# Frontend Clean Architecture — full standard

> Canonical full content for `skill.arch.ru.frontend-clean-architecture` (routed from `../SKILL.md`).

# Архитектура фронтенд-сервиса: Clean Architecture + Feature-Domain + Atomic Design

Скилл применяется при: проектировании нового фичевого модуля, ревью AI-сгенерированного кода, выборе имени объекта, определении его слоя или уровня Atomic Design, или когда структура деградирует после AI-спринтов. Охватывает только фронтенд SPA на TypeScript; для бэкенда — `skill.arch.ru.backend-clean-architecture`.

**Приоритет:** явные инструкции пользователя → требования проекта → этот скилл → общие эвристики качества кода.
**При конфликте со смежными frontend-скиллами:** см. раздел «Конфликты и приоритеты с другими скиллами».

Полные шаблоны структуры, именования и кода — [reference.md](reference.md).

---

## 0. Quick Reference

### 0.1 Нормативные уровни

- **MUST** — обязательное требование, нарушение считается архитектурным дефектом.
- **SHOULD** — рекомендуемое требование, допускаются редкие исключения с явной причиной.
- **MAY** — допустимый опциональный вариант, выбирается по контексту проекта.
- Если правило не помечено явно, трактуй его как **SHOULD**.

**Слои (снаружи → внутрь):**

```
View/Routing → Component (Atomic Design) → Application (State + Service) → Infrastructure → Domain Types
                                                   ↑
                                           Composition Root (паттерн сборки, не слой)
```

**Ключевые объекты фичи `orders`:**

| Объект | Файл | Тип/Класс |
|---|---|---|
| Gateway-контракт | `order.client.ts` | `OrderClient` (interface) |
| HTTP-реализация | `order.client.http.ts` | `OrderClientHttp` |
| State | `order.store.ts` | `OrderStore` |
| Service | `order.service.ts` | `OrderService` |
| Props компонента | — | `OrderCardProps` |

**Три правила ревью AI-сгенерированного кода:**
1. **SRP:** State = только данные; Service = только операции; нет смешивания.
2. **Dependency Rule:** компонент → Application Layer (не напрямую к клиенту); `new Concrete()` — только в Composition Root.
3. **Размещение:** `shared/` — только по явному указанию; импорт из другой фичи — только через `features/{feature}/index.ts`.

---

## 1. Архитектурный профиль

| Параметр | Концепция |
|---|---|
| Архитектурный стиль | Clean Architecture: зависимости направлены внутрь; UI и инфраструктура — периферия |
| Организация кода | Feature Modules: файлы группируются по домену, не по техническому типу |
| Компонентная модель | Atomic Design: atoms → molecules → organisms → templates |
| Разделение ответственности | State (данные) отделён от Application Service (операции) — SRP |
| API-слой | Contract-driven: все HTTP-вызовы скрыты за контрактом `{Feature}Client` |
| Сборка зависимостей | Composition Root — единственная точка `new ConcreteImplementation()` |
| Контроль доступа | Route Guards — декларативное управление доступом на уровне роутера |

Feature Modules и Atomic Design работают по разным осям одновременно: Feature Modules — домен (где?), Atomic Design — сложность компонента (каков?).

## 1.1 Конфликты и приоритеты с другими скиллами

| Ситуация | Приоритет | Решение |
|---|---|---|
| Именование архитектурных Gateway-контрактов | Этот скилл (MUST) | Использовать `{Feature}Client` без `I`-префикса |
| Общие TS/React naming/formatting | `skill.dev.ru.frontend-ts-react-standards` (MUST) | Следовать стандарту проекта для props/types/interfaces |
| Legacy-код с `I*` интерфейсами | Проектный контекст (SHOULD) | Не делать массовый rename без отдельной задачи; новый код — без `I` |
| Выбор библиотеки server-state для SSR | Проектный контекст (MAY) | TanStack Query или аналогичная библиотека |

---

## 2. Слои и ответственность

