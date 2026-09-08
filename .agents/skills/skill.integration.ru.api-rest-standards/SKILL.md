---
name: skill.integration.ru.api-rest-standards
description: >-
  Applies corporate REST API design conventions: URL structure, versioning per
  endpoint, HTTP method semantics, response codes, Swagger requirements, and
  frontend API client method naming. Language- and framework-agnostic. Use when
  designing or reviewing API endpoints, choosing HTTP methods or response codes,
  defining versioning strategy, or when the user asks for code that matches the
  corporate REST API style guide.
---

# REST API — требования к API сервисов

Ориентируйся на эти правила при проектировании и ревью API, если в проекте нет явно противоречащих инструкций. Нотация REST адаптирована под нужды команды с минимальными отклонениями от стандарта; допущения связаны с упрощением кода и сохранением читаемости эндпоинтов.

## Общие принципы

- Все эндпоинты начинаются с `/api/`: `<domain>/api/...`
- Взаимодействие **только по HTTPS**
- **Swagger / OpenAPI** подключён и актуален в каждом API-сервисе
- Сущности в URL — **во множественном числе**: `/entities`, `/users`, `/reports`
- Слова в сегментах URL — **kebab-case**: `/entity-property-name`, `/get-registry`

## Версионирование

- Версионируются **эндпоинты**, не контроллеры/роуты
- Формат: `/api/v{major}.{minor}/...`; сокращение `v{major}` допустимо: `/api/v1/entities`
- Каждый эндпоинт версионируется отдельно — обеспечивает обратную совместимость на период миграции потребителей

## REST-операции

| Метод | Назначение | Пример URL | Body | Результат | Код |
|---|---|---|---|---|---|
| POST | Создание сущности | `api/v1/entities` | entityJson | CreatedEntityJson | **201** |
| GET | Все сущности коллекции | `api/v1/entities` | — | EntityArrayJson | **200** |
| GET | Сущность по ID | `api/v1/entities/{entityId}` | — | EntityJson / null | **200 / 404** |
| PUT | Полное обновление | `api/v1/entities/{entityId}` | updatedEntityJson | UpdatedEntityJson | **200** |
| DELETE | Удаление | `api/v1/entities/{entityId}` | — | DeletedEntityJson / DeletedEntityId | **200 / 204** |
| PATCH | Обновление свойства | `api/v1/entities/{entityId}/{property-name}` | propertyValue | UpdatedEntityJson / UpdatedPropertyValue | **200** |
| POST | Операция над коллекцией | `api/v1/entities/search` | SearchConditionsJson | EntityArrayJson | **200** |

**POST для операций** (когда семантика не укладывается в CRUD):
- Поиск: `api/v1/entities/search`
- Постраничный реестр: `api/v1/entities/get-registry`
- Скачивание: `api/v1/reports/{reportName}/download`

Действие указывается глаголом или существительным-действием в последнем сегменте URL.

## Коды ответов

| Код | Когда использовать |
|---|---|
| 200 | Успешный GET, PUT, PATCH, DELETE с телом ответа |
| 201 | Успешный POST (создание) |
| 204 | Успешный DELETE без тела ответа |
| 404 | Сущность не найдена |

## Требования к документированию эндпоинтов

Независимо от языка и фреймворка каждый эндпоинт должен явно декларировать возможные HTTP-статусы и типы ответов:

- **Python / FastAPI**: `response_model`, `responses={404: {"model": ErrorSchema}}`
- **Java / Spring**: `@ApiResponse`, `ResponseEntity<T>`
- **Go**: комментарии Swagger (`// @Success 200`, `// @Failure 404`)
- **Node.js / Express**: JSDoc + swagger-jsdoc или аннотации NestJS (`@ApiResponse`)
- **C# / ASP.NET**: `[ProducesResponseType]` + `ActionResult<TResult>`

Swagger/OpenAPI-схема должна отражать все задокументированные статусы и быть актуальной.

## Именование методов API-клиента (Frontend)

Имя метода = префикс по HTTP-методу + сущность из эндпоинта:

| HTTP | Префикс | Пример |
|---|---|---|
| GET | `get` | `getVacationsRequests` |
| POST (создание) | `create` | `createVacationsRequests` |
| PUT / PATCH | `update` | `updateVacationsRequest` |
| DELETE | `delete` | `deleteVacationsRequest` |
| POST (операция) | по смыслу действия | `searchFaqs`, `getInfoPageByUrl` |

Полное соглашение по именованию Frontend — `.agents/skills/skill.dev.ru.frontend-ts-react-standards/SKILL.md`.

## Перед сдачей (чеклист)

1. URL начинается с `/api/`, сущности во множественном числе, сегменты в kebab-case.
2. Версия явно указана в URL (`/v1/` или `/v1.0/`).
3. HTTP-метод соответствует семантике операции (см. таблицу).
4. POST-операции (search, download, registry) имеют осмысленный глагол в последнем сегменте.
5. Каждый эндпоинт явно декларирует возможные HTTP-статусы и типы ответов средствами своего фреймворка.
6. Swagger/OpenAPI актуален и доступен.
7. Коды ответов соответствуют таблице (201 для POST-создания, 404 для not found, 204 для DELETE без тела).
