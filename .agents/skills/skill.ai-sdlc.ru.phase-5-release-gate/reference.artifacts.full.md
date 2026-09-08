---
name: reference.artifacts.full
description: >
  Конечные артефакты фазы 5 (RELEASE GATE) AI-SDLC в профиле `full` (человеко-читаемый).
  Выбирается `docs=full`. Парная ссылка: reference.artifacts.compact.
---

# Фаза 5 (RELEASE GATE) — артефакты профиля `full`

> Профиль `docs=compact|full` (дефолт `compact`). Полный профиль — полные отчёты с нарративом по шаблонам скилла (`template.*.md`). Краткий — `reference.artifacts.compact.md`.

Принцип `full`: полные отчёты с нарративом по шаблонам скилла (`template.*.md`).

## Состав артефактов

| Артефакт | Профиль `full` | Формат | Шаблон |
|---|---|---|---|
| Security report | ✅ полный | таблица + нарратив | `template.security-report.md` |
| Smoke report | ✅ полный | таблица + нарратив | `template.smoke-report.md` |
| PR description | ✅ полная | проза + таблицы | `template.pr-description.md` |
| DevOps-артефакты | ✅ при необходимости | code/spec | Dockerfile/helm/k8s |
| dev-process-plan | ✅ финализируется | таблицы | — |

## Отличие от `compact`

`full` добавляет нарративную интерпретацию security-findings, развёрнутые секции PR-описания (что/зачем, ключевые изменения по компонентам, технический долг) по шаблону. Объём проверок идентичен (full ⊇ compact).
