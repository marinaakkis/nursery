---
description: Комплексная проверка безопасности кода по OWASP Top 10
---

Выполни комплексную проверку безопасности указанного кода или файла. $ARGUMENTS

Проверь по чек-листу OWASP Top 10:

1. **Broken Access Control** — проверка прав доступа на каждом endpoint, нет прямых ссылок на объекты без авторизации, CORS настроен правильно.
2. **Cryptographic Failures** — секреты не хардкожены в коде, используется HTTPS, пароли хешируются (bcrypt/argon2).
3. **Injection** — SQL: prepared statements; NoSQL: санитизация; XSS: экранирование; Command Injection: нет eval()/exec().
4. **Insecure Design** — rate limiting, валидация входных данных, обработка ошибок без раскрытия деталей.
5. **Security Misconfiguration** — нет default credentials, debug mode отключен, stack traces не показываются клиенту.
6. **Vulnerable Components** — зависимости актуальные, нет известных CVE.
7. **Authentication Failures** — нет слабых паролей, защита от brute-force, токены истекают.
8. **Data Integrity Failures** — проверка подписи данных, SRI для external scripts.
9. **Logging Failures** — критичные операции логируются, секреты не попадают в логи.
10. **SSRF** — валидация URL перед запросами, whitelist разрешённых доменов.

Дополнительно проверь:
- Hardcoded секреты по паттернам: api_key, JWT (eyJ...), private keys (-----BEGIN), password=
- Опасные вызовы: eval(), Function(), dangerouslySetInnerHTML, динамические require()

Формат отчёта:

```
SECURITY AUDIT REPORT

PASSED:
  - Описание прошедших проверок

WARNINGS:
  - Проблема + где найдена + рекомендация

CRITICAL:
  - Проблема + расположение + CVSS + вектор атаки + безопасное решение с примером кода

SECURITY SCORE: X/10
```
