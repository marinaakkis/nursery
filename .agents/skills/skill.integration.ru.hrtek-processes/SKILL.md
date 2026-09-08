---
name: skill.integration.ru.hrtek-processes
description: >-
  Documents and guides the base integration process with VK HR Tek (electronic
  document signing) through the corporate ESB KrakenD gateway (bcd-to-hrtek,
  pass-through): creating signing requests (events), uploading documents,
  polling status, downloading signed files, cancelling requests, and UNEP/UKEP/PEP
  signing. Covers endpoints, data models, authorization (Service-Guard JWT +
  resource_access), process flows, environments, and code examples
  (curl/.NET/Go/Python). Use when integrating a consumer service with VK HR Tek,
  implementing document creation / cancellation / status retrieval / signing,
  consulting teams on the HR Tek base process, or when an AI agent implements
  these flows in a consumer system.
---

# Интеграция с VK HR Tek — базовый процесс

**VK HR Tek** — внешняя система электронного подписания документов. Корпоративные сервисы вызывают её **только** через корпоративный шлюз **ESB KrakenD** (семейство эндпоинтов `bcd-to-hrtek`), работающий в режиме **pass-through** (без трансформации запросов/ответов и без маскирования) — поэтому контракт совпадает с официальным API VK HR Tek 1:1. Полный официальный контракт приложен в каталоге скилла: [public-api.openapi.yaml](public-api.openapi.yaml) (снимок v1.0.1; источник истины — поставщик VK HR Tek).

Скилл двойного назначения: (а) консультирование команд, внедряющих процесс; (б) инструкция для ИИ-агентов, реализующих процесс в системах-потребителях. Покрывает три базовые операции: **создание документов на подписание**, **отмену/отклонение заявок**, **получение статусов и подписанных файлов** — плюс подписание УНЭП/УКЭП/ПЭП.

**Приоритет и безопасность:** при конфликте — правила безопасности (`rule.security.en.corporate-dlp`) приоритетнее. Секреты (`client_secret`, токены) — только из env/секрет-менеджера, никогда в коде/логах/git. Корпоративные хосты и орг-имена — плейсхолдеры (реальные значения — из конфигурации развёртывания). Детали — в reference-файлах (ссылки в конце).

## Когда применять и границы

| Применять | НЕ применять | Примечание |
|---|---|---|
| Потребитель интегрируется с VK HR Tek (создание/статус/отмена/подписание) | Проектирование/согласование новой интеграции — см. процесс `integration-design` | Этот скилл — про реализацию готового подхода `bcd-to-hrtek` |
| Нужна последовательность вызовов и контракты эндпоинтов базового процесса | Конфигурация KrakenD / IaC шлюза | Управляется DevOps (см. [reference.auth.md](reference.auth.md)) |
| Реализация ИИ-агентом процессов в системе-потребителе | Runtime получения токена Service-Guard | Кросс-ссылка на `skill.security.ru.service-guard-services-auth-process` |

## Топология

| Компонент | Роль | Зависит от | Тип связи |
|---|---|---|---|
| Система-потребитель | Инициирует базовый процесс | Service-Guard, ESB KrakenD | OAuth2 (token), REST/HTTPS |
| Service-Guard (Keycloak, realm `<service-guard-env-realm>`, обычно `systems`) | Выдаёт `client_credentials` JWT | — | OAuth2/HTTPS |
| ESB KrakenD (`bcd-to-hrtek`) | Проверка JWT (`resource_access.esb-krakend.bcd-to-hrtek`), pass-through | VK HR Tek | REST/HTTPS |
| VK HR Tek public API | Электронное подписание документов | — | REST/HTTPS |

```
Потребитель → ESB KrakenD (bcd-to-hrtek/api/v1.0) → VK HR Tek (public-api.vkdoc.mail.ru/api/v1)
```

## Авторизация (кратко)

Два независимых **звена**: **A.** Потребитель → шлюз (Service-Guard JWT, `Authorization: Bearer <access-token>`; шлюз проверяет `resource_access["esb-krakend"].roles ∋ "bcd-to-hrtek"`); **B.** Шлюз → VK HR Tek (токен VK, централизован на шлюзе, потребителю не виден). Различение: `401` — аутентификация (повтор с новым токеном), `403` — нет роли. Хост и realm Service-Guard — env-зависимы. Полностью — [reference.auth.md](reference.auth.md).

