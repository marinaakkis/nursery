## Reference: phase-5-release-gate

Этот файл содержит примеры выходных артефактов и краевые сценарии для фазы Release Gate.

## Пример: Security report (PASS)

```md
# Security Review Report
Status: PASS
Scope: Full change set in dev-request r-042
Critical findings: 0
High findings: 0
Result: Gate passed, proceed to smoke tests.
```

## Пример: Security report (FAIL)

```md
# Security Review Report
Status: FAIL
Scope: Full change set in dev-request r-042
Blocking findings:
- High: Missing authorization check on protected endpoint.
Result: Return to Phase 4 for remediation.
```

## Пример: Smoke report (PASS)

```md
# Smoke Test Report
Status: PASS
Environment: local
Checked endpoints: 6
Mismatches: 0
Result: All endpoints match expected status and response contract.
```

## Пример: Smoke report (FAIL)

```md
# Smoke Test Report
Status: FAIL
Environment: staging
Failed endpoint: GET /api/v1/orders/{id}
Expected: 200 with OrderDto
Actual: 500 Internal Server Error
Result: Return to Phase 4 for fix, then rerun smoke tests.
```

## Краевой сценарий: Security FAIL

1. Зафиксировать FAIL в `dev-security.r-<nnn>.report.<system-request-name>.md`.
2. Остановить фазу 5.
3. Вернуть задачу в IMPLEMENTATION (Phase 4) для исправления.
4. После фикса повторить security-review и smoke-test.

## Краевой сценарий: Smoke FAIL

1. Зафиксировать FAIL по endpoint в `dev-testing.r-<nnn>.smoke-report.<system-request-name>.md`.
2. Остановить фазу 5.
3. Вернуть задачу в IMPLEMENTATION (Phase 4).
4. После фикса повторить smoke-test по полному списку endpoint-ов.

## Краевой сценарий: Изменился дизайн

1. Обновить релевантные артефакты (`ADR`, `C4`, process diagrams).
2. Синхронизировать ссылки в dev-request документах.
3. Запросить повторный апрув дизайна.
4. Только после апрува продолжить Release Gate.

## Краевой сценарий: Недоступны шаблоны фазы 5

1. Зафиксировать блокер и не продолжать фазу.
2. Сообщить пользователю, какие шаблоны отсутствуют.
3. Запросить восстановление отсутствующих шаблонов (`template.*.md` в каталоге скилла).
4. Возобновить работу только после восстановления шаблонов.
