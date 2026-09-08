---
name: skill.arch.ru.frontend-clean-architecture.reference
description: >-
  Reference appendix for frontend clean architecture skill: project layout,
  naming matrix, and implementation templates for state, service, clients,
  routing, and composition root.
---

# Справочник: структура, именование, шаблоны кода

---

## Полная структура директорий

```
src/
├── features/
│   └── orders/                        ← Feature Module
│       ├── api/
│       │   ├── order.client.ts        ← Gateway-контракт (Interface Adapters)
│       │   └── order.client.http.ts   ← HTTP-реализация (Infrastructure)
│       ├── model/
│       │   ├── order.dto.ts
│       │   ├── create-order.dto.ts
│       │   ├── update-order.dto.ts
│       │   └── order-status.enum.ts
│       ├── state/
│       │   ├── order.store.ts         ← State-объект (Application Layer)
│       │   └── order.service.ts       ← Application Service
│       ├── ui/
│       │   ├── atoms/
│       │   │   └── OrderBadge/
│       │   │       ├── OrderBadge.tsx
│       │   │       ├── OrderBadge.module.css
│       │   │       ├── OrderBadge.test.tsx
│       │   │       └── index.ts
│       │   ├── molecules/
│       │   │   └── OrderFilter/
│       │   │       └── ...
│       │   └── organisms/
│       │       └── OrderCard/
│       │           ├── OrderCard.tsx
│       │           ├── OrderCard.module.css
│       │           ├── OrderCard.test.tsx
│       │           └── index.ts
│       ├── hooks/
│       │   └── use-order-filters.ts
│       └── index.ts                   ← публичный API фичи
│
├── shared/                            ← только то, что используется в ≥2 фичах
│   ├── ui/
│   │   ├── atoms/                     ← общие UI-примитивы без доменного контекста
│   │   ├── molecules/
│   │   └── templates/                 ← общие шаблоны страниц
│   ├── lib/                           ← utils, helpers
│   ├── constants/                     ← route-links.ts, глобальные enum
│   └── api/
│       ├── http-client.ts             ← HttpClient-контракт
│       └── http-client.axios.ts       ← реализация (или другой транспорт)
│
└── app/                               ← Composition Root + роутер
    ├── providers/
    │   └── orders.provider.ts         ← создание ClientHttp + Store + Service
    ├── router/
    │   └── router.ts
    └── pages/
        └── OrderDetailsPage/          ← cross-domain страницы (Orders + Users)
            ├── OrderDetailsPage.tsx
            └── index.ts
```

---

## Полная таблица именования

| Объект | Шаблон файла | Шаблон типа/класса | Пример (домен: Order) |
|---|---|---|---|
| Atom-компонент | `{Name}.tsx` в `{Name}/` | — | `Button/Button.tsx` |
| Molecule-компонент | `{Name}.tsx` в `{Name}/` | — | `OrderFilter/OrderFilter.tsx` |
| Organism-компонент | `{Name}.tsx` в `{Name}/` | — | `OrderCard/OrderCard.tsx` |
| Page-компонент | `{Feature}Page.tsx` в `{Feature}Page/` | — | `OrdersPage/OrdersPage.tsx` |
| Props-тип | — | `{Name}Props` | `OrderCardProps` |
| State-объект | `{feature}.store.ts` | `{Feature}Store` | `order.store.ts` / `OrderStore` |
| Application Service | `{feature}.service.ts` | `{Feature}Service` | `order.service.ts` / `OrderService` |
| API-контракт (Gateway) | `{feature}.client.ts` | `{Feature}Client` | `order.client.ts` / `OrderClient` |
| API Client (HTTP-реализация) | `{feature}.client.http.ts` | `{Feature}ClientHttp` | `order.client.http.ts` / `OrderClientHttp` |
| API Client (Mock-реализация) | `{feature}.client.mock.ts` | `{Feature}ClientMock` | `order.client.mock.ts` / `OrderClientMock` |
| Base DTO | `{entity}.dto.ts` | `{Entity}Dto` | `order.dto.ts` / `OrderDto` |
| Create DTO | `create-{entity}.dto.ts` | `Create{Entity}Dto` | `create-order.dto.ts` |
| Update DTO | `update-{entity}.dto.ts` | `Update{Entity}Dto` | `update-order.dto.ts` |
| Enum | `{concept}.enum.ts` | `{Concept}` (PascalCase) | `order-status.enum.ts` / `OrderStatus` |
| Хук | `use{Name}.ts` | — | `use-order-filters.ts` / `useOrderFilters` |
| HOC / Guard | `With{Name}.tsx` | — | `WithAuthGuard.tsx` |
| Хелпер | `{domain}.helper.ts` | — | `order.helper.ts` |
| Константы маршрутов | `route-links.ts` | — | (один файл на проект) |
| Feature Flag ключ | — | `{FEATURE}_{SCOPE}` (UPPER_SNAKE) | `ORDERS_ROUTE` |
| CSS Module | `{Name}.module.css` | — | `OrderCard.module.css` |

