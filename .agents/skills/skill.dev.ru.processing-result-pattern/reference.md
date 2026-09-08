---
name: skill.dev.ru.processing-result-pattern.reference
description: >-
  Reference implementations for the ProcessingResult pattern in C#, TypeScript,
  and Python, including HTTP adapters and bind/chain examples.
---

# reference.md — ProcessingResult: примеры реализации по стекам

---

## C# / .NET (эталонная реализация)

### Модели

```csharp
// Domain/Processings/Enums/ProcessingStatus.cs
public enum ProcessingStatus : short
{
    Undefined = 0, Ok = 1, Created = 2, Updated = 3, Deleted = 4,
    NotFound = 5, Error = 6, NotValid = 7,
    AccessDenied = 8, UnprocessableEntity = 9, Conflict = 10
}

// Domain/Processings/Enums/MessageType.cs
public enum MessageType : short { Unknown = 0, Info = 1, Error = 2, Warning = 3 }

// Domain/Processings/Enums/DisplayType.cs
public enum DisplayType : short { Common = 0, Field = 1 }

// Domain/Processings/Contracts/ProcessingMessage.cs
public sealed class ProcessingMessage
{
    public string Message { get; set; } = null!;
    public MessageType Type { get; set; }
    public string? MessageKey { get; set; }
    public DisplayType DisplayType { get; set; } = DisplayType.Common;
}

// Domain/Processings/Contracts/ProcessingResult.cs
public sealed class ProcessingResult<TResult>
{
    public TResult? Value { get; set; }
    public ProcessingStatus Status { get; set; }
    public List<ProcessingMessage> Messages { get; } = new();

    internal ProcessingResult() { }
}
```

---

### ProcessingResultFactory (C#)

```csharp
public static class ProcessingResultFactory
{
    public static ProcessingResult<T> Ok<T>(T result)             => Create(ProcessingStatus.Ok, result);
    public static ProcessingResult<T> Created<T>(T result)        => Create(ProcessingStatus.Created, result);
    public static ProcessingResult<T> Updated<T>(T result)        => Create(ProcessingStatus.Updated, result);
    public static ProcessingResult<T> Deleted<T>(T result)        => Create(ProcessingStatus.Deleted, result);
    public static ProcessingResult<T> NotFound<T>()               => Create<T>(ProcessingStatus.NotFound);
    public static ProcessingResult<T> NotValid<T>()               => Create<T>(ProcessingStatus.NotValid);
    public static ProcessingResult<T> NotValid<T>(ProcessingMessage msg)                    => Create<T>(ProcessingStatus.NotValid, msg);
    public static ProcessingResult<T> NotValid<T>(IEnumerable<ProcessingMessage> msgs)      => Create<T>(ProcessingStatus.NotValid, msgs);
    public static ProcessingResult<T> Error<T>(ProcessingMessage msg)                       => Create<T>(ProcessingStatus.Error, msg);
    public static ProcessingResult<T> AccessDenied<T>()           => Create<T>(ProcessingStatus.AccessDenied);
    public static ProcessingResult<T> AccessDenied<T>(ProcessingMessage msg)                => Create<T>(ProcessingStatus.AccessDenied, msg);
    public static ProcessingResult<T> AccessDenied<T>(IEnumerable<ProcessingMessage> msgs)  => Create<T>(ProcessingStatus.AccessDenied, msgs);
    public static ProcessingResult<T> UnprocessableEntity<T>(ProcessingMessage msg)         => Create<T>(ProcessingStatus.UnprocessableEntity, msg);
    public static ProcessingResult<T> Conflict<T>(ProcessingMessage msg)                    => Create<T>(ProcessingStatus.Conflict, msg);

    public static ProcessingResult<T> Create<T>(ProcessingStatus status, T? result = default)
        => new() { Status = status, Value = result };

    public static ProcessingResult<T> Create<T>(ProcessingStatus status, ProcessingMessage message, T? result = default)
    {
        ProcessingResult<T> processingResult = Create(status, result);
        processingResult.Messages.Add(message);
        return processingResult;
    }

    public static ProcessingResult<T> Create<T>(ProcessingStatus status, IEnumerable<ProcessingMessage> msgs, T? result = default)
    {
        ProcessingResult<T> processingResult = Create(status, result);
        processingResult.Messages.AddRange(msgs);
        return processingResult;
    }
}
```

