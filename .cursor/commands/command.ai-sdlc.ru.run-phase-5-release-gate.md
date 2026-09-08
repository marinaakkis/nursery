# Команда: Фаза 5 — Release Gate

Финальная верификация на стороне разработчика: security-review, DevOps-готовность, smoke-тесты. CI-верификация остаётся на стороне GitLab/GitHub.
Применяет `skill.ai-sdlc.ru.phase-5-release-gate`.

**Аргументы:** `$ARGUMENTS` — `<task-name> [mode=manual|auto|review] [docs=compact|full]`

Правила разбора аргументов:
- `<task-name>` — обязательное имя задачи (строка без служебного префикса `mode=`).
- `mode=manual|auto|review` — опциональный режим исполнения; числовые алиасы `1=manual`, `2=auto`, `3=review`.
- Если `mode` не задан — использовать режим `review` по умолчанию.
- Режим `plan-review` допустим только в `run-all`, не в phase-командах.
- `docs=compact|full` — опциональный объём документации (ортогонален `mode`). Если не задан — брать `Объём документации` из dev-process-plan, иначе `compact`. Профиль конечных артефактов фазы — `.agents/skills/skill.ai-sdlc.ru.phase-5-release-gate/reference.artifacts.<docs>.md`. В `compact` security/PR-отчёты — компактные таблицы; smoke и объём проверок не зависят от профиля.

Примеры:
- ✅ `improve-dev-process-artifacts mode=auto`
- ✅ `improve-dev-process-artifacts`
- ✅ `improve-dev-process-artifacts mode=2` (алиас)
- ❌ `improve-dev-process-artifacts mode=plan-review` (режим plan-review недопустим)

---

## Предварительные условия

1. Убедиться, что файл `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-process-plan.r-<nnn>.<system-process-plan-name>.md` существует и поля `Расположение требований` и `Расположение проекта` заполнены. Если файл отсутствует или поля пусты — остановиться и предложить пользователю: «Пожалуйста, запустите `command.ai-sdlc.ru.run-phase-1-research` для создания dev-process-plan, или заполните поля `Расположение требований` и `Расположение проекта` вручную.»
2. Убедиться, что завершена фаза IMPLEMENTATION:
   - В `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-process-plan.r-<nnn>.<system-process-plan-name>.md` Фаза 4 имеет статус "Завершена"
   - Финальный Cross-Phase Review: ALL PASS
   - Все коммиты созданы
3. **Стартовый контекст и изоляция (режим manual/review):** Предложить пользователю очистить контекст разговора перед запуском (`/clear` или новый чат). При согласии — перезапустить команду в чистом контексте. При отказе — продолжить.

   **Для всех режимов — обязательно:**
   - При старте читать ТОЛЬКО: dev-process-plan + dev-task файлы + `design/testing/dev-testing.r-<nnn>.strategy.md`.
   - Не читать дополнительные файлы, пока артефакты фазы не содержат явную ссылку на путь.
   - История предыдущих разговоров — не источник данных; использовать только файлы.
4. Определить режим исполнения: `manual` / `auto` / `review` (по умолчанию — `review`). Числовые алиасы: `1=manual`, `2=auto`, `3=review`. Если режим явно не указан в `$ARGUMENTS` — использовать `review`.
5. Обновить `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-process-plan.r-<nnn>.<system-process-plan-name>.md`: установить "Текущая фаза" = Release Gate, установить `Режим = <режим>` в разделе «Фаза 5»

---

## Шаги выполнения

### Шаг 1: DevOps-готовность

Применить DevOps-скиллы по decision-rules:
- `skill.devops.en.dokploy-repo-prep` — если целевая платформа деплоя Dokploy (Docker Compose runtime)
- `skill.devops.en.helm-chart-scaffold` — если нужен Helm-чарт, но нет требования генерировать полный GitLab/K8s scaffolding
- `skill.devops.en.k8s-deploy-scaffold` — если требуется полный контур K8s + GitLab CI (helm/, Dockerfile, CI, DEPLOYMENT.md)
- `rule.devops.ru.deploy-containerization-and-runtime-config` — Docker, health checks, runtime config через env
- `rule.security.en.gitlab-ci-immutable-security-block` — не изменять security-блок в `.gitlab-ci.yml`

Если ни один DevOps-артефакт не меняется и деплой-контур не входит в текущую задачу, зафиксировать `DevOps-готовность = N/A` с пояснением в итогах фазы.

### Шаг 2: Финальный security-review

Применить `skill.security.en.security-review` и `command.security.ru.security-audit` на весь набор изменений:
- Статический анализ всего изменённого кода
- Проверка Dockerfile / CI-конфигурации (если затронуты)
- Любые находки — вернуть в IMPLEMENTATION для исправления

Сформировать security-отчёт строго по шаблону `.agents/skills/skill.ai-sdlc.ru.phase-5-release-gate/template.security-report.md` в файл `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-security.r-<nnn>.report.<system-request-name>.md`.
Обязательные поля отчёта: `Статус (PASS/FAIL)`, `Проверенный скоуп`, `Найденные риски`, `Принятые/планируемые меры`.

### Шаг 3: Smoke тест

Запустить сервис локально или на staging. Для каждого endpoint из dev-task-файлов:

