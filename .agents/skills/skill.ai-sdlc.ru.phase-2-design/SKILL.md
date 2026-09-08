---
name: skill.ai-sdlc.ru.phase-2-design
description: >
  Phase 2 of the AI-assisted development process. Creates a complete set of
  architectural artifacts (C4, DFD, Sequence, ADR, test strategy, API contracts)
  based on the approved research document. Requires human review and approval
  before proceeding to PLANNING. Use after RESEARCH is complete and approved.
---

# SKILL: phase-2-design — Фаза 2: DESIGN

> **Скоуп:** Вторая обязательная фаза любой задачи разработки. Создаёт полный набор архитектурных артефактов на основе апрувленного research-документа.
> **Главенствующий процессный контекст:** `rule.ai-sdlc.ru.process` — порядок фаз, гейт-правила, ролевая модель.
> **Исполнительный артефакт:** `command.ai-sdlc.ru.run-phase-2-design` содержит пошаговый алгоритм выполнения фазы. Этот SKILL.md — нормативная спецификация; команда — исполнительная реализация.
> **Шаблоны:** [`reference.md`](reference.md) — шаблоны design-report, ADR и тест-стратегии.

## Когда применять

- После завершения и апрува фазы RESEARCH
- До фазы PLANNING
- **Повторный запуск:** при отказе на гейте качества или изменении архитектурного решения — обнови существующие артефакты в рамках того же `r-<nnn>` (не создавай новый номер); сбрось статус гейта до «В процессе», пройди гейт заново

## Агентный алгоритм

Полный пошаговый алгоритм — в `command.ai-sdlc.ru.run-phase-2-design`. Краткая схема:

1. **Определи набор артефактов** — на основе типа задачи и research-документа выбери нужные артефакты из таблиц раздела «Выходы».
2. **Сгенерируй архитектурные артефакты** — применяй скиллы из раздела «Используемые скиллы»; сохраняй в `docs/dev-requests/dev-request.r-<nnn>.../design/`.
3. **Зафиксируй эскалацию** — при триггерах из раздела «Эскалация» добавь `⚠ Архитектор:` в «Итоги фазы» dev-process-plan; при блокирующих поводах — жди явного подтверждения.
4. **Обнови `docs/architecture.md`** — применяй `skill.arch.en.architecture-md-artifact`.
5. **Обнови dev-process-plan** — установи режим, добавь ссылки на артефакты, заполни «Итоги фазы».
6. **Пройди самопроверку** — по чеклисту раздела «Гейт качества».

## Используемые скиллы и команды

| Артефакт | Скилл / Команда |
|---|---|
| C4-диаграммы | `skill.arch.ru.c4-diagrams` |
| Sequence-диаграммы (`sd.*`) | `skill.arch.ru.sequence-diagrams` |
| Workflow-диаграммы (`wf.*`) | `skill.arch.ru.workflow-diagrams` |
| BPMN-диаграммы (`bpmn.*`) | `skill.arch.ru.bpmn-diagrams` |
| DFD-диаграммы (`dfd.*`) | `skill.arch.ru.dfd-diagrams` |
| ERD-диаграммы (`erd.*`) | `skill.arch.ru.erd-diagrams` |
| OpenAPI-спецификации (`openapi.*`, `openapi.external.*`) | `skill.integration.ru.openapi-specs` |
| AsyncAPI-спецификации (`asyncapi.*`, `asyncapi.external.*`) | `skill.integration.ru.asyncapi-specs` |
| Индексный архитектурный артефакт | `skill.arch.en.architecture-md-artifact` |
| REST API стандарты | `skill.integration.ru.api-rest-standards` |
| Полный набор архитектурных артефактов из спецификации | `command.arch.ru.generate-architecture-artifacts-from-spec` |
| API-контракты markdown (эндпоинты) | `skill.integration.ru.api-endpoint-doc` |
| API-контракты markdown (тела запросов/ответов, модели) | `skill.dev.ru.data-model-table` |
| Документирование перечислений в контрактах и моделях | `skill.dev.ru.enum-doc` |
| API-контракты markdown (обзор интеграции) | `skill.integration.ru.integration-doc` |
| Структура и именование backend-модуля (C3, слои, CQRS) | `skill.arch.ru.backend-clean-architecture` — **ЕСЛИ** проектируется backend-сервис |
| Структура frontend-фичевого модуля (слои, Atomic Design) | `skill.arch.ru.frontend-clean-architecture` — **ЕСЛИ** проектируется SPA/frontend |
| Уточнение требований и закрытие пробелов в спецификации | `skill.arch.ru.architecture-requirements-interviewer` — **ЕСЛИ** есть открытые вопросы, слабые места или противоречия в требованиях |

