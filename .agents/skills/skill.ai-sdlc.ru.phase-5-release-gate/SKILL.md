---
name: skill.ai-sdlc.ru.phase-5-release-gate
description: >
  Phase 5 of the AI-assisted development process. Final release gate before
  deployment: security review (SAST/DAST), DevOps readiness, smoke tests.
  Produces a PR description file and proposes PR creation to the user.
  CI pipeline verification stays on the GitLab/GitHub side and is not tracked here.
  Use after all IMPLEMENTATION phases are complete and all quality gates passed.
---

# SKILL: phase-5-release-gate — Фаза 5: Release Gate

## Назначение и границы

Этот скилл описывает финальный release gate после завершения IMPLEMENTATION: DevOps-готовность, security-review и smoke-тесты перед предложением PR/MR.

- При конфликте инструкций приоритет у `rule.ai-sdlc.ru.process.mdc` и security-правил.
- Операционный порядок и детальный сценарий запуска через команду: `command.ai-sdlc.ru.run-phase-5-release-gate`.
- Smoke-тест выполняется агентом локально или в staging-контуре.
- CI-автоматизация (pipeline, SAST/DAST в GitLab/GitHub) остаётся вне скоупа этого скилла.

## Когда применять

- После завершения всех dev-task фазы IMPLEMENTATION
- После прохождения финального Cross-Phase Review
- Последний заслон на стороне разработчика: security, DevOps-готовность, smoke

## Используемые скиллы и команды

| Скилл / Команда | Применение |
|---|---|
| `skill.devops.en.dokploy-repo-prep` | Подготовка репо для деплоя через Dokploy |
| `skill.devops.en.helm-chart-scaffold` | Helm-чарты для Kubernetes |
| `skill.devops.en.k8s-deploy-scaffold` | Полный K8s / GitLab CI scaffolding |
| `skill.security.en.security-review` | Финальный security-review всего набора изменений |
| `command.security.ru.security-audit` | Аудит безопасности кода |

## Применяемые правила

| Правило | Область |
|---|---|
| `rule.devops.ru.deploy-containerization-and-runtime-config` | Docker, health checks, runtime config через env |
| `rule.security.en.gitlab-ci-immutable-security-block` | Неизменяемый security-блок в `.gitlab-ci.yml` |

## Входы

| Вход | Описание |
|---|---|
| Реализованный код | Прошедший все гейты IMPLEMENTATION + Final Review |
| Дизайн-артефакты | C4 (`c4-diagrams/`), DFD/Sequence (`process-diagrams/`), ADR (`adr-log/`) из `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/design/` |
| Dev-task файлы (план) | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-planning/dev-plan.r-<nnn>.<system-dev-plan-name>/dev-task.r-<nnn>.t-<nnn>.<system-dev-task-name>.md` — для проверки completeness |
| Тест-стратегия | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/design/testing/dev-testing.r-<nnn>.strategy.md` |

## Выходы

| Выход | Описание |
|---|---|
| Security-отчёт | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-security.r-<nnn>.report.<system-request-name>.md` — создаётся из шаблона `.agents/skills/skill.ai-sdlc.ru.phase-5-release-gate/template.security-report.md`; PASS или список находок |
| Smoke-отчёт | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-testing.r-<nnn>.smoke-report.<system-request-name>.md` — создаётся из шаблона `.agents/skills/skill.ai-sdlc.ru.phase-5-release-gate/template.smoke-report.md`; PASS / FAIL по каждому endpoint |
| DevOps-артефакты | Dockerfile, Helm-чарт, K8s-манифесты (если применимо) |
| PR-описание | `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-pr-description.r-<nnn>.<system-request-name>.md` — создаётся из шаблона `.agents/skills/skill.ai-sdlc.ru.phase-5-release-gate/template.pr-description.md`; содержит описание всех изменений для будущего PR |

## Порядок выполнения

1. Подтвердить DevOps-готовность (Docker, health checks, env-конфиг), если применимо.
2. Выполнить финальный security-review всего набора изменений.
3. Выполнить smoke-тесты по endpoint-ам из dev-task файлов.
4. Сформировать PR-описание и приложить ссылки на отчёты.
5. Предложить пользователю создать PR/MR (без автосоздания без подтверждения).

## Граница с Фазой 4

Reviewer: Security в Фазе 4 проверяет код каждого dev-task по мере реализации (OWASP, inline).  
Фаза 5 проводит **полный SAST/DAST на весь набор изменений** и формирует формальный отчёт.

## Smoke Test Protocol

```
1. Запустить сервис (staging или local)
2. Для каждого endpoint из dev-task файлов:
2a. Выполнить запрос.
2b. Проверить HTTP-статус == ожидаемому.
2c. Проверить тело ответа == контракту.
2d. Проверить auth-правила:
    - Auth-protected endpoint без токена → 401
    - Non-auth endpoint → 200
3. Проверить логи: нет unexpected errors
4. Сформировать отчёт: PASS / FAIL по каждому endpoint
```

Детальные примеры PASS/FAIL-отчётов и краевых случаев см. в `reference.md`.

## Поведение при FAIL Security-review

Если security-review завершился FAIL (есть блокирующие находки):

1. Остановить фазу 5 и зафиксировать статус FAIL в security-отчёте.
2. Вернуть задачу в Phase 4 (IMPLEMENTATION) для исправления.
3. После исправлений повторно запустить security-review и smoke-тесты.
4. Переход к PR-описанию допускается только после PASS.

