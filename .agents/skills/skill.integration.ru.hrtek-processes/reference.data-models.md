# Reference: модели данных и перечисления VK HR Tek

Модели данных базового процесса — по `skill.dev.ru.data-model-table` (стратегия A, N-нумерация вложенности; `?` — nullable/optional). Перечисления — по `skill.dev.ru.enum-doc`. Полный контракт — `public-api.openapi.yaml`.

> Именование полей — `snake_case` (как в контракте VK HR Tek). PII-поля помечены; в примерах используются фиктивные значения (см. [SKILL.md](SKILL.md) и единый набор плейсхолдеров).

## Сущности

### Event (Заявка)

Центральная сущность процесса; `event_id` — корреляционный идентификатор. Ответ `GET /event/{event_id}`.

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `id` | Идентификатор Заявки | `string` | GUID | |
| 2 | `event_type` | Тип Заявки | `EventTypeItem` | — | `{ id, name }` |
| 3 | `employee` | Сотрудник | `EventEmployee?` | — | PII (см. ниже) |
| 4 | `company` | Компания | `CompanyItem` | — | `{ id, name }` |
| 5 | `created_at` | Дата создания | `string` | ISO 8601 | |
| 6 | `active_nodes` | Активные этапы | `[]ActiveNode` | — | Текущие действия |
| 7 | `nodes` | Все этапы | `[]EventNode?` | — | |
| 8 | `documents` | Документы | `[]Document` | — | |
| 9 | `attributes` | Атрибуты | `[]Attribute` | — | Полиморфные |
| 10 | `permissions` | Разрешённые действия | `{}` | — | |
| 10.1 | `cancel` | Можно отменить | `bool` | — | Предпроверка перед `cancel` |
| 10.2 | `restore` | Можно восстановить | `bool` | — | |
| 11 | `canceled` | Детали отмены | `CanceledDetails?` | — | Заполнено после отмены |
| 12 | `deadline` | Дедлайн Заявки | `string?` | ISO 8601 | |

### ActiveNode / Action

Активный этап и его действие. По `action.type` определяется текущее состояние процесса.

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `action` | Действие этапа | `{}` | — | |
| 1.1 | `name` | Название действия | `string` | — | |
| 1.2 | `type` | Тип действия | `string` | enum `Action.type` | Ключ ветвления процесса |
| 2 | `responsible` | Ответственная сторона | `string` | — | |
| 3 | `document_type_name` | Тип документа этапа | `string` | — | |

### EventNode

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `node_id` | Идентификатор этапа | `string` | GUID | → path `node_id` для `upload`/подписания |
| 2 | `name` | Название этапа | `string` | — | |
| 3 | `actions` | Действия этапа | `[]NodeAction` | — | |
| 4 | `deadline` | Дедлайн этапа | `string?` | ISO 8601 | |

### Document

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `id` | Идентификатор документа | `string` | GUID | → path `document_id` |
| 2 | `document_type_name` | Тип документа | `string` | — | |
| 3 | `url` | URL документа | `string` | — | |
| 4 | `url_with_stamp` | URL с визуализацией подписей | `string` | — | Альтернатива `…/file_with_stamp` |
| 5 | `url_zip` | URL архива (документ + подписи) | `string` | — | |
| 6 | `signatures` | Подписи | `[]DocumentSignature` | — | |
| 7 | `read_at` | Когда прочитан | `string?` | ISO 8601 | |

### DocumentSignature

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `signed_by` | Подписант | `string` | — | |
| 2 | `signed_by_name` | Имя подписанта | `string?` | — | **PII** |
| 3 | `status` | Статус подписи | `string` | enum `SignatureStatus` | |

### Attribute (полиморфный)

`oneOf(AttributeValueString, AttributeValueFileMultiple)`. Тип значения — в поле `type`.

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `id` | Идентификатор атрибута | `string` | GUID | |
| 2 | `type` | Тип атрибута | `string` | enum | `text, textarea, date, file, choice, year, file_multiple` |
| 3 | `name` | Название | `string` | — | |
| 4 | `value` | Значение | `string \| []AttributeValueFile` | — | Зависит от `type` |

### EventEmployee (PII)

⚠ Содержит персональные данные. Не воспроизводить реальные значения; в примерах — фиктивные.

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `id` | Идентификатор сотрудника | `string` | GUID | → `employee_id` |
| 2 | `personnel_number` | Табельный (внешний) номер | `string` | — | ≤36 |
| 3 | `display_number` | Табельный для отображения | `string` | — | ≤36 |
| 4 | `first_name` | Имя | `string` | — | **PII** |
| 5 | `second_name` | Фамилия | `string` | — | **PII** |
| 6 | `middle_name` | Отчество | `string` | — | **PII** |
| 7 | `birthday` | Дата рождения | `string` | date | **PII** |
| 8 | `dismissed_at` | Дата увольнения | `string?` | date | **PII** |

---

## Модели запросов