## Применяемые правила

| Правило | Область |
|---|---|
| `rule.arch.ru.sequence-diagram-layout-and-naming` | Нейминг и layout диаграмм |
| `rule.governance.ru.architect-escalation-and-prohibited-patterns` | Рекомендательная эскалация к архитектору для неоднозначных архитектурных решений + обязательное подтверждение пользователя для блокирующих риск-операций |
| `rule.security.ru.secure-app-architecture-and-dependencies` | Безопасная архитектура |
| `rule.integration.ru.integration-passport-and-reliability-gate` | При наличии интеграций |

## Входы

| Вход | Описание |
|---|---|
| Research-документ | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/research.r-<nnn>.<system-request-name>.md` (апрувленный) |
| Описание задачи | Тикет, user story, описание бага с шагами воспроизведения |
| Тип задачи | Фича / Баг / Рефакторинг |

> Если research содержит открытые вопросы или противоречия в требованиях — сначала запусти `skill.arch.ru.architecture-requirements-interviewer` для их закрытия. Генерировать артефакты DESIGN до разрешения ключевых вопросов не допускается.

## Выходы

Базовый путь: `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/design/`

### Профиль артефактов (`docs`)

Состав выходов зависит от параметра `docs=compact|full` (дефолт `compact`; берётся из «Объём документации» dev-process-plan). Профили: `.agents/skills/skill.ai-sdlc.ru.phase-2-design/reference.artifacts.compact.md` и `.agents/skills/skill.ai-sdlc.ru.phase-2-design/reference.artifacts.full.md`.

- **`full`** (человеко-читаемый) — все артефакты по таблицам ниже в полном составе, включая Mermaid-диаграммы (C4/DFD/SD/WF/BPMN/ERD), нарративный Design Report и обновление `docs/architecture.md`.
- **`compact`** (по умолчанию, для ИИ-агента) — **Mermaid-диаграммы не создаются**; вместо каждой диаграммы создаётся таблица-эквивалент (та же информация плотнее и однозначнее для генерации кода; см. `reference.artifacts.compact.md`). Нарративный Design Report и `docs/architecture.md` опускаются. Решения фиксируются Design spec (таблицы решений).

Таблицы-эквиваленты в `compact` (создавать таблицу при тех же условиях «Когда», что и соответствующую диаграмму ниже):

| Вместо диаграммы | Таблица-эквивалент | Колонки |
|---|---|---|
| C4 C1/C2/C3 | Компоненты + связи | Компонент · Слой/Контейнер · Роль · Зависит от · Тип связи |
| DFD | Потоки данных | Источник · Процесс · Хранилище · Приёмник · Данные · Направление |
| Sequence | Шаги вызовов | Шаг · Актор · Вызывает · Сообщение/метод · Возврат |
| Workflow / BPMN | Переходы состояний | Состояние · Событие/условие · Действие · Следующее состояние |
| ERD | Сущности/атрибуты + связи (`skill.dev.ru.data-model-table`) | Сущность · Поле · Тип; Связь · Тип · Ключи |

**Незыблемо в обоих профилях:** Тест-стратегия, API-контракты (при изменении API), dev-process-plan. Таблицы «Когда» ниже задают условия применимости (диаграмма в `full` ↔ таблица-эквивалент в `compact`).

### Обязательные артефакты — новая фича

| # | Артефакт | Расположение | Когда |
|---|---|---|---|
| 1 | Design Report | `.../design/design-report.r-<nnn>.<system-request-name>.md` | **ВСЕГДА** |
| 2 | C4 Context | `.../design/c4-diagrams/c1.r-<nnn>.<system-diagram-name>.md` | **ЕСЛИ** новый сервис или изменение системного контекста |
| 3 | C4 Container | `.../design/c4-diagrams/c2.r-<nnn>.<system-diagram-name>.md` | **ЕСЛИ** затрагивает несколько сервисов |
| 4 | C4 Component | `.../design/c4-diagrams/c3.r-<nnn>.<system-diagram-name>.md` | **ВСЕГДА** |
| 5 | Data Flow Diagram | `.../design/process-diagrams/dfd.r-<nnn>.<system-diagram-name>.md` | **ЕСЛИ** добавляются или меняются потоки данных и их атрибуты |
| 6 | Тест-стратегия | `.../testing/dev-testing.r-<nnn>.strategy.md` | **ВСЕГДА** |
| 7 | `docs/architecture.md` | Обновление проектного индекса | **ЕСЛИ** изменяется архитектура |
| 8 | dev-process-plan _(обновляется)_ | `docs/dev-requests/dev-request.r-<nnn>.../dev-process-plan.r-<nnn>.*.md` | **ВСЕГДА** — режим, ссылки на артефакты, итоги фазы |

### После завершения всех фаз

Артефакты из dev-request вмерживаются в основную документацию:

| Тип | Откуда | Куда |
|---|---|---|
| C4-диаграммы | `c1.r-<nnn>.*`, `c2.r-<nnn>.*`, `c3.r-<nnn>.*` | `docs/c4-diagrams/` |
| Process-диаграммы | `sd.r-<nnn>.*`, `wf.r-<nnn>.*`, `bpmn.r-<nnn>.*` | `docs/process-diagrams/` |
| OpenAPI-контракты (сервис) | `openapi.r-<nnn>.*` | `docs/api-requirements/openapi.<service-name>.md` |
| AsyncAPI-контракты (сервис) | `asyncapi.r-<nnn>.*` | `docs/api-requirements/asyncapi.<service-name>.md` |
| OpenAPI-контракты (внешние) | `openapi.external.r-<nnn>.*` | `docs/api-requirements/openapi.external.<service-name>.md` |
| AsyncAPI-контракты (внешние) | `asyncapi.external.r-<nnn>.*` | `docs/api-requirements/asyncapi.external.<service-name>.md` |
| ERD | `erd.r-<nnn>.*` | `docs/data-models/` |
| API-контракты markdown (сервис) | `api.r-<nnn>.*` | `docs/api-requirements/api.<project-name>.<domain>.md` |
| API-контракты markdown (внешние) | `api.external.r-<nnn>.*` | `docs/api-requirements/api.external.<project-name>.<domain>.md` |

> **Важно:** если изменения в C2/C3 затрагивают системный контекст (новые внешние акторы, удалённые/добавленные системы) — обновить `c1.*` в основной документации при мерже.

### Дополнительные артефакты

| # | Артефакт | Расположение | Когда |
|---|---|---|---|
| 1 | Sequence Diagram | `.../design/process-diagrams/sd.r-<nnn>.<system-diagram-name>.md` | **ПО ЗАПРОСУ** или **ЕСЛИ** сложная / многошаговая логика — см. `skill.arch.ru.sequence-diagrams` |
| 2 | Workflow Diagram | `.../design/process-diagrams/wf.r-<nnn>.<system-diagram-name>.md` | **ПО ЗАПРОСУ** или **ЕСЛИ** оркестрация / сага — см. `skill.arch.ru.workflow-diagrams` |
| 3 | BPMN Diagram | `.../design/process-diagrams/bpmn.r-<nnn>.<system-diagram-name>.md` | **ПО ЗАПРОСУ** или **ЕСЛИ** бизнес-процесс с участниками — см. `skill.arch.ru.bpmn-diagrams` |
| 4 | ADR | `.../design/adr-log/adr.<xxx>.[r-<nnn>.]<kebab-case-title>.md` | **ЕСЛИ** сложное / спорное архитектурное решение; `r-<nnn>` добавляется, если ADR возник в рамках dev-request |
| 5 | OpenAPI-контракт (сервис) | `.../design/api-requirements/openapi.r-<nnn>.<system-request-name>.md` | **ЕСЛИ** изменяется REST API сервиса — см. `skill.integration.ru.openapi-specs` |
| 6 | AsyncAPI-контракт (сервис) | `.../design/api-requirements/asyncapi.r-<nnn>.<system-request-name>.md` | **ЕСЛИ** изменяется async API сервиса — см. `skill.integration.ru.asyncapi-specs` |
| 7 | OpenAPI-контракт (внешняя интеграция) | `.../design/api-requirements/openapi.external.r-<nnn>.<system-request-name>.md` | **ЕСЛИ** добавляется внешний REST API — см. `skill.integration.ru.openapi-specs` |
| 8 | AsyncAPI-контракт (внешняя интеграция) | `.../design/api-requirements/asyncapi.external.r-<nnn>.<system-request-name>.md` | **ЕСЛИ** добавляется внешний async API — см. `skill.integration.ru.asyncapi-specs` |
| 9 | ERD | `.../design/data-models/erd.r-<nnn>.<system-diagram-name>.md` | **ЕСЛИ** изменяется структура данных — см. `skill.arch.ru.erd-diagrams` |
| 10 | Паспорт интеграции | `docs/integrations/integration-passport.<name>.md` | **ЕСЛИ** новая внешняя интеграция или изменяются параметры существующей (протокол, передаваемые данные, reliability) |
| 11 | API-контракт markdown (сервис) | `.../design/api-requirements/api.r-<nnn>.<system-request-name>.md` | **ЕСЛИ** изменяется REST API и нужен Markdown контракт (без YAML) — шаблон `.agents/skills/skill.integration.ru.api-endpoint-doc/template.api-contract.md`; эндпоинты по `skill.integration.ru.api-endpoint-doc`, модели по `skill.dev.ru.data-model-table` |
| 12 | API-контракт markdown (внешняя интеграция) | `.../design/api-requirements/api.external.r-<nnn>.<system-request-name>.md` | **ЕСЛИ** новая или изменённая внешняя REST API интеграция — шаблон `.agents/skills/skill.integration.ru.integration-doc/template.api-external-contract.md`; реестр вызовов по `skill.integration.ru.integration-doc` |

> Паспорт интеграции — живой документ; изменения в нём + запись в `integrations-log` и есть история интеграции. Если в состав передаваемых данных добавляются ПДн, КТ или другая чувствительная информация — фиксировать `⚠ Архитектор:` в Итогах фазы.

### Обязательные артефакты — баг

| # | Артефакт | Расположение | Когда |
|---|---|---|---|
| 1 | Design Report | `.../design/design-report.r-<nnn>.<system-request-name>.md` | **ВСЕГДА** — описание минимального исправления |
| 2 | C4 Component | `.../design/c4-diagrams/c3.r-<nnn>.<system-diagram-name>.md` | **ВСЕГДА** — для понимания что именно правится |
| 3 | Тест-стратегия | `.../testing/dev-testing.r-<nnn>.strategy.md` | **ВСЕГДА** — регрессионный тест |
| 4 | C4 Context | `.../design/c4-diagrams/c1.r-<nnn>.<system-diagram-name>.md` | **ЕСЛИ** меняются системные границы |
| 5 | Data Flow Diagram | `.../design/process-diagrams/dfd.r-<nnn>.<system-diagram-name>.md` | **ЕСЛИ** добавляются или меняются потоки данных и их атрибуты |
| 6 | dev-process-plan _(обновляется)_ | `docs/dev-requests/dev-request.r-<nnn>.../dev-process-plan.r-<nnn>.*.md` | **ВСЕГДА** — режим, ссылки, итоги фазы |

### Обязательные артефакты — рефакторинг

| # | Артефакт | Расположение | Когда |
|---|---|---|---|
| 1 | Design Report | `.../design/design-report.r-<nnn>.<system-request-name>.md` | **ВСЕГДА** — целевая структура и migration path |
| 2 | C4 Component | `.../design/c4-diagrams/c3.r-<nnn>.<system-diagram-name>.md` | **ВСЕГДА** — целевой компонентный дизайн |
| 3 | Тест-стратегия | `.../testing/dev-testing.r-<nnn>.strategy.md` | **ВСЕГДА** |
| 4 | C4 Context | `.../design/c4-diagrams/c1.r-<nnn>.<system-diagram-name>.md` | **ЕСЛИ** меняются системные границы |
| 5 | C4 Container | `.../design/c4-diagrams/c2.r-<nnn>.<system-diagram-name>.md` | **ЕСЛИ** затрагивает несколько сервисов |
| 6 | Data Flow Diagram | `.../design/process-diagrams/dfd.r-<nnn>.<system-diagram-name>.md` | **ЕСЛИ** добавляются или меняются потоки данных и их атрибуты |
| 7 | dev-process-plan _(обновляется)_ | `docs/dev-requests/dev-request.r-<nnn>.../dev-process-plan.r-<nnn>.*.md` | **ВСЕГДА** — режим, ссылки, итоги фазы |

## Структура тест-стратегии

Полный шаблон со всеми разделами, полями и примерами — см. [`reference.md`](reference.md).

Разделы документа: `## Уровни тестирования` / `## Тест-кейсы` / `## Граничные условия` / `## Не тестируем`

