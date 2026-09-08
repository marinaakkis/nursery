---
name: skill.arch.ru.erd-diagrams
description: >-
  Defines standards for Entity-Relationship Diagrams (erd.*) covering data
  models, database schemas, entity relationships, and cardinality. Use when
  documenting the structure of data, entities, and their relationships within
  or across system components.
---

# ERD-диаграммы — нотация erd.*

Ориентируйся на нотацию Crow's Foot (Mermaid `erDiagram`) или Information Engineering (PlantUML).

**Приоритет:** явные инструкции пользователя и правила репозитория → этот скилл → общие визуальные предпочтения.

## Когда применять

- Нужно описать структуру данных: сущности, атрибуты, связи.
- Задача — спроектировать или задокументировать схему БД или доменную модель.
- Нужно визуализировать кардинальность (один-к-одному, один-ко-многим, многие-ко-многим).

**Не применяй**, если:
- нужно показать потоки данных между компонентами → используй `dfd.*` (`skill.arch.ru.dfd-diagrams`);
- нужна техническая последовательность вызовов → используй `sd.*` (`skill.arch.ru.sequence-diagrams`);
- нужен бизнес-процесс с ролями → используй `bpmn.*` (`skill.arch.ru.bpmn-diagrams`);
- нужна orchestration/saga → используй `wf.*` (`skill.arch.ru.workflow-diagrams`).

## Ключевые элементы ERD

| Элемент | Описание |
|---|---|
| Сущность (Entity) | Прямоугольник с именем в единственном числе, PascalCase |
| Атрибут (Attribute) | Поле сущности с указанием типа данных |
| Первичный ключ | `PK` — уникальный идентификатор сущности |
| Внешний ключ | `FK` — ссылка на PK другой сущности |
| Связь (Relationship) | Линия с глаголом-описателем и нотацией кардинальности |

## Кардинальность (нотация Crow's Foot)

| Символ | Значение |
|---|---|
| `\|\|--\|\|` | Один-к-одному (one-to-one) |
| `\|\|--o{` | Один-ко-многим (one-to-many) |
| `}o--o{` | Многие-ко-многим (many-to-many) |
| `\|\|--o\|` | Один к нулю-или-одному |
| `o` | Ноль (необязательно) |
| `\|` | Один (обязательно) |
| `{` | Много |

## Уровни детализации

- **Концептуальный (Conceptual)** — сущности и связи без атрибутов; для обзора доменной модели.
- **Логический (Logical)** — сущности, атрибуты, типы данных, PK/FK; без привязки к конкретной СУБД.
- **Физический (Physical)** — таблицы, колонки, точные типы СУБД, индексы, ограничения.

Допускается кодировать уровень в имени файла: `erd.conceptual-orders.md`, `erd.logical-payments.md`.

## Именование файлов (MUST)

| Тип | Шаблон | Regex |
|---|---|---|
| ERD | `erd.<diagram-title>.<ext>` | `^erd\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$` |

Правила:
- `<diagram-title>` — только lowercase `kebab-case`; допускается кодировать уровень (например `conceptual-orders`, `logical-user-profile`).
- Не использовать альтернативные префиксы.

## Размещение файлов

| Контекст | Путь |
|---|---|
| Основная документация | `docs/data-models/erd.<diagram-title>.md` |
| Dev-request (дизайн) | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/design/data-models/erd.r-<nnn>.<system-diagram-name>.md` |

После завершения всех фаз dev-request ERD-файлы вмерживаются из `design/data-models/` в `docs/data-models/`.

## Перед сдачей (чеклист)

1. Тип `erd.*` выбран осознанно (структура данных, не потоки / процессы).
2. Имя файла соответствует regex `^erd\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$`.
3. Файл размещён в правильной папке (`docs/data-models/` или `design/data-models/` в рамках dev-request).
4. Уровень детализации зафиксирован (концептуальный / логический / физический).
5. Кардинальность всех связей явно обозначена.
6. PK и FK явно помечены.
7. Имена сущностей — PascalCase, единственное число.