```
┌──────────────────────────────────────────────────────────────────┐
│  View / Routing Layer                                            │ ← страницы, навигация, route guards
├──────────────────────────────────────────────────────────────────┤
│  Component Layer  (Atomic Design)                               │ ← atoms / molecules / organisms
├──────────────────────────────────────────────────────────────────┤
│  Application Layer  (State + Application Service)               │ ← состояние домена + бизнес-операции
├──────────────────────────────────────────────────────────────────┤
│  Infrastructure Layer  (API Client implementations)             │ ← конкретные HTTP-реализации
└──────────────────────────────────────────────────────────────────┘
  + Domain Types — отдельный внутренний слой чистых типов без поведения (DTO, Enum, контракты, route-константы)
  + Composition Root — паттерн сборки, не слой
```

| Слой | Что хранить | Что запрещено |
|---|---|---|
| **View / Routing** | Страницы, роутер, route guards | Прямые HTTP-вызовы, бизнес-правила |
| **Component Layer** | Atoms / Molecules / Organisms, хуки | Прямые API-вызовы, персистентное состояние домена |
| **Application Layer** | State-объект (данные), Application Service (операции) | Импорт UI-компонентов, JSX |
| **Infrastructure** | `{feature}.client.http.ts`, HTTP-адаптер | Бизнес-логика, UI-зависимости |
| **Domain Types** | DTO, enum-типы, контракты (`{Feature}Client`), route-константы, типы запросов/ответов | Логика, побочные эффекты, HTTP-клиенты, импорт UI и инфраструктуры |

**Маппинг на классические слои CA:**

| CA-слой | FE-эквивалент | Примечание |
|---|---|---|
| Domain / Entities | Domain Types | Упрощение: в SPA нет Rich Entities; DTO = domain model |
| Use Cases | Application Layer (State + Service) | |
| Interface Adapters | Component + View + `{Feature}Client`-контракт | `{Feature}Client` — gateway-контракт на границе Application↔Infrastructure; файл `api/{feature}.client.ts` |
| Frameworks & Drivers | Infrastructure (`{Feature}ClientHttp`) | Только конкретные реализации |

---

## 3. Dependency Rule

```
Domain Types ←── Infrastructure ←── Application Layer ←── Component Layer ←── View / Routing
                                                                                      ↑
                                                                             Composition Root
```

**Железные правила:**
- **MUST:** Infrastructure не знает об Application Layer и компонентах.
- **MUST:** Application Service не импортирует UI-компоненты и не возвращает JSX.
- **MUST:** State-объект хранит только данные — не вызывает API.
- **MUST:** Компоненты не импортируют `{feature}.client.http.ts` — только через Application Layer.
- **MUST:** Composition Root — единственное место, где вызывается `new ConcreteImplementation()`.

---

## 4. Компонентный слой: Atomic Design

| Уровень | Определение | Зависит от | Примеры |
|---|---|---|---|
| **atom** | Неделимый UI-примитив без бизнес-состояния | Ничего app-специфичного | `Button`, `TextInput`, `Icon` |
| **molecule** | Комбинация 2–5 атомов с одной функцией | atoms | `SearchField`, `SelectInput`, `FilterPanel` |
| **organism** | Самодостаточный UI-блок, знает о домене | molecules + atoms + Application Layer | `OrderCard`, `UserProfileForm`, `ProductTable` |
| **template** | Каркас страницы (layout без данных) | organisms + molecules | `DashboardTemplate`, `DetailPageTemplate` |

**Правило размещения:**
- **MUST:** начинай всегда в `features/{feature}/ui/`. Если в фиче 2–3 компонента — достаточно плоской `ui/`.
- **SHOULD:** перенос в `shared/ui/` только как осознанное решение человека.
- **MUST:** LLM не вносит изменения в `shared/` без явного указания. При сомнении — дублируй в `features/`, не трогай `shared/`.

**Структура файлов компонента:**

```
{ComponentName}/
├── {ComponentName}.tsx
├── {ComponentName}.module.css    # или альтернативный подход к стилям
├── {ComponentName}.test.tsx      # колоцирован с компонентом
└── index.ts                      # export { ComponentName } from './{ComponentName}'
```

**Правила компонента:**

