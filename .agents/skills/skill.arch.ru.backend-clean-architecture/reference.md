---
name: skill.arch.ru.backend-clean-architecture.reference
description: >-
  Reference for skill.arch.ru.backend-clean-architecture: project/module
  structure, naming table, and C# code templates aligned with Clean Architecture
  + CQRS.
---

# Справочник: структура, именование, шаблоны кода

---

## Структура доменного модуля (Core-проект)

```
{DomainName}/
├── Domain/
│   ├── Models/                       ← Rich Domain Entities ({Entity}DomainEntity)
│   ├── States/                       ← {Entity}DraftState, {Entity}ActiveState
│   ├── Constants/                    ← константы домена
│   ├── Enums/                        ← перечисления домена
│   ├── Exceptions/                   ← доменные исключения
│   ├── Events/                       ← Domain Events ({Entity}{PastTense}DomainEvent) (опционально)
│   ├── Resources/                    ← локализованные строки (если нужны)
│   └── Contracts/                    ← интерфейсы + контрактные модели
│       ├── I{Entity}Repository
│       ├── I{Entity}ReadRepository   ← прямая проекция для Query-side (возвращает DTO / read-модель)
│       ├── I{Domain}Service
│       ├── I{Entity}Provider
│       ├── I{Entity}State
│       ├── I{Domain}EventPublisher   ← (опционально) публикация Domain Events
│       ├── I{Domain}UnitOfWork       ← (опционально) транзакция через несколько репозиториев
│       └── Models/                   ← {Entity}RepositoryInput, {Entity}RepositoryResult
├── Commands/                         ← CQRS write-side (Use Cases; намеренно вне Domain/)
│   ├── {Action}{Entity}Command
│   ├── Handlers/
│   │   └── {Command}Handler
│   ├── Validators/
│   │   └── {Command}Validator
│   ├── Decorators/                   ← (опционально) pre/post перехватчики
│   └── Facades/                      ← (опционально) для сложных операций
│       ├── {Operation}Command
│       └── Handlers/
├── Queries/                          ← CQRS read-side (Use Cases; намеренно вне Domain/)
│   ├── {Get}{Entity}{Criteria}Query
│   ├── Handlers/
│   ├── Validators/
│   └── Decorators/
├── Services/                         ← реализации I{Domain}Service
│   └── {Domain}Service
├── Configuration/                    ← регистрация сервисов модуля
│   └── {Domain}ServiceRegistrar
└── Utilities/                        ← билдеры, парсеры, конвертеры
```

---

## Структура Common-модуля

```
Common/
├── Clients/
│   └── {ExternalSystem}/
│       ├── Contracts/     ← I{System}Client
│       ├── Models/
│       └── Settings/
├── Constants/             ← глобальные: Cache, Config, Format, Regex, Mime
├── Contracts/             ← ICurrentUserContext, IDateTimeProvider
├── Utilities/
│   ├── Builders/
│   └── Converters/        ← конвертеры типов (date, decimal)
├── Helpers/               ← DateHelper, StringHelper, ValidationHelper
└── Configuration/         ← {Common}ServiceRegistrar
```

---

## Структура Api-проекта

```
{Product}.Api/
├── Controllers/
│   ├── {Feature}Controller          ← один контроллер на домен
│   └── Integrations/                ← входящие вызовы внешних систем
├── Dto/
│   └── {Feature}/
│       ├── {Entity}Dto
│       ├── {Entity}ShortInfoDto
│       ├── {Entity}DetailDto
│       ├── {Action}{Entity}CommandRequestDto
│       ├── Get{Entity}{Criteria}QueryRequestDto
│       ├── {Entity}ResponseDto
│       └── {Entity}FilterDto
├── Constants/
│   └── {Scope}Constants             ← роли, версии, схемы авторизации
├── Configuration/
│   ├── {Feature}ServiceRegistrar    ← один файл на модуль
│   └── Mappings/
│       └── {Feature}MappingRegistrar ← Domain Result → DTO; RequestDto → Command
└── Utilities/
    └── {Feature}/
        ├── Factories/
        └── Helpers/
```

