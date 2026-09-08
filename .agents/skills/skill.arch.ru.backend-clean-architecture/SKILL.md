---
name: skill.arch.ru.backend-clean-architecture
description: >-
  Enforces Clean Architecture + CQRS structure for backend services: layer
  boundaries (Domain / Use Cases / Interface Adapters / Infrastructure /
  Composition Root), feature-module layout, Rich Domain Entity naming
  ({Entity}DomainEntity), CQRS Handlers with Decorators and Facades, Dependency
  Rule compliance, and full naming conventions. Use when: designing a new
  backend service or module, reviewing AI-generated code, deciding which layer
  an object belongs to, naming Commands / Queries / DTOs / Repositories /
  Domain Services, writing Use Cases or Domain Entities, or when project
  structure erodes after AI-assisted development sprints. Supersedes
  skill.arch.ru.clean-architecture-llm.
---

# Архитектура бэкенд-сервиса: Clean Architecture + CQRS

Сфера применения описана в `description` frontmatter (авторитетный источник триггеров). Этот документ фиксирует правила и шаблоны их применения для бэкенд-контура; для фронтенда используется отдельный скилл.

**Приоритет:** явные инструкции пользователя → требования проекта → этот скилл → общие эвристики качества кода.

Полные шаблоны структуры, именования и кода — [reference.md](reference.md).

---

## 1. Архитектурный профиль

| Параметр | Значение |
|---|---|
| Стиль | Clean Architecture + CQRS + DDD (тактический) |
| Терминология | В этом скилле `Use Cases` и `Application Layer` — синонимы одного слоя |
| Организация | Feature Modules: код группируется по доменам, не по техническому типу |
| Модели | Rich Domain Model — поведение внутри `{Entity}DomainEntity` |
| Разделение операций | CQRS: Commands (write) отдельно от Queries (read) |
| Зависимости | Только внутрь: Infrastructure → Adapters → Use Cases → Domain |

---

## 2. Слои и ответственность

```
┌──────────────────────────────────────────────────┐
│  Infrastructure / Frameworks & Drivers           │ ← БД, репозитории, HTTP-клиенты, очереди
├──────────────────────────────────────────────────┤
│  Interface Adapters                              │ ← Контроллеры, DTO, маппинг
├──────────────────────────────────────────────────┤
│  Use Cases / Application                         │ ← CQRS Handlers, Validators, Services
├──────────────────────────────────────────────────┤
│  Domain / Entities                               │ ← Rich Models, Contracts, States
└──────────────────────────────────────────────────┘
  + Composition Root — отдельная роль запуска (не слой)
```

| Слой | Что хранить | Что запрещено |
|---|---|---|
| **Domain** | `{Entity}DomainEntity`, ValueObject, DomainService, интерфейсы контрактов, State-реализации | Импорты БД, HTTP, фреймворка |
| **Use Cases** | Command, Query, Handler, Validator, Decorator, Facade, `{Domain}Service` | Прямые SQL, HTTP-типы, ORM-объекты |
| **Interface Adapters** | Controller, DTO, маппинг Domain Result → DTO | Бизнес-логика, прямой доступ к БД |
| **Infrastructure** | DbContext, `{Entity}Record`, `{Entity}Repository` (реализация), HTTP-клиент | Бизнес-правила, оркестрация |
| **Composition Root** | `Program`/`main`, `AppServiceRegistrar`, конфиг окружения | Логика любого рода |

---

## 3. Dependency Rule (железное правило)

```
Domain ←── Use Cases ←── Interface Adapters ←── Infrastructure
```

Легенда: стрелка указывает направление compile-time зависимости (всегда к более внутреннему слою).

- **MUST:** `Domain` не импортирует никого.
- **MUST:** `Use Cases` импортируют из `Domain/`: модели (`{Entity}DomainEntity`, ValueObject, Enum, Exception) и интерфейсы из `Domain/Contracts/` (`I{Entity}Repository`, `I{Domain}Service`, `I{Entity}Provider`, `I{Entity}State`, `I{Domain}UnitOfWork`).
- **MUST NOT:** `Use Cases` импортируют конкретные реализации из Infrastructure.
- **MUST:** `Infrastructure` может зависеть от всех внутренних слоёв; никто не зависит от `Infrastructure`.

