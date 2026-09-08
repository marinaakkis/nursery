# Команда: Фаза 2 — DESIGN

Запуск фазы архитектурного проектирования на основе апрувленного research-документа.
Применяет `skill.ai-sdlc.ru.phase-2-design`.

**Аргументы:** `$ARGUMENTS` — `<task-name> [mode=manual|auto|review] [docs=compact|full]`

Правила разбора аргументов:
- `<task-name>` — обязательное имя задачи (строка без служебного префикса `mode=`).
- `mode=manual|auto|review` — опциональный режим исполнения; числовые алиасы `1=manual`, `2=auto`, `3=review`.
- Если `mode` не задан — использовать режим `review` по умолчанию.
- Режим `plan-review` допустим только в `run-all`, не в phase-командах.
- `docs=compact|full` — опциональный объём документации (ортогонален `mode`). Если не задан — брать `Объём документации` из dev-process-plan, иначе `compact`. Профиль конечных артефактов фазы — `.agents/skills/skill.ai-sdlc.ru.phase-2-design/reference.artifacts.<docs>.md`. В `compact` Mermaid-диаграммы (C4/DFD/SD/WF/BPMN/ERD) заменяются таблицами-эквивалентами; в `full` создаются Mermaid-диаграммы.

Примеры:
- ✅ `improve-dev-process-artifacts mode=auto`
- ✅ `improve-dev-process-artifacts`
- ✅ `improve-dev-process-artifacts mode=2` (алиас)
- ❌ `improve-dev-process-artifacts mode=plan-review` (режим plan-review недопустим)

---

## Предварительные условия

1. Убедиться, что файл `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-process-plan.r-<nnn>.<system-process-plan-name>.md` существует и поля `Расположение требований` и `Расположение проекта` заполнены. Если файл отсутствует или поля пусты — остановиться и предложить пользователю: «Пожалуйста, запустите `command.ai-sdlc.ru.run-phase-1-research` для создания dev-process-plan, или заполните поля `Расположение требований` и `Расположение проекта` вручную.»
2. Убедиться, что существует и апрувлен `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/research.r-<nnn>.<system-request-name>.md`
3. Убедиться, что в `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-process-plan.r-<nnn>.<system-process-plan-name>.md` Фаза 1 имеет статус "Завершена"
4. **Стартовый контекст и изоляция (режим manual/review):** Предложить пользователю очистить контекст разговора перед запуском (`/clear` или новый чат). При согласии — перезапустить команду в чистом контексте. При отказе — продолжить.

   **Для всех режимов — обязательно:**
   - При старте читать ТОЛЬКО: `research.r-<nnn>.<system-request-name>.md` + dev-process-plan (включая раздел «Открытые вопросы»).
   - Не читать дополнительные файлы, пока артефакты фазы не содержат явную ссылку на путь.
   - История предыдущих разговоров — не источник данных; использовать только файлы.
5. Прочитать оба файла полностью перед началом работы
6. Определить режим исполнения: `manual` / `auto` / `review` (по умолчанию — `review`). Числовые алиасы: `1=manual`, `2=auto`, `3=review`. Если режим явно не указан в `$ARGUMENTS` — использовать `review`.
7. Обновить `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-process-plan.r-<nnn>.<system-process-plan-name>.md`: установить "Текущая фаза" = DESIGN, установить `Режим = <режим>` в разделе «Фаза 2»

---

## Шаги выполнения

### Шаг 1: Определить набор артефактов

На основе типа задачи и research-документа определить, какие артефакты нужны:

