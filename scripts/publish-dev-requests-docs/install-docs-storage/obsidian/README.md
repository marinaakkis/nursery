# Сценарий A — локальное хранилище (Obsidian)

Детальная инструкция установки для малых/средних проектов. Бэкенд — **Obsidian**.

## 0. Быстрая автонастройка (опционально)

Один скрипт ставит Obsidian (+Node) и скаффолдит хранилище/плагины:

> **Требуются права администратора.** Скрипт устанавливает Obsidian через Chocolatey в `C:\ProgramData`, что требует elevation.
> Без прав администратора установка Obsidian будет **пропущена** (остальные шаги — каркас хранилища, плагины, `.env` — выполнятся).
>
> Запуск от имени администратора:
> ```powershell
> # Вариант 1 — открыть новый PowerShell-сеанс от имени администратора:
> Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File `"$PWD\scripts/publish-dev-requests-docs/install-docs-storage\obsidian\setup-obsidian.win.ps1`" -ProjectKey <project-key> -InstallNode"
>
> # Вариант 2 — запустить напрямую в уже открытом elevated PowerShell:
> powershell -ExecutionPolicy Bypass -File .\scripts/publish-dev-requests-docs/install-docs-storage\obsidian\setup-obsidian.win.ps1 -ProjectKey <project-key> -InstallNode
> ```
>
> Если устанавливать Obsidian через скрипт не нужно — запускайте без elevation, Obsidian поставьте вручную (см. раздел 1).

```powershell
# Windows (Chocolatey) — предварительно: открыть PowerShell от имени администратора
.\scripts/publish-dev-requests-docs/install-docs-storage\obsidian\setup-obsidian.win.ps1 -ProjectKey <project-key> -InstallNode -WhatIf   # предпросмотр
.\scripts/publish-dev-requests-docs/install-docs-storage\obsidian\setup-obsidian.win.ps1 -ProjectKey <project-key> -InstallNode
```

> **Ошибка «выполнение сценариев отключено»?** По умолчанию Windows запрещает запуск `.ps1`-файлов.
> Обход — разовый запуск без изменения политики системы:
> ```powershell
> powershell -ExecutionPolicy Bypass -File .\scripts/publish-dev-requests-docs/install-docs-storage\obsidian\setup-obsidian.win.ps1 -ProjectKey <project-key> -InstallNode -WhatIf
> powershell -ExecutionPolicy Bypass -File .\scripts/publish-dev-requests-docs/install-docs-storage\obsidian\setup-obsidian.win.ps1 -ProjectKey <project-key> -InstallNode
> ```

```bash
# macOS (brew) / Linux (flatpak)
bash scripts/publish-dev-requests-docs/install-docs-storage/obsidian/setup-obsidian.lin-mac.sh <project-key> --dry-run
bash scripts/publish-dev-requests-docs/install-docs-storage/obsidian/setup-obsidian.lin-mac.sh <project-key>
```

Скрипт автоматизирует установку и каркас; **один ручной шаг** остаётся — после первого запуска Obsidian скопировать API Key плагина Local REST API в `docsStorage.apiKey` в `.project-metadata.local.json` (плагин генерирует ключ в рантайме). Полные шаги ниже.

## 1. Установка Obsidian

1. Скачать Obsidian (desktop) с обязательной проверкой подписи дистрибутива.
2. Создать **хранилище проекта** (например `~/dev-vaults/<projectName>`). .

## 2. Плагины (Community plugins → Browse)

### Обязательный

| Плагин | Назначение |
|---|---|
| **Local REST API** | HTTP API поверх хранилища; в настройках включить, скопировать **API key** |

После включения Local REST API запомнить порт (по умолчанию HTTPS `27124`) и **API key**.

Скрипт установки загружает этот плагин автоматически.

### Опциональный — Smart Connections (семантический поиск)

Устанавливается вручную через Obsidian → Community plugins → Browse → «Smart Connections».

**Что решает:** строит on-device эмбеддинги для всех заметок хранилища и позволяет AI-агентам искать семантически связанные артефакты — например, находить похожие ADR или design-документы по смыслу, а не по ключевым словам.

**Нужен, если:** планируется использовать AI-агента для навигации по накопленным dev-артефактам (поиск прецедентов, связанных решений, похожих задач).

**Не нужен, если:** хранилище используется только для публикации для публикации и ручного чтения.

> **Приватность:** по умолчанию плагин предлагает подключить OpenAI API — данные хранилища уйдут на внешний сервер.
> Для полностью локальной работы: Settings → Smart Connections → Embedding model → выбрать **`TaylorAI/bge-micro-v2`** (модель ~23 MB, запускается локально через `transformers.js`, никаких внешних вызовов). Поле API-ключа оставить пустым.

## 3. Настройка проекта

`.project-metadata.local.json` (в корне репозитория, gitignored):

```json
{
  "projectName": "<projectName>",
  "docsStorage": {
    "backend": "obsidian",
    "baseUrl": "https://127.0.0.1:27124",
    "projectKey": "<projectName>",
    "apiKey": "<вставить API-ключ из Local REST API>"
  }
}
```

Шаблон: `install-docs-storage/obsidian/.project-metadata.docs-storage.obsidian.example.json`.

## 4. Публикация

> **Obsidian должен быть запущен** (плагин Local REST API активен, vault открыт) — API `127.0.0.1:27124` поднимается внутри приложения. При закрытом Obsidian публикация падает с ошибкой соединения. Headless-вариант и серверная альтернатива — см. `obsidian-publishing-guide.md` → «Предусловие: Obsidian должен быть запущен».

```bash
# plan (без реального запроса)
node scripts/publish-dev-requests-docs/publish-dev-requests-docs.mjs --request r-<nnn>

# публикация
node scripts/publish-dev-requests-docs/publish-dev-requests-docs.mjs --request r-<nnn>
```

## 5. Опционально — семантический поиск

Семантический поиск по хранилищу обеспечивает плагин Obsidian **Smart Connections** (on-device эмбеддинги, индексирует те же `.md`; git остаётся источником истины). Внешние индексаторы можно подключить отдельно — в шаблон они не входят.

## Проверка

- `node scripts/publish-dev-requests-docs/publish-dev-requests-docs.mjs --help` — справка.
- `node --test scripts/publish-dev-requests-docs/test/publish-dev-requests-docs.test.mjs` — тесты (stub-бэкенд, без хранилища).
