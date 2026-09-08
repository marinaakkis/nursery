<!-- Template path: .agents/skills/skill.ai-sdlc.ru.phase-5-release-gate/template.security-report.md -->
<!-- Output path:   docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-security.r-<nnn>.report.<system-request-name>.md -->

# Security Report: r-<nnn> <system-request-name>

## Мета

| Поле | Значение |
|---|---|
| Запрос | `r-<nnn>` |
| Задача | `<system-request-name>` |
| Фаза | RELEASE GATE |
| Дата проверки | <!-- YYYY-MM-DD --> |
| Проверяющий | <!-- Агент / Инженер --> |
| Итоговый статус | <!-- PASS / FAIL --> |

---

## Область проверки

| Файл / Компонент | Тип изменения |
|---|---|
| <!-- path/to/file.cs --> | <!-- new / modified --> |

---

## SAST — Статический анализ

### Результаты

| Инструмент | Статус | Находки |
|---|---|---|
| <!-- SonarQube / Semgrep / другой --> | <!-- PASS / FAIL --> | <!-- Кол-во --> |

### Находки

| # | Файл | Строка | Категория | Серьёзность | Описание | Статус |
|---|---|---|---|---|---|---|
| 1 | | | <!-- SQL Injection / XSS / ... --> | <!-- Critical / High / Medium / Low --> | | <!-- Исправлено / Принято / Ложное срабатывание --> |

---

## DAST — Динамический анализ

> Заполнять только если проводился DAST (staging-окружение).

| Инструмент | Статус | Находки |
|---|---|---|
| <!-- OWASP ZAP / другой --> | <!-- PASS / FAIL / Не применялся --> | <!-- Кол-во --> |

---

## OWASP Top 10 — Чеклист

| # | Категория | Статус | Комментарий |
|---|---|---|---|
| A01 | Broken Access Control | <!-- PASS / FAIL / N/A --> | |
| A02 | Cryptographic Failures | <!-- PASS / FAIL / N/A --> | |
| A03 | Injection (SQL, NoSQL, OS) | <!-- PASS / FAIL / N/A --> | |
| A04 | Insecure Design | <!-- PASS / FAIL / N/A --> | |
| A05 | Security Misconfiguration | <!-- PASS / FAIL / N/A --> | |
| A06 | Vulnerable Components | <!-- PASS / FAIL / N/A --> | |
| A07 | Auth & Session Management | <!-- PASS / FAIL / N/A --> | |
| A08 | Software & Data Integrity | <!-- PASS / FAIL / N/A --> | |
| A09 | Logging & Monitoring Failures | <!-- PASS / FAIL / N/A --> | |
| A10 | SSRF | <!-- PASS / FAIL / N/A --> | |

---

## Дополнительные проверки

| Проверка | Статус | Комментарий |
|---|---|---|
| Нет hardcoded secrets / credentials | <!-- PASS / FAIL --> | |
| Нет логирования sensitive-данных (PII, токены) | <!-- PASS / FAIL --> | |
| Все входные параметры валидируются | <!-- PASS / FAIL --> | |
| Auth-check на защищённых endpoints | <!-- PASS / FAIL --> | |
| TLS/HTTPS везде (нет HTTP для sensitive-трафика) | <!-- PASS / FAIL --> | |
| Dockerfile: нет секретов в ENV/ARG | <!-- PASS / FAIL / N/A --> | |
| CI `.gitlab-ci.yml`: security-блок не изменён | <!-- PASS / FAIL / N/A --> | |

---

## Блокирующие находки

> Находки Critical / High, которые требуют исправления до деплоя.

| # | Описание | Исправление | Статус |
|---|---|---|---|
| | <!-- Нет блокирующих находок --> | | |

---

## Нечего блокирующего / Принятые риски

| # | Описание | Обоснование принятия |
|---|---|---|
| | | |

---

## Итог

| Метрика | Значение |
|---|---|
| Статус | <!-- PASS — нет блокирующих находок / FAIL — есть блокирующие находки --> |
| Блокирующих находок | <!-- 0 --> |
| Исправлено в этом цикле | <!-- 0 --> |
| Принятых рисков | <!-- 0 --> |
| Следующий шаг | <!-- Продолжить RELEASE GATE / Вернуть в IMPLEMENTATION --> |