---

## Структура Infrastructure-проекта

```
{Product}.Infrastructure/
├── Persistence/
│   ├── Context/
│   │   └── {Domain}DbContext
│   ├── Models/
│   │   └── {Entity}Record
│   ├── Repositories/
│   │   └── {Entity}Repository
│   ├── Migrations/
│   └── Configuration/
│       └── {Feature}PersistenceMappingRegistrar
├── Clients/
│   └── {ExternalSystem}/
│       ├── Contracts/
│       ├── Models/
│       └── {ExternalSystem}Client
├── Messaging/
│   ├── Publishers/
│   └── Consumers/
├── Configuration/
│   └── {Feature}InfrastructureRegistrar
└── Settings/
    └── {Feature}Options
```

---

## Полная таблица именования

| Объект | Шаблон | Пример |
|---|---|---|
| Интерфейс | `I{Name}` | `IOrderService` |
| Rich Domain Entity | `{Entity}DomainEntity` | `OrderDomainEntity` |
| Value Object | `{Concept}ValueObject` | `MoneyValueObject` |
| Domain Event | `{Entity}{PastTense}DomainEvent` | `OrderSubmittedDomainEvent` |
| Event Publisher (интерфейс) | `I{Domain}EventPublisher` | `IOrderEventPublisher` |
| Unit of Work (интерфейс) | `I{Domain}UnitOfWork` | `IOrderUnitOfWork` |
| Domain Service (без инфра) | `{Entity}{Operation}DomainService` | `OrderDiscountDomainService` |
| Интерфейс доменного сервиса | `I{Domain}Service` | `IOrderProcessingService` |
| Реализация доменного сервиса | `{Domain}Service` | `OrderProcessingService` |
| Команда | `{Action}{Entity}Command` | `CreateOrderCommand`, `CancelPaymentCommand` |
| Запрос | `Get{Entity}{Criteria}Query` | `GetOrderByIdQuery`, `GetUserOrdersQuery` |
| Handler команды | `{Command}Handler` | `CreateOrderCommandHandler` |
| Handler запроса | `{Query}Handler` | `GetOrderByIdQueryHandler` |
| Валидатор | `{Command|Query}Validator` | `CreateOrderCommandValidator` |
| Декоратор (pre) | `{Command}Decorator` | `CreateOrderCommandDecorator` |
| Декоратор (post) | `{Command}PostDecorator` | `CreateOrderCommandPostDecorator` |
| Фасад-команда | `{Operation}Command` | `ProcessCheckoutCommand` |
| Контроллер | `{Feature}Controller` | `OrdersController` |
| Провайдер (интерфейс) | `I{Entity}Provider` | `ICurrentUserProvider`, `ITaxRateProvider` |
| Репозиторий (интерфейс) | `I{Entity}Repository` | `IOrderRepository` |
| Репозиторий (реализация) | `{Entity}Repository` | `OrderRepository` |
| ORM-запись | `{Entity}Record` | `OrderRecord` |
| DI-регистратор | `{Feature}ServiceRegistrar` | `OrdersServiceRegistrar` |
| Маппинг-регистратор | `{Feature}MappingRegistrar` | `OrdersMappingRegistrar` |
| Инфра-регистратор | `{Feature}InfrastructureRegistrar` | `OrdersInfrastructureRegistrar` |
| Конфигурация | `{Feature}Settings` / `{Feature}Options` | `PaymentSettings` |
| Domain Exception | `{Domain}{Problem}Exception` | `InsufficientFundsException` |
| Enum / статус | `{Entity}Status`, `{Entity}Type` | `OrderStatus` |
| State-реализация | `{Entity}DraftState`, `{Entity}ActiveState` | `OrderDraftState` |
| State Provider | `I{Entity}StateProvider` | `IOrderStateProvider` |
| Контрактные модели | `{Entity}RepositoryInput` | `OrderRepositoryInput` |

---

## Объекты по слоям (полная карта)