---

## 4. Domain Layer: Rich Entity и контракты

### `{Entity}DomainEntity` — обязательные свойства

| Свойство | Требование |
|---|---|
| Создание | Конструктор с проверкой инвариантов; невалидное состояние невозможно |
| Поведение | Бизнес-операции — методы Entity (`submit()`, `activate()`, `withdraw()`) |
| Доступ к полям | Поля приватные; снаружи только read-only геттеры |
| Независимость | Нет импортов ORM, HTTP, фреймворка |

| ✅ Должно | ❌ Не должно |
|---|---|
| `order.submit()` — логика внутри Entity | `orderService.submit(order)` — логика снаружи |
| Бросать Domain Exception при нарушении инварианта | Возвращать `null` или `bool` без объяснения |
| Только доменные поля | Аннотации `@Column`, `@JsonProperty`, `toJson()` |

### Domain/Contracts/ — все интерфейсы слоя Domain

| Интерфейс | Шаблон | Реализация в слое |
|---|---|---|
| Репозиторий | `I{Entity}Repository` | Infrastructure |
| Доменный сервис | `I{Domain}Service` | Use Cases / `Services/` |
| Провайдер | `I{Entity}Provider` | Infrastructure |
| State | `I{Entity}State` | Domain / `States/` |
| State Provider | `I{Entity}StateProvider` | Infrastructure |

`Contracts/` остаётся внутри `Domain/` — и интерфейсы, и их контрактные модели (`Contracts/Models/`) являются доменными артефактами.

### Aggregate Root

Агрегат — группа связанных Entity, изменяемых как единое целое. Только корень агрегата (`{Root}DomainEntity`) является точкой входа для любых изменений агрегата.

| Правило | Пример |
|---|---|
| Репозиторий только для корня | `IOrderRepository` — да; `IOrderItemRepository` — нет |
| Вложенные Entity управляются через корень | `order.addItem(item)`, не `itemRepo.save(item)` |
| Граница транзакции = граница агрегата | Одна транзакция — один агрегат; два агрегата — два отдельных коммита |
| ID вложенной Entity — локальный | `OrderItemId` уникален внутри `Order`, не системно |

Граница агрегата — архитектурное решение: чем больше агрегат, тем дороже блокировки; чем меньше — тем чаще нужна межагрегатная оркестрация.

### Domain Service vs `I{Domain}Service`

| Тип | `{Entity}{Operation}DomainService` | `I{Domain}Service` / `{Domain}Service` |
|---|---|---|
| Расположение | `Domain/` (реализован там же) | Интерфейс в `Domain/Contracts/`; реализация в Use Cases / `Services/` |
| Зависимости | Только Domain-объекты | Может использовать `I{Entity}Repository` |
| Назначение | Операция между несколькими Entity без внешних данных | Операция, требующая данных из репозитория |

- **MUST:** если операция требует чтения/записи через репозиторий, выбирать `I{Domain}Service` + `{Domain}Service` в Use Cases.
- **MUST NOT:** размещать репозиторно-зависимую логику в `{Entity}{Operation}DomainService` внутри `Domain/`.

> **Почему `I{Domain}Service` — в `Domain/Contracts/`, если реализация использует репозиторий?**
> Сам интерфейс не импортирует репозиторий — он описывает только сигнатуры операций.
> Реализация (`{Domain}Service`) в Use Cases / `Services/` зависит от `I{Entity}Repository` из того же `Domain/Contracts/`.
> Это стандартный DIP: Domain определяет контракты обоих участников; Use Cases связывают их в реализации.

### Стратегия доменных ошибок

| Ситуация | Механизм | Обоснование |
|---|---|---|
| Нарушение инварианта (невозможное состояние) | `throw {Domain}{Problem}Exception` | Неожиданное; всегда ошибка в логике или данных |
| Ожидаемый бизнес-исход (email занят, лимит исчерпан) | `Result<T, TError>` | Нормальный flow; исключение скрывает намерение |

Оба подхода совместимы в одном домене. Выбор фиксируется как командное соглашение. Библиотеки Result-паттерна для конкретных платформ — [reference.md](reference.md).

### Domain Events (опционально)

