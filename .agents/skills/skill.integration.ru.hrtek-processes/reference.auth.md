# Reference: авторизация при интеграции с VK HR Tek

HR-Tek-специфика модели авторизации. Runtime получения токена и процесс выдачи доступа **не дублируются** — см. кросс-ссылки на скиллы Service-Guard.

## Два звена авторизации

Авторизация состоит из двух независимых звеньев цепочки вызова (A и B):

| Звено | Механизм | Заголовок | Что проверяется |
|---|---|---|---|
| **A. Потребитель → шлюз** | Service-Guard OAuth2 `client_credentials` (Keycloak, realm `<service-guard-env-realm>`) | `Authorization: Bearer <access-token>` | Шлюз: `resource_access["esb-krakend"].roles` содержит `bcd-to-hrtek` |
| **B. Шлюз → VK HR Tek** | Токен, выданный VK (`<vk-hrtek-token>`) | `Authorization` (проставляет шлюз) | На стороне VK HR Tek; токен централизован, потребителю не виден |

> Потребитель работает **только** со звеном A. Токен VK HR Tek хранится и подставляется шлюзом — это и обеспечивает контроль распространения доступа к VK.

> **Зависимость от окружения:** хост Service-Guard (`<service-guard-host>`) и realm (`<service-guard-env-realm>`, обычно `systems`) берутся из конфигурации окружения и могут различаться в test/prod. В коде и URL не хардкодить — параметризовать.

## Получение токена потребителем

Потребитель получает JWT по гранту `client_credentials`. Токен **рекомендуется** кэшировать до `expires_in` (с буфером) и переиспользовать; допустимо и запрашивать токен на каждый вызов, но это менее эффективно (лишние обращения к Service-Guard). Полный runtime-процесс (запрос токена, кэширование, обогащение заголовка, повтор при `401`) — в скилле **`skill.security.ru.service-guard-services-auth-process`** (с примерами curl/Go/.NET/Python). Здесь не повторяется.

Кратко: `POST <service-guard-host>/realms/<service-guard-env-realm>/protocol/openid-connect/token`, `grant_type=client_credentials`, `client_id=<consumer-client-id>`, `client_secret=<consumer-client-secret>` → `access_token`. Далее — `Authorization: Bearer <access-token>` к шлюзу.

## Проверка на шлюзе и коды ответов

Шлюз `esb-krakend` валидирует JWT и проверяет роль `bcd-to-hrtek` в секции своего клиента:

```json
"resource_access": {
  "esb-krakend": { "roles": ["bcd-to-hrtek"] }
}
```

| Код | Условие |
|---|---|
| `401` | Токен отсутствует / невалиден / просрочен (аутентификация) — повтор имеет смысл с обновлённым токеном |
| `403` | Токен валиден, но роли `bcd-to-hrtek` нет (авторизация) — повтор бесполезен, нужен доступ |

> `403` со стороны VK HR Tek также возникает по бизнес-логике (например, отмена завершённой Заявки → `error_code = forbidden`) — это не про нехватку роли. Различать по контексту/телу ответа.

## Получение доступа `bcd-to-hrtek`

Клиент Service-Guard для системы-потребителя создаётся, и доступ `bcd-to-hrtek` выдаётся через корпоративный IaC (правка `client_system_access` клиента `esb-krakend`). **Процесс, роли, terragrunt и организационный запрос** — в скилле **`skill.security.ru.service-guard-clients-access-control`**. Здесь — только указатель.

Кратко: клиент потребителя — в `<gitlab-host>/iac/<systems-root>`; доступ — в конфигурации клиента `esb-krakend`; результат виден в JWT как `resource_access.esb-krakend.roles = ["bcd-to-hrtek"]`.

## Окружения

| Окружение | Отличия (описательно) |
|---|---|
| **test** | Отдельный базовый URL шлюза `<esb-krakend-host>` (тестовый), отдельный клиент Service-Guard и Ingress; отдельная конфигурация IaC (тестовый проект Service-Guard) |
| **prod** | Боевой `<esb-krakend-host>`, боевой клиент Service-Guard и Ingress; токен VK HR Tek — боевой (общий для подключённых орг-единиц) |

> Конкретные хосты, realm, имена клиентов и значения токенов — из конфигурации развёртывания (здесь — плейсхолдеры). В test и prod различаются базовые URL шлюза, хост/realm Service-Guard и клиенты Service-Guard; контракт API одинаков.

## Безопасность

- `client_secret`, `access_token`, токен VK HR Tek — **только** из env / секрет-менеджера; не в коде, логах, конфигах, git.
- Всегда HTTPS/TLS; не отключать проверку сертификатов.
- Токен кэшировать в памяти; не писать на диск/в общий кэш без шифрования.
- При `401` — один повтор с обновлением токена; при `403` — не повторять.

## Смежные скиллы

| Нужно | Скилл |
|---|---|
| Получение/кэширование `client_credentials` JWT, валидация, 401/403, примеры кода | `skill.security.ru.service-guard-services-auth-process` |
| Создание клиента Service-Guard, выдача доступа `bcd-to-hrtek` (IaC/Terragrunt, организационный запрос) | `skill.security.ru.service-guard-clients-access-control` |
