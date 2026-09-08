---
name: skill.arch.ru.c4-diagrams
description: >-
  Enforces C4 diagram standards (context diagram C1, container diagram C2,
  component diagram C3, dynamic C4d) with strict labeling, relationship
  annotations, naming patterns, and visual consistency. Use when creating,
  reviewing, or updating C4 architecture diagrams and related static
  architecture views.
---

# C4 диаграммы — строгая нотация

Ориентируйся на **официальную модель C4** ([c4model.com](https://c4model.com/)).

**Приоритет:** явные инструкции пользователя и правила репозитория -> этот скилл -> общая эвристика визуализации.

Если в репозитории зафиксирован обязательный инструмент/формат (например только Mermaid или только PlantUML), сначала следуй ему; этот скилл задает требования к нотации и качеству содержания.

## Когда применять

Применяется в Phase 2 (Design); в Phase 4 — только при актуализации существующих диаграмм.

- Пользователь просит C4 context/container/component/dynamic.
- Нужно создать или отревьюить C1/C2/C3/C4d файлы в `docs/c4-diagrams/`.
- Нужно проверить консистентность C4-описания и архитектурного каталога в `docs/architecture.md` — каждый C4-файл должен быть упомянут в индексе `architecture.md`.

## Не применяй, если

- Нужна временна́я последовательность шагов → используй `sd.*` (`skill.arch.ru.sequence-diagrams`).
- Нужно описать бизнес-процесс → используй `bpmn.*` (`skill.arch.ru.bpmn-diagrams`).
- Нужно показать потоки данных → используй `dfd.*` (`skill.arch.ru.dfd-diagrams`).

## Уровни C4 и смысл

| Уровень | Назначение |
|---|---|
| C1 (System context) | Границы системы, пользователи и внешние системы. |
| C2 (Container) | Контейнеры внутри системы и ключевые взаимодействия. |
| C3 (Component) | Крупные внутренние компоненты выбранного контейнера. |
| C4d (Dynamic) | Поток управления через конкретный сценарий в терминах статических C4-элементов. |

Используй только те уровни, которые добавляют ценность для текущей задачи.

## Обязательная подпись Container

Для каждого Container-элемента в подписи должно быть три логические строки:

1. Название контейнера.
2. `[Container: <стек>]`.
3. Короткое описание роли контейнера.

Для `Software system` используй подпись вида `[Software system]` (или эквивалент по инструменту) и не подставляй строку `[Container: ...]`.

## Связи (relationships) — обязательная детализация

На значимых связях явно фиксируй (если данные известны — обязательно; если неизвестны — проставь TBD и уведоми пользователя):

- формат/тип данных (JSON, Protobuf, ...);
- тип взаимодействия (REST, gRPC, queue, ...);
- auth/trust-модель (OAuth2, mTLS, API key, ...);
- протокол/транспорт (HTTPS, AMQP, HTTP/2, ...).

Если данных в источнике недостаточно — не выдумывай детали, помечай `TBD`.

## Компоновка и визуальная консистентность (SHOULD)

- Направление чтения: обычно слева направо.
- Однотипные блоки выравнивай по размерам/сетке где позволяет инструмент.
- Используй палитру из [reference.md](reference.md); не более двух акцентных цветов.

## Строгий контракт именования C4-файлов (MUST)

Если `docs/c4-diagrams/` не существует — создай его перед созданием файлов.

При создании файлов в `docs/c4-diagrams/`:

| Тип | Шаблон | Regex |
|---|---|---|
| C4 static/dynamic | `<c4-level>.<diagram-title>.<ext>` | `^(c1|c2|c3|c4d)\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$` |

Правила:

- Если имя не проходит regex — файл не создавать до исправления имени.
- `<diagram-title>` только lowercase `kebab-case`.
- Не использовать альтернативные префиксы вместо `c1|c2|c3|c4d`.

## Границы этого скилла

- Sequence-диаграммы (sd.*): `.agents/skills/skill.arch.ru.sequence-diagrams/SKILL.md`.
- Workflow / Saga / Orchestration-диаграммы (wf.*): `.agents/skills/skill.arch.ru.workflow-diagrams/SKILL.md`.
- BPMN-диаграммы (bpmn.*): `.agents/skills/skill.arch.ru.bpmn-diagrams/SKILL.md`.
- DFD — Data Flow Diagrams (dfd.*): `.agents/skills/skill.arch.ru.dfd-diagrams/SKILL.md`. Хранятся в `docs/process-diagrams/` и обязательны для каждого набора архитектурной документации.

## Перед сдачей (чеклист)

1. У каждого Container есть три строки подписи: name -> `[Container: ...]` -> description.
2. Для systems корректно указан тип `[Software system]` без container-строки.
3. На ключевых связях отражены data/style/auth/protocol или явно указан `TBD`.
4. Уровень диаграммы соответствует запросу (C1/C2/C3/C4d без смешения лишних абстракций).
5. Имена C4-файлов соответствуют regex `c1|c2|c3|c4d`.
6. Диаграмма читается последовательно и не перегружена визуальным шумом.
7. Каждый созданный C4-файл упомянут в индексе `docs/architecture.md`.
8. Если в диаграмме проставлены TBD — перечислить их пользователю для уточнения.

Подробные примеры подписей и форматирования — [reference.md](reference.md). Скелетные шаблоны C1/C2 для PlantUML и Mermaid — там же.
