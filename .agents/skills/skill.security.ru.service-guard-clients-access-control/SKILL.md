---
name: service-guard-clients-access-control
description: >-
  Guides creation of Service-Guard (Keycloak) clients for Consumer and Provider services and the
  granting of inter-service access via GitLab IaC (Terraform/Terragrunt) plus the organizational
  request process. Use when creating a Service-Guard client, defining roles and access groups,
  writing terragrunt.hcl with roles and client_system_access, requesting access between two services,
  mapping a service account into a role group, understanding how granted access surfaces in the
  resource_access JWT claim, or learning who creates clients and how the approval flow works.
---

# Создание клиентов Service-Guard и выдача доступов

Service-Guard (Keycloak, realm `<service-guard-env-realm>`, обычно `systems`) выдаёт сервисам JWT-токены по `client_credentials`. Хост и realm Service-Guard зависят от окружения (test/prod) — берутся из конфигурации, не хардкодить. Чтобы это работало, для каждого сервиса создаётся **клиент** (Service Account), а доступы между сервисами выдаются через **роли и группы**. Клиенты описываются как Infrastructure-as-Code (Terraform/Terragrunt) в корпоративном GitLab; создают и меняют их DevOps **отдела инфраструктурного развития** совместно с **отделом архитектуры** по согласованной заявке.

Скилл описывает **процесс провижининга и выдачи доступов** (как заказать клиент и доступ, как устроено IaC-описание). Сам runtime-процесс получения и использования токена — в скилле `service-guard-services-auth-process`.

**Важно:** скилл **не выполняет** провижининг — клиенты создаёт DevOps. Секреты (`kk_main_secret`) и URL Keycloak (`kk_url`) задаются **только через переменные окружения**, никогда не хардкодятся в `terragrunt.hcl`. Корпоративные хосты/пути GitLab здесь — плейсхолдеры; реальные значения — у DevOps. Приоритет правил безопасности (`rule.security.en.corporate-dlp`) выше локальных.

Детальные примеры — в reference-файлах (ссылки в конце).

## Когда применять и границы

| Применять | НЕ применять |
|---|---|
| Нужно создать клиент Service-Guard для сервиса (Consumer/Provider) | Реализация получения/проверки токена в коде — см. `service-guard-services-auth-process` |
| Нужно выдать доступ одного сервиса к другому (роль на клиенте) | Пользовательская аутентификация/SSO — см. `skill.security.en.keycloak-sso-scaffold` |
| Нужно описать роли/группы в `terragrunt.hcl` | Проектирование интеграции в целом — см. `skill.integration-design.ru.phase-2-architecture` |

## Клиент Service-Guard: Consumer и Provider

| Роль клиента | Назначение |
|---|---|
| **Consumer** (`<consumer>-service`) | Сервис-потребитель. Получает `client_id`/`client_secret`, запрашивает токен и вызывает Provider |
| **Provider** (`<provider>-service`) | Сервис-поставщик. На его клиенте заводятся роли; вызывающим клиентам выдаётся доступ к этим ролям |

Доступ «сервис A → сервис B» означает: сервисный аккаунт клиента Consumer добавлен в группу нужной роли клиента Provider.

## Модель ролей, групп и доступов

| Понятие | Правило |
|---|---|
| Роль | Заводится на клиенте Provider (ключ + описание) в `roles` |
| Группа | На каждую роль создаётся группа `<ClientId>.<Role>-group` |
| Выдача доступа | `client_system_access`: для роли перечисляются клиенты, чьи **сервисные аккаунты** добавляются в группу этой роли |
| Результат в токене | У клиента-вызывающего в JWT появляется `resource_access.<Provider-ClientId>.roles = [выданные роли]` |

Связь с runtime: именно эти роли Provider проверяет в клейме `resource_access` (см. `service-guard-services-auth-process`). Полный пример и разбор — [reference.terragrunt.md](reference.terragrunt.md).

## Где живут описания клиентов (GitLab IaC)

- Клиенты описываются в корпоративном GitLab IaC: `<gitlab-host>/iac/<systems-root>/<system-group>/<system-serviceguard-project>/<system-service-client>`.
- Системы и группы Service-Guard создают и настраивают DevOps по заявке.
- Описание клиента ведётся **в ветке окружения**: `test`, `stage`, `master` (prod).
- В каталоге клиента создаётся файл `terragrunt.hcl` с входными параметрами (см. ниже).

## Описание клиента (`terragrunt.hcl`)

| Вход | Назначение |
|---|---|
| `kk_main_secret` | Секрет подключения к Keycloak — **только через env** (`get_env`) |
| `kk_url` | URL инстанса Keycloak — **только через env** (`get_env`) |
| `client_id` | Уникальный идентификатор клиента в Keycloak |
| `client_name` | Человекочитаемое имя клиента |
| `roles` | Карта `имя_роли → описание`; создаёт роли и группы `<client_id>.<role>-group` |
| `client_system_access` | Карта `роль → [клиенты]`; сервисные аккаунты этих клиентов добавляются в группу роли |

Полный пример `terragrunt.hcl` и разбор результата — [reference.terragrunt.md](reference.terragrunt.md).

## Кто создаёт и как запросить доступ

- **Создание/изменение клиентов:** DevOps **отдела инфраструктурного развития** + **отдел архитектуры**.
- **Чтобы получить доступ к сервису:** обратиться в отдел архитектуры или отдел инфраструктурного развития, приложив заявки на согласование интеграции и/или изменения доступов, согласованные с **отделом информационной безопасности**.
- По заявке DevOps создают необходимые merge request'ы в проектах клиентов сервисов.

Подробный процесс заявок и передачи кред — [reference.access-request.md](reference.access-request.md).

## Шаги DevOps (провижининг пары Consumer/Provider)

1. [ ] Создать в GitLab проекты IaC для сервисов Consumer и Provider.
2. [ ] Перенести пайплайн публикации клиентов Service-Guard.
3. [ ] Создать клиенты `<consumer>-service` и `<provider>-service`.
4. [ ] В клиенте `<provider>-service` настроить доступы (`client_system_access`), выданные клиенту `<consumer>-service`.
5. [ ] Передать креды (`client_id`/`client_secret`) команде Consumer безопасным каналом.

## Reference-файлы

| Файл | Содержание |
|---|---|
| [reference.terragrunt.md](reference.terragrunt.md) | Полный `terragrunt.hcl`, справочник входов, разбор результата (роли/группы/членства → `resource_access`) |
| [reference.access-request.md](reference.access-request.md) | Организационный процесс заявок: к кому, что приложить, что делает DevOps, передача кред |

## Перед сдачей (чеклист)

1. [ ] Для Consumer и Provider определены `client_id`/`client_name`.
2. [ ] Роли Provider описаны в `roles` (ключ + описание).
3. [ ] Доступы заданы в `client_system_access` (роль → клиенты-вызывающие).
4. [ ] `kk_main_secret` и `kk_url` берутся через `get_env` — не хардкодятся.
5. [ ] Описание лежит в нужной ветке окружения (`test`/`stage`/`master`).
6. [ ] Заявка согласована с отделом информационной безопасности; запрос направлен в отдел архитектуры / отдел инфраструктурного развития.
7. [ ] Креды передаются Consumer только безопасным каналом; нет секретов в коде/IaC/логах.
