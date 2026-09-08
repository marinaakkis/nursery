# Reference: процессы интеграции с VK HR Tek (4 потока)

Обзорное описание взаимодействия по `skill.integration.ru.integration-doc`. Детали эндпоинтов — [reference.endpoints.md](reference.endpoints.md); модели — [reference.data-models.md](reference.data-models.md); авторизация — [reference.auth.md](reference.auth.md); подписание — `reference.signing-*.md`.

## Система-потребитель → VK HR Tek (через шлюз `bcd-to-hrtek`)

**Протокол:** REST, HTTPS

### Аутентификация и авторизация

| Параметр | Значение |
|---|---|
| Метод аутентификации | OAuth2 `client_credentials` (Service-Guard JWT), `Authorization: Bearer <access-token>` |
| Где хранятся credentials | Env / секрет-менеджер (`<consumer-client-secret>`) |
| Роли / доступы | `resource_access.esb-krakend` содержит роль `bcd-to-hrtek` |

### Надёжность

| Параметр | Значение |
|---|---|
| Таймаут запроса | Рекомендуется 10000–30000 мс (скачивание файлов — выше) |
| Retry | При `401` — 1 повтор с принудительным обновлением токена; при `5xx` — экспоненциальный backoff (по политике потребителя) |
| Circuit breaker | Рекомендуется для prod-нагрузки; порог — по политике потребителя |

> Идемпотентность на стороне API **не предусмотрена** (нет idempotency-ключей). Повтор `POST /event` создаст новую Заявку — контролировать на стороне потребителя.

### Эндпоинты

| N | Метод / Операция | Путь | Описание | Content-Type запроса | Content-Type ответа | Тип вызова | Комментарий |
|---|---|---|---|---|---|---|---|
| 1 | `GET` | `/user/by_snils` · `/user/by_personnel_number` | Резолв `X-User-Id` | — | `application/json` | `sync-pull` | 200/4xx/5xx |
| 2 | `GET` | `/user` | Получить `employee_id` | — | `application/json` | `sync-pull` | |
| 3 | `POST` | `/event` | Создать Заявку | `application/json` | `application/json` | `sync-push` | 200 → `event_id` |
| 4 | `GET` | `/event/{event_id}` | Статус Заявки | — | `application/json` | `sync-polling` | Поллинг до `completed` |
| 5 | `POST` | `/event/{event_id}/{node_id}/upload` | Загрузка документа | `multipart/form-data` | — | `sync-push` | 200 без тела |
| 6 | `GET` | `/event/cancel_reasons` | Причины отмены | — | `application/json` | `sync-pull` | |
| 7 | `POST` | `/event/{event_id}/cancel` | Отмена Заявки | `application/json` | `application/json` | `sync-push` | 200 / 403 forbidden |
| 8 | `GET` | `…/document/{document_id}/file_with_stamp` | Подписанный PDF | — | `application/pdf` | `sync-pull` | бинарь |

> Плейсхолдеры в curl: `<esb-krakend-host>`, `<access-token>`, `<user-id>`, `<event-id>`, `<node-id>`, `<document-id>`, `<event-type-id>`, `<employee-id>`. Фиктивные данные — `СНИЛС 123-456-789 00`, `Иван Иванов`. Реальные секреты/PII не использовать.

---

## Поток 1 — Запуск электронного подписания (создание документов)

**Триггер / предусловие:** инициатор запускает подписание для сотрудника; известны СНИЛС (или табельный номер + компания). Тип Заявки (`event_type_id`) берётся из `GET /event/create_options`. Получен токен Service-Guard.

**Шаги:**
1. **Резолв пользователя** → `GET /user/by_snils?snils=<snils>` (или `/user/by_personnel_number?personnel_number=<personnel-number>&company_id=<company-id>`) → `{ id }`. Далее `id` передаётся как `X-User-Id`.
2. **Получить сотрудника** → `GET /user` (заголовок `X-User-Id`) → `employees[].id` (= `employee_id`), `company.legal_id`.
3. **Создать Заявку** → `POST /event` (body `{ event_type_id, employee_id }`) → `{ event_id }`.
4. **Прочитать состояние** → `GET /event/{event_id}` → найти активный этап: элемент `active_nodes[]`, у которого `action.type == "upload"` (значение enum `Action.type`, означающее «ожидается загрузка документа»). Взять его `node_id`.
5. **Загрузить документ** → `POST /event/{event_id}/{node_id}/upload` (multipart: `document`, `attributes`) → `200`.
6. **Перечитать состояние** → `GET /event/{event_id}` — признак продвижения: в `active_nodes[]` больше нет узла с `action.type == "upload"` для этого `node_id`, а активным стал этап подписания (`action.type` ∈ `employee_sign` / `unep_sign` / `company_sign` / `ukep_sign` / `pep_sign`) либо `completed`.

**Терминал:** Заявка создана, документ загружен; процесс перешёл к подписанию.
**Граничные случаи:** `400` — неверный `event_type_id`/`employee_id`; `403` — нет прав/доступа; идемпотентности нет — не повторять `POST /event` вслепую.