## Расхождение с дизайн-артефактами

Если в ходе проверки выявлено расхождение реализации с дизайном:

1. Обновить затронутые дизайн-артефакты (`ADR`, `C4`, при необходимости процессные диаграммы).
2. Зафиксировать изменения в соответствующих документах dev-request.
3. Получить повторный апрув дизайна перед закрытием фазы 5.

## Блокеры шаблонов

Если любой из обязательных шаблонов фазы 5 (`template.security-report.md`, `template.smoke-report.md`, `template.pr-description.md` в каталоге скилла) недоступен:

1. Остановить выполнение фазы 5.
2. Сообщить пользователю о блокере.
3. Запросить восстановление отсутствующих шаблонов скилла.
4. Возобновить фазу только после восстановления шаблонов.

## Предложение PR

После прохождения всех проверок (security, smoke):

1. Создать файл PR-описания `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-pr-description.r-<nnn>.<system-request-name>.md` из шаблона `.agents/skills/skill.ai-sdlc.ru.phase-5-release-gate/template.pr-description.md`.

   Файл должен содержать:
   - Ссылку на задачу / тикет
   - Ссылку на `docs/architecture.md` или конкретные диаграммы
   - Ссылку на `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-planning/dev-plan.r-<nnn>.<system-dev-plan-name>/dev-plan.r-<nnn>.<system-dev-plan-name>.md`
   - Краткое описание изменений (что и зачем)
   - Результаты smoke test (ссылка на отчёт)
   - Результаты security review (ссылка на отчёт)

2. Предложить пользователю создать PR / MR. Не создавать без явного подтверждения.

3. При подтверждении — создать PR и сохранить ссылку в разделе «Фаза 5» dev-process-plan: поле `Ссылка на PR`.

> CI-верификация (code quality, SAST/DAST, contract validation, unit/integration tests) выполняется пайплайном GitLab/GitHub после создания PR и не отслеживается в этом файле.

## Гейт качества (финальный)

Источник режима проверки:

- Если в разделе «Фаза 5» dev-process-plan заполнено поле `Режим` — использовать его.
- Если поле отсутствует или не заполнено — по умолчанию использовать **Режим 3**.

| Режим | Описание |
|---|---|
| **1 — Инженер** | Инженер проверяет вручную по чеклисту |
| **2 — Агент-ревьюер** | Отдельный агент автоматически проверяет по чеклисту |
| **3 — Агент + Инженер** | Агент проверяет первым, затем инженер финально верифицирует |

Чеклист:

- [ ] `Режим` исполнения зафиксирован в разделе «Фаза 5» dev-process-plan
- [ ] Security-review пройден: нет блокирующих находок
- [ ] Smoke тесты пройдены — все endpoints отвечают корректно
- [ ] DevOps-готовность подтверждена (Docker, health checks, env-конфиг)
- [ ] PR-описание создано: `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-pr-description.r-<nnn>.<system-request-name>.md`
- [ ] PR / MR предложен пользователю (создаётся только по явному подтверждению)
- [ ] Ссылка на PR сохранена в разделе «Фаза 5» dev-process-plan (если PR создан)
- [ ] Дизайн-артефакты актуальны (если в ходе реализации менялись)
- [ ] `docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-planning/dev-plan.r-<nnn>.<system-dev-plan-name>/dev-plan.r-<nnn>.<system-dev-plan-name>.md` обновлён: все вехи отмечены

## Профиль артефактов (`docs`)

Состав конечных артефактов зависит от параметра `docs=compact|full` (дефолт `compact`; берётся из «Объём документации» dev-process-plan):

- **`compact`** (по умолчанию) — security-report и PR-описание в компактной табличной форме (findings-таблица + только блокирующие; краткий список изменений). Профиль: `.agents/skills/skill.ai-sdlc.ru.phase-5-release-gate/reference.artifacts.compact.md`.
- **`full`** — полные отчёты с нарративом по шаблонам скилла (`template.*.md`). Профиль: `.agents/skills/skill.ai-sdlc.ru.phase-5-release-gate/reference.artifacts.full.md`.

В обоих профилях: объём самих проверок (SAST/DAST, smoke по каждому endpoint, DevOps-гейт) и smoke-таблица не зависят от профиля — отличается только форма отчётности.

## Актуализация `docs/` (после релиз-гейта, до коммита)

Обязательный шаг по `rule.ai-sdlc.ru.docs-actualization-after-dev-request`: после прохождения релиз-гейта и **до** предложения коммита/PR — **предложить** пользователю актуализировать глобальную документацию `docs/` из значимых design-артефактов dev-request.

- Выбор: `[Актуализировать документацию]` → запустить `command.ai-sdlc.ru.actualize-main-docs` (план `docs-actualization-plan.r-<nnn>.<name>.md` → согласование → синтез в `docs/`); `[Пропустить]` → зафиксировать в dev-process-plan.
- Коммит предлагается **после** этого шага (чтобы изменения `docs/` вошли в него). Актуализация — **до** публикации `--with-clean`.
- В `docs/` актуализируется только глобально значимое (C2/C3, межсервисные контракты, ERD, ключевые ADR/DDR), синтезом, без ссылок в `docs/dev-requests/**`.
