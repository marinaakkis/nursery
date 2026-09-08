---
name: skill.dev.ru.processing-result-pattern
description: >-
  Defines and documents the ProcessingResult<T> pattern — a Railway-Oriented
  Programming (Result Monad) implementation for cross-stack operation result
  handling. Use when: designing a new service layer, implementing ProcessingResult
  from scratch in any project, reviewing handler/controller code for result
  propagation, mapping operation status to HTTP responses, or porting the pattern
  to TypeScript/Python. Reference implementation language is C#.
---

# ProcessingResult — паттерн обработки результатов

## Скоуп и приоритет

Скилл описывает **паттерн Railway-Oriented Programming (ROP)**, реализованный через `ProcessingResult<TResult>`.

**Применять при:**
- реализации паттерна с нуля;
- проектировании сервисного слоя нового сервиса;
- ревью кода обработчиков команд/запросов (CQRS) и контроллеров;
- портировании на TypeScript, Python или другой стек.

При конфликте с локальными соглашениями репозитория — уточни у команды; изменение семантики статусов (`ProcessingStatus`) и маппинга на HTTP-коды требует согласования с архитектором.

Полные примеры кода (C#, TypeScript, Python) — в [reference.md](reference.md).

**RU-триггеры для матчинга (дополнительно к EN description):**
- processing result, result monad, railway oriented programming;
- фабрика результата, маппинг статуса на HTTP, problem details;
- bind chain, проброс ошибок из вложенных вызовов, convert dto.

## Чеклист перед сдачей

- [ ] `ProcessingResult<T>` MUST создаваться только через фабрику, не через `new`
- [ ] Статус MUST устанавливаться при создании и не изменяться после
- [ ] `IsOk()` MUST использоваться вместо `status == Ok` для семантики «любой успех»
- [ ] HTTP-адаптер MUST маппить все 10 статусов (включая `Undefined -> 501`)
- [ ] Для `ProblemDetails` SHOULD заполняться `type` и `title`; `detail` и `instance` MUST быть заданы
- [ ] При ошибках с `ProblemDetails` MUST выставляться `Content-Type: application/problem+json`
- [ ] `messageKey` при автогенерации MUST быть формата `"{groupKey}{index}"` со счетчиком внутри группы
- [ ] Void-операции при успехе MUST возвращать `204 No Content`
- [ ] Bind/chain-пайплайн MUST пробрасывать status/messages без потерь
- [ ] Коллекционные ответы: пустая выборка при успешном запросе MUST трактоваться как `Ok` + `200`

## Ожидаемый output template

При применении этого скилла агент должен возвращать:
1. Измененный код `ProcessingResult`/factory/extensions в целевом языке.
2. HTTP-адаптер с явным маппингом `ProcessingStatus -> HTTP`.
3. Пример bind/chain для минимум двух последовательных шагов.
4. Короткий e2e-пример «service -> controller/route -> HTTP response».
5. Краткую self-check сводку по чеклисту (что выполнено/что осталось).

---

## Абстрактный паттерн (стеко-независимо)

`ProcessingResult<T>` — дискриминированный union, который объединяет:

| Поле | Тип | Назначение |
|------|-----|-----------|
| `value` | `T?` | Результат операции (nullable) |
| `status` | `ProcessingStatus` | Итог выполнения (не HTTP-код) |
| `messages` | `List<ProcessingMessage>` | Сообщения об ошибках, предупреждениях, информации |

**Ключевые принципы:**
1. **Исключения не используются** для управления потоком — статус передаётся явно.
2. **Конструктор закрыт (`internal` / `private`)** — создание только через фабрики.
3. **Иммутабельный статус** — устанавливается при создании, не меняется.
4. **Сообщения аддитивны** — список пополняется, не заменяется.

### Нормативность (RFC 2119)

- `MUST` / `MUST NOT` — обязательное требование.
- `SHOULD` / `SHOULD NOT` — рекомендовано, но возможны обоснованные исключения.
- `MAY` — допустимый опциональный вариант.

---

## Модели и перечисления

### ProcessingResult\<T\>

```
ProcessingResult<T>
  value:    T?                      -- результат (null допустим при ошибках и 204)
  status:   ProcessingStatus        -- итог обработки
  messages: List<ProcessingMessage> -- инициализируется пустым списком
```

**Конструктор закрыт.** Прямое `new ProcessingResult<T>()` в прикладном коде **запрещено** — использовать только фабрику.

---

### ProcessingMessage

```
ProcessingMessage
  message:    string       -- текст (обязателен)
  type:       MessageType  -- Info / Error / Warning
  messageKey: string?      -- ключ (i18n, поле формы); null — автогенерация при сериализации
  displayType: DisplayType -- Common (по умолчанию) / Field
```

`DisplayType.Field` — маркер, что сообщение относится к конкретному полю формы. При сериализации в HTTP-ответ ключ `messageKey` идентифицирует поле.

---

### ProcessingStatus

| Значение | Число | Семантика | HTTP-код |
|----------|-------|-----------|----------|
| `Undefined` | 0 | Не установлено (default) | 501 Not Implemented |
| `Ok` | 1 | Успех | 200 OK (если value != null) / 204 No Content |
| `Created` | 2 | Создан ресурс | 201 Created |
| `Updated` | 3 | Обновлён ресурс | 200 OK (если value != null) / 204 No Content |
| `Deleted` | 4 | Удалён ресурс | 200 OK (если value != null) / 204 No Content |
| `NotFound` | 5 | Ресурс не найден | 404 Not Found |
| `Error` | 6 | Внутренняя ошибка | 500 Internal Server Error |
| `NotValid` | 7 | Ошибка валидации | 400 Bad Request |
| `AccessDenied` | 8 | Доступ запрещён | 403 Forbidden |
| `UnprocessableEntity` | 9 | Необрабатываемый объект | 422 Unprocessable Entity |
| `Conflict` | 10 | Конфликт ресурсов | 409 Conflict |

**Успешные статусы** (`IsOk()` = true): `Ok`, `Created`, `Updated`, `Deleted`.

При кросс-стековой сериализации важны **целочисленные значения** (0–10), а не тип хранения. В C# эталоне используется `short` — достаточно и экономично, но для TypeScript/Python это не обязательно.

`Undefined -> 501` оставляется как защитный fallback: если слой приложений вернул неинициализированный/неподдержанный статус, адаптер явно сигнализирует о некорректной реализации контракта. Для штатных сценариев бизнес-логики этот путь не используется.

---

### MessageType

| Значение | Число | Ключ в API-ответе |
|----------|-------|-------------------|
| `Unknown` | 0 | `unknowns` |
| `Info` | 1 | `infos` |
| `Error` | 2 | `errors` |
| `Warning` | 3 | `warnings` |

Ключи в API-ответе: **plural camelCase** (convention, не enum-имя).

---

### DisplayType

| Значение | Число | Смысл |
|----------|-------|-------|
| `Common` | 0 | Общее сообщение (default) |
| `Field` | 1 | Сообщение для конкретного поля формы |

---

## Фабричный слой

### Правило: конструктор закрыт — создание только через фабрики

Цель — исключить неконсистентные состояния (забытый статус, нулевой список сообщений).

---

### ProcessingResultFactory — публичный API

| Метод | Статус | Value | Сообщения |
|-------|--------|-------|-----------|
| `Ok(value)` | `Ok` | передан | нет |
| `Created(value)` | `Created` | передан | нет |
| `Updated(value)` | `Updated` | передан | нет |
| `Deleted(value)` | `Deleted` | передан | нет |
| `NotFound()` | `NotFound` | null | нет |
| `NotValid()` | `NotValid` | null | нет |
| `NotValid(message)` | `NotValid` | null | одно |
| `NotValid(messages)` | `NotValid` | null | несколько |
| `Error(message)` | `Error` | null | одно |
| `AccessDenied()` | `AccessDenied` | null | нет |
| `AccessDenied(message)` | `AccessDenied` | null | одно |
| `AccessDenied(messages)` | `AccessDenied` | null | несколько |
| `UnprocessableEntity(message)` | `UnprocessableEntity` | null | одно |
| `Conflict(message)` | `Conflict` | null | одно |

**Низкоуровневый Create()** (для конвертации и внутренней логики):
- `Create(status, value?)` — без сообщений
- `Create(status, message, value?)` — одно сообщение
- `Create(status, messages, value?)` — несколько сообщений

---

### ProcessingMessageFactory — публичный API

Три метода, одинаковая сигнатура:

```
Info(message, messageKey? = null, displayType = Common) → ProcessingMessage
Error(message, messageKey? = null, displayType = Common) → ProcessingMessage
Warning(message, messageKey? = null, displayType = Common) → ProcessingMessage
```

Пример использования:
```csharp
var msg = ProcessingMessageFactory.Error("Поле обязательно", "email", DisplayType.Field);
return ProcessingResultFactory.NotValid<UserDto>(msg);
```

---

## Методы-помощники (расширения / статические утилиты)

### Проверки статуса

Все методы — `bool`, принимают `ProcessingResult<T>`:

| Метод | Условие |
|-------|---------|
| `IsOk()` | status ∈ {Ok, Created, Updated, Deleted} |
| `IsUndefined()` | status == Undefined |
| `IsNotFound()` | status == NotFound |
| `IsError()` | status == Error |
| `IsNotValid()` | status == NotValid |
| `IsAccessDenied()` | status == AccessDenied |
| `IsCreated()` | status == Created |
| `IsUpdated()` | status == Updated |
| `IsDeleted()` | status == Deleted |
| `IsUnprocessableEntity()` | status == UnprocessableEntity |
| `IsConflict()` | status == Conflict |

`IsOk()` — **семантический**, а не точный матч: если операция завершилась успешно любым способом, возвращает `true`. Не использовать `status == Ok` напрямую, если нужна семантика «успех».

---

### Convert\<TResult, TConvertedResult\>

Трансформирует тип `value` с сохранением статуса и всех сообщений:

```
Convert(converter?) → ProcessingResult<TConvertedResult>
```

**Логика:**
- Если `IsOk() && value != null && converter != null` → применяет `converter(value)`
- Иначе → `value = null`
- `status` и `messages` копируются без изменений

Используется для маппинга Domain → DTO перед отправкой HTTP-ответа.

---

## Цепочки вызовов (bind/chain)

Используй bind/chain для последовательных операций, где каждый шаг возвращает `ProcessingResult<T>`.

**Правила:**
- Если текущий результат неуспешен (`!IsOk()`), следующий шаг MUST НЕ выполняться.
- При остановке цепочки status/messages MUST пробрасываться без потерь.
- Конвертация типа через `Convert<T, U>()` применяется только для успешного `value`.
- Для ошибок в середине цепочки НЕ бросай exception для control flow; возвращай `ProcessingResult` со статусом и сообщениями.

Подробные примеры для C#, TypeScript и Python см. в [reference.md](reference.md).

---

## Коллекции, void и partial success

### Коллекционные результаты

- Для `ProcessingResult<IEnumerable<T>>` пустая коллекция при успешном запросе MUST считаться `Ok` с HTTP `200`.
- `NotFound` используй только когда не найден сам ресурс/контекст, а не «ноль элементов в списке».

### Void-операции

- Для команд без payload (delete/update side-effects) успешный результат MUST маппиться в `204 No Content`.
- Разрешается хранить `value = null`; отдельный `bool`-payload не обязателен.

### Partial success

- Отдельный статус `Partial` не вводится.
- Частичный успех описывается существующим успешным статусом + `Warning`-сообщениями.

---

## HTTP-адаптер

### Маппинг ProcessingStatus → ActionResult

| ProcessingStatus | value | HTTP-код | Тело ответа |
|-----------------|-------|----------|-------------|
| Ok, Updated, Deleted | не null | 200 OK | value |
| Ok, Updated, Deleted | null | 204 No Content | — |
| Created | любой | 201 Created | value |
| NotValid | — | 400 Bad Request | ProblemDetails + сообщения |
| NotFound | — | 404 Not Found | ProblemDetails + сообщения |
| AccessDenied | — | 403 Forbidden | ProblemDetails + сообщения |
| Error | — | 500 Internal Server Error | ProblemDetails + сообщения |
| UnprocessableEntity | — | 422 Unprocessable Entity | ProblemDetails + сообщения |
| Conflict | — | 409 Conflict | ProblemDetails + сообщения |
| Undefined / прочее | — | 501 Not Implemented | ProblemDetails |

---

### Формат ProblemDetails (RFC 7807)

```json
{
  "type": "https://example.com/problems/validation-error",
  "title": "Validation error",
  "detail": "<локализованное сообщение об ошибке>",
  "instance": "<uri запроса>",
  "errors": [
    { "key": "email", "message": "Поле обязательно", "displayType": 1 }
  ],
  "warnings": [...],
  "infos": [...]
}
```

`detail` и `instance` MUST быть заполнены. `type` и `title` SHOULD быть заполнены. Для ответов в формате ProblemDetails MUST выставляться `Content-Type: application/problem+json`.

**Алгоритм формирования расширений:**
1. Сгруппировать `messages` по `MessageType`.
2. Для каждой группы — ключ в `extensions`: plural camelCase (`errors`, `warnings`, `infos`, `unknowns`).
3. Каждый элемент группы: `{ key: messageKey ?? авто-генерация, message, displayType }`.
4. `messageKey` автогенерируется как `"{groupKey}{index}"`, если не задан.
5. `index` MUST начинаться с `0` отдельно внутри каждой группы (`errors0`, `errors1`, `warnings0`, ...).

---

### ConvertToActionResult — перегрузки

```
ConvertToActionResult()
ConvertToActionResult(uri)
ConvertToActionResult(uri, detail)
ConvertToActionResult(uri, detail, additionalDetails)
ConvertToActionResult<TResult, TConverted>()   // + Mapster/AutoMapper
```

Последняя перегрузка: конвертирует `value` через маппер, затем вызывает `ConvertToActionResult()` на результате.

---

## Альтернативы HTTP-адаптера

ProblemDetails — **не единственный** вариант. Выбор зависит от потребителя API.

| Формат | Когда применять | Структура ошибки |
|--------|----------------|-----------------|
| **ProblemDetails** (RFC 7807) | .NET-экосистема, публичный API, нужна OpenAPI-совместимость | `{ detail, instance, errors: [...] }` |
| **Custom envelope** | BFF, фронтенд-команда диктует формат, внутренние сервисы | `{ success, statusCode, data, errors: [...] }` |
| **Минимальный error body** | Простые CRUD-сервисы, внутренние API без богатой валидации | `{ message, code }` |

### Когда ProblemDetails оправдан

- Стек .NET — вся инфраструктура (middleware, Swagger, логирование) понимает RFC 7807 без настройки.
- `extensions`-механизм чисто несёт сгруппированные `errors/warnings/infos` из `ProcessingResult.Messages`.
- API потребляется внешними системами или публичен.

### Когда стоит выбрать Custom Envelope

Типовая структура:

```json
{
  "success": false,
  "statusCode": 400,
  "data": null,
  "errors": [
    { "key": "email", "message": "Поле обязательно", "displayType": 1 }
  ],
  "warnings": [],
  "infos": []
}
```

**Выбирай, если:**
- Потребитель — SPA/мобильное приложение, фронтенд ожидает единый формат для success и error.
- TypeScript или Python стек — нет встроенной поддержки RFC 7807.
- Внутренний сервис, и команда предпочитает явный `success: bool` вместо трактовки HTTP-кода.

**Компромисс:** custom envelope дублирует HTTP-статус в теле и отступает от REST-семантики — это приемлемо для BFF, но нежелательно для публичного API.

### Правило выбора

```
.NET + публичный/внешний API  → ProblemDetails
.NET + только внутренний BFF  → Custom Envelope допустим
TypeScript / Python            → Custom Envelope (предпочтительно)
Любой стек + простой CRUD     → Минимальный error body
```

---

## Реализация по стекам

### C# / .NET

Рекомендуемая структура слоя внутри проекта:

```
Domain/Processings/
  Contracts/   ProcessingResult.cs, ProcessingMessage.cs
  Enums/       ProcessingStatus.cs, MessageType.cs, DisplayType.cs
Utilities/
  Factories/   ProcessingResultFactory.cs, ProcessingMessageFactory.cs
  Converters/  ProcessingMessageTypeConverter.cs
Extensions/    ProcessingResultExtensions.cs, ProcessingResultConvertingExtensions.cs
```

HTTP-зависимость: `Microsoft.AspNetCore.Mvc.Core` (для `ActionResult`, `ObjectResult`, `ProblemDetails`).
Маппинг типов: любой маппер (Mapster, AutoMapper) или ручной `converter`.

---

### TypeScript / Node.js

Подход: **discriminated union** + статические фабричные методы.

Ключевые отличия от C#:
- Нет `internal` конструктора → используй `private constructor` + статические фабрики в классе
- `IsOk()` → метод экземпляра или утилита
- HTTP-адаптер: `express` / `fastify` — через маппинг в middleware или `toResponse()` метод
- Mapster → используй `class-transformer` или ручной маппер

Краткий пример и полная реализация — [reference.md § TypeScript](reference.md#typescript--nodejs).

---

### Python

Подход: `@dataclass` + `Enum` + фабричные функции (или `@classmethod`).

Ключевые отличия:
- `ProcessingResult[T]` через `Generic[T]`
- `status` → `ProcessingStatus(int, Enum)` (`IntEnum`)
- HTTP-адаптер: `FastAPI` / `Flask` через маппинг в роутере
- Нет встроенного `ProblemDetails` → реализуй как `dict` или Pydantic-модель
- **Конструктор закрыть нельзя** — `@dataclass` всегда генерирует публичный `__init__`; закрытие только через соглашение (документация + ревью)

Полная реализация — [reference.md § Python](reference.md#python).

---

## Антипаттерны

- Прямое создание `new ProcessingResult<T>()` в прикладном коде.
- Прямое сравнение `status == Ok` для семантики «успех» вместо `IsOk()`.
- Использование exceptions для штатного управления ветвлением бизнес-логики.
- Потеря `messages` при `Convert<T, U>()` или bind/chain-переходе.
- Глобальный счетчик автоключей между группами сообщений (`errors`/`warnings`/`infos`).