```
1. Выполнить запрос с ожидаемыми параметрами
2. Проверить HTTP-статус == ожидаемому
3. Проверить тело ответа == контракту (docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/design/api-requirements/)
4. Auth-protected endpoint без токена → ожидается 401
5. Non-auth endpoint → ожидается 200
6. Проверить логи: нет unexpected errors
```

При FAIL любого теста — исправить и повторить smoke перед предложением создать PR.

Сформировать smoke-отчёт строго по шаблону `.agents/skills/skill.ai-sdlc.ru.phase-5-release-gate/template.smoke-report.md` в файл `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-testing.r-<nnn>.smoke-report.<system-request-name>.md`.
Обязательные поля отчёта: `Перечень endpoint`, `Ожидаемый статус`, `Фактический статус`, `Итог (PASS/FAIL)`, `Комментарий/причина FAIL`.

### Шаг 4: PR-описание и предложение создать PR / MR

После успешного smoke теста:

1. Создать файл `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-pr-description.r-<nnn>.<system-request-name>.md` из шаблона `.agents/skills/skill.ai-sdlc.ru.phase-5-release-gate/template.pr-description.md`. Заполнить: описание изменений, ссылки на артефакты, результаты security review и smoke test.

1a. **Post-Release Gate — актуализация `docs/`** (обязательно по `rule.ai-sdlc.ru.docs-actualization-after-dev-request`, **до** предложения коммита/PR): предложить пользователю `[Актуализировать документацию]` (запуск `command.ai-sdlc.ru.actualize-main-docs` — план `docs-actualization-plan.r-<nnn>.<system-request-name>.md` → согласование → синтез в `docs/`) или `[Пропустить]`. Решение зафиксировать в «Итогах фазы». Актуализацию выполнять до публикации `--with-clean`.

2. Предложить пользователю создать PR / MR (включая изменения `docs/`, если актуализация выполнена). Не создавать PR без явного подтверждения.

   Формат предложения:
   ```
   PR-описание создано: docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-pr-description.r-<nnn>.<system-request-name>.md
   Предлагаю создать PR / MR:
     Ветка: <branch-name>
   Создать PR / MR? [да / нет / изменить описание]
   ```

3. При подтверждении — создать PR и сохранить ссылку в разделе «Фаза 5» dev-process-plan: поле `Ссылка на PR`.
   При отказе — зафиксировать в разделе «Итоги фазы» dev-process-plan: "PR не создан".

### Шаг 5: Закрытие dev-process-plan

В `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-process-plan.r-<nnn>.<system-process-plan-name>.md`:
- Отметить все шаги чеклиста фазы 5
- Заполнить раздел "Итоги фазы" (DevOps-готовность, security review, smoke test results, статус PR)
- Установить статус фазы 5 = "Завершена", дату завершения
- Для режимов auto/plan-review: установить "Текущая фаза" = DONE
- Для режимов manual/review: оставить "Текущая фаза" = Release Gate до инженерного согласования
- Заполнить раздел "Итог"

---

## Выходные артефакты

| Артефакт | Расположение |
|---|---|
| Security-отчёт | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-security.r-<nnn>.report.<system-request-name>.md` |
| Smoke-отчёт | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-testing.r-<nnn>.smoke-report.<system-request-name>.md` |
| PR-описание | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-pr-description.r-<nnn>.<system-request-name>.md` |
| PR / MR | По подтверждению пользователя; ссылка сохраняется в dev-process-plan |
| Dev-process-plan (закрыт) | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-process-plan.r-<nnn>.<system-process-plan-name>.md` |

---

## Завершение

Вывести final summary по задаче:
- PR ссылка (или "не создан — ожидает подтверждения")
- Security review: PASS / FAIL
- Smoke test: PASS / FAIL
- DevOps-готовность: PASS / N/A
- Технический долг (если есть)

## Переходы статусов фазы 5

Агент автоматически проставляет в разделе «Фаза 5» dev-process-plan: `Статус = Завершена`, `Дата завершения = <сегодня>`.

| Режим | Что делает агент после PASS проверок | Нужно инженерное согласование | Когда ставить `Текущая фаза = DONE` |
|---|---|---|---|
| `manual` (`1`) | Закрывает технический чеклист, ждёт апрув инженера | Да | После `Статус = Согласовано` |
| `auto` (`2`) | Автоматически закрывает фазу | Нет | Сразу после `Статус = Завершена` |
| `review` (`3`) | Закрывает технический чеклист, ждёт апрув инженера | Да | После `Статус = Согласовано` |
| `plan-review` | Автоматически закрывает фазу (фазы 4–5 запущены через run-all) | Нет | Сразу после `Статус = Завершена` |

Для режимов manual/review согласование — два варианта:
- **А — самостоятельно:** инженер открывает `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-process-plan.r-<nnn>.<system-process-plan-name>.md` и вручную устанавливает в разделе «Фаза 5»: `Статус = Согласовано`, `Дата согласования = <YYYY-MM-DD>`, `Текущая фаза = DONE`.
- **Б — через агента:** инженер отправляет подтверждение (например: «согласовано», «апрув», «approve»); агент проставляет `Статус = Согласовано`, `Дата согласования = <сегодня>`, `Текущая фаза = DONE` в dev-process-plan.

**ЗАВЕРШЕНО.** Задача прошла полный цикл: RESEARCH → DESIGN → PLANNING → IMPLEMENTATION → RELEASE GATE.