## Участники

| Участник | Роль |
|---|---|
| AI-агент | Генерирует артефакты на основе research-документа и задачи |
| Инженер (обязательно) | Ревьюит дизайн, корректирует вручную, апрувит |
| Коллега (рекомендуется) | Парное ревью — распространяет архитектурные знания в команде |

Ручные правки дизайна допустимы и часто быстрее, чем перегенерация. Итоговое состояние артефактов — то, что апрувлено, не то, что сгенерировано.

## Важно

- Фаза DESIGN **требует архитектурных навыков** — без них сложно оценить корректность артефактов
- Итоговое состояние артефактов — то, что **апрувлено**: Режим 1/3 — подтверждение фиксируется в dev-process-plan; Режим 2 — автопереход по статусу «Завершена»
- Ручные правки дизайна **допустимы** и часто быстрее перегенерации
- Инженер **обязан** провести ревью (Режим 1/3); парное ревью с коллегой — **рекомендуется** (Режим 2: ревью инженером не требуется)

## Эскалация к архитектору (рекомендательный характер)

Агент не блокирует работу при необходимости архитектурного суждения — вместо этого:

1. Фиксирует замечание в разделе «Итоги фазы» dev-process-plan с префиксом `⚠ Архитектор:`.
2. Продолжает генерацию артефактов с предварительным решением (отмечает его как «предварительное»).
3. Все такие замечания переносятся в PR-описание в раздел «Архитектурные замечания».