---

### ProcessingMessageFactory (C#)

```csharp
public static class ProcessingMessageFactory
{
    public static ProcessingMessage Info(string message, string? key = null, DisplayType displayType = DisplayType.Common)
        => new() { Message = message, Type = MessageType.Info, MessageKey = key, DisplayType = displayType };

    public static ProcessingMessage Error(string message, string? key = null, DisplayType displayType = DisplayType.Common)
        => new() { Message = message, Type = MessageType.Error, MessageKey = key, DisplayType = displayType };

    public static ProcessingMessage Warning(string message, string? key = null, DisplayType displayType = DisplayType.Common)
        => new() { Message = message, Type = MessageType.Warning, MessageKey = key, DisplayType = displayType };
}
```

---

### ProcessingResultExtensions (C#)

```csharp
public static class ProcessingResultExtensions
{
    private static readonly HashSet<ProcessingStatus> _successStatuses =
        [ProcessingStatus.Ok, ProcessingStatus.Created, ProcessingStatus.Updated, ProcessingStatus.Deleted];

    public static bool IsOk<T>(this ProcessingResult<T> processingResult)                  => _successStatuses.Contains(processingResult.Status);
    public static bool IsUndefined<T>(this ProcessingResult<T> processingResult)           => processingResult.Status == ProcessingStatus.Undefined;
    public static bool IsNotFound<T>(this ProcessingResult<T> processingResult)            => processingResult.Status == ProcessingStatus.NotFound;
    public static bool IsError<T>(this ProcessingResult<T> processingResult)               => processingResult.Status == ProcessingStatus.Error;
    public static bool IsNotValid<T>(this ProcessingResult<T> processingResult)            => processingResult.Status == ProcessingStatus.NotValid;
    public static bool IsAccessDenied<T>(this ProcessingResult<T> processingResult)        => processingResult.Status == ProcessingStatus.AccessDenied;
    public static bool IsCreated<T>(this ProcessingResult<T> processingResult)             => processingResult.Status == ProcessingStatus.Created;
    public static bool IsUpdated<T>(this ProcessingResult<T> processingResult)             => processingResult.Status == ProcessingStatus.Updated;
    public static bool IsDeleted<T>(this ProcessingResult<T> processingResult)             => processingResult.Status == ProcessingStatus.Deleted;
    public static bool IsUnprocessableEntity<T>(this ProcessingResult<T> processingResult) => processingResult.Status == ProcessingStatus.UnprocessableEntity;
    public static bool IsConflict<T>(this ProcessingResult<T> processingResult)            => processingResult.Status == ProcessingStatus.Conflict;
}
```

---

### HTTP-адаптер: ConvertToActionResult (C# — ключевая логика)

