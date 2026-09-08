# Команда: Фаза 3 — PLANNING

Запуск фазы планирования реализации на основе апрувленного дизайна.
Применяет `skill.ai-sdlc.ru.phase-3-planning`.

**Аргументы:** `$ARGUMENTS` — `<task-name> [mode=manual|auto|review] [docs=compact|full]`

Правила разбора аргументов:
- `<task-name>` — обязательное имя задачи (строка без служебного префикса `mode=`).
- `mode=manual|auto|review` — опциональный режим исполнения; числовые алиасы `1=manual`, `2=auto`, `3=review`.
- Если `mode` не задан — использовать режим `review` по умолчанию.
- `docs=compact|full` — опциональный объём документации (ортогонален `mode`). Если не задан — брать `Объём документации` из dev-process-plan, иначе `compact`. Профиль конечных артефактов фазы — `.agents/skills/skill.ai-sdlc.ru.phase-3-planning/reference.artifacts.<docs>.md`. В `compact` сводный dev-plan — компактный индекс; dev-task создаются всегда.

Примеры:
- ✅ `orders-planning mode=auto`
- ✅ `inventory-sync`
- ✅ `orders-planning mode=2` (алиас)
- ❌ `mode=auto` (нет `<task-name>`)
- ❌ `orders-planning 2` (режим без префикса `mode=`)

---

## Предварительные условия

1. Определить целевой `dev-request`:
   - если `<task-name>` однозначно соответствует одной директории `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/` — использовать её;
   - если есть активный `dev-process-plan` только в одной директории — использовать её;
   - если кандидатов несколько и однозначного соответствия нет — остановиться и запросить у пользователя явный выбор директории.
2. Убедиться, что файл `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-process-plan.r-<nnn>.<system-process-plan-name>.md` существует и поля `Расположение требований` и `Расположение проекта` заполнены. Если файл отсутствует или поля пусты — остановиться и предложить пользователю: «Пожалуйста, запустите `command.ai-sdlc.ru.run-phase-1-research` для создания dev-process-plan, или заполните поля `Расположение требований` и `Расположение проекта` вручную.»
3. Убедиться, что апрувлены:
   - `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/research.r-<nnn>.<system-request-name>.md`
   - Дизайн-артефакты в `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/design/`
   - `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/design/testing/dev-testing.r-<nnn>.strategy.md`
   - В `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-process-plan.r-<nnn>.<system-process-plan-name>.md` Фаза 2 имеет статус "Завершена"
4. **Стартовый контекст и изоляция (режим manual/review):** Предложить пользователю очистить контекст разговора перед запуском (`/clear` или новый чат). При согласии — перезапустить команду в чистом контексте. При отказе — продолжить.

   **Для всех режимов — обязательно:**
   - При старте читать ТОЛЬКО: `design/` (все артефакты) + `research.r-<nnn>.<system-request-name>.md` + dev-process-plan (включая раздел «Открытые вопросы»).
   - Не читать дополнительные файлы, пока артефакты фазы не содержат явную ссылку на путь.
   - История предыдущих разговоров — не источник данных; использовать только файлы.
5. Прочитать все указанные выше артефакты перед началом.
6. Определить режим исполнения: `manual` / `auto` / `review` (по умолчанию — `review`). Числовые алиасы: `1=manual`, `2=auto`, `3=review`. Если режим явно не указан в `$ARGUMENTS` — использовать `review`.
7. Обновить `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-process-plan.r-<nnn>.<system-process-plan-name>.md`: установить "Текущая фаза" = PLANNING, установить `Режим = <режим>` в разделе «Фаза 3».

---

## Шаги выполнения

### Шаг 1: Анализ дизайна для декомпозиции

На основе дизайн-артефактов определить:
- Логические срезы реализации (каждый срез = одна phase)
- Зависимости между срезами — определить порядок
- Для каждого среза — список изменяемых файлов

Принцип декомпозиции: каждая phase самодостаточна, ревьюируема и тестируема независимо.

### Шаг 2: Создание dev-task-файлов

Применить `skill.dev.ru.dev-planning` и `command.dev.ru.create-dev-plan`.

Номер `r-<nnn>` берётся из текущего dev-request (совпадает с `r-<nnn>` в пути `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/`). Создать директорию `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-planning/dev-plan.r-<nnn>.<system-dev-plan-name>/`.

Для каждого логического среза создать `dev-task.r-<nnn>.t-<nnn>.<system-dev-task-name>.md` в этой директории по структуре из `skill.ai-sdlc.ru.phase-3-planning`:

```markdown
# Dev-task r-<nnn>.t-<nnn>: <название>
## Цель
## Входные условия
## Шаги реализации (нумерованный список конкретных действий)
## Тест-кейсы (таблица: сценарий / вход / ожидаемый выход)
## Acceptance Criteria
- [ ] <бизнес-критерий>
- [ ] Билд проходит
- [ ] Все тесты зелёные
- [ ] Линтеры без ошибок
- [ ] Соответствие дизайну проверено
- [ ] Security-review пройден
## Выходные артефакты (таблица: файл / тип изменения)
## Changelog
```

