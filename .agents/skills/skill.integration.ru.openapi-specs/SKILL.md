---
name: skill.integration.ru.openapi-specs
description: >-
  Defines standards for OpenAPI 3.x API contract documentation (openapi.*,
  openapi.external.*) covering REST API endpoints, schemas, security schemes,
  and examples. Use when documenting service REST APIs, inter-service contracts,
  or external REST API integrations.
---

# OpenAPI-спецификации — нотация openapi.*

По умолчанию используй OpenAPI `3.0.3` (максимальная совместимость с tooling). OpenAPI `3.1.x` используй только если команда явно подтвердила поддержку этого формата в lint/codegen/CI.

Формат артефакта по умолчанию: YAML-блок в `.md`. Отдельный `.yaml/.yml` файл используй только при явной инструментальной необходимости (codegen, lint в CI, публикация в Swagger UI).

Эталонные фрагменты и пограничные кейсы смотри в `reference.md` этого скилла. При разработке по фазному процессу применяй скилл на Design-фазе (Phase 2), где формируются API-контракты.

**Приоритет:** явные инструкции пользователя и правила репозитория → этот скилл → общие предпочтения.

## Когда применять

- Нужно задокументировать REST API сервиса: эндпоинты, схемы запросов/ответов, коды статусов.
- Нужно описать контракт взаимодействия с внешним REST API (интеграция, провайдер).
- Задача включает изменение или добавление REST API-контрактов в рамках фичи или dev-request.

**Markdown-контракт вместо YAML**: если команда не использует OpenAPI-инструментарий (генерация клиентов, Swagger UI, lint) и нужен только human-readable документ — используй шаблоны `.agents/skills/skill.integration.ru.api-endpoint-doc/template.api-contract.md` (сервис) или `.agents/skills/skill.integration.ru.integration-doc/template.api-external-contract.md` (внешняя интеграция). В этом случае данный скилл не применяется; формат эндпоинтов задаёт `skill.integration.ru.api-endpoint-doc`, формат моделей — `skill.dev.ru.data-model-table`.

**Не применяй**, если:
- API использует событийную/асинхронную модель (Kafka, RabbitMQ, WebSocket, SSE) → используй `asyncapi.*` (`skill.integration.ru.asyncapi-specs`);
- нужна техническая последовательность вызовов → используй `sd.*` (`skill.arch.ru.sequence-diagrams`);
- нужен общий обзор архитектурных уровней → используй C4 (`skill.arch.ru.c4-diagrams`).

## Ключевые элементы OpenAPI 3.x

| Элемент | Описание |
|---|---|
| `info` | Название API, версия, описание, контакт |
| `servers` | Базовые URL сервера (dev, staging, prod) |
| `paths` | Маршруты и операции (GET, POST, PUT, PATCH, DELETE) |
| `components/schemas` | Переиспользуемые схемы данных (request/response bodies) |
| `components/securitySchemes` | Схемы аутентификации (Bearer JWT, OAuth2, API Key) |
| `components/responses` | Переиспользуемые ответы (400, 401, 403, 404, 500) |
| `tags` | Группировка эндпоинтов по доменным областям |

## Требования к контенту

- **Каждый эндпоинт** содержит: `summary`, `operationId`, схемы запроса/ответа, все возможные HTTP-коды.
- **`operationId`** именуется в camelCase по шаблону `<httpMethod><Resource>`: `getUserById`, `createOrder`, `updateOrderStatus`.
- **Схемы** имеют явные типы, обязательные поля (`required`), описания полей (`description`).
- **Переиспользуемые и нетривиальные модели** выносятся в `components/schemas` и подключаются через `$ref`; inline-схемы допустимы только для тривиальных локальных случаев.
- **Примеры** (`example` / `examples`) обязательны для всех `POST`/`PUT`/`PATCH` request body и для успешных ответов `200`/`201`.
- **Безопасность** описывается через `securitySchemes`; глобальный `security` применяется по умолчанию, публичные эндпоинты обязаны явно указывать `security: []`.
- **Deprecation** оформляется явно: устаревающие операции/схемы получают `deprecated: true` и комментарий о миграции/сроке вывода.
- Соблюдать `skill.integration.ru.api-rest-standards` по URL-структуре, версионированию, HTTP-методам и кодам ответов.

## Автоматизация проверок

- Для линтинга спецификаций используй Spectral (локально и/или в CI).
- Для синтаксической валидации используй `swagger-cli validate` (или эквивалент команды в проекте).
- Если используется codegen, проверяй согласованность `operationId` и схем через `openapi-generator validate` перед публикацией контракта.

## Типы файлов

| Тип | Описание |
|---|---|
| `openapi.*` | API самого сервиса (owned REST API) |
| `openapi.external.*` | Контракт внешнего REST API, с которым интегрируется сервис |

## Именование файлов (MUST)

| Тип | Шаблон | Regex |
|---|---|---|
| Основная документация | `openapi.<service-name>.<ext>` | `^openapi\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$` |
| Внешняя интеграция | `openapi.external.<service-name>.<ext>` | `^openapi\.external\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$` |
| Dev-request (сервис) | `openapi.r-<nnn>.<system-request-name>.<ext>` | `^openapi\.r-\d+\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$` |
| Dev-request (внешняя) | `openapi.external.r-<nnn>.<system-request-name>.<ext>` | `^openapi\.external\.r-\d+\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$` |

Правила:
- `<service-name>` и `<system-request-name>` — только lowercase `kebab-case`.
- Не использовать альтернативные префиксы (`api.*`, `rest.*`).

## Размещение файлов

| Контекст | Путь |
|---|---|
| Основная документация (сервис) | `docs/api-requirements/openapi.<service-name>.md` |
| Основная документация (внешняя) | `docs/api-requirements/openapi.external.<service-name>.md` |
| Dev-request дизайн (сервис) | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/design/api-requirements/openapi.r-<nnn>.<system-request-name>.md` |
| Dev-request дизайн (внешняя) | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/design/api-requirements/openapi.external.r-<nnn>.<system-request-name>.md` |

После завершения всех фаз dev-request файлы вмерживаются или создаются в `docs/api-requirements/`.

## Перед сдачей (чеклист)

1. Тип `openapi.*` выбран осознанно (REST API, не event-driven/async → `asyncapi.*`).
2. Имя файла соответствует regex для выбранного типа (основная / dev-request).
3. Файл размещён в правильной папке (`docs/api-requirements/` или `design/api-requirements/` в dev-request).
4. Все эндпоинты указаны с `operationId`, `summary`, схемами запроса/ответа.
5. Все возможные HTTP-коды перечислены для каждого эндпоинта.
6. Схемы данных содержат типы, обязательные поля и описания.
7. Аутентификация/авторизация описана через `securitySchemes`.
8. Глобальный `security` задан; публичные маршруты явно помечены `security: []`.
9. Для `POST`/`PUT`/`PATCH` и ответов `200`/`201` добавлены `example`/`examples`.
10. Для переиспользуемых структур используются `components/schemas` + `$ref`, а не дублирующий inline.
11. Устаревающие операции/схемы помечены `deprecated: true` и содержат примечание о миграции.
12. Спецификация проходит lint/validate (`Spectral`, `swagger-cli` или эквиваленты проекта).
13. Соблюдены правила `skill.integration.ru.api-rest-standards` (URL, версионирование, коды ответов).
