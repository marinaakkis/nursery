# Reference: curl

Плейсхолдеры берутся из окружения. Секрет — только из env, не вставлять в командную строку в открытом виде в shared-окружениях (он попадает в history).

## Переменные окружения

```bash
export SERVICE_GUARD_BASE_URL="https://<service-guard-host-test>"   # test; prod — свой хост
export SERVICE_GUARD_REALM="<service-guard-env-realm>"             # зависит от окружения, обычно systems
export SERVICE_GUARD_CLIENT_ID="<consumer>-service"
export SERVICE_GUARD_CLIENT_SECRET="<из секрет-менеджера>"          # никогда не коммитить
```

## 1. Получение токена (client_credentials)

```bash
curl --silent --location \
  --request POST "${SERVICE_GUARD_BASE_URL}/realms/${SERVICE_GUARD_REALM}/protocol/openid-connect/token" \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=client_credentials' \
  --data-urlencode "client_id=${SERVICE_GUARD_CLIENT_ID}" \
  --data-urlencode "client_secret=${SERVICE_GUARD_CLIENT_SECRET}"
```

Ответ — JSON с `access_token`. Извлечь токен в переменную (через `jq`):

```bash
ACCESS_TOKEN=$(curl --silent --location \
  --request POST "${SERVICE_GUARD_BASE_URL}/realms/${SERVICE_GUARD_REALM}/protocol/openid-connect/token" \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=client_credentials' \
  --data-urlencode "client_id=${SERVICE_GUARD_CLIENT_ID}" \
  --data-urlencode "client_secret=${SERVICE_GUARD_CLIENT_SECRET}" \
  | jq -r '.access_token')
```

## 2. Основной запрос с токеном

```bash
curl --silent --location \
  --request GET "https://<provider-host>/api/v1/employees" \
  --header "Authorization: Bearer ${ACCESS_TOKEN}"
```

## 3. Диагностика

- Просмотреть содержимое JWT (без проверки подписи) — вставить `access_token` на `jwt.io` или декодировать payload локально; проверить клейм `resource_access`.
- `401` — токен отсутствует/просрочен/невалидная подпись (повторить с новым токеном).
- `403` — токен валиден, но нет нужной роли в `resource_access.<provider-client_id>.roles` (нужна заявка на доступ — см. скилл `service-guard-clients-access-control`).

Эндпоинты и поля — [reference.protocol.md](reference.protocol.md).