| Объект | Слой |
|---|---|
| `{Entity}DomainEntity` | Domain |
| `{Concept}ValueObject` | Domain |
| `{Entity}{Operation}DomainService` | Domain |
| Domain Exception, Enum, Constants | Domain |
| State-реализации (`{Entity}DraftState`) | Domain |
| `I{Entity}Repository`, `I{Entity}ReadRepository`, `I{Domain}Service`, `I{Entity}Provider`, `I{Entity}State`, `I{Domain}UnitOfWork`, `I{Domain}EventPublisher` | Domain / Contracts |
| Контрактные модели (`{Entity}RepositoryInput`) | Domain / Contracts / Models |
| `{Action}{Entity}Command`, `Get{Entity}{Criteria}Query` | Use Cases |
| `{Command}Handler`, `{Query}Handler` | Use Cases |
| `{Command}Validator`, `{Query}Validator` | Use Cases |
| `{Command}Decorator`, `{Command}PostDecorator` | Use Cases |
| Facade Command + Handler | Use Cases |
| `{Domain}Service` (реализация `I{Domain}Service`) | Use Cases |
| `ICommandDispatcher`, `IQueryDispatcher` | Use Cases / Common |
| `{Feature}Controller` | Interface Adapters |
| Все DTO | Interface Adapters |
| `{Feature}MappingRegistrar`, `{Feature}ServiceRegistrar` | Interface Adapters |
| `{Scope}Constants`, `{Feature}Constants` | Interface Adapters |
| DbContext (`{Domain}DbContext`) | Infrastructure |
| `{Entity}Record` (ORM) | Infrastructure |
| `{Entity}Repository` (реализация) | Infrastructure |
| `{Feature}PersistenceMappingRegistrar` | Infrastructure |
| Domain Events (`{Entity}{PastTense}DomainEvent`) | Domain / Events |
| HTTP-клиент, Queue Publisher, Email-сервис | Infrastructure |
| `{Domain}UnitOfWork` (реализация) | Infrastructure |
| `{Domain}EventPublisher` (реализация) | Infrastructure |
| `{Feature}Settings`, `{Feature}Options` | Infrastructure |
| `{Feature}InfrastructureRegistrar` | Infrastructure |
| Миграции / SeedData | Infrastructure |
| `main` / `Program`, `AppServiceRegistrar` | Composition Root |

---

## Платформо-специфичные заметки (.NET)

### Result-паттерн: библиотеки (.NET)

| Библиотека | NuGet | Особенность |
|---|---|---|
| `ErrorOr` | `ErrorOr` | Простой; `ErrorOr<T>` как возвращаемый тип метода |
| `OneOf` | `OneOf` | Discriminated Union; подходит для > 2 вариантов исхода |
| `FluentResults` | `FluentResults` | Богатый API; `Result<T>` с коллекцией ошибок и successes |

Выбор — командное соглашение. Все три совместимы с подходом из §4 SKILL.md.

---

## Шаблоны кода (C# / псевдокод)

### Rich Domain Entity

```csharp
public sealed class OrderDomainEntity
{
    private readonly List<OrderItem> _items = new();

    public Guid Id { get; private set; }
    public Guid CustomerId { get; private set; }
    public OrderStatus Status { get; private set; }
    public IReadOnlyList<OrderItem> Items => _items.AsReadOnly();

    public OrderDomainEntity(Guid customerId)
    {
        if (customerId == Guid.Empty)
            throw new OrderDomainException("CustomerId is required");

        Id = Guid.NewGuid();
        CustomerId = customerId;
        Status = OrderStatus.Draft;
    }

    public void Submit()
    {
        if (Status != OrderStatus.Draft)
            throw new OrderDomainException("Only Draft orders can be submitted");

        Status = OrderStatus.Submitted;
    }

    public void AddItem(Guid productId, int quantity, decimal price)
    {
        if (Status != OrderStatus.Draft)
            throw new OrderDomainException("Cannot add items to non-Draft order");
        if (quantity <= 0)
            throw new OrderDomainException("Quantity must be positive");

        _items.Add(new OrderItem(productId, quantity, price));
    }
}
```

### Domain Entity vs ORM Entity (разделение)

