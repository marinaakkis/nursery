# Reference: подписание УНЭП (усиленная неквалифицированная)

Подписание документов усиленной неквалифицированной электронной подписью (УНЭП) на стороне **сотрудника** (`X-Side: employee`). Метод определяется значением `UnepType` этапа (см. [reference.data-models.md](reference.data-models.md)). Эндпоинты доступны через шлюз `bcd-to-hrtek`. Формат — `skill.integration.ru.api-endpoint-doc`.

## Когда применять

| Признак | Значение |
|---|---|
| Тип подписи | УНЭП |
| Сторона | `employee` |
| Активное действие | `active_nodes[].action.type` ∈ `unep_sign` / `unep_sign_batch` |
| Метод (`UnepType`) | `kontur` (SMS-код), `cryptopro_simple` (без кода), `cryptopro_local` (base64-подпись), `goskey`, `disabled` (запрещено) |

## Эндпоинты

| N | Метод | Путь | Назначение | Тип вызова | Комментарий |
|---|---|---|---|---|---|
| 1 | `POST` | `/event/{event_id}/{node_id}/unep_sign/code` | Запрос SMS-кода (для `kontur`) | `sync-push` | Тела нет |
| 2 | `POST` | `/event/{event_id}/{node_id}/unep_sign` | Подписать документ УНЭП | `sync-push` | `UnepSignRequest` (multipart) |
| 3 | `POST` | `/event/{event_id}/unep_sign_batch/code` | Инициировать batch (SMS) | `sync-push` | `InitUnepSignBatchRequest` → `request_id` |
| 4 | `POST` | `/event/{event_id}/unep_sign_batch/{sign_request_id}` | Batch-подпись | `sync-push` | `UnepSignRequest` |
| 5 | `POST` | `/event/unep_sign_batch` | Batch-подпись (cryptopro_local) | `sync-push` | `UnepSignBatchRequest` |

## Модель UnepSignRequest (multipart/form-data)

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `attributes` | Атрибуты | multipart-поля | `attributes[<id>]` | Механизм — [reference.data-models.md](reference.data-models.md) «Передача атрибутов» |
| 2 | `code` | SMS-код | `string?` | — | Обязателен для `kontur`; не нужен для `cryptopro_simple` |
| 3 | `signatures` | Подписи (cryptopro_local) | `{}?` | — | `signatures[index] = { document_hash, signature }` |
| 3.1 | `document_hash` | Хэш документа | `string` | — | |
| 3.2 | `signature` | Значение подписи | `string` | base64 | Не реальное; в примерах — плейсхолдер |

## Поток (kontur — с SMS-кодом)

1. Убедиться, что активный этап — `unep_sign` и `UnepType = kontur` (из `GET /event/{event_id}`).
2. Запросить SMS-код → `POST /event/{event_id}/{node_id}/unep_sign/code` → `200`.
3. Подписать → `POST /event/{event_id}/{node_id}/unep_sign` (multipart: `attributes`, `code`) → `200`.
4. Проверить статус подписи → `GET /event/{event_id}` (`documents[].signatures[].status == signed`).

**Варианты:** `cryptopro_simple` — шаг 2 пропускается, `code` не передаётся. `cryptopro_local` — вместо `code` передаётся `signatures[index] = { document_hash, signature(base64) }`, где `document_hash` берётся из `GET /event/{event_id}/document/{document_id}/file/hash`, а `signature` формируется средствами КриптоПро/CSP на стороне клиента (вне API). `disabled` — подписание УНЭП недоступно.

```bash
# 2. Запрос SMS-кода (kontur)
curl -sS -X POST "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/event/<event-id>/<node-id>/unep_sign/code" \
  -H "Authorization: Bearer <access-token>" -H "X-User-Id: <user-id>" -H "X-Side: employee"

# 3. Подпись с кодом (код — фиктивный плейсхолдер)
curl -sS -X POST "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/event/<event-id>/<node-id>/unep_sign" \
  -H "Authorization: Bearer <access-token>" -H "X-User-Id: <user-id>" -H "X-Side: employee" \
  -F "code=<sms-code>"
  # + attributes[<attribute-uuid>] — если этап требует атрибутов (см. form_attributes)
# → 200
```

## Статусы

`200` — подписано (без тела). `400` — неверный/просроченный код или данные. `401`/`403` — авторизация. `404` — этап не найден. `500` — серверная ошибка. (`Error` — см. [reference.data-models.md](reference.data-models.md).)

> Источники истины: `public-api.openapi.yaml`. В официальном PDF `…/unep_sign_batch/code` помечен Deprecated, упоминается `…/unep_sign_batch/confirm` (отсутствует в YAML) — при реализации сверяться с OpenAPI.