```csharp
public static ActionResult ConvertToActionResult<T>(
    this ProcessingResult<T> result,
    string? uri = null,
    string? detail = null,
    IDictionary<string, object>? additionalDetails = null)
{
    additionalDetails ??= new Dictionary<string, object>();

    switch (result.Status)
    {
        case ProcessingStatus.Ok:
        case ProcessingStatus.Updated:
        case ProcessingStatus.Deleted:
            return result.Value == null
                ? new ObjectResult(null) { StatusCode = 204 }
                : new ObjectResult(result.Value) { StatusCode = 200 };

        case ProcessingStatus.Created:
            return new ObjectResult(result.Value) { StatusCode = 201 };

        case ProcessingStatus.NotValid:
            result.AddMessagesToAdditionalDetails(additionalDetails);
            return ProblemResult(400, detail ?? "Bad Request", uri, additionalDetails);

        case ProcessingStatus.NotFound:
            result.AddMessagesToAdditionalDetails(additionalDetails);
            return ProblemResult(404, detail ?? "Not Found", uri, additionalDetails);

        case ProcessingStatus.AccessDenied:
            result.AddMessagesToAdditionalDetails(additionalDetails);
            return ProblemResult(403, detail ?? "Forbidden", uri, additionalDetails);

        case ProcessingStatus.Error:
            result.AddMessagesToAdditionalDetails(additionalDetails);
            return ProblemResult(500, detail ?? "Internal Server Error", uri, additionalDetails);

        case ProcessingStatus.UnprocessableEntity:
            result.AddMessagesToAdditionalDetails(additionalDetails);
            return ProblemResult(422, detail ?? "Unprocessable Entity", uri, additionalDetails);

        case ProcessingStatus.Conflict:
            result.AddMessagesToAdditionalDetails(additionalDetails);
            return ProblemResult(409, detail ?? "Conflict", uri, additionalDetails);

        default:
            return ProblemResult(501, "Not Implemented", uri, additionalDetails);
    }
}

private static ObjectResult ProblemResult(int code, string detail, string? uri, IDictionary<string, object> additionalDetails)
{
    var problemDetails = new ProblemDetails
    {
        Type = $"https://example.com/problems/{code}",
        Title = detail,
        Detail = detail,
        Instance = uri
    };
    foreach (var extension in additionalDetails) problemDetails.Extensions[extension.Key] = extension.Value;
    return new ObjectResult(problemDetails)
    {
        StatusCode = code,
        ContentTypes = { "application/problem+json" }
    };
}

private static void AddMessagesToAdditionalDetails<TResult>(this ProcessingResult<TResult> processingResult, IDictionary<string, object> outAdditionalDetails)
{
    foreach (var group in processingResult.Messages.GroupBy(message => message.Type))
    {
        int uniquePrefixKeyIndex = 0;
        string messageKey = group.Key switch
        {
            MessageType.Error   => "errors",
            MessageType.Warning => "warnings",
            MessageType.Info    => "infos",
            _                   => "unknowns"
        };
        outAdditionalDetails[messageKey] = group.Select(message => new
        {
            key = string.IsNullOrEmpty(message.MessageKey)
                ? $"{messageKey}{uniquePrefixKeyIndex++}"
                : message.MessageKey,
            message = message.Message,
            displayType = message.DisplayType
        }).ToList();
    }
}
```

---

## TypeScript / Node.js

### Модели и перечисления

```typescript
export enum ProcessingStatus {
  Undefined = 0,
  Ok = 1,
  Created = 2,
  Updated = 3,
  Deleted = 4,
  NotFound = 5,
  Error = 6,
  NotValid = 7,
  AccessDenied = 8,
  UnprocessableEntity = 9,
  Conflict = 10,
}

export enum MessageType {
  Unknown = 0,
  Info = 1,
  Error = 2,
  Warning = 3,
}

export enum DisplayType {
  Common = 0,
  Field = 1,
}

export interface ProcessingMessage {
  message: string;
  type: MessageType;
  messageKey?: string;
  displayType: DisplayType;
}

export class ProcessingResult<T> {
  readonly value: T | null;
  readonly status: ProcessingStatus;
  readonly messages: ProcessingMessage[];

  private constructor(status: ProcessingStatus, value: T | null, messages: ProcessingMessage[]) {
    this.status = status;
    this.value = value;
    this.messages = messages;
  }

  // --- Статические фабрики ---

  static ok<T>(value: T): ProcessingResult<T> {
    return new ProcessingResult(ProcessingStatus.Ok, value, []);
  }
  static created<T>(value: T): ProcessingResult<T> {
    return new ProcessingResult(ProcessingStatus.Created, value, []);
  }
  static updated<T>(value: T): ProcessingResult<T> {
    return new ProcessingResult(ProcessingStatus.Updated, value, []);
  }
  static deleted<T>(value: T): ProcessingResult<T> {
    return new ProcessingResult(ProcessingStatus.Deleted, value, []);
  }
  static notFound<T>(): ProcessingResult<T> {
    return new ProcessingResult(ProcessingStatus.NotFound, null, []);
  }
  static notValid<T>(messages: ProcessingMessage[] = []): ProcessingResult<T> {
    return new ProcessingResult(ProcessingStatus.NotValid, null, messages);
  }
  static error<T>(message: ProcessingMessage): ProcessingResult<T> {
    return new ProcessingResult(ProcessingStatus.Error, null, [message]);
  }
  static accessDenied<T>(messages: ProcessingMessage[] = []): ProcessingResult<T> {
    return new ProcessingResult(ProcessingStatus.AccessDenied, null, messages);
  }
  static conflict<T>(message: ProcessingMessage): ProcessingResult<T> {
    return new ProcessingResult(ProcessingStatus.Conflict, null, [message]);
  }
  static unprocessableEntity<T>(message: ProcessingMessage): ProcessingResult<T> {
    return new ProcessingResult(ProcessingStatus.UnprocessableEntity, null, [message]);
  }
  static create<T>(status: ProcessingStatus, value: T | null = null, messages: ProcessingMessage[] = []): ProcessingResult<T> {
    return new ProcessingResult(status, value, messages);
  }

  // --- Проверки статуса ---

  private static readonly SUCCESS = new Set([
    ProcessingStatus.Ok,
    ProcessingStatus.Created,
    ProcessingStatus.Updated,
    ProcessingStatus.Deleted,
  ]);

  isOk(): boolean { return ProcessingResult.SUCCESS.has(this.status); }
  isUndefined(): boolean { return this.status === ProcessingStatus.Undefined; }
  isNotFound(): boolean { return this.status === ProcessingStatus.NotFound; }
  isError(): boolean { return this.status === ProcessingStatus.Error; }
  isNotValid(): boolean { return this.status === ProcessingStatus.NotValid; }
  isAccessDenied(): boolean { return this.status === ProcessingStatus.AccessDenied; }
  isUpdated(): boolean { return this.status === ProcessingStatus.Updated; }
  isDeleted(): boolean { return this.status === ProcessingStatus.Deleted; }
  isUnprocessableEntity(): boolean { return this.status === ProcessingStatus.UnprocessableEntity; }
  isConflict(): boolean { return this.status === ProcessingStatus.Conflict; }

  // --- Конвертация типа ---

  convert<U>(converter?: (v: T) => U): ProcessingResult<U> {
    const newValue = this.isOk() && this.value != null && converter
      ? converter(this.value)
      : null;
    return new ProcessingResult<U>(this.status, newValue, [...this.messages]);
  }
}
```

