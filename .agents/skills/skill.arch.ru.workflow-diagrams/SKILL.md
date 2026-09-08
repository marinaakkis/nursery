---
name: skill.arch.ru.workflow-diagrams
description: >-
  Defines standards for workflow diagrams (wf.*) covering orchestration, saga
  patterns, route-logic, and state transitions. Use when documenting multi-step
  orchestration flows or saga-style processes with sequential or conditional routing.
---

# Workflow-диаграммы — нотация wf.*

Ориентируйся на orchestration/saga-паттерны и inter-step state routing.

**Приоритет:** явные инструкции пользователя и правила репозитория → этот скилл → общие визуальные предпочтения.

## Когда применять

- Нужна визуализация orchestration или saga-паттерна.
- Необходимо отобразить route-логику и переходы состояний между шагами.
- Процесс преимущественно технический (не бизнес-регламентный), но сложнее простой sequence.

**Не применяй**, если:
- нужна техническая последовательность вызовов request/response → используй `sd.*` (`skill.arch.ru.sequence-diagrams`);
- нужен бизнес-процесс с ролями и регламентными ветвлениями → используй `bpmn.*` (`skill.arch.ru.bpmn-diagrams`);
- нужно показать потоки данных между компонентами → используй `dfd.*` (`skill.arch.ru.dfd-diagrams`).

## Ключевые правила

- Явно показывай переходы состояний: старт, промежуточные шаги, развилки (условные/параллельные), финал/ошибка.
- Для saga — отображай компенсирующие шаги при откате.
- Для orchestration — показывай оркестратор явным участником/узлом.
- Участники диаграммы — реальные сервисы/компоненты кода; избегай абстрактных `Step A/B`.

## Именование файлов (MUST)

| Тип | Шаблон | Regex |
|---|---|---|
| Workflow | `wf.<title>.<ext>` | `^wf\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$` |

Правила:
- `<title>` — только lowercase `kebab-case`.
- Не использовать альтернативные префиксы.
- Файлы размещать в `docs/process-diagrams/`.

## Перед сдачей (чеклист)

1. Тип `wf.*` выбран осознанно (orchestration/saga/route-logic, не BPMN/sequence).
2. Имя файла соответствует regex `^wf\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$`.
3. Файл размещён в `docs/process-diagrams/`.
4. Все переходы состояний (включая компенсирующие шаги при ошибке) присутствуют.
5. Участники привязаны к реальным сущностям кода.
