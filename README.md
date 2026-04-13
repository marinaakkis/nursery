# Шаблон проекта для Cursor и Claude Code

Готовый каркас репозитория с настройками безопасности и кроссплатформенными хуками: проверка утечек секретов (gitleaks) и санитизация текста перед отправкой в ИИ и после ответа (sanitizer).

## Что внутри

- **Безопасность и политики** — `permissions` в `.claude/settings.json` (запрет чтения `.env`, ключей, опасных команд и т.д.).
- **Хук gitleaks** — вызывается через `node .cursor/hooks/gitleaks-launcher.mjs` (Node-лончер выбирает платформенный бинарник `gitleaks-hook-{os}-{arch}`).
- **Санитайзер** — вызывается через `node .cursor/hooks/sanitizer-launcher.mjs` (аналогичный лончер для бинарников `sanitizer-{os}-{arch}`).

Оба лончера — `.mjs`-файлы на чистом Node.js, работают одинаково на Windows, Linux и macOS.

## Кроссплатформенная архитектура

Все хуки вызываются через Node-лончеры, никогда напрямую:

```
Claude Code / Cursor
        │
        ▼
  node <tool>-launcher.mjs
        │
   detect OS + arch
        │
        ▼
  spawn platform binary
  (sanitizer-darwin-arm64, gitleaks-hook-linux-amd64, ...)
```

Правила:
- `command` в конфигах всегда начинается с `node`
- Никакого `bash`, `cmd`, `powershell` в командах хуков
- Пути разрешаются через `import.meta.url` + `path.join()` внутри лончера

## Быстрый старт