| Правило | Правильно | Неправильно |
|---|---|---|
| Тип | Функциональный с `{Name}Props` | Классовый компонент |
| Локальное состояние | Только UI-состояние (open/close, tab, hover) | Состояние домена |
| Доступ к Application Layer | Через DI-контекст или хук | Прямой импорт API-клиента |
| Стили | Изолированные (модули / scoped / utility) | Глобальные классы вне `shared/styles/` |

---

## 5. Application Layer: State + Service

Соответствует **Use Cases** в Clean Architecture. Разделён на два объекта с разными ответственностями.

### State-объект — только данные

Хранит реактивное состояние домена. **Инварианты:**
- **MUST:** только данные и computed/derived значения — нет методов с побочными эффектами.
- **MUST:** не знает об HTTP-клиентах и UI-фреймворке.
- **MUST:** меняется только через Application Service.
- **SHOULD:** использовать Zustand как базовый runtime-шаблон; другой runtime допустим при тех же инвариантах.

```
{Feature}Store содержит:
  данные с сервера: {entity}, {entities}[]
  UI-флаги:        isLoading, hasError
  выбранный:       selected{Entity}
  computed:        отфильтрованный список, сумма (допустимо)
```

### Application Service (`{Feature}Service`) — только операции

Оркестрирует: вызывает `{Feature}Client`-контракт через DI → пишет результат в State. **Инварианты:**
- **MUST:** принимает `{Feature}Client`-контракт и State через конструктор (явный DI).
- **MUST:** не знает об UI-компонентах, не возвращает JSX.
- **MUST:** является слоем orchestration/use-case.
- **MUST:** все публичные методы async; управляют `isLoading` / `hasError` в State.

### Server-state / SSR-кэширование

- **MAY:** для SSR/server-state использовать TanStack Query или аналогичную библиотеку.
- **MUST:** выбор библиотеки не меняет слой ответственности — orchestration остаётся в `{Feature}Service`.
- **SHOULD:** считать server-state библиотеку механизмом транспорта/кэша, а не заменой архитектурных границ фичи.

### Разграничение

| Вопрос | Куда |
|---|---|
| Данные с сервера | State |
| UI-флаги (isLoading, isOpen, hasError) | State |
| Производное значение (computed) | State |
| HTTP-запрос к API | Application Service |
| Бизнес-преобразование данных | Application Service |
| Управление флагами загрузки | Application Service (пишет в State) |
| Команда «сохранить» / «удалить» | Application Service |

Шаблоны кода — [reference.md](reference.md).

---

## 6. Infrastructure Layer: API Clients

Все HTTP-вызовы скрыты за контрактом `{Feature}Client`. Контракт — Gateway (Interface Adapter); реализация — Infrastructure.

### Именование: контракт без I-префикса

Различие контракта и реализации выражается именем класса, а не префиксом:

| Роль | Тип/Класс | Файл |
|---|---|---|
| Контракт (Gateway) | `{Feature}Client` | `{feature}.client.ts` |
| HTTP-реализация | `{Feature}ClientHttp` | `{feature}.client.http.ts` |
| Mock-реализация (тесты) | `{Feature}ClientMock` | `{feature}.client.mock.ts` |

**Правила клиента:**
- **MUST:** один домен — один клиент.
- **MUST:** принимать `HttpClient`-контракт через конструктор; не создавать HTTP-объект внутри.
- **MUST:** без бизнес-логики и доменных преобразований.
- **SHOULD:** низкоуровневый маппинг формата допустим как часть инфраструктуры (нормализация регистра полей, сериализация дат).
- **SHOULD:** прикладное кэширование держать в Application Layer; для SSR/server-state использовать специализированную библиотеку или её аналог.

---

## 7. Composition Root

Единственная точка создания всех конкретных реализаций. Живёт в `app/providers/`.

```
HttpClient (1 инстанс)
  └── {Feature}ClientHttp (1 инстанс на фичу)
        ├── {Feature}Store   (1 инстанс)
        └── {Feature}Service (1 инстанс) ← принимает ClientHttp + Store
                ↓
       DI-контейнер / контекст → UI-дерево
```

**Правила:**
- **MUST:** `new ConcreteImplementation()` — только здесь. Нигде в остальной кодовой базе.
- **MUST:** никакой бизнес-логики и UI-кода.
- **MUST:** все зависимости через конструктор — нет скрытых глобальных синглтонов вне Root.
- **SHOULD:** экспортировать как синглтон и передавать в DI-контейнер или фреймворковый контекст.

