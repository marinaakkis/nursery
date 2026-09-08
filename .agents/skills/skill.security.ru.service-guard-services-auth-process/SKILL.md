---
name: service-guard-services-auth-process
description: >-
  Implements service-to-service authentication and authorization through Service-Guard
  (Keycloak OAuth2.0 client_credentials): a Consumer obtains a JWT access token, attaches it
  as an Authorization Bearer header, and calls a Provider; the Provider validates the token
  (signature via JWKS, issuer, expiry, azp) and enforces roles from the resource_access claim.
  Use when integrating two backend services via Service-Guard, obtaining or caching a
  client_credentials JWT, enriching the Authorization header, validating a JWT, checking
  resource_access roles, or implementing 401-vs-403 logic. Ships reference code for curl,
  Go (Gin), .NET (ASP.NET Core) and Python (FastAPI).
---

# Межсервисная аутентификация и авторизация через Service-Guard

Service-Guard — это корпоративный OAuth2.0 Access Token Provider на базе Keycloak (realm `<service-guard-env-realm>`, обычно `systems`). Сервис получает от своего имени JWT-токен доступа по grant'у `client_credentials` (Service Account) и предъявляет его другому сервису для межсервисного вызова. Авторизация выполняется по клейму `resource_access`: какие роли выданы клиенту-вызывающему на клиента-получателя.

Скилл описывает **runtime-процесс**: как Consumer получает и использует токен и как Provider его валидирует и проверяет роли. Создание клиентов и выдача доступов — отдельный процесс, см. скилл `service-guard-clients-access-control`.

**Приоритет и безопасность:** секреты (`client_secret`) передаются и хранятся **только** через переменные окружения / секрет-менеджер — никогда в коде, логах, конфигах или git. Хост и realm Service-Guard зависят от окружения (test/stage/prod) — берутся из конфигурации, не хардкодить. Корпоративные хосты в этом скилле даны плейсхолдерами; реальные значения берутся из конфигурации окружения. При конфликте с локальными правилами стиля — правила безопасности (`rule.security.en.corporate-dlp`) приоритетнее.

Детальные примеры кода — в reference-файлах (ссылки в конце).

## Когда применять и границы

| Применять | НЕ применять | Примечание |
|---|---|---|
| Бэкенд-сервис A (consumer) вызывает бэкенд-сервис B (provider) внутри компании | Браузерная/пользовательская аутентификация (Authorization Code, SSO) — см. `skill.security.en.keycloak-sso-scaffold`, `skill.security.en.fastapi-react-keycloak-auth` | s2s-вызов от имени сервиса, без участия пользователя |
| Нужен JWT по `client_credentials` (от имени сервиса) | mTLS / Basic Auth / API key (Service-Guard их в данном процессе не использует) | Service-Guard выдаёт только `client_credentials` JWT |
| Нужно проверить роли вызывающего сервиса (`resource_access`) | Проектирование схемы интеграции — см. `skill.integration-design.ru.phase-2-architecture` | Этот скилл — про реализацию, не про проектирование |

**Предусловие:** для Consumer и Provider уже созданы клиенты Service-Guard и выданы доступы; Consumer получил `client_id`/`client_secret`. Если нет — сначала пройдите процесс в скилле `service-guard-clients-access-control`.

## Модель: client_credentials + resource_access

| Роль | Что делает |
|---|---|
| **Consumer** (клиент-потребитель) | Получает JWT в Service-Guard по `client_credentials`, кладёт его в `Authorization: Bearer`, вызывает Provider |
| **Service-Guard** (Keycloak, realm `<service-guard-env-realm>`, обычно `systems`) | Выдаёт подписанный JWT; публикует JWKS и OIDC discovery |
| **Provider** (клиент-поставщик) | Валидирует JWT и проверяет, что в `resource_access.<client-id-провайдера>.roles` есть требуемая роль |

Клейм `resource_access` в выданном токене (каноничный формат Keycloak):

```json
"resource_access": {
  "provider-service": { "roles": ["consumer-to-provider"] }
}
```

Здесь Provider — клиент `provider-service`; вызывающему сервису (Consumer) выданы роли `consumer-to-provider` на `provider-service`. Provider проверяет наличие нужной роли именно в секции своего `client_id`.

## Поток Consumer (получение и использование токена)

1. **Запрос токена:** `POST <base-url>/realms/<service-guard-env-realm>/protocol/openid-connect/token`, `Content-Type: application/x-www-form-urlencoded`, тело `grant_type=client_credentials&client_id=...&client_secret=...`.
2. **Кэширование:** ответ содержит `access_token` и `expires_in` (секунды). Кэшировать токен в памяти и переиспользовать до истечения с буфером (например, обновлять за 30–60 с до `expires_in`). Не запрашивать новый токен на каждый вызов.
3. **Обогащение заголовка:** к основному запросу добавить `Authorization: Bearer <access_token>`.
4. **Вызов Provider** и обработка ответа: при `401` — один повтор с принудительно обновлённым токеном, затем ошибка; `403` — недостаточно прав (роль не выдана), повтор бесполезен.