```csharp
// Domain/Models/ — без ORM-атрибутов
public sealed class OrderDomainEntity { /* см. выше */ }

// Infrastructure/Persistence/Models/ — только ORM
public sealed class OrderRecord
{
    [Column("id")]
    public Guid Id { get; set; }

    [Column("customer_id")]
    public Guid CustomerId { get; set; }

    [Column("status")]
    public string Status { get; set; } = default!;

    public List<OrderItemRecord> Items { get; set; } = new();
}

// Infrastructure/Persistence/ — единственное место маппинга Domain ↔ ORM
public sealed class OrderRepository : IOrderRepository
{
    private readonly AppDbContext _db;

    public OrderRepository(AppDbContext db) => _db = db;

    public async Task<OrderDomainEntity?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var record = await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

        return record is null ? null : ToDomain(record);
    }

    public async Task UpdateAsync(OrderDomainEntity order, CancellationToken ct)
    {
        var record = await _db.Orders.FindAsync([order.Id], cancellationToken: ct)
            ?? throw new InvalidOperationException("Order record not found");

        ApplyChanges(order, record);
        // SaveChanges не вызывается здесь, если транзакция управляется через Unit of Work.
        // Коммит выполняется централизованно в I{Domain}UnitOfWork.CommitAsync().
    }

    private static OrderDomainEntity ToDomain(OrderRecord r) =>
        RestoreFromRecord(
            r.Id,
            r.CustomerId,
            Enum.Parse<OrderStatus>(r.Status),
            r.Items.Select(i => new OrderItem(i.ProductId, i.Quantity, i.Price)).ToList());

    private static void ApplyChanges(OrderDomainEntity e, OrderRecord r)
    {
        r.Status = e.Status.ToString();
        // маппинг остальных полей
    }

    // Демонстрационный пример: здесь может быть любая эквивалентная логика восстановления
    // (static factory method, internal constructor, отдельный mapper и т.д.).
    private static OrderDomainEntity RestoreFromRecord(
        Guid id,
        Guid customerId,
        OrderStatus status,
        List<OrderItem> items)
    {
        var entity = new OrderDomainEntity(customerId);
        if (status == OrderStatus.Submitted)
            entity.Submit();

        foreach (var item in items)
            entity.AddItem(item.ProductId, item.Quantity, item.Price);

        return entity;
    }
}
```

### Command Handler

```csharp
public sealed class SubmitOrderCommandHandler : ICommandHandler<SubmitOrderCommand>
{
    private readonly IOrderRepository _repository;

    public SubmitOrderCommandHandler(IOrderRepository repository)
        => _repository = repository;

    public async Task HandleAsync(SubmitOrderCommand command, CancellationToken ct)
    {
        var order = await _repository.GetByIdAsync(command.OrderId, ct)
            ?? throw new OrderNotFoundException(command.OrderId);

        order.Submit();                         // бизнес-правило в Entity

        await _repository.UpdateAsync(order, ct);
    }
}
```

### Query Handler

```csharp
// Предпочтительный вариант: ReadRepository возвращает DTO напрямую (без Domain Entity)
public sealed class GetOrderByIdQueryHandler : IQueryHandler<GetOrderByIdQuery, OrderDto>
{
    private readonly IOrderReadRepository _readRepository;

    public GetOrderByIdQueryHandler(IOrderReadRepository readRepository)
        => _readRepository = readRepository;

    public async Task<OrderDto> HandleAsync(GetOrderByIdQuery query, CancellationToken ct)
    {
        return await _readRepository.GetProjectionByIdAsync(query.OrderId, ct)
            ?? throw new OrderNotFoundException(query.OrderId);
    }
}

// Domain/Contracts/
public interface IOrderReadRepository
{
    Task<OrderDto?> GetProjectionByIdAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<OrderShortInfoDto>> GetListAsync(OrderFilterDto filter, CancellationToken ct);
}
```

### Controller