Прикладные заголовки на каждый вызов: `Authorization: Bearer <access-token>`, `X-User-Id`, `X-Side` (`employee`|`company`).

## Базовый процесс: 3 операции / 4 потока

**Операция 1 — Создание документов (запуск подписания):**

| Шаг | Вызов | Возврат |
|---|---|---|
| 1 | `GET /user/by_snils` (или `/user/by_personnel_number`) | `id` → `X-User-Id` |
| 2 | `GET /user` | `employees[].id` → `employee_id` |
| 3 | `POST /event` | `event_id` |
| 4 | `GET /event/{event_id}` | `node_id`, `action.type` |
| 5 | `POST /event/{event_id}/{node_id}/upload` | `200` |

**Операция 2 — Получение статуса и подписанного файла:**

| Шаг | Вызов | Возврат |
|---|---|---|
| 1 | `GET /event/{event_id}` (поллинг) | `action.type` |
| 2 | ветвление: `action.type == completed` | `document_id` |
| 3 | `GET …/document/{document_id}/file_with_stamp` | бинарный PDF |

**Операция 3 — Отмена/отклонение заявки:**

| Сценарий | Вызов | Результат |
|---|---|---|
| Незавершённая (`permissions.cancel == true`) | `POST /event/{event_id}/cancel` `{reason_id}` | `200`, `canceled` |
| Уже завершённая | `POST /event/{event_id}/cancel` (то же) | `403`, `error_code = forbidden` |

Детальные потоки, ветвления, поллинг и curl — [reference.flows.md](reference.flows.md).

## Типы подписания

| Тип | Сторона | Особенность | Reference |
|---|---|---|---|
| УНЭП | `employee` | По `UnepType`: `kontur` (SMS-код), `cryptopro_simple` (без кода), `cryptopro_local` (base64) | [reference.signing-unep.md](reference.signing-unep.md) |
| УКЭП | `company` | Отделённая подпись → base64 `hash` | [reference.signing-ukep.md](reference.signing-ukep.md) |
| ПЭП | — | Без криптографического тела | [reference.signing-pep.md](reference.signing-pep.md) |

## Эндпоинты

Процессные эндпоинты (полно) — [reference.endpoints.md](reference.endpoints.md): `user/by_snils`, `user/by_personnel_number`, `user`, `event/create_options`, `POST /event`, `GET /event/{id}`, `upload`, `cancel_reasons`, `cancel`, `file_with_stamp`. Прочие (кратко + ссылка на `public-api.openapi.yaml`) — [reference.endpoints-extra.md](reference.endpoints-extra.md).

## Ключевые модели и enum

Сущности: **Event** (Заявка; `event_id` — корреляция), **EventNode/ActiveNode** (`action.type`), **Document** (`document_id`), **Attribute** (полиморфный), **DocumentSignature**, **EventEmployee** (PII). Корреляция: `event_id` → `node_id` → `document_id`. Ключевые enum: `Action.type` (вкл. `completed`/`canceled`), `SignatureStatus`, `FileRequest.status`, `UnepType`, `X-Side`. Полно — [reference.data-models.md](reference.data-models.md).

## Примеры кода

Сквозной базовый процесс: [reference.curl.md](reference.curl.md) · [reference.dotnet.md](reference.dotnet.md) (максимально полный) · [reference.go.md](reference.go.md) · [reference.python.md](reference.python.md). Библиотеки: .NET `HttpClient`/`IHttpClientFactory`, Go `x/oauth2/clientcredentials`, Python `httpx`.

## Обработка ошибок

| Код | Условие | Действие |
|---|---|---|
| `401` | Токен невалиден/просрочен | Один повтор с обновлённым токеном |
| `403` | Нет роли `bcd-to-hrtek` **или** `error_code=forbidden` (отмена завершённой Заявки) | Повтор бесполезен; различать по контексту |
| `400` | Невалидные данные | Исправить запрос |
| `404` | Не найдено | Проверить идентификаторы |
| `500` | Серверная ошибка | Backoff/эскалация |

Тело ошибки — `Error { code, message }` (часть `400` — с `data.error_code`).

## Граничные условия