---

### ProcessingMessageFactory (TypeScript)

```typescript
export const ProcessingMessageFactory = {
  info(message: string, messageKey?: string, displayType = DisplayType.Common): ProcessingMessage {
    return { message, type: MessageType.Info, messageKey, displayType };
  },
  error(message: string, messageKey?: string, displayType = DisplayType.Common): ProcessingMessage {
    return { message, type: MessageType.Error, messageKey, displayType };
  },
  warning(message: string, messageKey?: string, displayType = DisplayType.Common): ProcessingMessage {
    return { message, type: MessageType.Warning, messageKey, displayType };
  },
};
```

---

### HTTP-адаптер (TypeScript / Express)

> Используется `reduce`, поэтому пример совместим с Node LTS без `Map.groupBy`.

```typescript
const STATUS_TO_HTTP: Record<ProcessingStatus, number> = {
  [ProcessingStatus.Undefined]:          501,
  [ProcessingStatus.Ok]:                 200,
  [ProcessingStatus.Created]:            201,
  [ProcessingStatus.Updated]:            200,
  [ProcessingStatus.Deleted]:            200,
  [ProcessingStatus.NotFound]:           404,
  [ProcessingStatus.Error]:              500,
  [ProcessingStatus.NotValid]:           400,
  [ProcessingStatus.AccessDenied]:       403,
  [ProcessingStatus.UnprocessableEntity]: 422,
  [ProcessingStatus.Conflict]:           409,
};

const MESSAGE_TYPE_KEY: Record<MessageType, string> = {
  [MessageType.Unknown]: 'unknowns',
  [MessageType.Info]:    'infos',
  [MessageType.Error]:   'errors',
  [MessageType.Warning]: 'warnings',
};

export function toResponse<T>(result: ProcessingResult<T>, res: Response, uri?: string): void {
  const httpCode = STATUS_TO_HTTP[result.status];

  if (result.isOk()) {
    if (result.status === ProcessingStatus.Created) {
      res.status(201).json(result.value);
      return;
    }
    if (result.value == null) { res.status(204).end(); return; }
    res.status(200).json(result.value);
    return;
  }

  const grouped = result.messages.reduce<Record<number, ProcessingMessage[]>>((acc, message) => {
    const typeKey = Number(message.type);
    if (!acc[typeKey]) acc[typeKey] = [];
    acc[typeKey].push(message);
    return acc;
  }, {});

  const extensions: Record<string, unknown> = {};
  for (const [rawType, messages] of Object.entries(grouped)) {
    const key = MESSAGE_TYPE_KEY[Number(rawType) as MessageType];
    let groupIndex = 0;
    extensions[key] = messages.map((m) => ({
      key: m.messageKey ?? `${key}${groupIndex++}`,
      message: m.message,
      displayType: m.displayType,
    }));
  }

  res
    .status(httpCode)
    .type("application/problem+json")
    .json({
      type: `https://example.com/problems/${httpCode}`,
      title: "Processing error",
      detail: "Operation failed",
      instance: uri,
      ...extensions,
    });
}
```


---

### Альтернатива: Custom Envelope (TypeScript / Express)

Используй вместо `toResponse()` при работе с BFF или когда фронтенд ожидает единый формат.

```typescript
interface ApiEnvelope<T> {
  success: boolean;
  statusCode: number;
  data: T | null;
  errors: MessageDto[];
  warnings: MessageDto[];
  infos: MessageDto[];
}

