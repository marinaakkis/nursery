# Reference: подписание УКЭП (усиленная квалифицированная)

Подписание усиленной квалифицированной электронной подписью (УКЭП), как правило на стороне **компании** (`X-Side: company`). Используется отделённая (detached) подпись, закодированная в base64. Эндпоинты доступны через шлюз `bcd-to-hrtek`. Формат — `skill.integration.ru.api-endpoint-doc`.

## Когда применять

| Признак | Значение |
|---|---|
| Тип подписи | УКЭП |
| Сторона | `company` (типично) |
| Активное действие | `active_nodes[].action.type` ∈ `ukep_sign` / `ukep_sign_batch` |
| Особенность | Подпись формируется на стороне клиента (КриптоПро и т.п.), передаётся как base64 `hash`/`signature` |

## Эндпоинты

| N | Метод | Путь | Назначение | Тип вызова | Комментарий |
|---|---|---|---|---|---|
| 1 | `GET` | `/event/{event_id}/document/{document_id}/file/hash` | Хэш файла документа | `sync-pull` | Для формирования подписи |
| 2 | `POST` | `/event/{event_id}/{node_id}/ukep_sign` | Подписать документ УКЭП | `sync-push` | `UkepSignRequest` (multipart) |
| 3 | `POST` | `/event/ukep_sign_batch` | Batch-подпись УКЭП | `sync-push` | `UkepSignBatchRequest` (json) |

## Модели

### UkepSignRequest (multipart/form-data)

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `attributes` | Атрибуты | multipart-поля | `attributes[<id>]` | Механизм — [reference.data-models.md](reference.data-models.md) «Передача атрибутов» |
| 2 | `hash` | Значение подписи | `string` | base64 | Отделённая подпись (detached SIG), base64 |

### UkepSignBatchRequest (application/json)

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `params` | Список подписей | `[]{}` | — | |
| 1.1 | `event_id` | Заявка | `string` | GUID | |
| 1.2 | `node_id` | Этап | `string` | GUID | |
| 1.3 | `hash` | Значение подписи | `string` | base64 | |

## Поток

1. Получить документ для подписи: `GET …/document/{document_id}/file` (или хэш: `GET …/document/{document_id}/file/hash`).
2. Сформировать **отделённую** подпись средствами КриптоПро/CSP на стороне клиента.
3. Закодировать подпись в **base64**.
4. Отправить → `POST /event/{event_id}/{node_id}/ukep_sign` (multipart: `attributes`, `hash=<base64-подпись>`) → `200`. Для нескольких документов — `POST /event/ukep_sign_batch` (`params[]`).
5. Проверить статус → `GET /event/{event_id}` (`signatures[].status == signed`).

```bash
# 1. Хэш файла документа (при необходимости)
curl -sS "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/event/<event-id>/document/<document-id>/file/hash" \
  -H "Authorization: Bearer <access-token>" -H "X-User-Id: <user-id>" -H "X-Side: company"

# 4. Подпись УКЭП (значение base64 — фиктивный плейсхолдер)
curl -sS -X POST "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/event/<event-id>/<node-id>/ukep_sign" \
  -H "Authorization: Bearer <access-token>" -H "X-User-Id: <user-id>" -H "X-Side: company" \
  -F "hash=<base64-signature>"
  # + attributes[<attribute-uuid>] — если этап требует атрибутов (см. form_attributes)
# → 200
```

## Статусы

`200` — подписано. `400` — некорректная подпись/данные. `401`/`403` — авторизация. `404` — не найдено. `500` — серверная ошибка.

> ⚠ Реальные значения подписи/сертификатов — секреты; в документации и логах не воспроизводить. Источник истины контракта — `public-api.openapi.yaml`.
