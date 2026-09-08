# NestJS Ultimate Production Blueprint

## 1. Архитектура

Используется комбинация:

* Modular Monolith (bounded contexts)
* Hexagonal Architecture
* DDD Lite
* CQRS (точечно)
* Domain Events
* Outbox Pattern
* Clean Code

---

## 2. Структура проекта

```id="z8k2lm"
src/
 ├── modules/
 │    ├── user/
 │    │    ├── domain/
 │    │    ├── application/
 │    │    ├── infrastructure/
 │    │    └── interface/
 │    │
 │    ├── auth/
 │    └── billing/
 │
 ├── shared/
 │    ├── kernel/
 │    │    ├── base-entity.ts
 │    │    ├── result.ts
 │    │    └── domain-event.ts
 │    │
 │    ├── outbox/
 │    ├── logger/
 │    └── config/
 │
 ├── main.ts
```

---

## 3. Modular Monolith

* Каждый модуль изолирован
* Общение:

  * через events
  * через публичные use cases

---

## 4. Domain слой

```ts id="d1k9sl"
export class User {
  constructor(public readonly email: string) {
    if (!email) {
      throw new Error("Email is required");
    }
  }
}
```

---

## 5. Result Pattern (вместо null)

```ts id="r8x4qp"
export class Result<T> {
  constructor(
    public readonly data?: T,
    public readonly error?: string,
  ) {}

  static ok(data) {
    return new Result(data);
  }

  static fail(error) {
    return new Result(undefined, error);
  }
}
```

---

## 6. CQRS

```ts id="c3p7vn"
export class CreateUserCommand {
  constructor(public readonly email: string) {}
}
```

---

## 7. Domain Events

```ts id="n4w2sd"
export class UserCreatedEvent {
  constructor(public readonly email: string) {}
}
```

---

## 8. Outbox Pattern

```ts id="q7m1zx"
@Entity() // Таблица для хранения событий
export class OutboxEvent {
  id: string;
  payload: string;
  processed: boolean;
}
```

Правила:

* события сохраняются в БД
* отдельный воркер публикует их

---

## 9. Security

```ts id="s9k2ad"
@UseGuards(AuthGuard) // Проверка авторизации
@Roles('admin') // Роли
```

---

## 10. Observability

### Логирование

* structured logs (JSON)

### Метрики

* latency
* error rate

### Tracing

* request tracing

---

## 11. API Versioning

```ts id="v2x8pl"
@Controller({
  path: 'users',
  version: '1', // Версия API
})
```

---

## 12. Тестирование

### Unit

* use cases

### Integration

* repository

### e2e

* API

---

## 13. Docker

```id="k3n7op"
Dockerfile
docker-compose.yml
```

---

## 14. CI/CD

* lint
* test
* build
* deploy

---

## 15. Null Safety

* проверки входа
* проверки вложенных данных
* fail-fast

---

## 16. Антипаттерны

❌ Нет outbox при событиях
❌ CQRS везде
❌ shared everything
❌ fat modules

---