```csharp
[ApiController]
[Route("api/orders")]
public sealed class OrdersController : ControllerBase
{
    private readonly ICommandDispatcher _commands;
    private readonly IQueryDispatcher   _queries;
    private readonly IMapper            _mapper;

    public OrdersController(
        ICommandDispatcher commands,
        IQueryDispatcher queries,
        IMapper mapper)
    {
        _commands = commands;
        _queries  = queries;
        _mapper   = mapper;
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateOrderCommandRequestDto dto, CancellationToken ct)
    {
        await _commands.DispatchAsync(_mapper.Map<CreateOrderCommand>(dto), ct);
        return Ok();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<OrderDto>> GetById(Guid id, CancellationToken ct)
    {
        var result = await _queries.DispatchAsync(new GetOrderByIdQuery(id), ct);
        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _commands.DispatchAsync(new DeleteOrderCommand(id), ct);
        return NoContent();
    }
}
```

### PostDecorator (cross-cutting)

```csharp
public sealed class SubmitOrderCommandPostDecorator : ICommandHandler<SubmitOrderCommand>
{
    private readonly ICommandHandler<SubmitOrderCommand> _inner;
    private readonly INotificationService _notificationService;
    private readonly IAuditLog _auditLog;
    private readonly ILogger<SubmitOrderCommandPostDecorator> _logger;

    public SubmitOrderCommandPostDecorator(
        ICommandHandler<SubmitOrderCommand> inner,
        INotificationService notificationService,
        IAuditLog auditLog,
        ILogger<SubmitOrderCommandPostDecorator> logger)
    {
        _inner = inner;
        _notificationService = notificationService;
        _auditLog = auditLog;
        _logger = logger;
    }

    public async Task HandleAsync(SubmitOrderCommand command, CancellationToken ct)
    {
        try
        {
            await _inner.HandleAsync(command, ct);
            await _notificationService.SendAsync(command.OrderId, ct);
            await _auditLog.WriteAsync("order.submit.completed", command.OrderId, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SubmitOrderCommand failed for OrderId={OrderId}", command.OrderId);
            throw;
        }
    }
}
```

### Facade (сложная операция)

```csharp
public sealed class ProcessCheckoutCommandHandler : ICommandHandler<ProcessCheckoutCommand>
{
    private readonly ICommandDispatcher _commandDispatcher;

    public ProcessCheckoutCommandHandler(ICommandDispatcher commandDispatcher)
        => _commandDispatcher = commandDispatcher;

    public async Task HandleAsync(ProcessCheckoutCommand command, CancellationToken ct)
    {
        switch (command.Type)
        {
            case CheckoutType.Standard:
                await _commandDispatcher.DispatchAsync(
                    new CreateStandardOrderCommand(command.OrderId),
                    ct);
                break;
            case CheckoutType.Express:
                await _commandDispatcher.DispatchAsync(
                    new CreateExpressOrderCommand(command.OrderId),
                    ct);
                break;
            default:
                throw new InvalidOperationException($"Unsupported checkout type: {command.Type}");
        }

        await _commandDispatcher.DispatchAsync(new ReservePaymentCommand(command.OrderId), ct);
        await _commandDispatcher.DispatchAsync(new NotifyWarehouseCommand(command.OrderId), ct);
    }
}
```

---

## Поток данных через слои

```
HTTP Request (JSON)
  ↓
Controller (Interface Adapters)        ← валидирует формат, авторизует
  ↓
{Action}{Entity}CommandRequestDto      ← входной DTO уровня API
  ↓
{Action}{Entity}Command                ← входной контракт Use Case
  ↓
CommandHandler (Use Cases)             ← оркестрирует Domain и репозитории
  ↓
{Entity}DomainEntity                   ← выполняет бизнес-правила
  ↓
I{Entity}Repository (контракт)         ← сохраняет через интерфейс
  ↓
{Entity}Repository (Infrastructure)   ← реализует через ORM
  ↓
{Entity}Record                         ← маппинг в хранилище
  ↓
Domain Result                          ← возврат через слои
  ↓
{Entity}ResponseDto                    ← маппинг в DTO (Interface Adapters)
  ↓
HTTP Response (JSON)
```

---

## Паттерны второго порядка

### Aggregate Root (границы агрегата)