Если система использует событийную модель, Domain Events определяются в `Domain/Events/` как `{Entity}{PastTense}DomainEvent` (например, `OrderSubmittedDomainEvent`). Интерфейс публикатора `I{Domain}EventPublisher` живёт в `Domain/Contracts/`, реализация — в Infrastructure. Публикация происходит в CommandHandler или PostDecorator после успешного сохранения.

**Dual-write риск:** прямой вызов `messageBus.send()` после `SaveChanges()` не атомарен — сбой между ними приводит к потере события.
- **Transactional Outbox** (production): событие сохраняется в той же транзакции в таблицу `OutboxMessages`; отдельный процесс публикует и удаляет.
- **Прямая публикация** (допустимо): только в eventually-consistent сценариях с идемпотентными обработчиками событий.

---

## 5. Use Cases: CQRS

### Command (write-side)

| Объект | Шаблон | Папка |
|---|---|---|
| Команда | `{Action}{Entity}Command` | `{Domain}/Commands/` |
| Обработчик | `{Command}Handler` | `{Domain}/Commands/Handlers/` |
| Валидатор | `{Command}Validator` | `{Domain}/Commands/Validators/` |
| Декоратор (pre) | `{Command}Decorator` | `{Domain}/Commands/Decorators/` |
| Декоратор (post) | `{Command}PostDecorator` | `{Domain}/Commands/Decorators/` |
| Фасад | `{Operation}Command` | `{Domain}/Commands/Facades/` |
| Обработчик фасада | `{Operation}CommandHandler` | `{Domain}/Commands/Facades/Handlers/` |

**MUST:** `Handler` содержит только оркестрацию: получить `{Entity}DomainEntity` через репозиторий → вызвать метод Entity → сохранить.
**MUST NOT:** `Handler` содержит бизнес-правила.

**SHOULD:** `Decorator` используется для cross-cutting concerns (логирование, аудит, idempotency, кэш-инвалидация, уведомления).
**MUST:** `PostDecorator` при ошибке `inner.Handle(...)` не делает swallow исключения: логирует контекст и пробрасывает ошибку дальше.

**SHOULD:** `Facade` использовать, когда операция требует ветвления между командами или композиции нескольких команд внутри одного сервиса.

> **Facade ≠ Saga.** Межсервисная оркестрация с компенсирующими транзакциями — это Saga / Process Manager (отдельный паттерн). Вызов нескольких внешних сервисов через Facade без компенсаций создаёт риск partial failures.

**MUST NOT (anti-pattern):** использовать Facade для long-running межсервисных процессов, где нужны компенсации, ретраи и устойчивость к partial failures. В таком случае выбирать Saga / Process Manager.

**Validator (разграничение):** три категории проверок — в разных местах:

- `{Command}Validator` / `{Query}Validator` — только **input shape**: поле не null, длина ≤ N, формат даты, enum в допустимом диапазоне. Цель — fail-fast до загрузки сущности из БД.
- `{Entity}DomainEntity` — **domain invariants**: что разрешает домен (`submit()` только из Draft, количество > 0). Авторитетная гарантия — держится независимо от вызывающего.
- `I{Domain}Service` — **cross-entity rules**: требуют данных из репозитория (email уже занят, кредитный лимит исчерпан).

Перекрытие Validator + Entity допустимо как defence-in-depth: Validator ловит очевидное рано, Entity гарантирует корректность всегда.

### Query (read-side)

| Объект | Шаблон | Папка |
|---|---|---|
| Запрос | `Get{Entity}{Criteria}Query` | `{Domain}/Queries/` |
| Обработчик | `{Query}Handler` | `{Domain}/Queries/Handlers/` |
| Валидатор | `{Query}Validator` | `{Domain}/Queries/Validators/` |
| Декоратор | `{Query}Decorator` | `{Domain}/Queries/Decorators/` |

**QueryHandler** — читает, маппит в DTO, возвращает. Никаких побочных эффектов.

**Read-side:** QueryHandler **не обязан** загружать полный `{Entity}DomainEntity`. По умолчанию используй `I{Entity}ReadRepository` (интерфейс в `Domain/Contracts/`) — прямая проекция в read-модель или DTO без прохода через Domain Entity. Реализация в Infrastructure делает прямой SQL-запрос (Dapper / EF projection). Dependency Rule не нарушается — Use Case работает через интерфейс из `Domain/Contracts/`.

