# Reference: протокол Service-Guard (язык-агностично)

Источник истины по эндпоинтам, параметрам и форматам. Реальные хосты — плейсхолдеры; берутся из конфигурации окружения. Хост и realm Service-Guard зависят от окружения (test/prod) — берутся из конфигурации, не хардкодить; realm обозначен плейсхолдером `<service-guard-env-realm>` (обычно `systems`).

## Эндпоинты

| Назначение | Метод / путь |
|---|---|
| Получение токена | `POST ${SERVICE_GUARD_BASE_URL}/realms/<service-guard-env-realm>/protocol/openid-connect/token` |
| OIDC discovery | `GET ${SERVICE_GUARD_BASE_URL}/realms/<service-guard-env-realm>/.well-known/openid-configuration` |
| JWKS (ключи валидации) | `GET ${SERVICE_GUARD_BASE_URL}/realms/<service-guard-env-realm>/protocol/openid-connect/certs` |
| Issuer (`iss` в токене) | `${SERVICE_GUARD_BASE_URL}/realms/<service-guard-env-realm>` |

`token_endpoint` и `jwks_uri` можно не хардкодить, а читать из discovery-документа.

## Запрос токена (форма)

`Content-Type: application/x-www-form-urlencoded`

| Параметр | Значение | Обязателен |
|---|---|---|
| `grant_type` | `client_credentials` | да |
| `client_id` | идентификатор клиента Consumer | да |
| `client_secret` | секрет клиента (только из env) | да |
| `scope` | дополнительные scope (если требуются) | нет |

## Ответ (JSON)

| Поле | Тип | Назначение |
|---|---|---|
| `access_token` | string (JWT) | предъявляется в `Authorization: Bearer` |
| `expires_in` | int (сек) | TTL токена (пример: `36000` = 10 ч) |
| `token_type` | string | `Bearer` |
| `scope` | string | выданные scope |

Пример:

```json
{
  "access_token": "<access-token>",
  "expires_in": 36000,
  "token_type": "Bearer",
  "scope": "profile email"
}
```

## Клейм авторизации `resource_access`

Каноничный формат Keycloak (вложенный объект с массивом `roles` на каждый клиент):

```json
"resource_access": {
  "provider-service": { "roles": ["consumer-to-provider" ] },
  "<другой-провайдер>": { "roles": ["..."] }
}
```

Provider с `client_id = provider-service` авторизует запрос, если в `resource_access["provider-service"].roles` есть требуемая роль. Роли появляются в токене за счёт включения сервисного аккаунта Consumer в группу роли Provider (см. скилл `service-guard-clients-access-control`).

## Правила кэширования токена (Consumer)

- Хранить токен в памяти, переиспользовать до истечения.
- Обновлять заранее: за `30–60 c` до `expires_in` (буфер на сетевую задержку и рассинхрон часов).
- Потокобезопасный доступ к кэшу (один запрос на обновление, не «стадо»).
- При `401` от Provider — принудительно обновить токен и повторить запрос **один** раз.

## Валидация на стороне Provider

| Проверка | Правило | Код при провале |
|---|---|---|
| Подпись | по JWKS (`jwks_uri`), алгоритм RS256 | `401` |
| Issuer | `iss == ${SERVICE_GUARD_BASE_URL}/realms/<service-guard-env-realm>` | `401` |
| Срок | `exp` не истёк (учесть clock skew) | `401` |
| `azp` (опц.) | в allowlist ожидаемых вызывающих | `401`/`403` |
| Роль | `resource_access.<свой-client_id>.roles ∋ требуемая роль` | `403` |

JWKS кэшировать (с учётом ротации ключей по `kid`); не запрашивать на каждый запрос.

## Безопасность (чеклист протокола)

- `client_secret` и `access_token` — не логировать.
- Только HTTPS; проверка TLS-сертификата включена.
- Хосты/идентификаторы — из конфигурации развёртывания (типизированные модели / конфиг-файлы), не хардкодить корпоративные значения в коде.
