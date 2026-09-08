# Reference — phase-4-implementation

## Шаблон отчёта ревьюера (PASS/FAIL)

```md
## Reviewer Report — <Build+Test | Architecture | Security | Plan Compliance>

### Статус
- Result: <PASS | FAIL>
- Dev-task: `dev-task.r-<nnn>.t-<nnn>.<system-dev-task-name>.md`

### Findings
1. [<SEVERITY>] `<path/to/file.ext>:<line>`
   - Проблема: <что именно нарушено>
   - Почему это важно: <риск/последствие>
   - Рекомендация: <конкретное исправление>

### Gate Decision
- Gate: <Build | Tests | Linters | Architecture | Security | Plan compliance>
- Decision: <PASS | FAIL>
- Blocking: <yes | no>
```

## Шаблон отчёта Lead (агрегация 4 ревьюеров)

```md
## Lead Summary — `dev-task.r-<nnn>.t-<nnn>.<system-dev-task-name>.md`

### Входы
- Scope: <кратко>
- Changed files: <N>
- Iteration: <1..3>

### Результаты ревьюеров
- Build+Test: <PASS | FAIL> — <1 строка>
- Architecture: <PASS | FAIL> — <1 строка>
- Security: <PASS | FAIL> — <1 строка>
- Plan Compliance: <PASS | FAIL> — <1 строка>

### Сводка блокеров
1. `<path>:<line>` — <проблема> — Owner: <Implementer | User decision>

### Решение Lead
- Final: <ALL PASS | ANY FAIL | PARTIAL>
- Next step: <next dev-task | return to Implementer | escalate to user>
```

## Шаблон эскалации при PARTIAL

```md
## Escalation — PARTIAL

- Dev-task: `dev-task.r-<nnn>.t-<nnn>.<system-dev-task-name>.md`
- Причина блокировки: <кратко>
- Сделано: <список>
- Не сделано: <список>
- Рекомендованное действие: <ok | не ok>
- Требуется решение пользователя: <да>
```

## Шаблон эскалации при отклонении от плана/дизайна

```md
## Escalation — Plan/Design Deviation

- Dev-task: `dev-task.r-<nnn>.t-<nnn>.<system-dev-task-name>.md`
- Отклонение: <что именно не совпало с планом/дизайном>
- Влияние: <scope/сроки/риски>

### Варианты решения
1. Вернуться к Фазе 2/3 (с завершением текущего контекста и артефактом возврата)
2. Продолжить в текущем контексте
3. Остановить обработку (с артефактом точки остановки)
```

## Шаблон финального Cross-Phase Review Summary

```md
## Final Cross-Phase Review Summary

- Scope: <что реализовано>
- Reviewed dev-tasks: <N>

### Gate Results
- Build: <PASS | FAIL>
- Tests: <PASS | FAIL>
- Architecture: <PASS | FAIL>
- Security: <PASS | FAIL>
- Plan compliance: <PASS | FAIL>

### Deviations and Debt
- Deviations from design: <none | list>
- Technical debt: <none | list>

### Final Decision
- Phase 4 status: <Completed | Blocked>
- Recommended next action: <proceed phase-5 | return phase-2/3 | stop>
```