Загрузка полного `{Entity}DomainEntity` в QueryHandler оправдана только если нужна бизнес-логика при чтении (крайне редко).

### `{Domain}Service` — реализация `I{Domain}Service`

Живёт в `{Domain}/Services/`. Оркестрирует через `I{Entity}Repository`. Не знает про HTTP и ORM. Используется когда операция требует данных из нескольких репозиториев, но не является отдельным CQRS-сценарием.

`Commands/` и `Queries/` расположены на уровне `{DomainName}/`, а не внутри `Domain/` — **намеренно**: это Use Cases, не доменные объекты.

---

## 6. Interface Adapters

**Controller** — единственный входной маршрутизатор. Принимает `{Action}{Entity}CommandRequestDto` → маппит в Command/Query через Dispatcher → возвращает `{Entity}ResponseDto`. Не содержит бизнес-логики.

| DTO | Шаблон | Назначение |
|---|---|---|
| Базовое | `{Entity}Dto` | Стандартный набор полей |
| Краткое | `{Entity}ShortInfoDto` | Для списков, выпадающих |
| Расширенное | `{Entity}DetailDto` | Все поля + вложенные объекты |
| Входной команды | `{Action}{Entity}CommandRequestDto` | HTTP-тело write-операции |
| Входной запроса | `Get{Entity}{Criteria}QueryRequestDto` | HTTP-параметры read-операции |
| Выходной | `{Entity}ResponseDto` / `{Operation}ResponseDto` | Структурированный ответ |
| Фильтр | `{Entity}FilterDto` / `{Entity}RangeDto` | Параметры фильтрации |

Маппинг Domain Result → DTO — только в `{Feature}MappingRegistrar`. Запрещено: бизнес-логика, прямой доступ к БД.

---

## 7. Infrastructure

`{Entity}Repository` реализует `I{Entity}Repository`. Конвертирует `{Entity}DomainEntity ↔ {Entity}Record`. **Единственное место** маппинга между Domain и ORM.

`{Entity}Record` — Anemic-класс с ORM-атрибутами, без бизнес-логики. Живёт в `Persistence/Models/`. Отдельный класс от `{Entity}DomainEntity`.

**Unit of Work:** если CommandHandler затрагивает несколько репозиториев в одной транзакции, используется `I{Domain}UnitOfWork` (интерфейс в `Domain/Contracts/`, реализация в Infrastructure). Handler вызывает `unitOfWork.CommitAsync()` после всех изменений.

**MUST NOT:** при активном `I{Domain}UnitOfWork` вызывать `SaveChanges()` / `Commit` внутри `{Entity}Repository`. Коммит транзакции выполняется централизованно через `unitOfWork.CommitAsync()`.

---

## 8. Структура проекта

### Типовое разделение на проекты

| Проект | Слои CA | Пример |
|---|---|---|
| `{Product}.Core` | Domain + Use Cases | `Acme.Billing.Core` |
| `{Product}.Api` | Interface Adapters | `Acme.Billing.Api` |
| `{Product}.Infrastructure` | Infrastructure | `Acme.Billing.Infrastructure` |
| `{Product}.Host` | Composition Root | `Acme.Billing.Host` |

В небольших системах Domain и Use Cases живут в одном `Core`. В крупных — разделяются на `{Product}.Domain` и `{Product}.Application`.

### Доменный модуль внутри Core (краткая схема)

```
{DomainName}/
├── Domain/         ← Models, States, Constants, Enums, Exceptions, Contracts/
├── Commands/       ← Use Cases write-side (намеренно вне Domain/)
├── Queries/        ← Use Cases read-side (намеренно вне Domain/)
├── Services/       ← реализации I{Domain}Service
└── Configuration/  ← {Domain}ServiceRegistrar
```

Полная структура с вложенными папками — [reference.md](reference.md).

Inline-пример (минимум для быстрой навигации без `reference.md`):

