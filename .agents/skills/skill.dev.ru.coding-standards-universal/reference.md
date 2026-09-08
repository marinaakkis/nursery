# Reference: skill.dev.ru.coding-standards-universal

## 1) Именование: good / bad

### Классы, интерфейсы, сервисы

| Контекст | Good | Bad |
|---|---|---|
| Класс | `OrderService` | `order_service`, `OrderServiceHelperManager` |
| Интерфейс (.NET) | `IOrderRepository` | `OrderRepositoryInterface` |
| Интерфейс (Python Protocol/ABC) | `OrderRepository` | `IOrderRepository` |
| Enum value | `OrderStatus.Paid` | `OrderStatus.OrderStatusPaid` |

### Переменные и поля

| Контекст | Good | Bad |
|---|---|---|
| Локальная переменная | `orderItem` | `Order_Item`, `x` (без контекста) |
| Приватное поле (C-подобные) | `_repository` | `repository`, `m_repository` |
| Приватное поле (Python) | `_repository` | `repository` |
| Константа (Python) | `MAX_RETRY_COUNT` | `MaxRetryCount` |

## 2) Постфиксы запросных моделей

| Сценарий | Good | Bad |
|---|---|---|
| Создание | `OrderToCreate` | `CreateOrderRequestModelV2` |
| Полное обновление | `OrderToUpdate` | `OrderUpdatePayloadFull` |
| Частичное обновление | `OrderPatch` | `OrderToPatchUpdate` |
| Create or update | `OrderToCreateOrUpdate` | `OrderUpsertPayloadModel` |
| Удаление | `DeleteOrderRequest` или `orderId` | `OrderToDelete` |

> Для удаления постфикс `ToDelete` не вводится как универсальный стандарт.

## 3) Пример структуры типа (порядок членов)

```csharp
public sealed class OrderService : IOrderService
{
    private const int _maxRetryCount = 3;
    private readonly IOrderRepository _repository;

    public string ServiceName { get; }

    public OrderService(IOrderRepository repository)
    {
        _repository = repository;
        ServiceName = nameof(OrderService);
    }

    public Order GetById(int orderId)
    {
        if (orderId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(orderId));
        }

        return _repository.GetById(orderId);
    }

    private bool IsValid(Order order)
    {
        return order is not null;
    }
}
```

## 4) Краевые случаи

- **Python name mangling:** `__token` используй только когда нужно ограничить доступ из подклассов; базовый вариант для "непубличного" члена — `_token`.
- **Python Final:** для неизменяемых значений используй `Final`, для запрета переопределения класса/метода — `@final` из `typing`.
- **Go/Rust:** формат и стиль именования определяются языковыми конвенциями и инструментами (`gofmt`, `rustfmt`) или профильным языковым скиллом проекта.
