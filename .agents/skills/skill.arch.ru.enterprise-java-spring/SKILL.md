---
name: enterprise-java-spring
description: >-
  Guides generation of enterprise Java/Spring services using Hexagonal
  Architecture, domain-first layering, ports and adapters, controllers, and
  fail-fast domain rules. Use when designing or implementing Java Spring backend
  modules that need clean architecture boundaries.
---

# Cursor AI Skill: Hexagonal Architecture (Spring)

## 🎯 Цель

Генерация масштабируемого Java-кода с:

* Hexagonal Architecture
* Чистой бизнес-логикой
* Минимальной связностью

---

## 📌 ОБЯЗАТЕЛЬНАЯ структура

При любой задаче создавай:

1. Domain (model)
2. Use Case (port in)
3. Port out (repository interface)
4. Application service (реализация use case)
5. Infrastructure adapter
6. Controller

---

## 1. Domain правила

* ❌ Никаких Spring аннотаций
* ❌ Никаких repository
* ✅ Только бизнес-логика
* ✅ Fail-fast null checks

---

## 2. Ports

Всегда:

```java id="k5a7q3"
public interface XUseCase {}
public interface XRepositoryPort {}
```

---

## 3. Application слой

```java id="v5xajv"
@Service // Сервисный слой (use case)
@Transactional // Управление транзакцией
```

Обязательно:

* null-check
* логика use-case
* работа через порты

---

## 4. Infrastructure

* Реализует port out
* Использует Spring Data / JDBC

---

## 5. Controller

```java id="f88rtp"
@RestController // REST API
```

Правила:

* только orchestration
* валидация
* никаких бизнес-правил

---

## 6. Null Safety (строго)

ВСЕГДА:

* проверка входных DTO
* проверка вложенных объектов
* отсутствие цепочек вызовов

---

## 7. Маппинг

* MapStruct (если есть DTO)
* никаких ручных set()

---

## 8. Логирование

* log.info → бизнес события
* log.error → ошибки

---

## 9. Генерация (алгоритм)

1. Определи domain модель
2. Создай use case (port in)
3. Создай repository port
4. Реализуй service
5. Добавь adapter
6. Добавь controller
7. Добавь null-checks

---

## 10. Строгие запреты

❌ Controller → Repository
❌ Domain → Spring
❌ Отсутствие портов
❌ Нарушение dependency rule

---

## 11. Упрощения (разрешены)

Если задача маленькая:

* можно сократить количество DTO
* можно объединить application + service

НО:

* ports остаются обязательными

---

## ✅ Результат

Код должен:

* легко тестироваться
* быть изолирован от Spring
* поддерживать масштабирование
* быть устойчивым к изменениям инфраструктуры

---
