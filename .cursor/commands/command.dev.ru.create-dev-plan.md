# Создание плана разработки (dev-planning)

Универсальная команда для Cursor Agent: **создать или обновить** артефакты планирования разработки для выбранного модуля на основе готовой архитектурной документации. Команда переносима между репозиториями.

---

## Как вызывать

Пользователь указывает модуль или путь к его `docs/` (абсолютный или относительный от корня репозитория).

Если модуль не указан:

1. Найти наиболее вероятный модуль с готовой документацией (`docs/architecture.md`, `docs/requirements/`).
2. Если неоднозначно — уточнить у пользователя.

**Каталог вывода:** `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-planning/` — внутри соответствующего dev-request.

---

## Порядок работы (обязательно)

### 0. Применить скилл dev-planning

Прочитать и применить:

- `.agents/skills/skill.dev.ru.dev-planning/SKILL.md`
- `.agents/skills/skill.dev.ru.dev-planning/reference.md`

### 1. Прочитать архитектурную документацию модуля

Путь к источникам зависит от контекста:

**В ai-sdlc процессе** (вызов из Phase 3 / `skill.ai-sdlc.ru.phase-3-planning`) — читать из `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/`:

1. `design/` — дизайн-артефакты: C4, DFD, Sequence, ADR, BPMN/Workflow.
2. `design/testing/dev-testing.r-<nnn>.strategy.md` — тест-стратегия.
3. `design/api-requirements/` — API-контракты (если есть).
4. `research.r-<nnn>.<system-request-name>.md` — research-документ.

**Standalone** (вне ai-sdlc процесса) — читать из `docs/` в следующем порядке:

1. `docs/architecture.md` — каталог компонентов C1/C2/C3, ссылки на ADR/DDS.
2. `docs/requirements/` — все документы требований (FURPS, FR, NFR).
3. `docs/api-requirements/` — API-контракты, межсервисные интерфейсы и способы аутентификации/авторизации.
4. `docs/adr-log/` — принятые архитектурные решения.
5. `docs/dds-log/` — контракты разработки.
6. `docs/process-diagrams/` — runtime-потоки (`sd.*`, `wf.*`, `bpmn.*`) при наличии.

Если `docs/architecture.md` отсутствует — сначала выполнить команду `command.arch.ru.generate-architecture-artifacts-from-spec`.

### 2. Определить номер и имя dev-plan

- Определить `r-<nnn>` — номер текущего dev-request (из папки `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/`).
- Определить `<system-dev-plan-name>` в `kebab-case` по контексту задачи.

### 3. Создать файловую структуру

```
docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/
└── dev-planning/
    └── dev-plan.r-<nnn>.<system-dev-plan-name>/
        ├── dev-plan.r-<nnn>.<system-dev-plan-name>.md
        ├── dev-task.r-<nnn>.t-001.<system-dev-task-name>.md
        ├── dev-task.r-<nnn>.t-002.<system-dev-task-name>.md
        └── scripts/
            └── sync-dev-plan.py
```

Правила именования:

| Тип | Маска |
|-----|-------|
| Dev-plan директория | `dev-plan.r-<nnn>.<system-dev-plan-name>/` |
| Dev-plan файл | `dev-plan.r-<nnn>.<system-dev-plan-name>.md` |
| Dev-task | `dev-task.r-<nnn>.t-<nnn>.<system-dev-task-name>.md` |

### 4. Создать `dev-plan.r-<nnn>.<system-dev-plan-name>.md`

Начальные значения:

- **Статус:** `Планирование`
- **Версия:** `1.0`

Обязательные таблицы:

- `Основные компоненты` — из C2/C3 каталога `architecture.md`.
- `Dev-задачи` — все создаваемые dev-задачи.
- `Changelog` — первая строка с датой создания.

### 5. Создать dev-task-файлы

Для каждого функционального требования или компонента:

1. Создать файл по маске `dev-task.r-<nnn>.t-<nnn>.<system-dev-task-name>.md`.
2. Заполнить: Системное название, Код dev-задачи (`r-<nnn>.t-<nnn>`), Название, Версия `1.0`, Аннотация, Описание.
3. Добавить раздел Критерии готовности и таблицу Changelog (первая строка).

### 6. Скопировать скрипт синхронизации

Скопировать `.agents/skills/skill.dev.ru.dev-planning/scripts/sync-dev-plan.py` в `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-planning/dev-plan.r-<nnn>.<system-dev-plan-name>/scripts/sync-dev-plan.py`.

### 7. Проверить согласованность

- Все компоненты из таблицы `Основные компоненты` покрыты хотя бы одной dev-задачей.
- Все dev-задачи зарегистрированы в таблице `Dev-задачи` dev-plan.
- Changelog заполнен в dev-plan и каждом dev-task.

---

## Ограничения

- В `docs/` не добавлять ссылки на `.input/`.
- Не хранить секреты, токены, ключи в planning-артефактах.
- Все имена файлов — строго `kebab-case`, без кириллицы.

---

## Версия команды

Команда переносима: не фиксировать здесь продукт-специфичные пути или жёсткие имена файлов.