interface MessageDto {
  key: string;
  message: string;
  displayType: DisplayType;
}

export function toEnvelope<T>(result: ProcessingResult<T>, uri?: string): [number, ApiEnvelope<T>] {
  const httpCode = STATUS_TO_HTTP[result.status];
  const success = result.isOk();

  const bucket = (type: MessageType): MessageDto[] => {
    let i = 0;
    const key = MESSAGE_TYPE_KEY[type];
    return result.messages
      .filter((m) => m.type === type)
      .map((m) => ({ key: m.messageKey ?? `${key}${i++}`, message: m.message, displayType: m.displayType }));
  };

  return [httpCode, {
    success,
    statusCode: httpCode,
    data: success ? result.value : null,
    errors:   bucket(MessageType.Error),
    warnings: bucket(MessageType.Warning),
    infos:    bucket(MessageType.Info),
  }];
}

// Использование в Express:
// const [status, body] = toEnvelope(result);
// res.status(status).json(body);
```

---

## Python

### Модели и перечисления

```python
from __future__ import annotations
from dataclasses import dataclass, field
from enum import IntEnum
from typing import ClassVar, Generic, TypeVar, Callable, Optional

T = TypeVar("T")
U = TypeVar("U")


class ProcessingStatus(IntEnum):
    UNDEFINED = 0
    OK = 1
    CREATED = 2
    UPDATED = 3
    DELETED = 4
    NOT_FOUND = 5
    ERROR = 6
    NOT_VALID = 7
    ACCESS_DENIED = 8
    UNPROCESSABLE_ENTITY = 9
    CONFLICT = 10


class MessageType(IntEnum):
    UNKNOWN = 0
    INFO = 1
    ERROR = 2
    WARNING = 3


class DisplayType(IntEnum):
    COMMON = 0
    FIELD = 1


@dataclass
class ProcessingMessage:
    message: str
    type: MessageType
    message_key: Optional[str] = None
    display_type: DisplayType = DisplayType.COMMON


@dataclass
class ProcessingResult(Generic[T]):
    status: ProcessingStatus
    value: Optional[T] = None
    messages: list[ProcessingMessage] = field(default_factory=list)

    # Прямое создание через __init__ допустимо только из фабрик.
    # Python не имеет механизма закрытия конструктора — соглашение enforcement.

    _SUCCESS: ClassVar[frozenset] = frozenset({
        ProcessingStatus.OK,
        ProcessingStatus.CREATED,
        ProcessingStatus.UPDATED,
        ProcessingStatus.DELETED,
    })

    def is_ok(self) -> bool:
        return self.status in self._SUCCESS

    def is_undefined(self) -> bool:
        return self.status == ProcessingStatus.UNDEFINED

    def is_not_found(self) -> bool:
        return self.status == ProcessingStatus.NOT_FOUND

    def is_not_valid(self) -> bool:
        return self.status == ProcessingStatus.NOT_VALID

    def is_error(self) -> bool:
        return self.status == ProcessingStatus.ERROR

    def is_access_denied(self) -> bool:
        return self.status == ProcessingStatus.ACCESS_DENIED

    def is_updated(self) -> bool:
        return self.status == ProcessingStatus.UPDATED

    def is_deleted(self) -> bool:
        return self.status == ProcessingStatus.DELETED

    def is_unprocessable_entity(self) -> bool:
        return self.status == ProcessingStatus.UNPROCESSABLE_ENTITY

    def is_conflict(self) -> bool:
        return self.status == ProcessingStatus.CONFLICT

    def convert(self, converter: Optional[Callable[[T], U]] = None) -> "ProcessingResult[U]":
        new_value = converter(self.value) if (self.is_ok() and self.value is not None and converter) else None
        return ProcessingResult(
            status=self.status,
            value=new_value,
            messages=list(self.messages),
        )
