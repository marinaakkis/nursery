---
name: skill.arch.ru.bpmn-diagrams
description: >-
  Defines standards for BPMN diagrams (bpmn.*) covering business processes,
  approval flows, cross-department processes, business regulation
  (согласование, заявка, регламент), and stakeholder roles. Use when
  documenting business processes with pools, lanes, roles, or regulatory flows.
---

# BPMN-диаграммы — нотация bpmn.*

Ориентируйся на BPMN 2.0 и принятые в проекте ограничения инструмента (Mermaid/PlantUML).

**Приоритет:** явные инструкции пользователя и правила репозитория → этот скилл → общие визуальные предпочтения.

## Когда применять

- Нужна визуализация бизнес-процесса с ролями, регламентными и бизнес-ветвлениями.
- Процесс охватывает несколько участников/отделов (pools/lanes).
- Нужно документировать события, задачи, шлюзы, тайм-ауты, ошибки в бизнес-терминах.

**Не применяй**, если:
- нужна техническая последовательность вызовов → используй `sd.*` (`skill.arch.ru.sequence-diagrams`);
- нужна orchestration/saga → используй `wf.*` (`skill.arch.ru.workflow-diagrams`);
- нужно показать потоки данных → используй `dfd.*` (`skill.arch.ru.dfd-diagrams`).

## Ключевые правила

- **(MUST)** Используй стандартные BPMN-элементы: события (start/end/intermediate), задачи, шлюзы (exclusive/parallel/inclusive), pools, lanes, subprocesses.
- **(MUST)** Участники (pools/lanes) — реальные роли, системы или организационные единицы.
- **(MUST)** Явно показывай Happy Path. Для каждого шага с бизнес-ошибкой — явный Exception Flow; для компенсируемых задач — Compensation Event.
- **(SHOULD)** Если инструмент не поддерживает полный BPMN — зафиксируй ограничение рядом с диаграммой.

Используется в **Phase 2 — Design**.

Таблицы элементов, примеры синтаксиса и ограничения инструментов — см. [`reference.md`](reference.md).

## Именование файлов (MUST)

| Тип | Шаблон | Regex |
|---|---|---|
| BPMN | `bpmn.<title>.<ext>` | `^bpmn\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$` |

Правила:
- `<title>` — только lowercase `kebab-case`.
- Не использовать альтернативные префиксы.
- Файлы размещать в `docs/process-diagrams/`.

## Перед сдачей (чеклист)

1. Тип `bpmn.*` выбран осознанно (бизнес-процесс с ролями/регламентом, не orchestration/sequence).
2. Имя файла соответствует regex `^bpmn\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$`.
3. Файл размещён в `docs/process-diagrams/`.
4. Pools/lanes соответствуют реальным ролям/системам.
5. Happy Path полностью отображён.
6. Для каждого значимого шага показан Exception Flow (при наличии бизнес-ошибки).