**ЗАПРЕТ:** Нельзя создавать один монолитный dev-task. Только отдельные файлы, по одному на логический срез.
Каждый шаг должен быть однозначным — никаких "сделай хорошо", только конкретные действия.

### Шаг 3: Создание сводного dev-plan

Создать `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-planning/dev-plan.r-<nnn>.<system-dev-plan-name>/dev-plan.r-<nnn>.<system-dev-plan-name>.md` по `skill.dev.ru.dev-planning`:
- Таблица Основных компонентов
- Таблица Dev-задач (ссылки на все dev-task-файлы)
- Зависимости между dev-task
- Ссылки на дизайн-артефакты
- Changelog (первая строка)

### Шаг 4: Обновить tracking dev-plan

В `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-process-plan.r-<nnn>.<system-process-plan-name>.md` отметить выполненные шаги чеклиста фазы 3, добавить ссылки на все dev-task файлы, заполнить раздел "Итоги фазы" (количество задач, зависимости, риски реализации), установить статус = "Завершена", дату завершения.

Если в ходе планирования выявлены неопределённости или риски реализации, требующие уточнения — добавить каждый вопрос строкой в раздел **«Открытые вопросы»** dev-process-plan (Источник = PLANNING, Статус = Открыт). Закрытые вопросы из фаз RESEARCH/DESIGN — обновить статус на "Закрыт" и внести ответ.

### Шаг 5: Зафиксировать выявленный техдолг как future-task (при наличии)

Если в ходе планирования выявлены задачи вне scope текущего dev-request (техдолг, улучшения требующие отдельного дизайна, зависимости от внешних факторов) — создать future-task файл по `rule.governance.ru.future-tasks`:

- Создать `docs/dev-requests/future-tasks/future-task.<domain>.<kebab-case-name>.md`
- Заполнить обязательные разделы: Статус, Приоритет, Создан, Описание, Мотивация, Ожидаемый результат, Предшественники
- Добавить ссылку на созданный файл в раздел «Итоги фазы» текущего dev-process-plan

Техдолг фиксируется только здесь — не в комментариях к коду и не в dev-task файлах.

### Шаг 6: Самопроверка перед гейтом

- [ ] Каждый dev-task охватывает конкретный срез функционала
- [ ] Acceptance criteria конкретны и проверяемы
- [ ] Тест-кейсы прописаны для каждого dev-task
- [ ] Шаги не содержат неоднозначностей ("сделай лучше" — это неоднозначность)
- [ ] Порядок dev-task логичен, зависимости соблюдены
- [ ] Стандарты стека учтены в контексте каждого dev-task
- [ ] Раздел "Итоги фазы" в dev-process-plan заполнен

---

## Выходные артефакты

| Артефакт | Расположение |
|---|---|
| Dev-task-файлы | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-planning/dev-plan.r-<nnn>.<system-dev-plan-name>/dev-task.r-<nnn>.t-<nnn>.<system-dev-task-name>.md` |
| Сводный dev-plan | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-planning/dev-plan.r-<nnn>.<system-dev-plan-name>/dev-plan.r-<nnn>.<system-dev-plan-name>.md` |
| Dev-process-plan (обновлён) | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-process-plan.r-<nnn>.<system-process-plan-name>.md` |

---

## Завершение

Вывести summary:
- Количество phases и их названия
- Общее количество тест-кейсов
- Риски реализации (если есть)

**ГЕЙТ (режим manual/review — с согласованием инженера):**

Агент автоматически проставляет в разделе «Фаза 3» dev-process-plan: `Статус = Завершена`, `Дата завершения = <сегодня>`.

Переход к Фазе 4 заблокирован до перехода фазы в статус **Согласовано**.

Согласование — два варианта:
- **А — самостоятельно:** инженер открывает dev-process-plan и вручную устанавливает в разделе «Фаза 3»: `Статус = Согласовано`, `Дата согласования = <YYYY-MM-DD>`.
- **Б — через агента:** инженер отправляет подтверждение (например: «согласовано», «апрув», «approve»); агент проставляет `Статус = Согласовано` и `Дата согласования = <сегодня>`.

**ГЕЙТ (режим auto/plan-review):** Агент автоматически устанавливает `Статус = Завершена`. В режиме `plan-review` — вместо перехода к Фазе 4 выполняется PLAN-REVIEW PAUSE (см. `command.ai-sdlc.ru.run-all`). В режиме `auto` — автопереход к Фазе 4.

После фиксации статуса **Согласовано** запустите `command.ai-sdlc.ru.run-phase-4-implementation`.