1. **Клонируйте** репозиторий с этим шаблоном или скопируйте содержимое в свой проект.
2. **Убедитесь**, что в системе доступна команда `node` (Node.js 18+).
3. **gitleaks-hook и санитайзер** — бинарники скачиваются автоматически из GitLab Package Registry при первом запуске хуков (требуется доступ к `gitlab.biocad.ru`).
   При отсутствии сети можно установить вручную:
   - Скачайте из [GitLab Package Registry](https://gitlab.biocad.ru) нужные сборки: `gitleaks-hook-darwin-arm64`, `gitleaks-hook-linux-amd64`, `gitleaks-hook-windows-amd64.exe` и т.д.
   - Положите их в `.cursor/hooks/vendor/gitleaks/<версия>/` и `.claude/hooks/vendor/gitleaks/<версия>/` (аналогично для sanitizer — в `vendor/sanitizer/<версия>/`).
   - На Unix-системах: `chmod +x <имя-бинарника>`
4. **Настройки Cursor** — из корня проекта выполните:
   - Linux / macOS: `./config-lin-mac.sh`
   - Windows: `config-win.bat`
5. Перезапустите Cursor / Claude Code.

### Проверка работоспособности хуков

После настройки убедитесь, что хуки работают:

```bash
# Проверка gitleaks (должен вывести версию или предупреждение, не ошибку):
echo '{}' | node .cursor/hooks/gitleaks-launcher.mjs

# Проверка sanitizer:
echo '{}' | node .cursor/hooks/sanitizer-launcher.mjs cursor-session

# Проверка локальных хуков безопасности (работают без внешних зависимостей):
echo '{"path":".env"}' | node .cursor/hooks/before-read-file.js
# Ожидаемый вывод в stderr: [SECURITY] WARNING: Reading sensitive file: .env

echo '{"path":".env"}' | node .cursor/hooks/before-tab-file-read.js
# Ожидаемый результат: exit code 2 (заблокировано)

echo '{"prompt":"my key is sk-1234567890abcdefghij"}' | node .cursor/hooks/before-submit-prompt.js
# Ожидаемый вывод в stderr: [SECURITY] WARNING: Potential secret detected in prompt!
```

Если gitleaks/sanitizer показывают предупреждение о недоступном реестре — это нормально при отсутствии сети. Хуки работают в режиме fail-open: при ошибке скачивания проверка пропускается. Локальные хуки безопасности (before-read-file, before-submit-prompt, before-tab-file-read) работают без сети.

## Конфигурации AI-инструментов

Шаблон содержит настройки для нескольких AI-инструментов разработки:

| Директория | Инструмент | Что настроено |
|------------|-----------|---------------|
| `.cursor/` | Cursor | Хуки безопасности, правила DLP, команды |
| `.claude/` | Claude Code | Permissions, хуки, правила DLP |
| `.codex/` | Codex CLI | Песочница, политика подтверждения |
| `.opencode/` | OpenCode | Агент по умолчанию, разрешения MCP |

Кросс-инструментальная политика безопасности — в `AGENTS.md` (корень репозитория).

## Локальные хуки безопасности

Помимо gitleaks и sanitizer, шаблон включает локальные хуки, которые работают без внешних зависимостей:

| Хук | Событие | Действие |
|-----|---------|----------|
| `before-read-file.js` | Чтение файла | Предупреждение при доступе к `.env`, `*.key`, `*.pem`, `credentials` |
| `before-submit-prompt.js` | Отправка промпта | Обнаружение секретов в тексте промпта (sk-, ghp_, AKIA, PEM) |
| `before-tab-file-read.js` | Tab/автодополнение | **Блокировка** чтения секретных файлов (exit 2) |
| `before-mcp-execution.js` | Вызов MCP | Логирование имени сервера и инструмента |
| `after-mcp-execution.js` | Результат MCP | Логирование результата (OK/FAILED) |

## Как вызываются хуки

### Claude Code

В `.claude/settings.json` команды вида:

```
node "$CLAUDE_PROJECT_DIR"/.claude/hooks/sanitizer-launcher.mjs claude-in
```

`$CLAUDE_PROJECT_DIR` задаётся средой Claude Code и указывает на корень проекта.

### Cursor

В `.cursor/hooks.json` используются относительные пути:

```
node .cursor/hooks/gitleaks-launcher.mjs
node .cursor/hooks/sanitizer-launcher.mjs cursor-in
```

Cursor запускает хуки с рабочей директорией в корне проекта.

Для событий с несколькими хуками (например `beforeSubmitPrompt`, `afterAgentResponse`) в массиве указаны два элемента — сначала gitleaks, затем sanitizer.

## Конфигурация санитайзера

Правила подмены задаются в `~/.config/sanitizer/mappings.yaml`:

```yaml
mappings:
  "ООО Компания": "COMPANY_A"
  "секретный-сервер.internal": "remote-host-1"
  "admin@corp.ru": "user@example.com"

patterns:
  email:
    enabled: true
  ipv4:
    enabled: true
  api_key_sk:
    enabled: true
```

## Добавление бинарника под новую платформу

1. Соберите бинарник для целевой ОС/архитектуры.
2. Положите файл в `.cursor/hooks/vendor/<tool>/<version>/` и `.claude/hooks/vendor/<tool>/<version>/`.
3. Откройте `*-launcher.mjs` и добавьте запись в объект `binaries` конфигурации.
4. На Unix: `chmod +x имя-файла`.

## Переменные окружения для хуков

| Переменная | Назначение | Значение по умолчанию |
|-----------|-----------|----------------------|
| `HOOKS_GITLAB_URL` | URL GitLab для скачивания бинарников | `https://gitlab.biocad.ru` |
| `GITLEAKS_HOOK_PROJECT_ID` | ID проекта gitleaks в GitLab | `3168` |
| `GITLEAKS_HOOK_VERSION` | Версия gitleaks (пустая = последняя) | — |
| `SANITIZER_HOOK_PROJECT_ID` | ID проекта sanitizer в GitLab | `3228` |
| `SANITIZER_HOOK_VERSION` | Версия sanitizer (пустая = последняя) | — |
| `HOOKS_REGISTRY_TIMEOUT_MS` | Таймаут запроса к реестру | `5000` |