Типичные поводы для `⚠ Архитектор:` (рекомендательные — агент продолжает с предварительным решением):
- Новая внешняя интеграция или хранилище данных
- Клиентский контур/Tier 3
- Нетривиальный архитектурный trade-off без явного требования в задаче

Поводы, требующие явного подтверждения пользователя (`⚠ 💥`, блокирующие — агент ждёт ответа):
- Деструктивные операции с данными: DROP TABLE/COLUMN, TRUNCATE, CASCADE DELETE, переименование колонок в production, необратимые миграции
- Обработка ПДн, КТ или конфиденциальных данных (новая или расширенная)
- Создание нового публичного API
- Снижение требований безопасности: отключение проверок, понижение уровня шифрования, открытие ранее закрытых endpoints

Для блокирующих поводов агент **обязан**:
1. Явно предупредить пользователя о риске
2. Дождаться явного подтверждения перед продолжением работы
3. Зафиксировать в Итогах фазы: `⚠ 💥 <операция> — ✅ Подтверждено пользователем: YYYY-MM-DD`

## Гейт качества

Режим проверки задаётся в начале задачи (по умолчанию — **Режим 3**):

| Режим | Описание |
|---|---|
| **1 — Инженер** | Инженер проверяет вручную по чеклисту |
| **2 — Агент-ревьюер** | Отдельный агент автоматически проверяет по чеклисту |
| **3 — Агент + Инженер** | Агент проверяет первым, затем инженер финально верифицирует |

Чеклист:

- [ ] `Режим` исполнения зафиксирован в разделе «Фаза 2» dev-process-plan
- [ ] C4-диаграммы покрывают все затронутые уровни
- [ ] Data Flow понятен: откуда, куда, как трансформируются данные
- [ ] Sequence Diagram отражает все шаги сценария
- [ ] ADR заполнен для нетривиальных решений (что, почему, альтернативы, риски)
- [ ] Тест-стратегия определена: уровни, сценарии, граничные условия
- [ ] OpenAPI/AsyncAPI YAML-контракты актуальны (если меняется REST/async API) — `skill.integration.ru.openapi-specs` / `skill.integration.ru.asyncapi-specs`
- [ ] Markdown API-контракты сервиса актуальны (если применимо) — `skill.integration.ru.api-endpoint-doc`, `skill.dev.ru.data-model-table`
- [ ] Markdown API-контракты внешних интеграций актуальны (если есть новая или изменённая внешняя интеграция) — `skill.integration.ru.integration-doc`
- [ ] ERD актуален для изменённых или новых сущностей (если применимо)
- [ ] Интеграционный паспорт создан (если есть новая внешняя интеграция)
- [ ] `docs/architecture.md` обновлён
