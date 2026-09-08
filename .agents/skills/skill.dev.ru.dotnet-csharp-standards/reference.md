# C# стандарты — справочник (примеры)

Дополнение к `SKILL.md`. Читай при сомнениях в форматировании или именовании.

## Порядок модификаторов (ориентир)

В C# на одном объявлении члена задаётся **одна** валидная цепочка; типичный стиль (в духе документации Microsoft): модификатор доступа первым, затем `static` при необходимости, затем `abstract` / `virtual` / `override` / `sealed` в допустимых сочетаниях.

```csharp
public abstract class Base
{
    public abstract void M();
}

public sealed class Derived : Base
{
    public override void M() { }
}
```

Группируй члены по уровню доступа (`public` перед `private` и т.д.), как в `SKILL.md`; внутри группы порядок — на усмотрение команды, если он единообразен.

## Файловое пространство имён (предпочтительно для новых файлов)

```csharp
using System;

namespace MyApp.Feature;

public sealed class ExampleService
{
}
```

## Именование: примеры enum

```csharp
// Хуже читается — префиксы значений дублируют имя типа
public enum Teams
{
    TeamsAlpha,
    TeamsBeta,
}

// Предпочтительно
public enum Team
{
    Alpha,
    Beta,
    Delta,
}
```

## Переносы LINQ (отступ +4 на уровень вложенности)

```csharp
return AppDomain.CurrentDomain.GetAssemblies()
    .Where(assembly => !assembly.IsDynamic)
    .SelectMany(assembly => assembly.GetExportedTypes())
    .Where(type => type.IsInterface)
    .Where(type => componentType.IsAssignableFrom(type))
    .OrderBy(type => type.FullName)
    .ToList();
```

## Лямбды: имя параметра

```csharp
// Нежелательно: сокращение параметра не раскрывает смысл
var sanitized = string.Concat(name.Select(ch => ch == ' ' ? '-' : ch));

// Предпочтительно: параметр читается без контекста
var sanitized = string.Concat(name.Select(character => character == ' ' ? '-' : character));
```

## if с длинным условием

```csharp
if (FirstVeryLongCondition() && SecondVeryLongCondition() &&
    ThirdVeryLongCondition())
{
    DoSomething();
}
```

## switch expression

```csharp
static decimal GetDiscountInPercent(DayOfWeek? dayOfWeek) => dayOfWeek switch
{
    DayOfWeek.Monday => 0.5m,
    DayOfWeek.Tuesday => 12.5m,
    _ => 0.0m,
};
```

## Событие: подписка и безопасный вызов

```csharp
public event EventHandler? SomethingHappened;

protected virtual void OnSomethingHappened(EventArgs e)
{
    SomethingHappened?.Invoke(this, e);
}
```

Подписка без явного `new EventHandler(...)`:

```csharp
instance.SomethingHappened += Instance_SomethingHappened;
```

## using declaration

```csharp
using var stream = File.OpenRead(path);
// stream освободится в конце области видимости блока
```

## `var` и явный тип

```csharp
// Предпочтительно оставить var: тип очевиден из new
var request = new ArtifactGenerationRequest(path, output, TargetNotation.Mermaid);

// Предпочтительно явный тип: справа сложный контракт/дженерики
Dictionary<string, object?> data = deserializer.Deserialize<Dictionary<string, object?>>(yaml);
```

## XML-документация (русский, без пустых строк между тегами)

```csharp
/// <summary>
/// Определяет, требуется ли перенос данных для указанного адреса и пакета.
/// </summary>
/// <param name="address">Адрес назначения.</param>
/// <param name="package">Пакет для проверки.</param>
/// <returns>True, если перенос необходим; иначе false.</returns>
public bool NeedTransfer(string address, Package package)
```

## Валидация (один исход)

```csharp
if (/* условие ошибки */)
{
    // при необходимости лог/сообщение
    return false;
}

return true;
```

## Валидация (несколько проверок)

```csharp
var isValidatedRequest = true;

if (/* первая ошибка */)
{
    // зафиксировать сообщение
    isValidatedRequest = false;
}

if (/* вторая ошибка */)
{
    isValidatedRequest = false;
}

return isValidatedRequest;
```

## EF Core: практика