### CreateEventRequest

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `event_type_id` | Тип Заявки | `string` | GUID | Обязателен |
| 2 | `employee_id` | Сотрудник | `string?` | GUID | |
| 3 | `participants` | Участники | `[]CreateEventParticipant?` | — | Назначение групп на роли; только для типов Заявок с настраиваемыми участниками. Допустимые значения — из `/event/create_options/event_type/participant_options` |
| 3.1 | `role_id` | Роль | `string` | GUID | Роль в типе Заявки; обязателен в участнике |
| 3.2 | `group_id` | Группа | `string` | GUID | Назначаемая на роль группа/подразделение; обязателен в участнике |
| 4 | `deadlines` | Дедлайны этапов | `[]{}?` | — | `{ node_id, deadline }` |

### UploadRequest (multipart/form-data)

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `document` | Файл документа | `string` | binary | Обязателен |
| 2 | `attributes` | Атрибуты | multipart-поля | `attributes[<attribute-uuid>]` | НЕ один JSON-блок: отдельное form-поле на атрибут; значение `file`/`text`/`[]file` (по `form_attributes` этапа). Если атрибутов нет — поля не добавляются |
| 3 | `document_date` | Дата документа | `string?` | date | |
| 4 | `document_number` | Номер документа | `string?` | — | |

> Поле `attributes` — см. канонический раздел «Передача атрибутов» ниже.

### Передача атрибутов (`attributes[<id>]`) — общий механизм

Единое описание для всех multipart-эндпоинтов с атрибутами (`upload`, `accept`, `decline`, `decline_sign`, `unep_sign`, `ukep_sign`). На этот раздел ссылаются `reference.endpoints.md`, `reference.signing-*.md` и примеры кода.

Атрибуты передаются в `multipart/form-data` **отдельными полями**, НЕ единым JSON-объектом:

- **Ключ поля:** `attributes[<id>]`, где `<id>` — это `form_attributes[].id` активного этапа (из `GET /event/{event_id}` → `nodes[].actions[].form_attributes`), т.е. идентификатор конкретного атрибута, **а не случайный GUID**.
- **Значение** — по типу атрибута (`form_attributes[].type`):

| `type` | Как передать значение | Пример (multipart-поле, `<id>` фиктивный) |
|---|---|---|
| `text` (а также `textarea`, `date`, `choice`, `year`) | строка по смыслу атрибута (дата, номер, текст) | `-F 'attributes[a1b2c3d4-...]=2026-07-01'` |
| `file` | один файл | `-F 'attributes[a1b2c3d4-...]=@/path/to/doc.pdf'` |
| `file_multiple` (`[]file`) | несколько полей с **одним и тем же** ключом `attributes[<id>]` — по одному файлу на поле | `-F 'attributes[a1b2c3d4-...]=@/path/to/file1.pdf' -F 'attributes[a1b2c3d4-...]=@/path/to/file2.pdf'` |

> Для `file_multiple` ключ `attributes[<id>]` повторяется столько раз, сколько файлов; на стороне VK HR Tek повторяющиеся поля собираются в массив для одного и того же атрибута `<id>`.

- **Какие атрибуты требуются:** перечень и обязательность — из `form_attributes` (`id`, `type`). Если этап атрибутов не требует — поля `attributes[...]` не добавляются.
- Полная схема `FormAttribute` — в `public-api.openapi.yaml`.

### CancelEventRequest

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `reason_id` | Причина отмены | `int` | — | Из `cancel_reasons` |
| 2 | `comment` | Комментарий | `string?` | — | |

### DeclineRequest / DeclineSignRequest (multipart/form-data)

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `attributes` | Атрибуты | `string` | JSON | Обязателен |
| 2 | `comment` | Комментарий | `string?` | — | **Обязателен** в `DeclineSignRequest` |

---

## Модели ответов

### CreateEventResponse / CancelEventResponse

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `event_id` | Идентификатор Заявки | `string` | GUID | |

### UserBySnilsResponse / UserByPersonnelNumberResponse

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `id` | Идентификатор пользователя | `string` | GUID | → `X-User-Id` |

### UserResponse (ключевые поля)

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `id` | Идентификатор | `string` | GUID | |
| 2 | `employees` | Сотрудники | `[]AuthEmployee` | — | |
| 2.1 | `id` | Идентификатор сотрудника | `string` | GUID | → `employee_id` |
| 2.2 | `personnel_number` | Табельный номер | `string` | — | |
| 2.3 | `company.legal_id` | Идентификатор организации | `string` | GUID | → `company_id` |

> Полный набор полей `UserResponse` (телефон, сертификаты УНЭП и др.) — в `public-api.openapi.yaml`.

### CreateEventOptionsList

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `options` | Доступные типы Заявок | `[]CreateEventOption` | — | |
| 1.1 | `event_type_id` | Тип Заявки | `string` | GUID | |
| 1.2 | `event_type_name` | Название типа | `string` | — | |
| 1.3 | `employee_id` | Сотрудник | `string` | GUID | |
| 1.4 | `employee_name` | Имя сотрудника | `string` | — | PII |

