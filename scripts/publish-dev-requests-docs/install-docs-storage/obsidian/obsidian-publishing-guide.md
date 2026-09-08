# Obsidian: API и публикация артефактов

Постоянный документ. Описывает **Obsidian Local REST API** и порядок отправки содержимого артефактов (включая каталог dev-request) в локальное хранилище Obsidian публикатором `scripts/publish-dev-requests-docs/`.

> Это переиспользуемый справочник в `docs/`. На него ссылаются команда и инструкции; сам он не ссылается на `docs/dev-requests/**`.

## Модель

- **Vault = проект.** Один Obsidian vault на проект (изоляция). Артефакты раскладываются по пути `<projectKey>/<относительный путь артефакта>`.
- **Plain-markdown.** Obsidian хранит `.md` как есть — формат совпадает с источником в git (потерь конвертации нет, в отличие от Confluence).
- **Источник vs хранилище (lifecycle).** Источник работы — git; Obsidian — долгосрочное хранилище опубликованных артефактов и слой поиска (плагин Smart Connections).

## Аутентификация

| Поле | Значение |
|---|---|
| Плагин | **Local REST API** (включить в Obsidian → Settings → Community plugins) |
| База | `https://127.0.0.1:27124` (HTTPS, self-signed) или `http://127.0.0.1:27123` |
| Заголовок | `Authorization: Bearer <API key>` |
| Где взять ключ | Settings → Local REST API → **API Key** |
| Где хранить ключ | `.project-metadata.local.json` → `docsStorage.apiKey` (gitignored, не в репозитории) |

## Предусловие: Obsidian должен быть запущен

**Local REST API — это плагин, работающий внутри процесса Obsidian.** HTTP-сервер (`127.0.0.1:27124`) поднимается самим приложением, поэтому:

- **Obsidian должен быть запущен** (с включённым плагином Local REST API и открытым нужным vault) на момент публикации. Если приложение закрыто — эндпоинт недоступен, и публикатор падает на health-проверке (`GET /`) либо на `PUT /vault/...` с ошибкой соединения (`ECONNREFUSED`).
- **Режима «без запущенного Obsidian» нет** — плагин не работает как отдельный демон/сервис в отрыве от приложения.
- **«Headless»-вариант** — запускать само desktop-приложение Obsidian в фоне/без видимого окна: на постоянно включённой машине либо в Linux-контейнере с виртуальным дисплеем (например, `xvfb`). Это по-прежнему «Obsidian запущен», просто без интерактивного окна.
- Для полностью серверного сценария без запущенного desktop-приложения — реализовать другую стратегию-адаптер `docsStorage` (например, Onyx), не требующую локального Obsidian. Точка расширения описана в `scripts/publish-dev-requests-docs/README.md`.

## Используемые эндпоинты Obsidian Local REST API

| # | Метод | Путь | Назначение | Тело / параметры | Ответ |
|---|---|---|---|---|---|
| 1 | `PUT` | `/vault/{path}` | Создать/перезаписать заметку (idempotent upsert по пути) | `Content-Type: text/markdown`, тело — markdown | `200` (обновлено) / `201` (создано) |
| 2 | `POST` | `/search/simple/?query=<q>` | Текстовый поиск по vault | — | `200`, массив совпадений `[{filename, score, matches[]}]` |
| 3 | `GET` | `/` | Проверка доступности (health) | — | `200` при живом сервере |

> Семантический поиск обеспечивается плагином **Smart Connections** (on-device эмбеддинги), индексирующим тот же каталог `.md`. MCP-доступ — community MCP-сервер поверх Local REST API.

## Как публикатор отправляет содержимое

Адаптер `scripts/publish-dev-requests-docs/docs-storage-api-clients/obsidian/adapter.mjs` реализует контракт `upsertDocument/search/health`:

1. **Prepare** — публикатор собирает манифест артефактов завершённого dev-request (по умолчанию только `DONE`).
2. **Push** — для каждого артефакта: `PUT /vault/<projectKey>/<folderName>/<relativePath>` с markdown-телом. Повторная публикация перезаписывает по тому же пути (идемпотентно).
3. Все вызовы — через reliability-слой (`utilities/http.mjs`): таймаут 30 с, retry 3× (1/2/4 с), circuit-breaker; токен из `.project-metadata.local.json`, в лог не попадает.

**Раскладка в vault:**
```
<vault>/
  <projectKey>/
    dev-request.r-nnn.<name>/
      research.r-nnn.<name>.md
      design/adr-log/adr.001.r-nnn.<name>.md
      design/c4-diagrams/c1.r-nnn.<name>.md
      ...
```

## Запуск

> **Перед запуском** убедитесь, что Obsidian запущен с включённым Local REST API (см. «Предусловие: Obsidian должен быть запущен»), иначе публикация завершится ошибкой соединения.

```bash
# план без реальной отправки
node scripts/publish-dev-requests-docs/publish-dev-requests-docs.mjs --dry-run

# публикация всех DONE-запросов
node scripts/publish-dev-requests-docs/publish-dev-requests-docs.mjs

# публикация + удаление исходников
node scripts/publish-dev-requests-docs/publish-dev-requests-docs.mjs --with-clean
```

`.project-metadata.local.json` (gitignored):
```json
{ "docsStorage": { "backend": "obsidian", "baseUrl": "https://127.0.0.1:27124", "projectKey": "<project-key>", "apiKey": "<api-key>" } }
```

## Установка и автоматизация

- Ручная установка и плагины: `scripts/publish-dev-requests-docs/deploy/local/README.md`.
- Скрипт автонастройки (Chocolatey/Obsidian/Node + vault-скаффолдинг): `scripts/publish-dev-requests-docs/deploy/local/setup-obsidian.win.ps1` (Windows) / `setup-obsidian.lin-mac.sh` (macOS/Linux).
