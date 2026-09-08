---
description: Комплексная проверка безопасности кода по OWASP Top 10 и инфраструктурным слоям
---

Выполни комплексную проверку безопасности указанного кода или файла. $ARGUMENTS

Перед проверкой прочитай и применяй:
- `.cursor/rules/rule.security.en.corporate-dlp.mdc` — корпоративный DLP, обнаружение секретов, stop-conditions.
- `.cursor/rules/rule.security.ru.secure-app-architecture-and-dependencies.mdc` — безопасная архитектура, auth, валидация, зависимости.
- `.agents/skills/skill.security.en.security-review/SKILL.md` — security review Docker, Helm, K8s, GitLab CI и кода (применяй соответствующие секции в зависимости от проверяемого файла).

---

## Чек-лист OWASP Top 10

- [ ] **A01 Broken Access Control** — права доступа на каждом endpoint; нет прямых ссылок на объекты без авторизации; CORS настроен корректно.
- [ ] **A02 Cryptographic Failures** — секреты не хардкожены; HTTPS везде; пароли хешируются bcrypt/argon2.
- [ ] **A03 Injection** — SQL: prepared statements; NoSQL: санитизация; XSS: экранирование; нет `eval()`/`exec()`.
- [ ] **A04 Insecure Design** — rate limiting; валидация входных данных; обработка ошибок без раскрытия деталей стека.
- [ ] **A05 Security Misconfiguration** — нет default credentials; debug mode отключён в production; stack traces не передаются клиенту.
- [ ] **A06 Vulnerable Components** — зависимости актуальны; нет известных CVE.
- [ ] **A07 Authentication Failures** — нет слабых паролей; защита от brute-force; токены истекают.
- [ ] **A08 Data Integrity Failures** — проверка подписи данных; SRI для external scripts.
- [ ] **A09 Logging Failures** — критичные операции логируются; секреты не попадают в логи.
- [ ] **A10 SSRF** — валидация URL перед запросами; whitelist разрешённых доменов.

## Поиск hardcoded секретов

Паттерны (`rule.security.en.corporate-dlp.mdc`): `password=`, `token=`, `api_key=`, `secret=`, `Bearer`, `sk-`, `ghp_`, `glpat-`, `xoxb-`, `AKIA`, `-----BEGIN`, строки подключения с кредентиалами.

При обнаружении — немедленный BLOCK, вывести предупреждение по шаблону из DLP-правила.

## TypeScript / JavaScript

- [ ] Нет `eval()` / `Function()` с динамическими данными.
- [ ] `dangerouslySetInnerHTML` только с санитизацией.
- [ ] Нет `require()` с динамическими путями.
- [ ] Strict mode включён; нет `@ts-ignore`.

## Инфраструктурные файлы (Docker / Helm / K8s / GitLab CI)

Если проверяемый файл относится к инфраструктуре — применяй соответствующие секции из `.agents/skills/skill.security.en.security-review/SKILL.md`:
- **Dockerfile** — non-root user, pinned base image, нет секретов в ENV/ARG, минимальные слои.
- **docker-compose.yaml** — нет `privileged: true`; named volumes; secrets через env-файл.
- **Helm / K8s** — NetworkPolicy, readOnlyRootFilesystem, securityContext, нет тега `latest`.
- **GitLab CI** — блок безопасности (первые строки `.gitlab-ci.yml`) неизменяем согласно `rule.security.en.gitlab-ci-immutable-security-block.mdc`; нет секретов в `script`.

## Зависимости

```bash
npm audit --audit-level=high
```

Проверить: HIGH/CRITICAL severity; deprecated пакеты; пакеты без обновлений >2 лет.

## Формат отчёта

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
