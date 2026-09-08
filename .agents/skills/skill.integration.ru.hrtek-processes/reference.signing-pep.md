# Reference: подписание ПЭП (простая электронная подпись)

Подписание простой электронной подписью (ПЭП). Самый простой метод: подпись выполняется вызовом без криптографического тела. Эндпоинты доступны через шлюз `bcd-to-hrtek`. Формат — `skill.integration.ru.api-endpoint-doc`.

## Когда применять

| Признак | Значение |
|---|---|
| Тип подписи | ПЭП |
| Активное действие | `active_nodes[].action.type` ∈ `pep_sign` / `pep_sign_batch` |
| Особенность | Тело подписи не формируется на клиенте |

## Эндпоинты

| N | Метод | Путь | Назначение | Тип вызова | Комментарий |
|---|---|---|---|---|---|
| 1 | `POST` | `/event/{event_id}/{node_id}/pep_sign` | Подписать документ ПЭП | `sync-push` | Тела нет |
| 2 | `POST` | `/event/pep_sign_batch` | Batch-подпись ПЭП | `sync-push` | `PepSignBatchRequest` (json) |

## Модель PepSignBatchRequest (application/json)

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `params` | Список подписей | `[]{}` | — | |
| 1.1 | `event_id` | Заявка | `string` | GUID | |
| 1.2 | `node_id` | Этап | `string` | GUID | |

## Поток

1. Убедиться, что активный этап — `pep_sign` (из `GET /event/{event_id}`).
2. Подписать → `POST /event/{event_id}/{node_id}/pep_sign` (без тела) → `200`. Для нескольких — `POST /event/pep_sign_batch` (`params[]`).
3. Проверить статус → `GET /event/{event_id}` (`signatures[].status == signed`).

```bash
# 2. Подпись ПЭП (одиночная)
curl -sS -X POST "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/event/<event-id>/<node-id>/pep_sign" \
  -H "Authorization: Bearer <access-token>" -H "X-User-Id: <user-id>" -H "X-Side: employee"
# → 200

# Batch
curl -sS -X POST "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/event/pep_sign_batch" \
  -H "Authorization: Bearer <access-token>" -H "X-User-Id: <user-id>" -H "X-Side: employee" \
  -H "Content-Type: application/json" \
  -d '{ "params": [ { "event_id": "<event-id>", "node_id": "<node-id>" } ] }'
```

## Статусы

`200` — подписано. `400` — некорректные данные. `401`/`403` — авторизация. `404` — не найдено. `500` — серверная ошибка.

> Источник истины контракта — `public-api.openapi.yaml`.
