---
name: skill.governance.en.readme-quick-start-maintainer
description: >-
  Maintains repository README as a concise navigation hub and QUICK-START.md as
  the step-by-step onboarding guide. README links to sources of truth (docs/ai-tooling-index.md,
  QUICK-START, AGENTS, specialized READMEs) instead of duplicating full asset tables.
  Use when the user asks to update README/QUICK-START project description, improve
  discoverability, keep onboarding aligned with .agents/skills, .cursor/rules,
  .cursor/commands, .githooks, or fix cross-links.
---

# README & Quick Start Maintainer

This skill keeps `README.md` short and navigable, and `QUICK-START.md` practical and current.

**Priority:** follow repository-level rules first. If local rules conflict with this skill, local rules win.

## Принцип: README — навигационный хаб, не каталог

Корневой `README.md` **не дублирует** полные таблицы скиллов/правил/команд. Вместо этого он:
- даёт общее описание проекта (что это, зачем);
- содержит таблицу «С чего начать» с кросс-ссылками;
- описывает структуру репозитория;
- ссылается на источники истины, а не повторяет их.

| Контент | Источник истины (куда ссылаться) |
|---|---|
| Полный список скиллов/правил/команд | `docs/ai-tooling-index.md` (generated index) |
| Человекочитаемые сводки ключевых скиллов/правил/команд | `QUICK-START.md` |
| Детали хуков (sanitizer, gitleaks, env-vars, tool-manifest) | `scripts/README.md` (раздел ai-hooks) |
| Инструкции по скриптам | `scripts/README.md` и вложенные README |
| Политика для AI-агентов | `AGENTS.md` |

**Не воспроизводи** в README большие таблицы `№ | name | path | purpose` — это устаревшая модель. Если такие таблицы найдены — замени на краткое описание + кросс-ссылку.

## Структура README (рекомендуемый порядок)

1. Заголовок + 1 абзац: что это за шаблон.
2. **«С чего начать»** — таблица `Я хочу… | Смотри` с кросс-ссылками.
3. **Структура репозитория** — таблица директорий.
4. **Навигация по агентским ассетам** — ссылка на `docs/ai-tooling-index.md` + краткий обзор категорий со ссылками на сводки в QUICK-START.
5. **Безопасность** — краткое описание + ссылка на `scripts/README.md` (ai-hooks).
6. **Установка** — минимум команд + ссылка на QUICK-START.
7. Таблица конфигураций AI-инструментов.

## Структура QUICK-START.md

Пошаговый онбординг: требования → клонирование → git-хуки → Serena MCP → навигационные индексы → работа с dev-процессом → команды → публикация → troubleshooting.

Здесь допустимы человекочитаемые **сводные** таблицы ключевых скиллов/правил/команд (не полные — только самые используемые, с одной строкой описания).

## Кросс-ссылки

- Используй repository-relative пути в markdown-ссылках: `[текст](path/to/file.md)`.
- Для якорей внутри документа учитывай GitHub-генерацию (lowercase, пробелы→дефисы, кириллица сохраняется).
- Проверяй что целевой файл существует — не ссылайся на удалённые артефакты.

## Update Workflow

1. Прочитать текущие `README.md` и `QUICK-START.md`.
2. Сверить кросс-ссылки с реальными файлами (нет битых ссылок и якорей).
3. Если в README появились дублирующие большие таблицы — свернуть в кросс-ссылку.
4. Обновить сводки в QUICK-START при добавлении/удалении ключевых ассетов.
5. Перечитать изменённые фрагменты — проверить целостность markdown.

## Safety Notes

- Не включать секреты, токены, PII в README/QUICK-START.
- Не добавлять ссылки из `docs/` на `.input/`.
- Не ссылаться из постоянной документации на содержимое `docs/dev-requests/**`.
- Держать онбординг практичным; избегать длинных концептуальных эссе.

## Done Checklist

- [ ] README остаётся навигационным хабом (нет больших дублирующих таблиц).
- [ ] Таблица «С чего начать» актуальна, все ссылки рабочие.
- [ ] `docs/ai-tooling-index.md` указан как источник истины для полного списка ассетов.
- [ ] Детали хуков живут в `scripts/README.md` (ai-hooks), README только ссылается.
- [ ] Нет битых кросс-ссылок и якорей.
- [ ] QUICK-START содержит актуальные сводки и шаги онбординга.