```csharp
// Корень агрегата — единственная точка входа для изменений
public sealed class OrderDomainEntity            // ← Aggregate Root
{
    private readonly List<OrderItem> _items = new();
    public IReadOnlyList<OrderItem> Items => _items.AsReadOnly();

    // Вложенная Entity управляется только через корень
    public void AddItem(Guid productId, int quantity, decimal price)
    {
        // ... инварианты ...
        _items.Add(new OrderItem(productId, quantity, price));
    }

    public void RemoveItem(Guid itemId)
    {
        var item = _items.FirstOrDefault(i => i.Id == itemId)
            ?? throw new OrderDomainException("Item not found");
        _items.Remove(item);
    }
}

// Вложенная Entity — нет публичного конструктора вне агрегата
public sealed class OrderItem                    // ← Child Entity
{
    public Guid    Id        { get; private set; }
    public Guid    ProductId { get; private set; }
    public int     Quantity  { get; private set; }
    public decimal Price     { get; private set; }

    internal OrderItem(Guid productId, int quantity, decimal price)
    {
        Id = Guid.NewGuid(); ProductId = productId;
        Quantity = quantity; Price = price;
    }
}

// Репозиторий только для корня — НЕТ IOrderItemRepository
public interface IOrderRepository
{
    Task<OrderDomainEntity?> GetByIdAsync(Guid id, CancellationToken ct);
    Task UpdateAsync(OrderDomainEntity order, CancellationToken ct);
}
```

### State Pattern (lifecycle сущности)

```
// Domain/Contracts/
I{Entity}State {
  approve(...)
  reject(...)
  cancel(...)
}

I{Entity}StateProvider {
  getState(entity: {Entity}DomainEntity): I{Entity}State
}

// Domain/States/ — бизнес-логика переходов (в Domain, не в Adapters)
{Entity}DraftState  : I{Entity}State { ... }
{Entity}ActiveState : I{Entity}State { ... }
{Entity}ClosedState : I{Entity}State { ... }
```

### Provider Pattern

```
// Domain/Contracts/
ICurrentUserProvider    ← кто сделал запрос
IManagerProvider        ← непосредственный руководитель
ITaxRateProvider        ← налоговая ставка для региона
IExchangeRateProvider   ← курс валют
```

### Validation Service

```
// Domain/Contracts/
I{Domain}ValidationService {
  validate(data): ValidationResult
}

// {Domain}/Services/ — реализация: {Domain}ValidationService
// Реализует I{Domain}ValidationService; использует I{Entity}Repository через DI
```

### Domain Events (опционально)

```
// Domain/Events/
{Entity}{PastTense}DomainEvent {
  entityId: ID
  occurredAt: DateTime
  // только данные, нужные подписчикам; без бизнес-логики
}

// Domain/Contracts/
I{Domain}EventPublisher {
  publish(event: {Entity}{PastTense}DomainEvent): void
}

// Infrastructure — реализует I{Domain}EventPublisher
{Domain}EventPublisher : I{Domain}EventPublisher {
  publish(event) {
    messageBus.send(event)   ← или in-process dispatcher
  }
}

// Публикация в CommandHandler или PostDecorator
{Command}PostDecorator {
  Handle(command) {
    result = inner.Handle(command)
    eventPublisher.publish(new OrderSubmittedDomainEvent(result.entityId))
    return result
  }
}
```

### Unit of Work (опционально, для multi-repo транзакций)

```
// Domain/Contracts/
I{Domain}UnitOfWork {
  CommitAsync(): Task
}

// Infrastructure — реализует I{Domain}UnitOfWork через DbContext
{Domain}UnitOfWork : I{Domain}UnitOfWork {
  CommitAsync() { dbContext.SaveChangesAsync() }
}

// CommandHandler — использует вместо repository.Save() в каждом репозитории
{Command}Handler {
  Handle(command) {
    order = orderRepository.GetById(command.orderId)
    order.submit()
    orderRepository.Update(order)          ← только помечает изменение

    payment = paymentRepository.GetById(command.paymentId)
    payment.reserve(order.Total)
    paymentRepository.Update(payment)

    await unitOfWork.CommitAsync()         ← единственный коммит транзакции
  }
}
```