Шаблоны кода — [reference.md](reference.md).

---

## 8. View / Routing

**Принципы:**
- **MUST:** маршруты — константы в одном файле `route-links.ts`. Нигде строковых литералов путей.
- **MUST:** page-компонент тонкий: только композиция organisms и подключение Application Layer через DI-контекст.
- **MUST:** контроль доступа декларативный, в конфиге роутера; не дублируется внутри компонентов страниц.

**Подходы к контролю доступа:**

| Подход | Когда |
|---|---|
| Route Guard HOC | SPA: защита отдельных маршрутов; логика в конфиге роутера |
| Protected Route Group | Группа маршрутов с одинаковым доступом |
| Middleware (серверный) | SSR: перехват до рендера на сервере |
| Проверки внутри Page-компонента | **Антипаттерн** — логика доступа размазана |

Выбор определяется архитектурой роутера. Инвариант любого подхода: логика доступа не дублируется внутри Page-компонентов.

---

## 9. Именование: ключевые шаблоны

**PascalCase:** папки компонентов, файлы `.tsx`, классы, типы, Props-типы.
**kebab-case:** все файлы `.ts` (service, store, client, dto, helper, enum, hooks).

| Объект | Файл | Тип/Класс | Пример |
|---|---|---|---|
| Atom-компонент | `{Name}.tsx` в `{Name}/` | — | `Button/Button.tsx` |
| Page-компонент | `{Feature}Page.tsx` | — | `OrdersPage.tsx` |
| Props-тип | — | `{Name}Props` | `OrderCardProps` |
| State | `{feature}.store.ts` | `{Feature}Store` | `OrderStore` |
| Service | `{feature}.service.ts` | `{Feature}Service` | `OrderService` |
| API-контракт | `{feature}.client.ts` | `{Feature}Client` | `OrderClient` |
| HTTP-реализация | `{feature}.client.http.ts` | `{Feature}ClientHttp` | `OrderClientHttp` |
| Mock-реализация | `{feature}.client.mock.ts` | `{Feature}ClientMock` | `OrderClientMock` |
| Base DTO | `{entity}.dto.ts` | `{Entity}Dto` | `OrderDto` |
| Хук | `use{Name}.ts` | — | `useOrderFilters.ts` |
| HOC / Guard | `With{Name}.tsx` | — | `WithAuthGuard.tsx` |
| Enum | `{concept}.enum.ts` | `{Concept}` (PascalCase) | `OrderStatus` |
| Хелпер | `{domain}.helper.ts` | — | `order.helper.ts` |
| Константы маршрутов | `route-links.ts` | — | `ORDERS_ROUTE` |

**Единственное/множественное:**
- Файлы `.ts` и классы — **единственное** (`order.store.ts`, `OrderStore`).
- Папки фич — **множественное** (`features/orders/`).
- Компонент-список/страница — **множественное** (`OrderList`, `OrdersPage`).

Полная таблица — [reference.md](reference.md).

---

## 10. Структура фичевого модуля

Feature-first — единственный рекомендуемый подход. Type-first (группировка по техническому типу) встречается в legacy, для новых проектов и LLM-разработки не рекомендуется: контекст фичи разбросан по 5+ папкам.

```
features/orders/
├── api/
│   ├── order.client.ts          ← Gateway-контракт (Interface Adapters)
│   └── order.client.http.ts     ← HTTP-реализация (Infrastructure)
├── model/
│   ├── order.dto.ts
│   └── order-status.enum.ts
├── state/
│   ├── order.store.ts
│   └── order.service.ts
├── ui/
│   ├── atoms/
│   ├── molecules/
│   └── organisms/
│       └── OrderCard/
│           ├── OrderCard.tsx
│           ├── OrderCard.module.css
│           ├── OrderCard.test.tsx
│           └── index.ts
├── hooks/
│   └── use-order-filters.ts
└── index.ts                     ← публичный API фичи
```