---

## Объекты по слоям (карта)

| Объект | Слой |
|---|---|
| DTO (`{Entity}Dto`, `Create{Entity}Dto`) | Domain Types |
| Enum (`OrderStatus`) | Domain Types |
| `{Feature}Client` (interface/type) | Gateway-контракт на границе Application↔Infrastructure (Interface Adapters) |
| `{Feature}Store` | Application Layer |
| `{Feature}Service` | Application Layer |
| Хуки доступа к State (`use{Feature}`) | Application Layer / Component |
| Atoms, Molecules | Component Layer |
| Organisms | Component Layer (знают о Application Layer) |
| Page-компоненты | View / Routing |
| Route Guards (`With{Name}`) | View / Routing |
| `{Feature}ClientHttp` | Infrastructure |
| `HttpClient`-реализация | Infrastructure |
| `HttpClient`-контракт | shared/api (Domain Types) |
| Composition Root, `{Feature}Provider` | Composition Root (не слой) |

---

## Шаблоны кода

### State-объект (Zustand по умолчанию)

```typescript
// order.store.ts
import { create } from 'zustand';

type OrderStoreState = {
  orders: OrderDto[];
  selectedOrder: OrderDto | null;
  isLoading: boolean;
  hasError: boolean;
};

type OrderStoreActions = {
  setOrders: (orders: OrderDto[]) => void;
  setSelectedOrder: (order: OrderDto | null) => void;
  setLoading: (value: boolean) => void;
  setError: (value: boolean) => void;
};

export const useOrderStore = create<OrderStoreState & OrderStoreActions>((set, get) => ({
  orders: [],
  selectedOrder: null,
  isLoading: false,
  hasError: false,

  setOrders: (orders) => set({ orders }),
  setSelectedOrder: (selectedOrder) => set({ selectedOrder }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (hasError) => set({ hasError }),
}));

export const selectActiveOrders = (state: OrderStoreState): OrderDto[] =>
  state.orders.filter((o) => o.status === OrderStatus.Active);
```

> Допустим и другой реактивный runtime (например, MobX), если сохраняются инварианты слоя: состояние без побочных эффектов, операции — в `{Feature}Service`.

### Application Service

```typescript
// order.service.ts
class OrderService {
  constructor(
    private readonly client: OrderClient,   // контракт, не реализация
    private readonly store: OrderStore
  ) {}

  async loadOrders(): Promise<void> {
    this.store.isLoading = true;
    this.store.hasError = false;
    try {
      this.store.orders = await this.client.getOrders();
    } catch {
      this.store.hasError = true;
    } finally {
      this.store.isLoading = false;
    }
  }

  async loadOrder(id: string): Promise<void> {
    this.store.isLoading = true;
    try {
      this.store.selectedOrder = await this.client.getOrder(id);
    } catch {
      this.store.hasError = true;
    } finally {
      this.store.isLoading = false;
    }
  }

  async createOrder(data: CreateOrderDto): Promise<void> {
    const created = await this.client.createOrder(data);
    this.store.orders = [...this.store.orders, created];
  }
}
```

### API Client: контракт + HTTP-реализация

```typescript
// order.client.ts — контракт (Gateway, Interface Adapter)
interface OrderClient {
  getOrder(id: string): Promise<OrderDto>;
  getOrders(filter?: OrderFilterDto): Promise<OrderDto[]>;
  createOrder(data: CreateOrderDto): Promise<OrderDto>;
  updateOrder(id: string, data: UpdateOrderDto): Promise<OrderDto>;
  deleteOrder(id: string): Promise<void>;
}

// order.client.http.ts — HTTP-реализация (Infrastructure)
class OrderClientHttp implements OrderClient {
  constructor(private readonly http: HttpClient) {}

  getOrder(id: string): Promise<OrderDto> {
    return this.http.get(`/orders/${id}`);
  }

  getOrders(filter?: OrderFilterDto): Promise<OrderDto[]> {
    return this.http.get('/orders', { params: filter });
  }

  createOrder(data: CreateOrderDto): Promise<OrderDto> {
    return this.http.post('/orders', data);
  }

  updateOrder(id: string, data: UpdateOrderDto): Promise<OrderDto> {
    return this.http.put(`/orders/${id}`, data);
  }

  deleteOrder(id: string): Promise<void> {
    return this.http.delete(`/orders/${id}`);
  }
}

// order.client.mock.ts — Mock-реализация (только в тестах)
class OrderClientMock implements OrderClient {
  getOrder(id: string): Promise<OrderDto> {
    return Promise.resolve({ id, status: OrderStatus.Active, ...mockData });
  }
  // ...
}
```

