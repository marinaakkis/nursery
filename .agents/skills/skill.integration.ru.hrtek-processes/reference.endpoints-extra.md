# Reference: прочие эндпоинты VK HR Tek (кратко)

Краткий перечень эндпоинтов API VK HR Tek, **не входящих** в основные задокументированные процессы (те описаны полно в [reference.endpoints.md](reference.endpoints.md)). Здесь — назначение и паттерн; **полная документация (параметры, схемы, статусы) — в официальном `public-api.openapi.yaml`** (`https://public-api.vkdoc.mail.ru/api/v1`).

> Все эндпоинты доступны через шлюз `bcd-to-hrtek` в режиме pass-through (`<esb-krakend-host>/bcd-to-hrtek/api/v1.0/...`). Маршрутизация конкретного пути на шлюзе — зона ответственности DevOps (см. [reference.auth.md](reference.auth.md)).

## Работа с документами и этапами

| N | Метод | Путь | Назначение | Тип вызова | Комментарий |
|---|---|---|---|---|---|
| 1 | `PUT` | `/event/{event_id}/{node_id}/generate_document_from_template/preview` | Предпросмотр генерации документа из шаблона | `sync-pull` | Ответ `application/pdf` |
| 2 | `POST` | `/event/{event_id}/{node_id}/generate_document_from_template` | Генерация документа из шаблона | `sync-push` | Альтернатива `upload` |
| 3 | `POST` | `/event/{event_id}/{node_id}/accept` | Принять/подтвердить этап | `sync-push` | |
| 4 | `POST` | `/event/{event_id}/{node_id}/decline` | Отклонить этап | `sync-push` | `multipart` |
| 5 | `POST` | `/event/{event_id}/{node_id}/decline_sign` | Отказ от подписания | `sync-push` | `comment` обязателен |
| 6 | `POST` | `/event/{event_id}/{node_id}/return` | Вернуть на доработку | `sync-push` | `comment` обязателен |
| 7 | `POST` | `/event/{event_id}/restore` | Восстановить отменённую Заявку | `sync-push` | Обратна `cancel` |

## Файлы документов

| N | Метод | Путь | Назначение | Тип вызова | Комментарий |
|---|---|---|---|---|---|
| 8 | `GET` | `/event/{event_id}/document/{document_id}/file` | Скачать документ (PDF, без штампа) | `sync-pull` | `application/pdf` |
| 9 | `GET` | `/event/{event_id}/document/{document_id}/zip` | Скачать архив (документ + подписи) | `sync-pull` | `application/zip` |
| 10 | `GET` | `/event/{event_id}/document/{document_id}/file/hash` | Хэш файла документа | `sync-pull` | Для УКЭП |
| 11 | `POST` | `/event/{event_id}/document/{document_id}/mark_read` | Отметить документ прочитанным | `sync-push` | Только сторона `employee` |
| 12 | `GET` | `/event/{event_id}/attribute/{attribute_id}/file` | Скачать файл атрибута | `sync-pull` | `image/*` или `application/pdf` |

## Списки и экспорт

| N | Метод | Путь | Назначение | Тип вызова | Комментарий |
|---|---|---|---|---|---|
| 13 | `POST` | `/event/list` | Список Заявок (фильтры, пагинация) | `sync-pull` | Тело `EventListRequest` |
| 14 | `GET` | `/event/available_filters` | Доступные фильтры списка | `sync-pull` | |
| 15 | `POST` | `/event/export` | Async-экспорт Заявок/документов | `async` | Возвращает `file_request_id` |
| 16 | `GET` | `/file_request/{file_request_id}` | Статус async-запроса файла | `sync-polling` | Поллинг до `status=done` |
| 17 | `GET` | `/file_request/{file_request_id}/download` | Скачать файл по запросу | `sync-pull` | `application/zip`/xlsx |

## Сотрудники

| N | Метод | Путь | Назначение | Тип вызова | Комментарий |
|---|---|---|---|---|---|
| 18 | `POST` | `/employee` | Создать/обновить сотрудника | `sync-push` | Тело `EmployeeCreateRequest` |

## Подписание

Эндпоинты подписания (УНЭП/УКЭП/ПЭП и их batch-варианты) вынесены в отдельные reference:
- [reference.signing-unep.md](reference.signing-unep.md) — УНЭП (`…/unep_sign`, `…/unep_sign/code`, batch);
- [reference.signing-ukep.md](reference.signing-ukep.md) — УКЭП (`…/ukep_sign`, `/event/ukep_sign_batch`);
- [reference.signing-pep.md](reference.signing-pep.md) — ПЭП (`…/pep_sign`, `/event/pep_sign_batch`).

---

> Параметры, модели тел и полный перечень статусов для всех перечисленных эндпоинтов — в `public-api.openapi.yaml`. Формат описания при необходимости детализации — `skill.integration.ru.api-endpoint-doc`.
