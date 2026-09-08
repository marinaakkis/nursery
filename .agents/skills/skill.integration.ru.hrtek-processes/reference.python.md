# Reference: базовый процесс на Python

Сквозной пример через шлюз `bcd-to-hrtek`. Базовые/популярные средства: `httpx`. Секреты — из env; хосты — плейсхолдеры. Детали токена — [reference.auth.md](reference.auth.md); процессы — [reference.flows.md](reference.flows.md).

## Клиент с кэшем токена Service-Guard

```python
import os, time, httpx
from dataclasses import dataclass

@dataclass
class HrTekConfig:
    gateway_base_url: str   # https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0
    token_url: str          # https://<service-guard-host>/realms/<service-guard-env-realm>/protocol/openid-connect/token
    client_id: str          # <consumer-client-id>
    client_secret: str      # из env, не хардкодить
    side: str = "company"   # "company" | "employee"

class HrTekClient:
    def __init__(self, cfg: HrTekConfig):
        self._cfg = cfg
        self._client = httpx.Client(base_url=cfg.gateway_base_url, timeout=30.0)
        self._token: str | None = None
        self._exp: float = 0.0

    def _access_token(self, force: bool = False) -> str:
        if not force and self._token and time.time() < self._exp:
            return self._token
        r = httpx.post(self._cfg.token_url, data={
            "grant_type": "client_credentials",
            "client_id": self._cfg.client_id,
            "client_secret": self._cfg.client_secret,  # из защищённого источника
        }, timeout=15.0)
        r.raise_for_status()
        tok = r.json()
        self._token = tok["access_token"]
        self._exp = time.time() + tok["expires_in"] - 60  # буфер 60с
        return self._token

    def _headers(self, user_id: str | None) -> dict:
        h = {"Authorization": f"Bearer {self._access_token()}", "X-Side": self._cfg.side}
        if user_id:
            h["X-User-Id"] = user_id
        return h

    def _request(self, method: str, path: str, user_id: str | None = None, **kw) -> httpx.Response:
        resp = self._client.request(method, path, headers={**self._headers(user_id), **kw.pop("headers", {})}, **kw)
        if resp.status_code == 401:  # один повтор с обновлённым токеном
            h = {**self._headers(user_id), "Authorization": f"Bearer {self._access_token(force=True)}"}
            resp = self._client.request(method, path, headers=h, **kw)
        return resp
```

## Шаги базового процесса

```python
    def resolve_user_by_snils(self, snils: str) -> str:
        r = self._request("GET", "/user/by_snils", params={"snils": snils})
        r.raise_for_status()
        return r.json()["id"]

    def create_event(self, user_id: str, event_type_id: str, employee_id: str) -> str:
        r = self._request("POST", "/event", user_id=user_id,
                           json={"event_type_id": event_type_id, "employee_id": employee_id})
        r.raise_for_status()
        return r.json()["event_id"]

    def get_event(self, user_id: str, event_id: str) -> dict:
        r = self._request("GET", f"/event/{event_id}", user_id=user_id)
        r.raise_for_status()
        return r.json()

    def upload_document(self, user_id: str, event_id: str, node_id: str, file_path: str) -> None:
        with open(file_path, "rb") as f:
            # Атрибуты этапа (по form_attributes) — отдельными полями attributes[<uuid>]:
            #   data={f"attributes[{attr_uuid}]": "текстовое значение"}            # type=text
            #   files={..., f"attributes[{attr_uuid}]": ("attr.pdf", attr_bytes)}  # type=file
            # Если этап атрибутов не требует — доп. data/files не передаются.
            r = self._request("POST", f"/event/{event_id}/{node_id}/upload", user_id=user_id,
                              files={"document": ("document.pdf", f, "application/pdf")})
        r.raise_for_status()

    def cancel_event(self, user_id: str, event_id: str, reason_id: int) -> bool:
        """True — отменена; False — завершённая Заявка (403 forbidden)."""
        r = self._request("POST", f"/event/{event_id}/cancel", user_id=user_id, json={"reason_id": reason_id})
        if r.status_code == 403:
            return False
        r.raise_for_status()
        return True

    def download_signed_pdf(self, user_id: str, event_id: str, document_id: str, out_path: str) -> None:
        r = self._request("GET", f"/event/{event_id}/document/{document_id}/file_with_stamp",
                          user_id=user_id, headers={"Accept": "application/pdf"})
        r.raise_for_status()
        with open(out_path, "wb") as f:
            f.write(r.content)
```

## Оркестрация (запуск → поллинг → файл)

```python
    def run_signing(self, snils: str, event_type_id: str, employee_id: str, doc_path: str, out_path: str) -> None:
        user_id = self.resolve_user_by_snils(snils)
        event_id = self.create_event(user_id, event_type_id, employee_id)

        state = self.get_event(user_id, event_id)
        node_id = next(n["node_id"] for n in state["active_nodes"] if n["action"]["type"] == "upload")
        self.upload_document(user_id, event_id, node_id, doc_path)

        # Поллинг до completed (нет webhooks)
        deadline = time.time() + 30 * 60
        document_id = None
        while time.time() < deadline:
            state = self.get_event(user_id, event_id)
            if any(n["action"]["type"] == "completed" for n in state["active_nodes"]):
                document_id = state["documents"][0]["id"]
                break
            time.sleep(15)
        if document_id is None:
            raise TimeoutError("Подписание не завершено за отведённое время")

        self.download_signed_pdf(user_id, event_id, document_id, out_path)

# Пример: client_secret из env
# cfg = HrTekConfig(gateway_base_url="https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0",
#                   token_url="https://<service-guard-host>/realms/<service-guard-env-realm>/protocol/openid-connect/token",
#                   client_id="<consumer-client-id>", client_secret=os.environ["HRTEK_SG_CLIENT_SECRET"])
```

> Секреты — только из env/секрет-менеджера. 401 — один повтор; 403 — нехватка роли (или `forbidden` при cancel завершённой). Подписание — `reference.signing-*.md`. Для async-сценариев — `httpx.AsyncClient` по тому же контракту.