| # | Условие | Влияние |
|---|---|---|
| 1 | Поллинг (нет webhooks) | Статус — только периодический `GET /event/{id}` |
| 2 | Нет идемпотентности | Не повторять `POST /event`/`cancel` вслепую |
| 3 | Cancel завершённой = `forbidden` | Предпроверять `permissions.cancel` |
| 4 | Бинарные файлы | `file_with_stamp`/`file` → PDF; `zip` → zip; не base64 |
| 5 | base64 в подписях | Только УКЭП/CryptoPro Local |
| 6 | Multipart `attributes[<id>]` | Атрибуты — отдельными form-полями (механизм — `reference.data-models.md` «Передача атрибутов») |
| 7 | Версия пути | Шлюз — `api/v1.0`; официальный API — `api/v1` |

## Безопасность / DLP

- Секреты (`<consumer-client-secret>`, токены) — только env/секрет-менеджер; не логировать.
- PII (ФИО, СНИЛС, дата рождения сотрудников) — не воспроизводить; в примерах фиктивные.
- Всегда HTTPS/TLS; не отключать проверку сертификатов.
- Внутренние хосты/орг-имена — плейсхолдеры.

**Единый набор плейсхолдеров:** `<esb-krakend-host>`, `<service-guard-host>`, `<service-guard-env-realm>` (обычно `systems`), `<gitlab-host>`, `<systems-root>`, `<consumer-client-id>`, `<consumer-client-secret>`, `<access-token>`, `<vk-hrtek-token>`, `<user-id>`/`<event-id>`/`<node-id>`/`<document-id>`/`<employee-id>`/`<event-type-id>`, `<snils>`/`<personnel-number>`/`<company-id>`. Допустимы как есть: `VK HR Tek`, `public-api.vkdoc.mail.ru`, `KrakenD`, `Keycloak`, `esb-krakend`, `bcd-to-hrtek`, `service-guard`, realm `systems`, `resource_access`.

## Reference-файлы

| Файл | Содержание |
|---|---|
| [reference.endpoints.md](reference.endpoints.md) | Процессные эндпоинты — полно (`api-endpoint-doc`) |
| [reference.endpoints-extra.md](reference.endpoints-extra.md) | Прочие эндпоинты — кратко + ссылка на `openapi.yaml` |
| [reference.data-models.md](reference.data-models.md) | Модели данных + перечисления |
| [reference.flows.md](reference.flows.md) | 4 потока: шаги, ветвления, поллинг, curl |
| [reference.auth.md](reference.auth.md) | Авторизация (2 звена), окружения, кросс-ссылки на Service-Guard |
| [reference.signing-unep.md](reference.signing-unep.md) | Подписание УНЭП |
| [reference.signing-ukep.md](reference.signing-ukep.md) | Подписание УКЭП |
| [reference.signing-pep.md](reference.signing-pep.md) | Подписание ПЭП |
| [reference.curl.md](reference.curl.md) | Пример: curl |
| [reference.dotnet.md](reference.dotnet.md) | Пример: .NET (C#), максимально полный |
| [reference.go.md](reference.go.md) | Пример: Go |
| [reference.python.md](reference.python.md) | Пример: Python |
| [public-api.openapi.yaml](public-api.openapi.yaml) | Полный официальный контракт VK HR Tek (снимок v1.0.1) |

Внешний источник истины контракта: официальный `public-api.openapi.yaml` поставщика (`https://public-api.vkdoc.mail.ru/api/v1`); приложенный в каталоге файл — версионированный снимок.

## Перед сдачей (чеклист)

1. [ ] Все вызовы идут через шлюз `bcd-to-hrtek` (или прямой официальный API при отладке); базовый путь `api/v1.0`.
2. [ ] `Authorization: Bearer` — токен Service-Guard; заголовки `X-User-Id`/`X-Side` проставлены.
3. [ ] Корреляция соблюдена: `event_id` → `node_id` → `document_id`.
4. [ ] Статус определяется поллингом `GET /event/{id}` до `action.type == completed` (webhooks нет).
5. [ ] Перед отменой проверяется `permissions.cancel`; `403/forbidden` для завершённой обрабатывается.
6. [ ] `401` — один повтор с обновлением токена; `403` — без повтора.
7. [ ] Секреты — только из env/секрет-менеджера; PII/секреты не в логах; хосты/орг — плейсхолдеры.