### CancelReasonListResponse

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `reasons` | Причины отмены | `[]{}` | — | |
| 1.1 | `id` | Идентификатор причины | `int` | — | → `reason_id` |
| 1.2 | `description` | Описание | `string` | — | |

### FileRequest (async-экспорт)

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `file_request_id` | Идентификатор запроса | `string` | GUID | |
| 2 | `status` | Статус | `string` | enum `FileRequest.status` | Поллинг до `done` |
| 3 | `expired_at` | Истекает | `string?` | ISO 8601 | |

### Error

| N | Свойство модели | Наименование | Тип данных | Формат | Комментарий |
|---|---|---|---|---|---|
| 1 | `code` | Код ошибки | `int` | — | |
| 2 | `message` | Сообщение | `string` | — | |

> Часть `400`-ответов несёт расширенный `data: { error_details, error_code }` (в примерах OpenAPI). Логический `error_code = forbidden` соответствует HTTP `403` (например, отмена завершённой Заявки).

---

## Перечисления

> **Тип реализации:** `record (string)` — значения сериализуются строками. Нулевое значение `Undefined` в контракте VK HR Tek не используется (это внешний API; правило `Undefined=0` применяется к нашим `enum (int)`).

### Action.type (тип действия активного этапа)

| N | Системное название | Значение | Название | Комментарий |
|---|---|---|---|---|
| 1 | `upload` | `upload` | Загрузка | Ожидается загрузка документа |
| 2 | `accept` | `accept` | Проверка | Этап принятия |
| 3 | `company_sign` | `company_sign` | Подпись компании | + `company_sign_batch` |
| 4 | `employee_sign` | `employee_sign` | Подпись сотрудника | |
| 5 | `unep_sign` | `unep_sign` | УНЭП-подпись | + `unep_sign_batch` |
| 6 | `ukep_sign` | `ukep_sign` | УКЭП-подпись | + `ukep_sign_batch` |
| 7 | `pep_sign` | `pep_sign` | ПЭП-подпись | + `pep_sign_batch` |
| 8 | `generate_document_from_template` | `generate_document_from_template` | Генерация из шаблона | |
| 9 | `decline` | `decline` | Отклонение | |
| 10 | `decline_sign` | `decline_sign` | Отказ от подписания | Конечное состояние |
| 11 | `declined` | `declined` | Отклонена | Конечное состояние |
| 12 | `in_paper` | `in_paper` | В бумаге | Флаг события |
| 13 | `completed` | `completed` | Завершена | **Документ подписан** — триггер скачивания |
| 14 | `canceled` | `canceled` | Отменена | Результат успешной отмены |

### SignatureStatus (статус подписи документа)

| N | Системное название | Значение | Название | Комментарий |
|---|---|---|---|---|
| 1 | `signed` | `signed` | Подписано | |
| 2 | `on_signing` | `on_signing` | На подписании | |
| 3 | `can_sign` | `can_sign` | Можно подписать | |
| 4 | `not_signed` | `not_signed` | Не подписано | |
| 5 | `declined_sign` | `declined_sign` | Отказ от подписания | |

### FileRequest.status (статус async-запроса файла)

| N | Системное название | Значение | Название | Комментарий |
|---|---|---|---|---|
| 1 | `in_progress` | `in_progress` | В обработке | Продолжать поллинг |
| 2 | `done` | `done` | Готов | Можно скачивать |
| 3 | `expired` | `expired` | Истёк | |
| 4 | `error` | `error` | Ошибка | |

### UnepType (метод УНЭП-подписи)

| N | Системное название | Значение | Название | Комментарий |
|---|---|---|---|---|
| 1 | `kontur` | `kontur` | Контур | Требует SMS-код |
| 2 | `goskey` | `goskey` | Госключ | |
| 3 | `cryptopro_simple` | `cryptopro_simple` | CryptoPro Simple | Без кода |
| 4 | `cryptopro_local` | `cryptopro_local` | CryptoPro Local | base64-подпись |
| 5 | `disabled` | `disabled` | Отключено | Подписание запрещено |

### EventListRequestFilters.status (фильтр статуса в списке)

| N | Системное название | Значение | Название | Комментарий |
|---|---|---|---|---|
| 1 | `upload` | `upload` | Загрузка | |
| 2 | `sign` | `sign` | Подписание | |
| 3 | `accept` | `accept` | Проверка | |
| 4 | `completed` | `completed` | Завершено | |
| 5 | `declined` | `declined` | Отклонено | |
| 6 | `declined_sign` | `declined_sign` | Отказ от подписания | |
| 7 | `canceled` | `canceled` | Отменено | |
| 8 | `in_paper` | `in_paper` | В бумаге | |

### X-Side (сторона взаимодействия)

| N | Системное название | Значение | Название | Комментарий |
|---|---|---|---|---|
| 1 | `employee` | `employee` | Сотрудник | |
| 2 | `company` | `company` | Компания | |
