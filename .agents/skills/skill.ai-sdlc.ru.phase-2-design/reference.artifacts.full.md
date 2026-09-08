---
name: reference.artifacts.full
description: >
  Конечные артефакты фазы 2 (DESIGN) AI-SDLC в профиле `full` (человеко-читаемый):
  Mermaid-диаграммы + нарративный Design Report + architecture.md. Выбирается `docs=full`.
  Парная ссылка: reference.artifacts.compact.
---

# Фаза 2 (DESIGN) — артефакты профиля `full`

> Профиль `docs=compact|full` (дефолт `compact`). Полный профиль — Mermaid-диаграммы, нарративный Design Report и обновление `docs/architecture.md`. Краткий — `reference.artifacts.compact.md`.

Принцип `full`: полный набор архитектурных артефактов с Mermaid-диаграммами и нарративом.

## Состав артефактов (условия генерации — AS-IS из skill.ai-sdlc.ru.phase-2-design)

| Артефакт | Профиль `full` | Условие | Skill |
|---|---|---|---|
| Design Report (нарратив) | ✅ | всегда | — |
| C4 Component (C3) | ✅ | всегда | `skill.arch.ru.c4-diagrams` |
| C4 Context (C1) | ✅ | если новый сервис / изменение контекста | `skill.arch.ru.c4-diagrams` |
| C4 Container (C2) | ✅ | если затрагивает несколько сервисов | `skill.arch.ru.c4-diagrams` |
| DFD | ✅ | если меняются потоки данных | `skill.arch.ru.dfd-diagrams` |
| Sequence (sd) | ✅ | по запросу / сложная логика | `skill.arch.ru.sequence-diagrams` |
| Workflow (wf) | ✅ | по запросу / оркестрация-сага | `skill.arch.ru.workflow-diagrams` |
| BPMN | ✅ | по запросу / бизнес-процесс с участниками | `skill.arch.ru.bpmn-diagrams` |
| ERD | ✅ | если меняется структура данных | `skill.arch.ru.erd-diagrams` |
| ADR | ✅ | нетривиальное решение | — |
| Test Strategy | ✅ | всегда | — |
| API-контракты (OpenAPI/AsyncAPI/md) | ✅ | при изменении/добавлении API | `openapi-specs`/`asyncapi-specs`/`api-endpoint-doc` |
| `docs/architecture.md` | ✅ | если меняется архитектура | `skill.arch.en.architecture-md-artifact` |
| dev-process-plan | ✅ | всегда | — |

## Отличие от `compact`

`full` создаёт Mermaid-диаграммы (в `compact` — таблицы-эквиваленты), нарративный Design Report и обновляет `docs/architecture.md`. Фактический состав решений совпадает (full ⊇ compact по информации).
