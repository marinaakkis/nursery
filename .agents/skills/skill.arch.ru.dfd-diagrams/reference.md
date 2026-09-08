# DFD Reference: примеры, нотации, краевые случаи

## Инструмент: Structurizr DSL

Ни Mermaid, ни PlantUML не поддерживают DFD нативно.
Используй **Structurizr DSL** как основной инструмент — он поддерживает элементы DFD через модель `softwareSystem` + `container` + `relationship`.
При использовании другого инструмента (draw.io, Lucidchart) — укажи ограничения в комментарии к файлу.

---

## Нотации: Yourdon-DeMarco vs Gane-Sarson

**Дефолт: Gane-Sarson** (применяй, если не указано иное).

| Элемент | Yourdon-DeMarco | Gane-Sarson |
|---|---|---|
| Процесс | Круг / эллипс | Прямоугольник с закруглёнными углами (rounded rectangle) |
| Хранилище данных | Две параллельные линии (открытый прямоугольник) | Прямоугольник с именем внутри |
| Внешний субъект | Прямоугольник | Прямоугольник (идентично) |
| Поток данных | Именованная стрелка | Именованная стрелка (идентично) |

Если используется Yourdon-DeMarco — укажи это явно в комментарии к диаграмме.

---

## Пример L0 (Context diagram) — Structurizr DSL

```dsl
workspace {
  model {
    // Внешние субъекты
    customer = person "Customer" "Initiates data requests"
    externalService = softwareSystem "External Payment Service" "Processes payments" "External"

    // Система как единый процесс
    system = softwareSystem "Order Processing System" {
      description "Receives orders, processes payments, stores results"
    }

    // Потоки данных L0
    customer -> system "Order request [JSON]"
    system -> customer "Order confirmation [JSON]"
    system -> externalService "Payment request [ISO 8583]"
    externalService -> system "Payment result [ISO 8583]"
  }

  views {
    systemContext system "dfd-l0-context" {
      include *
      autolayout lr
    }
  }
}
```

**Финальный артефакт:** файл `dfd.l0-context.md` содержит DSL-блок выше + краткое текстовое описание потоков (1–3 предложения).

---

## Пример L1 (Detailed diagram) — Structurizr DSL

```dsl
workspace {
  model {
    customer = person "Customer"
    externalPayment = softwareSystem "External Payment Service" "External"

    system = softwareSystem "Order Processing System" {
      // Процессы-трансформации
      orderValidator = container "Order Validator" "Validates incoming orders" "Process"
      paymentProcessor = container "Payment Processor" "Handles payment flow" "Process"
      notificationSender = container "Notification Sender" "Sends confirmations" "Process"

      // Хранилища данных
      orderDb = container "Order DB" "Stores order records" "Data Store"
      auditLog = container "Audit Log" "Immutable event log" "Data Store"
    }

    // Потоки данных L1
    customer -> orderValidator "Raw order [JSON]"
    orderValidator -> orderDb "Validated order [Order entity]"
    orderValidator -> paymentProcessor "Payment intent [PaymentDTO]"
    paymentProcessor -> externalPayment "Payment request [ISO 8583]"
    externalPayment -> paymentProcessor "Payment result [ISO 8583]"
    paymentProcessor -> orderDb "Payment status update"
    paymentProcessor -> auditLog "Payment event [AuditEvent]"
    paymentProcessor -> notificationSender "Confirmation trigger [NotifyDTO]"
    notificationSender -> customer "Order confirmation [email/push]"
  }

  views {
    container system "dfd-l1-order-processing" {
      include *
      autolayout lr
    }
  }
}
```

**Финальный артефакт:** файл `dfd.l1-order-processing.md` содержит DSL-блок выше + таблицу потоков данных (имя, формат, направление).

---

## Краевые случаи

### Двунаправленный поток данных
Два однонаправленных потока с разными именами — не одна двусторонняя стрелка:
```dsl
processA -> processB "Query request [QueryDTO]"
processB -> processA "Query result [ResultDTO]"
```

### Трансформация с промежуточным хранилищем
Если процесс читает из хранилища и записывает результат обратно — два явных потока:
```dsl
enricher -> referenceData "Read [LookupKey]"
referenceData -> enricher "Enriched value [ReferenceDTO]"
enricher -> outputStore "Enriched record [EnrichedEntity]"
```

### Синхронный vs асинхронный поток
Указывай в имени потока или в описании:
```dsl
producer -> queue "Event published [OrderCreated] async"
queue -> consumer "Event consumed [OrderCreated] async"

clientApp -> apiGateway "REST call [OrderDTO] sync"
```

### Когда применять L2
- Процесс на L1 содержит более 7 подпроцессов, **или**
- Процесс на L1 требует собственного хранилища данных (не разделяемого с другими процессами).

L2-файл: `dfd.l2-<process-name>.md` — декомпозиция одного конкретного процесса L1.
