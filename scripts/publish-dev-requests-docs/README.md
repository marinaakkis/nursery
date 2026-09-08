# Публикация артефактов dev-request

Идемпотентная публикация документации завершённых dev-request во внешнее хранилище.
По умолчанию реализован один backend — **Obsidian** (для локальной разработки). Архитектура —
strategy/adapter: добавление нового сервиса (например, **Onyx**, Confluence) делается реализацией
адаптера, **без изменения ядра**.

## Архитектура (strategy pattern)

| Компонент | Роль |
|---|---|
| `docs-storage-api-client-factory/contract.mjs` | Контракт адаптера: `upsertDocument` / `search` / `health` |
| `docs-storage-api-client-factory/index.mjs` | Реестр backend'ов (`REGISTRY`) + выбор адаптера |
| `docs-storage-api-clients/obsidian/` | Адаптер Obsidian (Local REST API) — единственная реализация по умолчанию |
| `docs-storage-api-clients/stub/` | In-memory адаптер для тестов; образец интерфейса для новых стратегий |
| `utilities/` | http (timeout/retry/circuit-breaker), подготовка/очистка артефактов, метаданные |
| `install-docs-storage/obsidian/` | Установка и настройка хранилища Obsidian |

## Расширение: публикация в другой сервис (например, Onyx)

Реализуется как новая стратегия, ядро не меняется:

1. Создать `docs-storage-api-clients/<backend>/adapter.mjs` по контракту `contract.mjs`
   (методы `upsertDocument(doc, config)`, `search(query, config)`, `health(config)`).
   Образец интерфейса — `docs-storage-api-clients/stub/adapter.mjs`.
2. Зарегистрировать фабрику адаптера в `REGISTRY` (`docs-storage-api-client-factory/index.mjs`) —
   там есть закомментированные примеры `onyx` / `atlassian`.
3. Добавить backend и его поля `docsStorage` в `utilities/project-metadata-helper.mjs`
   (`VALID_BACKENDS` + `DOCS_STORAGE_SHAPE` + `buildDocsStorage`).
4. При необходимости — скрипт установки в `install-docs-storage/<backend>/`.

## Хранение секретов

Токен доступа хранится в `.project-metadata.local.json` (gitignored), поле `docsStorage`:

| Бэкенд | Поле | Где взять |
|---|---|---|
| `obsidian` | `docsStorage.apiKey` | Obsidian → Settings → Local REST API → API Key |

Шаблон `.project-metadata.docs-storage.obsidian.example.json` — рядом со скриптом установки.

## Быстрый старт (Obsidian)

1. Установить **Node.js 18+** и Obsidian (desktop) с плагином Local REST API.
2. Установка хранилища: см. [`install-docs-storage/obsidian/README.md`](install-docs-storage/obsidian/README.md).
3. Заполнить `docsStorage` в `.project-metadata.local.json` (`apiKey` + URL).
4. Dry-run / публикация:
   ```bash
   node scripts/publish-dev-requests-docs/publish-dev-requests-docs.mjs --request r-<nnn> --dry-run
   node scripts/publish-dev-requests-docs/publish-dev-requests-docs.mjs --request r-<nnn>
   ```

## Надёжность

- HTTP-адаптеры: timeout 30s, retry 3× (exponential backoff), circuit-breaker (`utilities/http.mjs`).
- Каждый адаптер реализует `health()`. Публикация идемпотентна — повторный запуск безопасен.

## Безопасность

- Секреты — только в `.project-metadata.local.json` (gitignored), не в коде и не в аргументах CLI.
- Скрипт не выполняет git-операций (`git-agent-no-staging`).