### Composition Root

```typescript
// app/providers/orders.provider.ts
import { HttpClientAxios } from '@/shared/api/http-client.axios';
import { OrderClientHttp } from '@/features/orders/api/order.client.http';
import { OrderStore } from '@/features/orders/state/order.store';
import { OrderService } from '@/features/orders/state/order.service';

const httpClient = new HttpClientAxios(BASE_URL);

export const orderClientHttp = new OrderClientHttp(httpClient);
export const orderStore = new OrderStore();
export const orderService = new OrderService(orderClientHttp, orderStore);

// → передаётся в DI-контейнер или фреймворковый контекст (React Context, Vue provide/inject и т.д.)
```

### Публичный API фичи (`index.ts`)

```typescript
// features/orders/index.ts
export { OrdersPage } from './ui/organisms/OrdersPage';
export { OrderCard } from './ui/organisms/OrderCard';
export type { OrderDto } from './model/order.dto';
export type { CreateOrderDto } from './model/create-order.dto';
export { OrderStatus } from './model/order-status.enum';

// Store и Service НЕ экспортируются наружу — доступны только через DI-контекст
// Прямые внутренние пути — запрещено импортировать из других фич
```

---

### View / Routing шаблоны

```typescript
// shared/constants/route-links.ts
export const ROUTE_LINKS = {
  orders: '/orders',
  orderDetails: (id: string) => `/orders/${id}`,
} as const;
```

```typescript
// app/router/WithAuthGuard.tsx
import { Navigate } from 'react-router-dom';

type WithAuthGuardProps = {
  isAllowed: boolean;
  redirectTo: string;
  children: React.ReactNode;
};

export const WithAuthGuard = ({ isAllowed, redirectTo, children }: WithAuthGuardProps) => {
  if (!isAllowed) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};
```

```typescript
// app/pages/OrdersPage/OrdersPage.tsx
import { useEffect } from 'react';
import { OrderList } from '@/features/orders';
import { useOrderStore } from '@/features/orders/state/order.store';
import { orderService } from '@/app/providers/orders.provider';

export const OrdersPage = () => {
  const orders = useOrderStore((s) => s.orders);
  const isLoading = useOrderStore((s) => s.isLoading);

  useEffect(() => {
    void orderService.loadOrders();
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return <OrderList orders={orders} />;
};
```

---

## Межфичевые зависимости: примеры

### Правило 1: только через `index.ts`

```typescript
// ✅ Правильно: orders импортирует из users через публичный API
// features/orders/ui/organisms/OrderCard.tsx
import { UserAvatar } from '@/features/users';

// ❌ Нарушение: прямой импорт из недр чужой фичи
import { UserAvatar } from '@/features/users/ui/atoms/UserAvatar/UserAvatar';
```

### Правило 2: cross-domain страница в `app/pages/`

```typescript
// ✅ Правильно: страница с данными из двух фич — в app/pages/
// app/pages/OrderDetailsPage/OrderDetailsPage.tsx
import { OrderCard } from '@/features/orders';
import { UserProfile } from '@/features/users';

// ❌ Нарушение: cross-domain страница внутри фичи orders
// features/orders/ui/organisms/OrderDetailsPage.tsx ← импортирует из features/users
```

### Правило 3: приоритет зависимостей

```
app/         ← импортирует: features/*, shared/*
features/    ← импортирует: shared/*; из других features — только через index.ts
shared/      ← НЕ импортирует из features/*
```

---

## Поток данных через слои

```
Пользовательское действие (клик, форма)
  ↓
Component (organism)                      ← вызывает метод через DI-контекст
  ↓
Application Service ({Feature}Service)    ← оркестрирует операцию
  ↓
{Feature}Client (контракт)                ← вызов через интерфейс
  ↓
{Feature}ClientHttp (Infrastructure)      ← конкретный HTTP-запрос
  ↓
HTTP Response
  ↓
Application Service                       ← пишет данные в State
  ↓
{Feature}Store (State)                    ← реактивное обновление
  ↓
Component                                 ← реагирует на изменение State (подписка)
  ↓
Re-render с новыми данными
```

---

## Решение о `shared/`: дерево решений

```
Нужен компонент / тип / утилита?
  │
  ├─ Используется в одной фиче → features/{feature}/
  │
  ├─ Используется в ≥2 фичах → shared/
  │
  └─ Не уверен → features/{feature}/ (дублировать!)
                  └─ Перенос в shared/ — только решение человека
```

**LLM-правило:** при любом сомнении — создавай в `features/`, не трогай `shared/`. Перенос в `shared/` — осознанное архитектурное решение, не автоматическое.
