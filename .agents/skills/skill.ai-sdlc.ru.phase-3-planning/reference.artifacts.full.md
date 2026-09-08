---
name: reference.artifacts.full
description: >
  Конечные артефакты фазы 3 (PLANNING) AI-SDLC в профиле `full` (человеко-читаемый).
  Выбирается `docs=full`. Парная ссылка: reference.artifacts.compact.
---

# Фаза 3 (PLANNING) — артефакты профиля `full`

> Профиль `docs=compact|full` (дефолт `compact`). Полный профиль — dev-task + развёрнутый сводный dev-plan с нарративом. Краткий — `reference.artifacts.compact.md`.

Принцип `full`: dev-task + развёрнутый сводный dev-plan с нарративом для человеческого ревью.

## Состав артефактов

| Артефакт | Профиль `full` | Формат |
|---|---|---|
| dev-task (на логический срез) | ✅ всегда | проза + checklist (полная структура) |
| dev-plan (сводный) | ✅ развёрнутый | проза + таблицы: компоненты, dev-task, зависимости, связь с design-артефактами, changelog |
| future-task | ✅ если есть техдолг | по `rule.governance.ru.future-tasks` |
| dev-process-plan | ✅ обновляется | таблицы |

Структура dev-task/dev-plan — по `skill.dev.ru.dev-planning`.

## Отличие от `compact`

`full` дополняет сводный dev-plan нарративом (контекст, обоснования, риски прозой). Состав dev-task идентичен (full ⊇ compact).
