---
name: skill.integration-design.ru.phase-2-architecture
description: >-
  Phase 2 (Architecture) of the inter-service integration design-and-approval
  process — "Проектирование архитектуры межсервисной интеграции". Produces the
  integration project card and the full technical documentation set: a connection
  technology table (data format, interaction type, auth model, protocol/transport,
  frequency, sync/async), C2 container view, environment-linking tables, endpoint
  descriptions, data models with PII/commercial-secret sensitivity columns, field
  mappings, an adaptive authentication/authorization template (OAuth2.0 via an
  Access Token Provider, Basic Auth, mTLS, API key), and a related-requests
  log. Tables are the source
  of truth for agents; diagrams (C2, sequence, environment links) are derived for
  humans, mermaid by default. Use after the concept phase, when designing the
  detailed architecture of an inter-service integration.
---

# SKILL: integration-design phase-2-architecture — Фаза 2: Проектирование

> **Скоуп:** Детальное проектирование межсервисной интеграции после концепта. Формирует карточку проекта и всю техническую документацию. «Проектирование архитектуры межсервисной интеграции».
> **Семейство:** `integration-design`. Предыдущая фаза — `skill.integration-design.ru.phase-1-concept`; следующая — `skill.integration-design.ru.phase-3-approval`.
> **Приоритет:** явные инструкции пользователя → security/DLP → этот скилл → общая эвристика.
> **Принцип:** **table-first** — агенты работают по таблицам; диаграммы (C2/Sequence/env-links) — производные для людей, по умолчанию mermaid, формируются по запросу. **Self-contained** — шаблоны таблиц встроены в этот скилл (скопированы из скиллов-источников), изменения источников не ломают процесс.

## Когда применять

- После фазы «Концепт», когда собран минимум сведений и подтверждён переход.
- Для составления карточки проекта интеграции и сопутствующей техдокументации.
- Для ревью/доработки уже спроектированной интеграции.

## Используемые шаблоны и reference

| Артефакт | Назначение | Источник формата |
|---|---|---|
| [`template.project-card.md`](template.project-card.md) | Карточка проекта (агрегатор всех разделов) | корпус карточек |
| [`template.general-description.md`](template.general-description.md) | Общее описание + тех-таблица связей + надёжность | `skill.integration.ru.integration-doc` |
| [`reference.c2-requirements.md`](reference.c2-requirements.md) | Требования к C2 + воспроизведение из таблицы (mermaid) | `skill.arch.ru.c4-diagrams` |
| [`reference.sequence-input.md`](reference.sequence-input.md) | Описание алгоритма сложных процессов + sequence (mermaid) | `skill.arch.ru.sequence-diagrams` |
| [`template.environments.md`](template.environments.md) | Окружения и их связи | корпус env-links |
| [`reference.env-links-requirements.md`](reference.env-links-requirements.md) | Воспроизведение диаграммы окружений (mermaid) | корпус env-links |
| [`template.api-endpoints.md`](template.api-endpoints.md) | Описание эндпоинтов целевого сервиса | `skill.integration.ru.api-endpoint-doc` |
| [`template.data-model.md`](template.data-model.md) | Модель данных JSON/XML с ПДн/КТ | `skill.dev.ru.data-model-table` |
| [`template.field-mapping.md`](template.field-mapping.md) | Маппинг полей (для шлюза/трансформации) | корпус маппингов |
| [`template.auth.md`](template.auth.md) | Аутентификация/авторизация (адаптивно) | `skill.security.en.keycloak-sso-scaffold`, OAuth2.0 Access Token Provider |
| [`template.related-requests-log.md`](template.related-requests-log.md) | Журнал связанных заявок пользователя | корпус карточек |

## Алгоритм фазы «Проектирование»

1. Открой `integration-request-plan` (создан в фазе 1); работай по разделу Фаза 2.
2. Создай/заполни **карточку проекта** (`project-card`) как агрегатор; остальные артефакты — её разделы или связанные файлы.
3. Заполни **тех-таблицу связей** (`general-description`): для каждой связи — вызываемый эндпоинт/операцию и её описание, формат данных, тип взаимодействия, модель аутентификации, протокол/транспорт, частоту, sync/async. Это обязательный машинно-читаемый источник.
4. Перенеси reliability-требования из FURPS+ в таблицу **Надёжность** (таймаут, retry, circuit breaker).
5. Заполни **окружения** (`environments`) и их связи.
6. Опиши **эндпоинты** (`api-endpoints`) и **модель данных** (`data-model`) с пометками ПДн/КТ/маскирование.
7. При наличии промежуточного шлюза с трансформацией контрактов — заполни **маппинг** (`field-mapping`).
8. Заполни **аутентификацию/авторизацию** (`auth`) по фактической схеме (OAuth2.0 через Access Token Provider; Basic Auth; mTLS; API key); зафиксируй требуемые Service Account/доступы.
9. Веди **журнал связанных заявок** (`related-requests-log`).
10. По запросу пользователя сформируй визуализации: C2 (`reference.c2-requirements`), sequence (`reference.sequence-input`), диаграмму окружений (`reference.env-links-requirements`).
11. Зафиксируй итоги и открытые вопросы в `integration-request-plan`; по подтверждению пользователя — фаза 3 (`skill.integration-design.ru.phase-3-approval`).

## Принципы

- **Технологии связи фиксируй детально:** формат/тип данных (JSON/XML), тип взаимодействия (REST/gRPC/OData), модель аутентификации (OAuth2.0/Basic Auth/mTLS/API key), протокол/транспорт (HTTPS/AMQP/TCP).
- **Направление стрелки** на C2 = «использует/вызывает», не «передаёт данные» (для данных — DFD).
- **DLP — секреты и ПДн:** при заполнении документации никогда не вписывай реальные секреты (`client_secret`, пароли, токены, ключи, сертификаты) и персональные данные — фиксируй только факт их наличия.
- **DLP — конфиденциальные имена:** реальные имена систем и организаций приводи только в рабочем экземпляре документации; в примерах и совместно используемых/публикуемых артефактах заменяй их плейсхолдерами.
- **Self-contained:** не заменяй встроенные таблицы ссылками на исходные скиллы; при расхождении со скиллом-источником обновляй вручную.

## Чеклист (перед переходом к фазе 3)

- [ ] Карточка проекта собрана (все применимые разделы)
- [ ] Тех-таблица связей заполнена (эндпоинт/описание/формат/тип/аутентификация/протокол/частота/направление)
- [ ] Таблица «Надёжность» заполнена (таймаут/retry/circuit breaker)
- [ ] Окружения и их связи описаны
- [ ] Эндпоинты и модель данных (с ПДн/КТ) описаны
- [ ] Маппинг заполнен (если есть шлюз с трансформацией контрактов) или явно `—`
- [ ] Аутентификация/авторизация и требуемые доступы зафиксированы
- [ ] Журнал связанных заявок заведён
- [ ] (По запросу) C2/Sequence/диаграмма окружений сформированы
- [ ] DLP: только плейсхолдеры; ПДн/КТ помечены, не воспроизведены
- [ ] Итоги и открытые вопросы внесены в `integration-request-plan`