| Артефакт | Новая фича | Баг | Рефакторинг |
|---|---|---|---|
| C4 Context | Обязательно при новом сервисе или изменении системных границ | Только если меняются границы системы | Только если меняются границы системы |
| C4 Container | Если затронуто несколько сервисов/контейнеров | Нет | Если рефакторинг затрагивает несколько сервисов/контейнеров |
| C4 Component | Обязательно | Обязательно (минимальный компонентный срез исправления) | Обязательно |
| Data Flow Diagram | Если добавляются или меняются потоки данных и их атрибуты | Если меняются потоки данных или их атрибуты | Если меняются потоки данных или их атрибуты |
| Sequence Diagram | Если есть сложный многошаговый сценарий или асинхронная оркестрация | Если нужна фиксация сценария воспроизведения/устранения бага | Если меняется межкомпонентное взаимодействие |
| ADR | Если принято нетривиальное архитектурное решение | Нет | Если принят архитектурный trade-off |
| Тест-стратегия | Обязательно | Регрессионный тест | Обязательно |
| API-контракты (OpenAPI/AsyncAPI + markdown) | Если меняется API сервиса или внешняя интеграция | Нет (кроме случаев изменения API при исправлении бага) | Если меняется API сервиса или внешняя интеграция |

### Шаг 2: Генерация архитектурных артефактов

Применить при создании диаграмм:
- `skill.arch.ru.c4-diagrams` — стандарты C4
- `skill.arch.ru.sequence-diagrams` — Sequence-диаграммы (`sd.*`)
- `skill.arch.ru.workflow-diagrams` — Workflow/Saga-диаграммы (`wf.*`)
- `skill.arch.ru.bpmn-diagrams` — BPMN-диаграммы (`bpmn.*`)
- `skill.arch.ru.dfd-diagrams` — Data Flow Diagrams (`dfd.*`)
- `skill.integration.ru.api-rest-standards` — при изменении API
- `skill.integration.ru.openapi-specs` — OpenAPI-контракты (`openapi.*`, `openapi.external.*`)
- `skill.integration.ru.asyncapi-specs` — AsyncAPI-контракты (`asyncapi.*`, `asyncapi.external.*`)
- `rule.arch.ru.sequence-diagram-layout-and-naming` — нейминг и layout

Создать артефакты в `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/design/`:
- `.../design/design-report.r-<nnn>.<system-request-name>.md`
- `.../design/c4-diagrams/c1.r-<nnn>.<system-request-name>.md`
- `.../design/c4-diagrams/c2.r-<nnn>.<system-request-name>.md` (если несколько сервисов)
- `.../design/c4-diagrams/c3.r-<nnn>.<system-request-name>.md` (всегда)
- `.../design/process-diagrams/dfd.r-<nnn>.<system-request-name>.md` (если есть движение данных)
- `.../design/process-diagrams/sd.r-<nnn>.<system-diagram-name>.md` (если многошаговые сценарии)
- `.../design/adr-log/adr.<NNN>.<kebab-case-title>.md` (для нетривиальных решений)
- `.../design/testing/dev-testing.r-<nnn>.strategy.md`
- `.../design/api-requirements/openapi.r-<nnn>.<system-request-name>.md` (если меняется REST API сервиса)
- `.../design/api-requirements/asyncapi.r-<nnn>.<system-request-name>.md` (если меняется async API сервиса)
- `.../design/api-requirements/openapi.external.r-<nnn>.<system-request-name>.md` (если появляется/меняется внешний REST API)
- `.../design/api-requirements/asyncapi.external.r-<nnn>.<system-request-name>.md` (если появляется/меняется внешний async API)
- `.../design/api-requirements/api.r-<nnn>.<system-request-name>.md` (если нужен markdown-контракт API сервиса)
- `.../design/api-requirements/api.external.r-<nnn>.<system-request-name>.md` (если нужен markdown-контракт внешней интеграции)
- `.../design/data-models/erd.r-<nnn>.<system-diagram-name>.md` (если меняется структура данных)

### Шаг 3: Проверить обязательное эскалирование

По правилу `rule.governance.ru.architect-escalation-and-prohibited-patterns` —
если решение затрагивает новое хранилище, публичное API, sensitive data или архитектурно спорно,
зафиксировать предупреждение "Требуется эскалация к архитектору" в разделе "Итоги фазы" dev-process-plan.

### Шаг 4: Обновить `docs/architecture.md`