```bash
# 1. Резолв пользователя по СНИЛС (фиктивный)
curl -sS "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/user/by_snils?snils=123-456-789%2000" \
  -H "Authorization: Bearer <access-token>" -H "Accept: application/json"
# → { "id": "<user-id>" }

# 2. Сотрудники пользователя
curl -sS "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/user" \
  -H "Authorization: Bearer <access-token>" -H "X-User-Id: <user-id>" -H "Accept: application/json"

# 3. Создать Заявку
curl -sS -X POST "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/event" \
  -H "Authorization: Bearer <access-token>" -H "X-User-Id: <user-id>" -H "X-Side: company" \
  -H "Content-Type: application/json" \
  -d '{ "event_type_id": "<event-type-id>", "employee_id": "<employee-id>" }'
# → { "event_id": "<event-id>" }

# 4. Прочитать состояние (узнать node_id и action.type)
curl -sS "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/event/<event-id>" \
  -H "Authorization: Bearer <access-token>" -H "X-User-Id: <user-id>" -H "X-Side: company"

# 5. Загрузить документ в активный этап
curl -sS -X POST "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/event/<event-id>/<node-id>/upload" \
  -H "Authorization: Bearer <access-token>" -H "X-User-Id: <user-id>" -H "X-Side: company" \
  -F "document=@/path/to/document.pdf"
# Атрибуты (если требуются form_attributes этапа) — отдельными полями:
#   -F 'attributes[<attribute-uuid>]=текстовое значение'   (для type=text)
#   -F 'attributes[<attribute-uuid>]=@/path/to/attr.pdf'   (для type=file)
# → 200 (без тела)
```

---

## Поток 2 — Контроль статуса подписания и получение подписанного файла

**Триггер / предусловие:** Заявка (`event_id`) существует и находится в подписании.

**Шаги:**
1. **Поллинг состояния** → `GET /event/{event_id}` (`sync-polling`) — повторять с интервалом.
2. **Ветвление:** когда `active_nodes[].action.type == completed` → подписание завершено; взять `document_id` из `documents[].id`.
3. **Скачать файл** → `GET /event/{event_id}/document/{document_id}/file_with_stamp` (`Accept: application/pdf`) → бинарный PDF (`200`).

**Терминал:** получен подписанный PDF — ответ возвращается как двоичные данные файла (`Content-Type: application/pdf`), не в виде base64-строки и не в JSON-обёртке.
**Граничные случаи:** статус долго не `completed` — продолжать поллинг с разумным интервалом/таймаутом; нет webhooks — только поллинг. Альтернатива скачивания — `documents[].url_with_stamp` или `…/zip`.

```bash
# 1. Поллинг (повторять до action.type == "completed")
curl -sS "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/event/<event-id>" \
  -H "Authorization: Bearer <access-token>" -H "X-User-Id: <user-id>" -H "X-Side: company"

# 3. Скачать подписанный PDF
curl -sS "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/event/<event-id>/document/<document-id>/file_with_stamp" \
  -H "Authorization: Bearer <access-token>" -H "X-User-Id: <user-id>" -H "X-Side: company" \
  -H "Accept: application/pdf" -o signed.pdf
```

---

## Поток 3 — Отмена Заявки, не завершённой в VK (успех)

**Триггер / предусловие:** Заявка не завершена; `permissions.cancel == true` (из `GET /event/{event_id}`).

**Шаги:**
1. *(опционально)* `GET /event/cancel_reasons` → выбрать `reason_id`.
2. **Отмена** → `POST /event/{event_id}/cancel` (body `{ reason_id, comment? }`) → `{ event_id }`.
3. **Итог:** Заявка переходит в `action.type = canceled`.

**Терминал:** `200`, `{ event_id }`, состояние `canceled`.

```bash
curl -sS -X POST "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/event/<event-id>/cancel" \
  -H "Authorization: Bearer <access-token>" -H "X-User-Id: <user-id>" -H "X-Side: company" \
  -H "Content-Type: application/json" \
  -d '{ "reason_id": 4 }'
# → { "event_id": "<event-id>" }
```

---

## Поток 4 — Отмена Заявки, уже завершённой в VK (запрет)

**Триггер / предусловие:** Заявка уже завершена.

**Шаги:**
1. **Та же отмена** → `POST /event/{event_id}/cancel` — идентичные эндпоинт, заголовки и тело, что и в Потоке 3.
2. **Итог:** отказ — `error_code = forbidden` (HTTP `403`).

**Ключевое отличие П3/П4:** различается только ответ (`canceled` vs `forbidden`). Эндпоинт/метод/тело идентичны. Предпроверка — `permissions.cancel` в `GET /event/{event_id}` (если `false` — отмену не выполнять).

```bash
# Тот же запрос; для завершённой Заявки вернётся 403 с error_code=forbidden
curl -sS -i -X POST "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/event/<event-id>/cancel" \
  -H "Authorization: Bearer <access-token>" -H "X-User-Id: <user-id>" -H "X-Side: company" \
  -H "Content-Type: application/json" \
  -d '{ "reason_id": 4 }'
# → HTTP/1.1 403 ; { "code": <code>, "message": "...", "data": { "error_code": "forbidden" } }
```

---

## Граничные условия (сводно)

| # | Условие | Влияние на реализацию |
|---|---|---|
| 1 | Поллинг (нет webhooks) | Статус только через периодический `GET /event/{event_id}` |
| 2 | Нет идемпотентности | Не повторять `POST /event`/`cancel` вслепую; контроль на стороне потребителя |
| 3 | Cancel завершённой = `forbidden` (403) | Предпроверять `permissions.cancel` |
| 4 | Бинарные файлы | `file_with_stamp`/`file` → `application/pdf`; `zip` → `application/zip`; не base64 |
| 5 | base64 в подписях | Только для УКЭП/CryptoPro Local (см. `reference.signing-*`) |
| 6 | Multipart-конвенция | Атрибуты — поля `attributes[<attribute-uuid>]` |
| 7 | Версия пути | Шлюз — `api/v1.0`; официальный API — `api/v1` |
