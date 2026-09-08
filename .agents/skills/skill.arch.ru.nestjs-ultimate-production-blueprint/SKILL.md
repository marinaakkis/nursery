---
name: nestjs-ultimate-production-blueprint
description: >-
  Guides production-grade NestJS architecture with bounded modules, CQRS,
  domain events, outbox integration, guards, controllers, and tests. Use when
  designing or implementing enterprise NestJS backend features or services.
---

# Cursor AI Skill: Ultimate NestJS Architecture

## 🎯 Цель

Генерация production-ready систем уровня enterprise.

---

## 📌 Обязательная генерация

При любой фиче:

1. Module (bounded context)
2. Domain model
3. Command (CQRS)
4. Handler
5. Domain event
6. Outbox integration
7. Controller
8. Guard (если нужно)
9. Tests

---

## 1. Modules

```ts id="p8x3ld"
@Module({
  controllers: [],
  providers: [],
})
```

---

## 2. CQRS

```ts id="t4w9qp"
@CommandHandler(CreateCommand)
```

---

## 3. Events + Outbox

```ts id="m2v7sx"
this.eventBus.publish(new Event());
```

* сохранять в outbox

---

## 4. Security

```ts id="z1n5xt"
@UseGuards(AuthGuard) // Авторизация
```

---

## 5. Null Safety

```ts id="r9k2va"
if (!input) {
  throw new Error("Invalid input");
}
```

---

## 6. Observability

* логирование
* метрики
* tracing hooks

---

## 7. API Versioning

* всегда versioned endpoints

---

## 8. Tests

* unit (use case)
* e2e (endpoint)

---

## 9. Генерация (алгоритм)

1. Создать модуль
2. Создать domain
3. Создать command
4. Создать handler
5. Создать event
6. Добавить outbox
7. Создать controller
8. Добавить security
9. Добавить тесты

---

## 10. Строгие запреты

❌ Нет модульности
❌ Нет событий
❌ Нет outbox
❌ Нет тестов
❌ Нет проверки null

---

## 11. Упрощения

Если задача маленькая:

* можно убрать CQRS
* можно убрать outbox

НО:

* архитектура остаётся

---

## ✅ Результат

Код должен:

* масштабироваться
* быть отказоустойчивым
* поддерживать события
* быть готовым к микросервисам

---