Минимальный пример получения токена — в [reference.curl.md](reference.curl.md). Реализации: [reference.go.md](reference.go.md), [reference.dotnet.md](reference.dotnet.md), [reference.python.md](reference.python.md). Поля и протокол — [reference.protocol.md](reference.protocol.md).

## Валидация Provider (аутентификация + авторизация)

| Шаг | Проверка | Ошибка |
|---|---|---|
| 1 | Подпись токена по JWKS (`<base-url>/realms/<service-guard-env-realm>/protocol/openid-connect/certs`) | `401` |
| 2 | `iss == <base-url>/realms/<service-guard-env-realm>`, токен не истёк (`exp`), `typ`/алгоритм корректны | `401` |
| 3 | (опц.) `azp` — ожидаемый client_id вызывающего, если нужен allowlist | `401`/`403` |
| 4 | `resource_access.<свой-client_id>.roles` содержит требуемую роль | `403` |

Ключевое различие: **`401`** — токен невалиден/отсутствует/просрочен (аутентификация); **`403`** — токен валиден, но роли не хватает (авторизация). JWKS кэшируется библиотекой; не ходить за ключами на каждый запрос.

## Конфигурация

Значения берутся из **типизированной конфигурации** (файл конфигурации + модель), а не из переменных окружения напрямую (примеры — в reference-файлах). Секрет — из защищённого источника (секрет-менеджер / защищённая конфигурация развёртывания). Хост и realm Service-Guard зависят от окружения (test/prod) — берутся из конфигурации, не хардкодить (здесь плейсхолдеры).

| Ключ конфигурации | Назначение | Пример (плейсхолдер) |
|---|---|---|
| `BaseUrl` | Базовый URL Service-Guard | test: `https://<service-guard-host-test>` · prod: `https://<service-guard-host-prod>` |
| `Realm` | Realm — зависит от окружения (обычно `systems`) | `<service-guard-env-realm>` |
| Token endpoint | Получение токена | `<base-url>/realms/<service-guard-env-realm>/protocol/openid-connect/token` |
| OIDC discovery | Автообнаружение эндпоинтов | `<base-url>/realms/<service-guard-env-realm>/.well-known/openid-configuration` |
| JWKS | Ключи валидации (Provider) | `<base-url>/realms/<service-guard-env-realm>/protocol/openid-connect/certs` |
| `ClientId` | client_id (Consumer) | `<consumer>-service` |
| `ClientSecret` | client_secret (Consumer) — из защищённого источника | `[REDACTED]` |
| `ProviderClientId` | свой client_id (Provider) | `provider-service` |

## Безопасность

- **Секреты — только из защищённого источника** (секрет-менеджер / защищённая конфигурация), не в репозитории. Не логировать `client_secret` и сам `access_token`.
- Токен кэшировать в памяти процесса; не писать на диск, не класть в общий кэш без шифрования.
- Всегда HTTPS/TLS; не отключать проверку сертификатов.
- Один повтор при `401` с обновлением токена; без бесконечных циклов.
- Provider валидирует подпись по JWKS, а не «доверяет» содержимому токена.

## Reference-файлы

| Файл | Содержание |
|---|---|
| [reference.protocol.md](reference.protocol.md) | Эндпоинты, параметры, формат ответа, `resource_access`, правила кэша — источник истины |
| [reference.curl.md](reference.curl.md) | curl: получение токена + вызов с Bearer |
| [reference.go.md](reference.go.md) | Go: Consumer (`oauth2/clientcredentials`) + Provider (Gin + `golang-jwt` + JWKS) |
| [reference.dotnet.md](reference.dotnet.md) | .NET: Consumer (`IHttpClientFactory` + `DelegatingHandler`) + Provider (ASP.NET Core `JwtBearer`) |
| [reference.python.md](reference.python.md) | Python: Consumer (`httpx`) + Provider (FastAPI + `PyJWT` + JWKS) |

## Перед сдачей (чеклист)

1. [ ] Получение токена использует `client_credentials`; `client_secret` читается из env.
2. [ ] Токен кэшируется и переиспользуется до `expires_in` с буфером.
3. [ ] Основной запрос содержит `Authorization: Bearer <token>`.
4. [ ] Provider валидирует подпись (JWKS), `iss`, `exp` до проверки ролей.
5. [ ] Авторизация проверяет роль в `resource_access.<свой-client_id>.roles`.
6. [ ] Разделены `401` (аутентификация) и `403` (авторизация); при `401` — один повтор.
7. [ ] Нет секретов/токенов в логах; используются плейсхолдеры/env для хостов и кред.
