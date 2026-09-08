---
name: skill.arch.ru.sequence-diagrams
description: >-
  Enforces UML 2 sequence diagram standards (sd.*) with participant layout,
  message semantics, and UML fragment rules. Use when creating or reviewing
  technical call-flow and request/response diagrams.
---

# Sequence-диаграммы — нотация sd.*

Ориентируйся на UML 2 Sequence Diagram и принятые в проекте ограничения инструмента (Mermaid/PlantUML).

**Приоритет:** явные инструкции пользователя и правила репозитория → этот скилл → общие визуальные предпочтения.

## Когда применять

- Нужна техническая последовательность вызовов, message flow, request/response.
- Нужно задокументировать многошаговый сценарий с явными вызовами и ответами.
- Нужно выбрать тип `sd.*` для process-диаграммы в `docs/process-diagrams/`.

**Не применяй**, если:
- нужна orchestration/saga → используй `wf.*` (`skill.arch.ru.workflow-diagrams`);
- нужен бизнес-процесс с ролями → используй `bpmn.*` (`skill.arch.ru.bpmn-diagrams`);
- нужно показать потоки данных → используй `dfd.*` (`skill.arch.ru.dfd-diagrams`).

## UML sequence — базовые правила

Строго различай:

- синхронный вызов и ответ;
- асинхронный сигнал;
- create/destroy при необходимости;
- фрагменты `alt`, `opt`, `loop`, `par`, `break`, `ref` с guard-условиями.

Активации показывай, когда длительность выполнения существенна для сценария.

## Обязательная компоновка участников

1. Группируй участников по смыслу и ответственности.
2. Внутренние участники системы размещай рядом.
3. Внешние системы располагай правее внутренних блоков.
4. Инициатора (user/operator/scheduler) размещай слева.
5. Имена участников привязывай к реальным сущностям кода, избегай абстрактных `System A/B`.

Если инструмент не поддерживает часть UML, явно фиксируй ограничение рядом с диаграммой и компенсируй недостающее в тексте.

## Именование файлов (MUST)

| Тип | Шаблон | Regex |
|---|---|---|
| Sequence | `sd.<diagram-title>.<ext>` | `^sd\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$` |

Правила:
- `<diagram-title>` — только lowercase `kebab-case`.
- Не использовать альтернативные префиксы.
- Файлы размещать в `docs/process-diagrams/`.

## Перед сдачей (чеклист)

1. Тип `sd.*` выбран осознанно (технический call-flow/request-response, не BPMN/workflow/DFD).
2. Имя файла соответствует regex `^sd\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$`.
3. Файл размещён в `docs/process-diagrams/`.
4. Sequence использует корректные message semantics и UML fragments.
5. Участники сгруппированы и расположены в читаемом порядке.

Подробные примеры — [reference.md](reference.md).