```

---

### ProcessingResultFactory (Python)

```python
class ProcessingResultFactory:

    @staticmethod
    def ok(value: T) -> ProcessingResult[T]:
        return ProcessingResult(ProcessingStatus.OK, value)

    @staticmethod
    def created(value: T) -> ProcessingResult[T]:
        return ProcessingResult(ProcessingStatus.CREATED, value)

    @staticmethod
    def updated(value: T) -> ProcessingResult[T]:
        return ProcessingResult(ProcessingStatus.UPDATED, value)

    @staticmethod
    def deleted(value: T) -> ProcessingResult[T]:
        return ProcessingResult(ProcessingStatus.DELETED, value)

    @staticmethod
    def not_found() -> ProcessingResult:
        return ProcessingResult(ProcessingStatus.NOT_FOUND)

    @staticmethod
    def not_valid(messages: list[ProcessingMessage] | None = None) -> ProcessingResult:
        return ProcessingResult(ProcessingStatus.NOT_VALID, messages=messages or [])

    @staticmethod
    def error(message: ProcessingMessage) -> ProcessingResult:
        return ProcessingResult(ProcessingStatus.ERROR, messages=[message])

    @staticmethod
    def access_denied(messages: list[ProcessingMessage] | None = None) -> ProcessingResult:
        return ProcessingResult(ProcessingStatus.ACCESS_DENIED, messages=messages or [])

    @staticmethod
    def conflict(message: ProcessingMessage) -> ProcessingResult:
        return ProcessingResult(ProcessingStatus.CONFLICT, messages=[message])

    @staticmethod
    def unprocessable_entity(message: ProcessingMessage) -> ProcessingResult:
        return ProcessingResult(ProcessingStatus.UNPROCESSABLE_ENTITY, messages=[message])
```

---

### ProcessingMessageFactory (Python)

```python
class ProcessingMessageFactory:

    @staticmethod
    def info(message: str, key: str | None = None, display_type=DisplayType.COMMON) -> ProcessingMessage:
        return ProcessingMessage(message, MessageType.INFO, key, display_type)

    @staticmethod
    def error(message: str, key: str | None = None, display_type=DisplayType.COMMON) -> ProcessingMessage:
        return ProcessingMessage(message, MessageType.ERROR, key, display_type)

    @staticmethod
    def warning(message: str, key: str | None = None, display_type=DisplayType.COMMON) -> ProcessingMessage:
        return ProcessingMessage(message, MessageType.WARNING, key, display_type)
```

---

### HTTP-адаптер (Python / FastAPI)

```python
from fastapi import Response
from fastapi.responses import JSONResponse
from itertools import groupby

STATUS_TO_HTTP = {
    ProcessingStatus.UNDEFINED:           501,
    ProcessingStatus.OK:                  200,
    ProcessingStatus.CREATED:             201,
    ProcessingStatus.UPDATED:             200,
    ProcessingStatus.DELETED:             200,
    ProcessingStatus.NOT_FOUND:           404,
    ProcessingStatus.ERROR:               500,
    ProcessingStatus.NOT_VALID:           400,
    ProcessingStatus.ACCESS_DENIED:       403,
    ProcessingStatus.UNPROCESSABLE_ENTITY: 422,
    ProcessingStatus.CONFLICT:            409,
}

MESSAGE_TYPE_KEY = {
    MessageType.UNKNOWN: "unknowns",
    MessageType.INFO:    "infos",
    MessageType.ERROR:   "errors",
    MessageType.WARNING: "warnings",
}