**Публичный API:** другие фичи и `app/` импортируют только из `features/orders/`. Store и Service не экспортируются наружу — доступны через DI-контекст.

**Правила межфичевых зависимостей:**
1. Импортировать из другой фичи — только через `features/{feature}/index.ts`.
2. Страница, компонующая несколько доменов — в `app/pages/`, не внутри фичи.
3. Однонаправленность: `app/` ← `features/` ← `shared/`; `shared/` не импортирует из `features/`.
4. Круговые зависимости запрещены; общие части → `shared/`.
5. Частые импорты из фичи B в фичу A → сигнал переноса в `shared/`.

---

## 11. Антипаттерны

| Антипаттерн | Почему плохо | Исправление |
|---|---|---|
| Бизнес-логика в State | God Object; нарушает SRP | Перенести в Application Service |
| HTTP-вызов в компоненте | Компонент зависит от Infrastructure | Вынести в Service; компонент подписывается на State |
| Прямой импорт HTTP-клиента в Service | Обходит контракт; нетестируемо | `{Feature}Client`-контракт через конструктор |
| `new ConcreteClientHttp()` вне Composition Root | Скрытые зависимости | `new` — только в Composition Root |
| Props drilling 3+ уровней | Хрупко; промежуточные компоненты знают чужое | DI-контекст |
| LLM изменяет `shared/` без указания | Регрессии во всех фичах | Явное правило: `shared/` — только по указанию человека |
| State + Service в одном классе (большой объём) | SRP нарушен; State с HTTP-зависимостью | Разделить |
| Cross-domain страница внутри фичи | Размытые границы | `app/pages/` |
| Импорт из внутренних путей чужой фичи | Нарушает инкапсуляцию; скрытые связи | Только через `index.ts` |
| Organism в `shared/ui/` без реального переиспользования | Ложная абстракция | В `features/{feature}/ui/organisms/` |

---

## 12. LLM-стратегии

### Что даёт архитектура LLM

| Элемент | Эффект |
|---|---|
| Feature-first | Весь контекст фичи в одной папке — не нужно собирать по дереву |
| State/Service разделение | 1 файл = 1 ответственность; LLM не смешивает данные и операции |
| `{Feature}Client`-контракт | LLM видит сигнатуры — не придумывает API |
| Atomic Design уровни | Имя папки = инструкция по уровню компонента |
| DTO в `model/` | LLM знает форму данных — не изобретает поля |
| Composition Root | Одно место регистрации — LLM знает куда добавить зависимость |
| `index.ts` публичный API | LLM импортирует из фичи, не угадывает внутренние пути |
| Запрет `shared/` | Предотвращает непреднамеренные регрессии |

### Что давать LLM в контекст

| Задача | Контекст |
|---|---|
| Новый Service | 1–2 существующих `{feature}.service.ts` |
| Новый State | 1–2 существующих `{feature}.store.ts` |
| Новый API Client | `{feature}.client.ts`-контракт + 1 похожая реализация |
| Новый organism | 1–2 organism из той же фичи |
| Регистрация зависимости | Composition Root целиком |
| Новый маршрут | Файл роутера + `route-links.ts` |
| Cross-domain страница | `app/pages/` + `index.ts` обеих фич |

**Правило:** один-два реальных файла точнее длинного словесного описания паттерна.

### Output template для генерации новой фичи

Порядок вывода файлов и фрагментов ответа:
1. `model/` (DTO, enum, контракты типов)
2. `api/` (`{feature}.client.ts` → `{feature}.client.http.ts`)
3. `state/` (`{feature}.store.ts` → `{feature}.service.ts`)
4. `ui/` (атомы/молекулы/организмы + page при необходимости)
5. `route-links.ts` + route guard (если добавляется маршрут)
6. `index.ts` (публичный API фичи)
7. Composition Root wiring (`app/providers/*`)

Минимальный контекст перед генерацией:
- 1–2 примера существующих `store/service/client`
- текущий `route-links.ts` и router-конфиг
- текущий Composition Root
- чеклист §13 для самопроверки результата

### Ревью AI-сгенерированного кода: три проверки