Применить `skill.arch.en.architecture-md-artifact`: обновить индексный файл архитектуры,
добавить ссылки на новые артефакты.

### Шаг 5: Обновить dev-process-plan

В `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-process-plan.r-<nnn>.<system-process-plan-name>.md` отметить выполненные шаги чеклиста фазы 2, добавить ссылки на все артефакты, заполнить раздел "Итоги фазы" (ключевые решения, альтернативы, риски, флаг эскалации), установить статус = "Завершена", дату завершения.

Если в ходе проектирования выявлены неопределённости или архитектурные развилки, требующие уточнения — добавить каждый вопрос строкой в раздел **«Открытые вопросы»** dev-process-plan (Источник = DESIGN, Статус = Открыт). Закрытые вопросы из фазы RESEARCH — обновить статус на "Закрыт" и внести ответ.

### Шаг 6: Самопроверка перед гейтом

- [ ] Режим исполнения зафиксирован в разделе «Фаза 2» dev-process-plan
- [ ] C4-диаграммы покрывают все затронутые уровни
- [ ] Data Flow понятен: откуда, куда, как трансформируются данные (если применимо)
- [ ] Sequence Diagram отражает все шаги сценария (если применимо)
- [ ] ADR заполнен для нетривиальных решений (что, почему, альтернативы, риски) (если применимо)
- [ ] Тест-стратегия определена: уровни, сценарии, граничные условия
- [ ] OpenAPI/AsyncAPI YAML-контракты актуальны (если меняется REST/async API)
- [ ] Markdown API-контракты сервиса актуальны (если применимо)
- [ ] Markdown API-контракты внешних интеграций актуальны (если есть внешняя интеграция)
- [ ] ERD актуален для изменённых или новых сущностей (если применимо)
- [ ] Интеграционный паспорт создан (если есть новая внешняя интеграция)
- [ ] `docs/architecture.md` обновлён
- [ ] Раздел «Итоги фазы» в dev-process-plan заполнен

---

## Выходные артефакты

| Артефакт | Расположение |
|---|---|
| Design Report | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/design/design-report.r-<nnn>.<system-request-name>.md` |
| Архитектурные диаграммы | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/design/c4-diagrams/` и `process-diagrams/` |
| Тест-стратегия | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/design/testing/dev-testing.r-<nnn>.strategy.md` |
| `docs/architecture.md` (обновлён) | Индексный файл проекта |
| Dev-process-plan (обновлён) | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-process-plan.r-<nnn>.<system-process-plan-name>.md` |

---

## Завершение

Вывести summary строго по шаблону:

```markdown
## Summary: Phase 2 DESIGN
- Mode: <manual|auto|review>
- Created artifacts:
  - <artifact-1 path>
  - <artifact-2 path>
- Key architecture decisions (1-3):
  1) <decision-1>
  2) <decision-2>
- Risks:
  - <risk-1 or "none">
- Architect escalation:
  - <"required: <reason>" | "not required">
```

**ГЕЙТ (режим manual/review — с согласованием инженера):** Рекомендуется парное ревью дизайна с коллегой.

Агент автоматически проставляет в разделе «Фаза 2» dev-process-plan: `Статус = Завершена`, `Дата завершения = <сегодня>`.

Переход к Фазе 3 заблокирован до перехода фазы в статус **Согласовано**.

Согласование — два варианта:
- **А — самостоятельно:** инженер открывает dev-process-plan и вручную устанавливает в разделе «Фаза 2»: `Статус = Согласовано`, `Дата согласования = <YYYY-MM-DD>`.
- **Б — через агента:** инженер отправляет подтверждение (например: «согласовано», «апрув», «approve»); агент проставляет `Статус = Согласовано` и `Дата согласования = <сегодня>`.

**ГЕЙТ (режим auto/plan-review):** Агент автоматически устанавливает `Статус = Завершена` и переходит к Фазе 3 без ожидания.

После фиксации статуса **Согласовано** запустите `command.ai-sdlc.ru.run-phase-3-planning`.