```
Orders/
├── Domain/
│   ├── Models/OrderDomainEntity.cs
│   └── Contracts/IOrderRepository.cs
├── Commands/
│   └── Handlers/CreateOrderCommandHandler.cs
├── Queries/
│   └── Handlers/GetOrderByIdQueryHandler.cs
├── Services/OrderProcessingService.cs
└── Configuration/OrdersServiceRegistrar.cs
```

---

## 9. Выбор объекта по сценарию

| Сценарий | Создать |
|---|---|
| Логика только внутри одной Entity, без внешних данных | Метод `{Entity}DomainEntity` |
| Логика между Entity одного агрегата | Метод корня агрегата |
| Операция требует репозитория, но не отдельный CQRS-сценарий | `I{Domain}Service` + реализация `{Domain}Service` |
| Write-операция (создать, изменить, удалить) | `{Action}{Entity}Command` + Handler |
| Read-операция | `Get{Entity}{Criteria}Query` + Handler |
| Несколько команд в одном flow (внутри одного сервиса) | Facade Command + Handler |
| Cross-cutting (лог, аудит, кэш, idempotency) | `{Command}Decorator` / `PostDecorator` |

---

## 10. Именование: ключевые шаблоны

Наиболее часто используемые шаблоны. Полная таблица (DTO, State, Provider, Decorator, Constants) — [reference.md](reference.md).

| Объект | Шаблон | Пример |
|---|---|---|
| Rich Domain Entity | `{Entity}DomainEntity` | `OrderDomainEntity` |
| ORM-запись | `{Entity}Record` | `OrderRecord` |
| Value Object | `{Concept}ValueObject` | `MoneyValueObject` |
| Команда | `{Action}{Entity}Command` | `CreateOrderCommand` |
| Запрос | `Get{Entity}{Criteria}Query` | `GetOrderByIdQuery` |
| Handler | `{Command/Query}Handler` | `CreateOrderCommandHandler` |
| Валидатор | `{Command/Query}Validator` | `CreateOrderCommandValidator` |
| Контроллер | `{Feature}Controller` | `OrdersController` |
| Репозиторий (интерфейс) | `I{Entity}Repository` | `IOrderRepository` |
| Репозиторий (реализация) | `{Entity}Repository` | `OrderRepository` |

---

## 11. Фреймворки в Clean Architecture

Фреймворки (ASP.NET, Spring, NestJS, Django) стремятся занять центр системы. Этот скилл предполагает **Clean Architecture по умолчанию**: бизнес-логика — центр, фреймворк — деталь на периферии.

**Правило размещения:** фреймворк только в Interface Adapters и Infrastructure. Domain и Use Cases не импортируют специфику фреймворка.

**Гибридный вариант** (если фреймворк уже в центре): изолировать Domain + Use Cases от фреймворка через интерфейсы; адаптеры и DI остаются фреймворк-зависимыми.

**Признаки «фреймворк везде» (анти-паттерн):** Domain Models наследуются от базового класса фреймворка; бизнес-логика использует `HttpContext` / `EntityManager`; тест требует поднять весь фреймворк; смена фреймворка = переписывание всей системы.

---

## 12. Антипаттерны

| Антипаттерн | Почему плохо | Исправление |
|---|---|---|
| Бизнес-логика в Controller или Handler | Нельзя переиспользовать; LLM копирует шаблон с дефектом | Перенести в `{Entity}DomainEntity` |
| ORM-атрибуты на `{Entity}DomainEntity` | Entity зависит от Infrastructure | Завести `{Entity}Record` в Infrastructure |
| Anemic Domain Model | Логика разбросана по сервисам; LLM не видит полную картину | Вернуть поведение в методы Entity |
| SQL/ORM в CommandHandler | Handler зависит от Infrastructure напрямую | Вынести за `I{Entity}Repository` |
| HTTP-типы в Use Case | Use Case привязан к транспорту | Принимать Command/Query, не HttpRequest |
| `toJson()` / `toViewModel()` в Entity | Entity меняется по двум причинам (SRP) | Маппинг только в Interface Adapters |
| Организация по типу, не по домену | Неясно, к какому домену относится файл | Группировать по доменам; типы — вложенные папки |
| State-реализации вне `Domain/States/` | Бизнес-логика переходов вынесена из ядра | Перенести в `Domain/States/` |
| `I{Domain}Service` реализован в Infrastructure | Оркестрация в инфраструктуре — нарушение слоёв | Реализовать в `{Domain}/Services/` |
| Бизнес-правила в `{Command}Validator` | Валидатор запускается до загрузки сущности; правила без репозиторного контекста не выявляют нарушения инвариантов | Перенести в `{Entity}DomainEntity` или `{Domain}Service` |
| Bloated `{Domain}Service` | Сервис накапливает всю логику вместо Entity; Anemic Domain Model через чёрный ход | Вернуть поведение в методы `{Entity}DomainEntity` |
| Exception для ожидаемых бизнес-ошибок | Исключение скрывает нормальный flow; клиент не знает о возможном исходе без чтения кода | Использовать `Result<T, TError>` для ожидаемых ошибок домена |
| Загрузка полного `{Entity}DomainEntity` в QueryHandler | Излишние расходы: маппинг ORM→Domain→DTO вместо прямой проекции | Использовать `I{Entity}ReadRepository` с прямой SQL-проекцией |