- **Миграции:** имя в PascalCase, отражает смысл (`AddOrderStatusColumn`); при коллизии имён в команде — суффикс даты или инициалов. После изменения модели проверяй сгенерированный `Up`/`Down` на соответствие ожиданиям для целевой СУБД.
- **Контекст:** держи `DbSet<>` и конфигурации согласованными с границами домена; общие соглашения об именовании таблиц/схем — в `OnModelCreating` или отдельных `IEntityTypeConfiguration<>`.
- **`EF.Functions`:** при использовании в запросах комментируй зависимость от провайдера (например `ILike` и PostgreSQL).

## EF: вложенная JSON-сущность

- Тип: `SomeChildJsonEntity` с `<remarks>` про хранение в JSON.
- В родителе: навигация `SomeChild` (FK) отдельно от `SomeInnerChild` (jsonb).
- Конфигурация: `.Property(e => e.SomeInnerChild).HasColumnType("jsonb")` и `HasOne`/`WithMany` для обычной связи.

## Mapster: явная конфигурация

Минимум — именованная конфигурация для пары типов (удобно искать и ревьюить):

```csharp
TypeAdapterConfig<SomeModelA, SomeModelB>.NewConfig()
    .Map(dest => dest.DisplayName, src => src.Name);
```

Централизованная регистрация через `IRegister` (или вызов из композиции DI при старте приложения):

```csharp
public sealed class OrderMappingRegister : IRegister
{
    public void Register(TypeAdapterConfig config)
    {
        config.NewConfig<OrderEntity, OrderDto>()
            .Map(dest => dest.Id, src => src.OrderId);
    }
}
```

После изменения маппинга прогоняй тесты/смоук на затронутых API: Mapster не ловит все несоответствия на этапе компиляции.

## Async/await examples

```csharp
public async Task<OrderDto> GetOrderAsync(Guid orderId, CancellationToken cancellationToken)
{
    var entity = await _dbContext.Orders
        .AsNoTracking()
        .FirstOrDefaultAsync(order => order.Id == orderId, cancellationToken)
        .ConfigureAwait(false);

    if (entity is null)
    {
        throw new OrderNotFoundException(orderId);
    }

    return _mapper.Map<OrderDto>(entity);
}
```

```csharp
// Антипаттерн
var result = _service.GetOrderAsync(id, cancellationToken).Result;

// Предпочтительно
var result = await _service.GetOrderAsync(id, cancellationToken);
```

## Exception handling examples

```csharp
try
{
    await _externalClient.SendAsync(request, cancellationToken);
}
catch (HttpRequestException exception)
{
    _logger.LogWarning(exception, "Network call failed");
    throw;
}
```

```csharp
// Антипаттерн: теряется исходный stack trace
catch (Exception exception)
{
    throw exception;
}
```

## Record and record struct examples

```csharp
public sealed record CreateOrderCommand(Guid CustomerId, IReadOnlyList<Guid> ProductIds);

public readonly record struct Money(decimal Amount, string Currency);
```

```csharp
public sealed class OrderDomainEntity
{
    public Guid Id { get; init; }
    public required string Number { get; init; }
}
```

## Dependency injection examples

```csharp
public sealed class OrderService
{
    private readonly IOrderRepository _orderRepository;
    private readonly IClock _clock;

    public OrderService(IOrderRepository orderRepository, IClock clock)
    {
        _orderRepository = orderRepository;
        _clock = clock;
    }
}
```

```csharp
// Антипаттерн: Service Locator в бизнес-логике
public sealed class BadOrderService
{
    private readonly IServiceProvider _serviceProvider;

    public BadOrderService(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public IOrderRepository GetRepository() => _serviceProvider.GetRequiredService<IOrderRepository>();
}
```

## IDisposable and IAsyncDisposable examples

```csharp
public sealed class BufferedWriter : IAsyncDisposable
{
    private readonly StreamWriter _writer;

    public BufferedWriter(Stream stream)
    {
        _writer = new StreamWriter(stream);
    }

    public async ValueTask DisposeAsync()
    {
        await _writer.DisposeAsync();
    }
}
```

```csharp
await using var writer = new BufferedWriter(stream);
await writer.WriteLineAsync("payload");
```

## Постфиксы моделей API

| Сценарий        | Постфикс в имени типа   |
|----------------|-------------------------|
| Только создание | `ToCreate`              |
| Обновление      | `ToUpdate` или `Patch`  |
| Upsert          | `ToCreateOrUpdate`      |

## Приватная константа

Если команда следует правилу «как у приватного поля»: **camelCase с префиксом `_`**. Публичные константы чаще остаются **PascalCase**.