1. **SRP:** State — только данные? Service — только операции? Нет смешивания?
2. **Dependency Rule:** компонент не импортирует клиент напрямую? Service не импортирует UI? `new Concrete()` только в Composition Root? Импорты из других фич — через `index.ts`?
3. **Размещение:** правильный уровень Atomic Design? Cross-domain страница в `app/pages/`? Фичевый код не попал в `shared/`?

---

## 13. Чеклист нового фичевого модуля

**Domain Types:**
- [ ] DTO: `{entity}.dto.ts`, `create-{entity}.dto.ts`, `update-{entity}.dto.ts`
- [ ] Enum-типы в `model/`
- [ ] Gateway-контракт `{Feature}Client` в `api/{feature}.client.ts`
- [ ] Контракты и типы без поведения; без импортов инфраструктуры и UI

**Infrastructure:**
- [ ] `{feature}.client.http.ts` реализует `{Feature}Client`
- [ ] Принимает `HttpClient`-контракт через конструктор; не создаёт HTTP-объект сам
- [ ] Без бизнес-логики и доменных трансформаций

**Application Layer:**
- [ ] State содержит только данные и computed-значения
- [ ] Service принимает `{Feature}Client`-контракт и State через конструктор
- [ ] Service не импортирует UI, не возвращает JSX
- [ ] `isLoading` / `hasError` управляются в Service, хранятся в State

**Component Layer:**
- [ ] Компоненты на правильном уровне Atomic Design
- [ ] Новые компоненты в `features/{feature}/ui/`, не в `shared/ui/`
- [ ] `{Name}/` с `.tsx` + `.module.css` + `.test.tsx`
- [ ] Props типизированы `{Name}Props`
- [ ] Нет прямых импортов API-клиентов в компонентах

**View / Routing:**
- [ ] Путь добавлен в `route-links.ts`
- [ ] Маршрут в файл роутера; при необходимости — Route Guard
- [ ] Cross-domain страница в `app/pages/`, не внутри фичи

**Composition Root:**
- [ ] `{Feature}ClientHttp`, Store, Service созданы и связаны в Composition Root
- [ ] Нигде кроме Composition Root нет `new {Feature}ClientHttp()` / `new {Feature}Store()` / `new {Feature}Service()`

**Инкапсуляция фичи:**
- [ ] `features/{feature}/index.ts` экспортирует только публичный API
- [ ] Другие фичи импортируют только через `features/{feature}/index.ts`
- [ ] Нет круговых зависимостей

**Dependency Rule:**
- [ ] Компоненты не импортируют API-клиенты напрямую
- [ ] Service не импортирует UI-фреймворк
- [ ] Infrastructure без бизнес-логики
- [ ] `shared/` не импортирует из `features/`

Полные шаблоны кода и карта объектов по слоям — [reference.md](reference.md).

---

## 14. Чеклист compliance (ревью реализации)

Компактный чеклист для проверки реализованного кода на соответствие архитектуре. Используй вместо полного скилла, когда задача — ревью, а не проектирование с нуля.

- [ ] State содержит только данные и computed-значения; нет HTTP-вызовов в State (§5)
- [ ] Service не импортирует UI-компоненты, не возвращает JSX (§5)
- [ ] Компоненты не импортируют API-клиент напрямую — только через Application Layer (§4)
- [ ] `new ConcreteImplementation()` только в Composition Root (§7)
- [ ] Импорты из другой фичи — только через `features/{feature}/index.ts` (§10)
- [ ] Новые компоненты в `features/{feature}/ui/`, не в `shared/ui/` без явного указания (§4)
- [ ] Компоненты на правильном уровне Atomic Design (§4)
- [ ] Infrastructure (`{feature}.client.http.ts`) без бизнес-логики (§6)

## 15. Когда не применять

- **MAY:** для микро-виджетов и одноэкранных UI без фичевых границ можно использовать упрощённую структуру.
- **MAY:** в полностью legacy-модуле допустимо сохранить существующий layout, если нет задачи на архитектурную миграцию.
- **SHOULD:** при Next.js App Router или специфичном SSR-пайплайне адаптировать правила View/Routing под платформу, сохраняя Dependency Rule.
- **MUST:** если в задаче появляется фичевая доменная логика, вернуться к полной схеме этого скилла.
