# Reference: не-HTTP и edge-кейсы

Ниже приведены примеры для случаев, где колонка `Метод / Операция` заполняется не как HTTP-метод.

## 1) gRPC (sync-pull)

| N | Метод / Операция | Путь | Описание | Content-Type запроса | Content-Type ответа | Тип вызова | Комментарий |
|---|---|---|---|---|---|---|---|
| 1 | `GetUser` | `UserService/GetUser` | Получение пользователя по идентификатору | `application/grpc+proto` | `application/grpc+proto` | `sync-pull` | Успех: `OK`; ошибки: `NOT_FOUND`, `UNAVAILABLE` |

## 2) Message Queue (async)

| N | Метод / Операция | Путь | Описание | Content-Type запроса | Content-Type ответа | Тип вызова | Комментарий |
|---|---|---|---|---|---|---|---|
| 1 | `Publish` | `orders.created` | Публикация события о создании заказа | `application/json` | — | `async` | Retry: 3, backoff 1s/2s/4s; DLQ: `orders.created.dlq` |
| 2 | `Subscribe` | `orders.created` | Обработка события на стороне потребителя | `application/json` | — | `async` | Идемпотентность по `eventId`; ошибки в DLQ |

## 3) Входящий webhook (ВнешняяСистема → НашаСистема)

| N | Метод / Операция | Путь | Описание | Content-Type запроса | Content-Type ответа | Тип вызова | Комментарий |
|---|---|---|---|---|---|---|---|
| 1 | `POST` | `/webhooks/payments/status` | Внешняя система присылает обновление статуса платежа | `application/json` | `application/json` | `async` | Направление: `ВнешняяСистема → НашаСистема`; успех: `200`; ошибки: `401`, `422` |
