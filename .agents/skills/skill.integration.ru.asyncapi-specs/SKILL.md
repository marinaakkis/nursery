---
name: skill.integration.ru.asyncapi-specs
description: >-
  Defines standards for AsyncAPI 3.x contract documentation (asyncapi.*,
  asyncapi.external.*) covering async messaging channels, publish/subscribe
  operations, message schemas, and protocol bindings. Use when documenting
  event-driven APIs, message brokers, or async integrations.
---

# AsyncAPI-спецификации — нотация asyncapi.*

Ориентируйся на формат AsyncAPI 3.x (YAML-блоки в Markdown или отдельные YAML-файлы).

**Приоритет:** явные инструкции пользователя и правила репозитория → этот скилл → общие предпочтения.

## Когда применять

- Нужно задокументировать event-driven или async API: Kafka-топики, AMQP/RabbitMQ-очереди, WebSocket, SSE.
- Нужно описать контракт взаимодействия с внешним async API (брокер, провайдер событий).
- Задача включает изменение или добавление async-контрактов в рамках фичи или dev-request.

**Не применяй**, если:
- API использует синхронную request/response модель (HTTP REST) → используй `openapi.*` (`skill.integration.ru.openapi-specs`);
- нужна техническая последовательность вызовов → используй `sd.*` (`skill.arch.ru.sequence-diagrams`);
- нужен обзор архитектуры компонентов → используй C4 (`skill.arch.ru.c4-diagrams`).

## Ключевые элементы AsyncAPI 3.x

| Элемент | Описание |
|---|---|
| `info` | Название API, версия, описание |
| `servers` | Адреса брокеров/серверов (dev, staging, prod) + протокол (`kafka`, `amqp`, `ws`) |
| `channels` | Каналы/топики/очереди с адресом и описанием назначения |
| `operations` | Операции `send`/`receive` с привязкой к каналу и сообщению |
| `components/messages` | Переиспользуемые схемы сообщений (payload, headers, correlationId) |
| `components/schemas` | Переиспользуемые схемы данных для payload-полей |
| `components/securitySchemes` | Схемы аутентификации (SASL, OAuth2, API Key, mTLS) |

## Требования к контенту

- **Каждый канал** содержит: `address`, `description`, `messages` (привязка к схемам сообщений).
- **Каждая операция** указывает: `action` (`send`/`receive`), канал, сообщение, `summary`.
- **Схемы сообщений** имеют явные типы, обязательные поля (`required`), описания полей.
- **Bindings** (привязки к протоколу) указываются явно при наличии специфики (Kafka partition/offset, AMQP exchange type).
- **Примеры** (`examples`) рекомендуются для ключевых payload-схем.

## Типы файлов

| Тип | Описание |
|---|---|
| `asyncapi.*` | Async API самого сервиса (owned channels/topics) |
| `asyncapi.external.*` | Контракт внешнего async API, с которым интегрируется сервис |

## Именование файлов (MUST)

| Тип | Шаблон | Regex |
|---|---|---|
| Основная документация | `asyncapi.<service-name>.<ext>` | `^asyncapi\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$` |
| Внешняя интеграция | `asyncapi.external.<service-name>.<ext>` | `^asyncapi\.external\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$` |
| Dev-request (сервис) | `asyncapi.r-<nnn>.<system-request-name>.<ext>` | `^asyncapi\.r-\d+\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$` |
| Dev-request (внешняя) | `asyncapi.external.r-<nnn>.<system-request-name>.<ext>` | `^asyncapi\.external\.r-\d+\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$` |

Правила:
- `<service-name>` и `<system-request-name>` — только lowercase `kebab-case`.
- Не использовать альтернативные префиксы (`async.*`, `event.*`, `kafka.*`).

## Размещение файлов

| Контекст | Путь |
|---|---|
| Основная документация (сервис) | `docs/api-requirements/asyncapi.<service-name>.md` |
| Основная документация (внешняя) | `docs/api-requirements/asyncapi.external.<service-name>.md` |
| Dev-request дизайн (сервис) | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/design/api-requirements/asyncapi.r-<nnn>.<system-request-name>.md` |
| Dev-request дизайн (внешняя) | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/design/api-requirements/asyncapi.external.r-<nnn>.<system-request-name>.md` |

После завершения всех фаз dev-request файлы вмерживаются или создаются в `docs/api-requirements/`.

## Перед сдачей (чеклист)

1. Тип `asyncapi.*` выбран осознанно (event-driven/async, не REST → `openapi.*`).
2. Имя файла соответствует regex для выбранного типа (основная / dev-request).
3. Файл размещён в правильной папке (`docs/api-requirements/` или `design/api-requirements/` в dev-request).
4. Все каналы описаны с адресом, назначением и привязкой к схемам сообщений.
5. Каждая операция явно указывает `action` (`send`/`receive`), канал и сообщение.
6. Схемы payload содержат типы, обязательные поля и описания.
7. Bindings к протоколу указаны при наличии специфики (Kafka, AMQP, WebSocket).
8. Аутентификация описана через `securitySchemes`.