def to_response(result: ProcessingResult, uri: str | None = None) -> JSONResponse:
    http_code = STATUS_TO_HTTP[result.status]

    if result.is_ok():
        if result.status == ProcessingStatus.CREATED:
            return JSONResponse(content=result.value, status_code=201)
        if result.value is None:
            return Response(status_code=204)
        return JSONResponse(content=result.value, status_code=200)

    extensions: dict = {
        "type": f"https://example.com/problems/{http_code}",
        "title": "Processing error",
        "detail": "Operation failed",
        "instance": uri,
    }
    sorted_messages = sorted(result.messages, key=lambda m: m.type)
    for msg_type, group in groupby(sorted_messages, key=lambda m: m.type):
        key = MESSAGE_TYPE_KEY[msg_type]
        items = []
        group_index = 0
        for m in group:
            msg_key = m.message_key or f"{key}{group_index}"
            group_index += 1
            items.append({"key": msg_key, "message": m.message, "displayType": int(m.display_type)})
        extensions[key] = items

    return JSONResponse(content=extensions, status_code=http_code, media_type="application/problem+json")
```

---

## Bind/chain примеры

### C# bind/chain

```csharp
public static class ProcessingResultBindExtensions
{
    public static async Task<ProcessingResult<TNext>> BindAsync<TCurrent, TNext>(
        this Task<ProcessingResult<TCurrent>> sourceTask,
        Func<TCurrent, Task<ProcessingResult<TNext>>> next)
    {
        ProcessingResult<TCurrent> current = await sourceTask;
        if (!current.IsOk() || current.Value is null)
        {
            return ProcessingResultFactory.Create<TNext>(current.Status, current.Messages);
        }
        return await next(current.Value);
    }
}
```

### TypeScript bind/chain

```typescript
export async function bindAsync<T, U>(
  current: Promise<ProcessingResult<T>>,
  next: (value: T) => Promise<ProcessingResult<U>>,
): Promise<ProcessingResult<U>> {
  const result = await current;
  if (!result.isOk() || result.value == null) {
    return ProcessingResult.create<U>(result.status, null, [...result.messages]);
  }
  return next(result.value);
}
```

### Python bind/chain

```python
async def bind_async(current_coro, next_step):
    current: ProcessingResult = await current_coro
    if not current.is_ok() or current.value is None:
        return ProcessingResult(status=current.status, value=None, messages=list(current.messages))
    return await next_step(current.value)
```

---

## Пример сквозного использования (C#)

```csharp
// Сервис
public async Task<ProcessingResult<UserDto>> CreateUserAsync(CreateUserRequest request)
{
    if (await _repository.ExistsByEmailAsync(request.Email))
        return ProcessingResultFactory.Conflict<UserDto>(
            ProcessingMessageFactory.Error("Email уже занят", "email", DisplayType.Field));

    var user = new User(request.Email, request.Name);
    await _repository.AddAsync(user);

    return ProcessingResultFactory.Created(UserDto.From(user));
}

// Контроллер
[HttpPost]
public async Task<ActionResult> CreateUser(CreateUserRequest request)
{
    var result = await _userService.CreateUserAsync(request);
    return result.ConvertToActionResult<User, UserDto>(Request.Path);
}

// HTTP-ответ при конфликте (409):
// {
//   "detail": "Conflict",
//   "instance": "/api/users",
//   "errors": [{ "key": "email", "message": "Email уже занят", "displayType": 1 }]
// }
```

---

## Пример сквозного использования (TypeScript)

```typescript
// service.ts
export async function createUser(input: CreateUserRequest): Promise<ProcessingResult<UserDto>> {
  const exists = await userRepo.existsByEmail(input.email);
  if (exists) {
    return ProcessingResult.conflict<UserDto>(
      ProcessingMessageFactory.error("Email уже занят", "email", DisplayType.Field),
    );
  }
  const entity = await userRepo.create(input);
  return ProcessingResult.created<UserDto>(toUserDto(entity));
}

// route.ts
app.post("/api/users", async (req, res) => {
  const result = await createUser(req.body);
  toResponse(result, res, req.path);
});
```

---

## Пример сквозного использования (Python)

```python
# service.py
async def create_user(request: CreateUserRequest) -> ProcessingResult[dict]:
    if await repo.exists_by_email(request.email):
        return ProcessingResultFactory.conflict(
            ProcessingMessageFactory.error("Email уже занят", "email", DisplayType.FIELD)
        )
    user = await repo.create(request)
    return ProcessingResultFactory.created({"id": user.id, "email": user.email})

# router.py
@router.post("/api/users")
async def create_user_endpoint(request: CreateUserRequest):
    result = await create_user(request)
    return to_response(result, "/api/users")
```
