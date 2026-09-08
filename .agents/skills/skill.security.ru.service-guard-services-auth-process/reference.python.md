# Reference: Python

Пример самодостаточен: только публичные пакеты. Без зависимостей от внутренних корпоративных библиотек.

Зависимости: `httpx` (Consumer); `fastapi` + `pydantic` + `pyjwt[crypto]` (Provider).

Конфигурация читается из файла в типизированную модель (`pydantic`), а не из переменных окружения. Секрет (`client_secret`) подставляется из защищённого источника (секрет-менеджер / защищённая конфигурация развёртывания) и не хранится в репозитории.

## Модель конфигурации

```python
import json

from pydantic import BaseModel


class ServiceGuardConfig(BaseModel):
    base_url: str
    realm: str = "systems"      # зависит от окружения (test/prod)
    client_id: str
    client_secret: str          # из защищённого источника, не из репозитория
    provider_client_id: str     # свой client_id (Provider)


def load_config(path: str) -> ServiceGuardConfig:
    with open(path, encoding="utf-8") as config_file:
        return ServiceGuardConfig.model_validate(json.load(config_file))
```

## Consumer (`httpx` + кэш токена)

```python
import threading
import time

import httpx

TOKEN_EXPIRY_BUFFER_SECONDS = 60  # запас до фактического истечения (сеть + рассинхрон часов)


class ServiceGuardToken:
    """Кэширует client_credentials-токен и обновляет до истечения."""

    def __init__(self, config: ServiceGuardConfig) -> None:
        self._config = config
        self._access_token: str | None = None
        self._expires_at = 0.0
        self._lock = threading.Lock()

    def get(self) -> str:
        if self._access_token and time.monotonic() < self._expires_at:
            return self._access_token
        with self._lock:
            if self._access_token and time.monotonic() < self._expires_at:
                return self._access_token
            token_url = f"{self._config.base_url}/realms/{self._config.realm}/protocol/openid-connect/token"
            response = httpx.post(token_url, data={
                "grant_type": "client_credentials",
                "client_id": self._config.client_id,
                "client_secret": self._config.client_secret,
            })
            response.raise_for_status()
            payload = response.json()
            self._access_token = payload["access_token"]
            self._expires_at = time.monotonic() + payload["expires_in"] - TOKEN_EXPIRY_BUFFER_SECONDS
            return self._access_token


def get_employees(token: ServiceGuardToken, provider_url: str) -> httpx.Response:
    return httpx.get(
        f"{provider_url}/api/v1/employees",
        headers={"Authorization": f"Bearer {token.get()}"},
    )
```

## Provider (FastAPI + PyJWT + JWKS)

```python
import jwt  # pyjwt[crypto]
from fastapi import Depends, FastAPI, Header, HTTPException
from jwt import PyJWKClient

config = load_config("config.json")
ISSUER = f"{config.base_url}/realms/{config.realm}"
JWKS_URL = f"{config.base_url}/realms/{config.realm}/protocol/openid-connect/certs"
CLOCK_SKEW_SECONDS = 30  # допустимый рассинхрон часов при проверке exp

_jwks_client = PyJWKClient(JWKS_URL)  # кэширует ключи, ротация по kid


def _decode(token: str) -> dict:
    signing_key = _jwks_client.get_signing_key_from_jwt(token).key
    return jwt.decode(
        token,
        signing_key,
        algorithms=["RS256"],
        issuer=ISSUER,
        leeway=CLOCK_SKEW_SECONDS,
        options={"verify_aud": False, "require": ["exp", "iss"]},
    )


def require_role(required_role: str):
    def dependency(authorization: str = Header(default="")) -> dict:
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="missing bearer token")
        try:
            claims = _decode(authorization[len("Bearer "):])
        except jwt.PyJWTError:
            raise HTTPException(status_code=401, detail="invalid token")
        granted_roles = (
            claims.get("resource_access", {})
            .get(config.provider_client_id, {})
            .get("roles", [])
        )
        if required_role not in granted_roles:
            raise HTTPException(status_code=403, detail=f"missing role: {required_role}")
        return claims
    return dependency


app = FastAPI()


@app.get("/api/v1/employees")
def employees(_claims: dict = Depends(require_role("users"))):
    return {"data": []}
```

Примечания:
- `PyJWKClient` кэширует ключи; не запрашивает JWKS на каждый запрос.
- Нет/битый токен → `401`; валидный токен без нужной роли → `403`.

Поля и протокол — [reference.protocol.md](reference.protocol.md).
