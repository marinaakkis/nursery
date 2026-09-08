# Quick Start: Шаблон проекта для Cursor, Claude Code и Codex

Пошаговое руководство по инициализации проекта, запуску вспомогательных скриптов и началу работы с AI dev процессом.

---

## Предварительные требования

| Инструмент | Версия | Зачем |
|---|---|---|
| [Node.js](https://nodejs.org/) | 18+ | Git-хуки и скрипты генерации артефактов |
| PowerShell | 5.1+ или 7+ | Только Windows: запуск `.ps1`-скриптов git-hooks |
| bash | 3.2+ | Linux/macOS: запуск `.sh`-скриптов git-hooks |
| [uv](https://docs.astral.sh/uv/) | любая | Только если нужен Serena MCP |

Проверьте наличие инструментов:
```bash
node -v   # >= 18
```

---

## Шаг 1: Клонирование репозитория

```bash
git clone <url-репозитория>
cd <имя-проекта>
```

---

## Шаг 2: Инициализация проекта

Рекомендуемый вариант устанавливает проверенный AI security hook и git-хуки,
объединяет настройки Cursor без потери пользовательских ключей и обновляет
локальные метаданные проекта.

**Windows:**
```powershell
.\config-win.bat
```

**Linux / macOS:**
```bash
./config-lin-mac.sh
```

AI security hook `v2.0.1` проверяет секреты и только высокодостоверные PII во
вводе и действиях Cursor, Claude Code и Codex. Бинарник скачивается один раз,
проверяется по SHA-256 и затем работает из локального кеша без сети.

Ручная установка или восстановление кеша:

```bash
node scripts/ai-hooks/run-hook-tool.mjs gitleaks --install
```

### Только git-хуки

Git-хуки обеспечивают проверки при `commit` и `push`, включая валидацию паспортов интеграций. Они не заменяют AI security hook.

**Windows:**
```powershell
.\scripts\git-hooks\git-hooks.win.install.ps1

# Если политика выполнения блокирует:
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\git-hooks\git-hooks.win.install.ps1"
```

**Linux / macOS:**
```bash
bash scripts/git-hooks/git-hooks.lin-mac.install.sh
```

> Флаг `isGitHooksInited` отражает только состояние git-хуков. Он не является
> индикатором установки AI security hook.

---

## Шаг 3: Smoke-тест git-хуков

Убедитесь, что хуки работают корректно:

```bash
node .githooks/integration-passports.validate.mjs pre-commit
node .githooks/integration-passports.validate.mjs pre-push
```

Успешный результат: хук завершается без ошибок (код выхода 0) или сообщает, что нет нарушений. Если хук сообщает об ошибке, читайте `scripts/README.md`.

---

## Шаг 4: Настройка Serena MCP (опционально)

Serena MCP — локальный LSP-сервер для символьной навигации по коду (поиск определений, вхождений, структуры проекта) для Claude Code и Cursor. По умолчанию **отключён**.

### Подключить Serena

**Linux / macOS:**
```bash
bash scripts/serena-mcp/init-serena-mcp.sh              # Python LSP (по умолчанию)
bash scripts/serena-mcp/init-serena-mcp.sh python typescript go  # несколько языков
```

**Windows:**
```powershell
.\scripts\serena-mcp\init-serena-mcp.ps1
.\scripts\serena-mcp\init-serena-mcp.ps1 python typescript

# Если политика выполнения блокирует:
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\serena-mcp\init-serena-mcp.ps1"
```

**Поддерживаемые языки:** `python`, `typescript` / `javascript`, `go`, `csharp` / `dotnet`, `rust`, `java`

### Отключить Serena (сохранить бинарник)

```bash
bash scripts/serena-mcp/disable-serena-mcp.sh   # Linux/macOS
.\scripts\serena-mcp\disable-serena-mcp.ps1     # Windows
```

### Полное удаление Serena

```bash
bash scripts/serena-mcp/uninstall-serena-mcp.sh   # Linux/macOS
.\scripts\serena-mcp\uninstall-serena-mcp.ps1     # Windows
```

---

## Шаг 5: Обновление индекса инструментов (при необходимости)

После добавления/изменения скиллов, правил или команд обновите адаптеры и индекс:
```bash
node scripts/ai-template-indexing/sync-claude-skill-adapters.mjs
node scripts/ai-template-indexing/sync-claude-command-adapters.mjs
node scripts/ai-template-indexing/generate-ai-tooling-index.mjs
```
Полный индекс — `docs/ai-tooling-index.md`.

---

## Работа с AI dev процессом

Шаблон содержит 5-фазный процесс AI-assisted разработки: **Research → Design → Planning → Implementation → Release Gate**.

### Режимы запуска

| Режим | Что делает | Когда использовать |
|---|---|---|
| `plan-review` (по умолчанию) | Фазы 1–3 (Research → Design → Planning) выполняются автоматически, затем **пауза** для обсуждения и правок плана, после подтверждения — фазы 4–5 (Implementation → Release Gate) | Обычная работа: вы хотите проверить план до написания кода |
| `auto` | Все 5 фаз без паузы | Простые/понятные задачи, где промежуточный контроль не нужен |

### Полный цикл (рекомендуется plan-review)

```
/command.ai-sdlc.ru.run-all .input/моя-задача.txt
```

Или задача прямо в тексте:

```
/command.ai-sdlc.ru.run-all Добавить экспорт отчёта в PDF
```

Полностью автоматический режим (без паузы):

```
/command.ai-sdlc.ru.run-all .input/моя-задача.txt mode=auto
```

### Что происходит на PLAN-REVIEW PAUSE

После завершения фазы 3 (Planning) агент выводит:
- Саммари по фазам 1–3: компоненты, дизайн-решения, план
- Открытые вопросы (если есть)
- Предложение начать обсуждение или запустить реализацию

Вы можете задать вопросы, скорректировать план или запустить фазу 4–5.

### Запуск отдельных фаз

```
/command.ai-sdlc.ru.run-phase-1-research .input/моя-задача.txt mode=auto
/command.ai-sdlc.ru.run-phase-2-design   scripts-reorganize mode=auto
/command.ai-sdlc.ru.run-phase-3-planning scripts-reorganize mode=auto
```

Подробное описание всего процесса — в `AGENTS.md`.

---

## Ключевые скиллы

| Домен | Скилл | Для чего |
|---|---|---|
| `arch` | `skill.arch.ru.c4-diagrams` | C4 Context/Container/Component диаграммы |
| `arch` | `skill.arch.ru.sequence-diagrams` | Sequence и process диаграммы |
| `arch` | `skill.arch.en.architecture-md-artifact` | Создание/обновление `docs/architecture.md` (создаётся при запуске Phase 2 Design) |
| `arch` | `skill.arch.ru.backend-clean-architecture` | Чистая архитектура бэкенда |
| `arch` | `skill.arch.ru.frontend-clean-architecture` | Чистая архитектура фронтенда |
| `dev` | `skill.dev.ru.dev-planning` | Создание dev-plan, epic, task |
| `dev` | `skill.dev.ru.coding-standards-universal` | Универсальные стандарты кода |
| `dev` | `skill.dev.ru.dotnet-csharp-standards` | Стандарты C#/.NET |
| `devops` | `skill.devops.en.dokploy-repo-prep` | Подготовка репо для деплоя в Dokploy |
| `devops` | `skill.devops.en.helm-chart-scaffold` | Scaffold Helm-чартов |
| `devops` | `skill.devops.en.k8s-deploy-scaffold` | Полный Kubernetes scaffold |
| `governance` | `skill.governance.en.readme-quick-start-maintainer` | Поддержка README и Quick Start |
| `security` | `skill.security.en.security-review` | Security review Docker, K8s, CI, кода |
| `ai-sdlc` | `skill.ai-sdlc.ru.phase-1-research` | Фаза 1: исследование кодовой базы |
| `ai-sdlc` | `skill.ai-sdlc.ru.phase-2-design` | Фаза 2: архитектурные артефакты |
| `ai-sdlc` | `skill.ai-sdlc.ru.phase-3-planning` | Фаза 3: декомпозиция на dev-task |
| `ai-sdlc` | `skill.ai-sdlc.ru.phase-4-implementation` | Фаза 4: мультиагентная реализация |
| `ai-sdlc` | `skill.ai-sdlc.ru.phase-5-release-gate` | Фаза 5: release gate перед деплоем |

Полный индекс скиллов/правил/команд: `docs/ai-tooling-index.md`

---

## Ключевые правила

| Правило | Суть |
|---|---|
| `rule.security.en.corporate-dlp` | Никаких секретов, ключей и PII в промптах и коде |
| `rule.governance.ru.project-init-check` | При `isGitHooksInited: false` — запустить init-скрипт |
| `rule.integration.ru.integration-passport-and-reliability-gate` | Каждая внешняя интеграция требует паспорта |
| `rule.dev.ru.code-quality-tests-docs-logging` | Тесты + структурированные логи + документация |
| `rule.ai-sdlc.ru.process` | Обязательный 5-фазный AI dev процесс |

---

## Команды быстрого старта

Команды вызываются через `/` в Cursor или Claude Code. Полное описание каждой — в файле команды (`.cursor/commands/<имя>.md`).

| Команда | Что делает | Подробности |
|---|---|---|
| `/command.ai-sdlc.ru.run-all <задача>` | Полный цикл разработки: 5 фаз (Research → Design → Planning → Implementation → Release Gate). По умолчанию `plan-review` — с паузой после планирования. | [run-all](.cursor/commands/command.ai-sdlc.ru.run-all.md) |
| `/command.ai-sdlc.ru.publish-dev-requests-docs` | Публикует артефакты завершённых dev-request в документальное хранилище (Obsidian; расширяемо на другие сервисы через стратегии) | [publish-dev-requests-docs](.cursor/commands/command.ai-sdlc.ru.publish-dev-requests-docs.md) |
| `/command.ai-sdlc.ru.actualize-main-docs` | После dev-request актуализирует глобальный `docs/` значимыми design-артефактами (C4 C2/C3, межсервисные контракты, ERD, ключевые ADR/DDR): план → согласование (`Решение`) → синтез. Предлагается на Post-Release Gate Фазы 5 | [actualize-main-docs](.cursor/commands/command.ai-sdlc.ru.actualize-main-docs.md) |
| `/command.dev.ru.generate-commit-message` | Генерирует сообщение коммита в формате [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:` …) из проиндексированных (`git add`) изменений | [generate-commit-message](.cursor/commands/command.dev.ru.generate-commit-message.md) |
| `/command.security.ru.security-audit <файл>` | Проверяет файл по [OWASP Top 10](https://owasp.org/www-project-top-ten/) (инъекции, секреты, небезопасные зависимости) и выдаёт отчёт с рекомендациями | [security-audit](.cursor/commands/command.security.ru.security-audit.md) |
| `/command.dev.ru.fix-by-comments <файл>` | Находит в файле комментарии-указания на правки (`// TODO`, `// FIXME` и т.п.), готовит пронумерованные диффы с оценкой риска, ждёт подтверждения | [fix-by-comments](.cursor/commands/command.dev.ru.fix-by-comments.md) |
| `/command.governance.ru.apply-critique <отчёт>` | Применяет к артефакту (скилл / правило / команда) находки из critique-отчёта: сначала открытые вопросы, затем нумерованный план фиксов | [apply-critique](.cursor/commands/command.governance.ru.apply-critique.md) |

> **Conventional Commits** — соглашение о формате сообщений коммитов: префикс типа (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`) + краткое описание. Позволяет автогенерировать changelog и версии.

Полный список команд (и всех скиллов/правил) — в [docs/ai-tooling-index.md](docs/ai-tooling-index.md).

---

## Публикация документации dev-request

После завершения dev-request его артефакты (research, design, dev-plan) можно опубликовать во внешнее документальное хранилище для долгосрочного хранения и семантического поиска.

1. **Установить хранилище** (один раз) — Obsidian (другие сервисы — через реализацию стратегии-адаптера).
   См. [scripts/publish-dev-requests-docs/README.md](scripts/publish-dev-requests-docs/README.md).
2. **Опубликовать**:
   ```bash
   node scripts/publish-dev-requests-docs/publish-dev-requests-docs.mjs --dry-run   # план
   node scripts/publish-dev-requests-docs/publish-dev-requests-docs.mjs              # публикация всех DONE
   ```

Команда-обёртка для AI-агента: `/command.ai-sdlc.ru.publish-dev-requests-docs`.

---

## Решение типичных проблем

**Хуки не срабатывают при commit/push:**
Повторно установите git-хуки:
```powershell
.\scripts\git-hooks\git-hooks.win.install.ps1       # Windows
bash scripts/git-hooks/git-hooks.lin-mac.install.sh  # Linux/macOS
```

**Serena MCP не отвечает или не запускается:**
```bash
bash scripts/serena-mcp/disable-serena-mcp.sh
bash scripts/serena-mcp/init-serena-mcp.sh python
```

---

Подробная документация скриптов: [scripts/README.md](scripts/README.md)  
Инструкции для AI-агентов: [AGENTS.md](AGENTS.md)
