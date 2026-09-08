<!-- Template path: .agents/skills/skill.ai-sdlc.ru.phase-5-release-gate/template.smoke-report.md -->
<!-- Output path:   docs/dev-requests/dev-request.r-<nnn>.<system-request-name>/dev-testing.r-<nnn>.smoke-report.<system-request-name>.md -->

# Smoke Report: r-<nnn> <system-request-name>

## Мета

| Поле | Значение |
|---|---|
| Запрос | `r-<nnn>` |
| Задача | `<system-request-name>` |
| Фаза | RELEASE GATE |
| Окружение | <!-- local / staging --> |
| Дата / время | <!-- YYYY-MM-DD HH:MM --> |
| Запускал | <!-- Агент / Инженер --> |
| Итоговый статус | <!-- PASS / FAIL --> |

---

## Результаты по endpoint

| # | Endpoint | Метод | Ожидаемый статус | Фактический статус | Тело ответа | Auth без токена → 401 | Итог |
|---|---|---|---|---|---|---|---|
| 1 | `/api/...` | GET | 200 | <!-- 200 --> | <!-- Соответствует контракту / Отклонение: ... --> | <!-- ✓ / N/A --> | <!-- PASS / FAIL --> |
| 2 | | | | | | | |

---

## Проверка логов

| Проверка | Статус | Комментарий |
|---|---|---|
| Нет unexpected errors (5xx, unhandled exceptions) | <!-- PASS / FAIL --> | |
| Нет sensitive-данных в логах | <!-- PASS / FAIL --> | |
| Structured logging работает | <!-- PASS / FAIL --> | |

---

## Non-HTTP проверки

<!-- Заполняется при наличии очередей, scheduled jobs, gRPC-эндпоинтов. При отсутствии — удалить секцию или отметить N/A. -->

| # | Тип | Компонент / Топик | Сценарий | Ожидаемый результат | Фактический результат | Итог |
|---|---|---|---|---|---|---|
| 1 | <!-- Queue / gRPC / Scheduler --> | <!-- topic-name / service-method / job-name --> | <!-- что запускается --> | <!-- ожидаемое поведение --> | <!-- --> | <!-- PASS / FAIL / N/A --> |

---

## Найденные проблемы

| # | Endpoint | Описание проблемы | Severity | Статус |
|---|---|---|---|---|
| | | <!-- Нет проблем --> | | |

---

## Итог

| Метрика | Значение |
|---|---|
| Всего endpoints | <!-- 0 --> |
| PASS | <!-- 0 --> |
| FAIL | <!-- 0 --> |
| Статус | <!-- PASS / FAIL --> |
| Следующий шаг | <!-- Продолжить RELEASE GATE / Исправить и повторить --> |