---

## 13. LLM-стратегии

### Что даёт LLM правильная архитектура

| Элемент | Эффект |
|---|---|
| Rich `{Entity}DomainEntity` | 1 файл = полное понимание поведения; меньше контекста, лучше генерация |
| Изолированный Handler | Чёткий шаблон; предсказуемая генерация по образцу |
| DTO-контракты | LLM видит точный формат — не угадывает поля |
| Слоёная структура | Ревью управляемо: домен, оркестрация, адаптеры — отдельно |

**Главная опасность AI-разработки без архитектуры:** принятие кода без понимания ведёт к оттоку знаний. Через 6 месяцев команда не понимает собственную кодовую базу.

### Что давать LLM в контекст

**Правило:** один-два реальных файла в контексте дают точнее результат, чем длинное словесное описание паттерна.



| Задача | Дать в контекст | LLM генерирует |
|---|---|---|
| Новый Command | 1 существующий Command + Handler | Command + Handler + Validator |
| Новый Query | 1 существующий Query + Handler | Query + Handler (+ ReadRepository если нет) |
| Новая Entity | Существующую Rich Entity того же домена | DomainEntity + доменные исключения + перечисления |
| Новый Controller | 1 похожий `{Feature}Controller` | Controller + RequestDto + ResponseDto |
| Тест Handler | Сам Handler + интерфейс репозитория | Unit-тест с мок-репозиторием |

### Ревью AI-сгенерированного кода: промпт против дрейфа

Используй как готовый промпт после каждого AI-спринта:

```
Проверь модуль по чеклисту:
1. {Entity}DomainEntity: есть ли бизнес-методы? Нет ORM/HTTP-атрибутов?
2. CommandHandler: только оркестрация? Нет SQL, HTTP-типов, бизнес-правил?
3. Все импорты в Domain/: только stdlib + другие Domain-объекты?
4. Use Cases: импортируют только из Domain/Contracts/, не конкретные реализации?
5. QueryHandler: использует I{Entity}ReadRepository вместо полного DomainEntity?
Для каждого нарушения: укажи файл, строку, нарушенное правило и исправление. Не патчи молча.
```

---

## 14. Чеклист нового доменного модуля

Назначение раздела: **создание нового модуля** (design/implementation bootstrap), не ревью готового кода.

**Domain:**
- [ ] `{Entity}DomainEntity` с инвариантами в конструкторе; нет ORM/HTTP-атрибутов
- [ ] `I{Entity}Repository` в `Domain/Contracts/`
- [ ] `I{Domain}Service` в `Domain/Contracts/` (если нужен)
- [ ] Репозиторно-зависимые операции вынесены в `{Domain}Service` (Use Cases), а не в `{Entity}{Operation}DomainService` (Domain)
- [ ] Domain Exception, Enum, Constants определены
- [ ] Domain Events (`{Entity}{PastTense}DomainEvent`) в `Domain/Events/` (если паттерн применяется)

**Use Cases:**
- [ ] Command + Handler + Validator для каждой write-операции
- [ ] Query + Handler для каждой read-операции
- [ ] Handler не содержит SQL, HTTP-типов, бизнес-логики; оркестрирует только через интерфейсы

**Interface Adapters:**
- [ ] `{Feature}Controller` диспатчит через Dispatcher, не напрямую в Handler
- [ ] DTO разделены: `CommandRequestDto`, `QueryRequestDto`, `ResponseDto`
- [ ] `{Feature}MappingRegistrar` выполняет Domain Result → DTO

**Infrastructure:**
- [ ] `{Entity}Repository` реализует `I{Entity}Repository`
- [ ] `{Entity}Record` без бизнес-логики; только ORM-атрибуты
- [ ] Маппинг Domain ↔ ORM только в репозитории
- [ ] Если затрагивается несколько репозиториев — использован `I{Domain}UnitOfWork`

**Dependency Rule:**
- [ ] Domain не импортирует ничего внешнего
- [ ] Use Cases не импортируют фреймворк и конкретные реализации
- [ ] Фреймворк только в Infrastructure и Interface Adapters

**Тесты:**
- [ ] Unit-тесты для `{Entity}DomainEntity` написаны без моков
- [ ] Unit-тесты для `{Command/Query}Handler` написаны с мок-репозиторием
- [ ] Integration-тесты для `{Entity}Repository` покрывают запись и чтение

Полные шаблоны кода и карта объектов по слоям — [reference.md](reference.md).

---

## 15. Тестовая стратегия

| Что тестировать | Уровень | Зависимости |
|---|---|---|
| `{Entity}DomainEntity` инварианты и методы | Unit | Никаких (чистый объект) |
| `{Command}Handler` / `{Query}Handler` | Unit | Мок `I{Entity}Repository` |
| `{Domain}Service` (кросс-entity правила) | Unit | Мок `I{Entity}Repository` |
| `{Entity}Repository` | Integration | Реальная БД (TestContainers / in-memory) |
| Controller → Handler flow | Integration | In-memory host (`WebApplicationFactory`) |

**Правило:** если тест для `{Entity}DomainEntity` требует мок — логика не там. Domain-объект должен тестироваться как pure function: вход → метод → состояние / исключение.

---

## 16. Чеклист compliance (ревью реализации)

Компактный чеклист для проверки реализованного кода на соответствие архитектуре. Используй вместо полного скилла, когда задача — ревью, а не проектирование с нуля.

- [ ] `{Entity}DomainEntity` содержит бизнес-методы; нет ORM/HTTP-атрибутов (§4)
- [ ] CommandHandler — только оркестрация; нет SQL, бизнес-правил, HTTP-типов (§5)
- [ ] Domain не импортирует ORM, HTTP, фреймворк (§3)
- [ ] Use Cases импортируют только из `Domain/Contracts/` — не конкретные реализации из Infrastructure (§3)
- [ ] QueryHandler использует `I{Entity}ReadRepository` для чтения, не полный DomainEntity (§5)
- [ ] Код организован по доменам (`{DomainName}/`), не по техническому типу (§8)
- [ ] Infrastructure не содержит бизнес-правил и оркестрации (§7)
- [ ] Нет бизнес-логики в Controller или DTO (§6)
- [ ] При использовании UoW репозитории не вызывают `SaveChanges()`; коммит идёт через `I{Domain}UnitOfWork` (§7)

---

## 17. Применение в фазах AI-процесса

- **Phase 2 — Design (MUST):** использовать при фиксации целевого слоя для каждого нового объекта (Entity, Command/Query, Repository, Service, DTO) и при выборе границ агрегатов.
- **Phase 4 — Implementation (MUST):** использовать как чеклист размещения кода по слоям и валидации Dependency Rule перед завершением реализации.
- **Phase 5 — Release Gate (SHOULD):** использовать для архитектурного smoke-ревью на предмет дрейфа слоёв после серии правок.

---

## 18. Когда не применять

- **SHOULD NOT:** применять полный профиль, если сервис — маленький CRUD-only модуль без насыщенной доменной логики и без сложных инвариантов.
- **SHOULD:** для простых вертикальных срезов без долгоживущих агрегатов выбирать более лёгкую структуру (например, pragmatic vertical slice), сохраняя базовые принципы изоляции зависимостей.
- **MUST:** если начинается рост доменной сложности (инварианты, состояния, межобъектные правила), переходить к полному профилю этого скилла.
