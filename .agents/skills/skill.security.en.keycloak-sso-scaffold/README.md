# Keycloak SSO Scaffold — DevOps handoff skill

AI-скилл для подготовки запроса в команду SSO-платформы. Работает в **любом** репозитории приложения — независимо от языка, фреймворка и структуры проекта.

## Когда использовать

Разработчику нужно подключить своё приложение к корпоративному Keycloak SSO. Доступа к Terraform-репозиториям платформы (`route66`, `route66_ldap_groups`) у него нет, поэтому конфигурация на стороне Keycloak (клиент, AD-группы) должна быть подготовлена и передана в SSO-команду как запрос. Скилл делает именно это.

Скилл работает на **любой стадии**:

- **До интеграции в код** — разработчик ещё не писал auth-код, но знает что нужен SSO. Скилл задаст вопросы (`AskUserQuestion`), сгенерирует Terraform-конфиг для DevOps и заодно покажет какие переменные окружения и redirect URI ожидать в своём приложении. Это становится спецификацией для последующей интеграции.
- **Во время интеграции** — часть кода уже есть (env-переменные, callback-роут, страница логина), часть нет. Скилл вытаскивает имеющееся (имя приложения, хост, callback-путь, кандидаты на роли) как defaults и спрашивает только недостающее.
- **После интеграции** — auth-код полностью написан, осталось только запросить у DevOps создание клиента. Скилл прочитает всё из проекта, задаст 1-2 уточняющих вопроса и сгенерирует пакет.

В любом случае на выходе — папка `keycloak-handoff/` с готовыми Terraform-сниппетами и README, которую разработчик прикладывает к тикету / PR / письму в SSO-команду. DevOps копирует файлы в свои репозитории, открывает MR, применяет, возвращает `CLIENT_SECRET` (для confidential клиентов) через корпоративный канал обмена секретами.

### Что значит "обе стороны"

Скилл покрывает обе стороны конфигурации SSO:

- **Сторона Keycloak** (`route66/`, `route66_ldap_groups/` — это и есть основная цель): Terraform-описание клиента + AD-групп для DevOps.
- **Сторона приложения**: справочник env-переменных и redirect URI в `keycloak-handoff/.env.example`, плюс finalised reference values в `keycloak-handoff/README.md` — разработчик перенесёт нужное в свой реальный `.env*` или secret manager. Сам код приложения скилл **не трогает** (это делается отдельно — вручную, через OIDC-библиотеку или через специализированный auth-скилл вроде `fastapi-react`).

## Stack-agnostic

Скилл не привязан ни к какому стеку. Поддерживает (но не ограничивается):

| Категория | Примеры |
|---|---|
| Серверные фреймворки | Spring (Boot/MVC/WebFlux), Micronaut, Quarkus, Ktor, ASP.NET Core, Express, Fastify, NestJS, Hono, FastAPI, Django, Flask, Rails, Sinatra, Phoenix, Laravel, Symfony, Gin, Echo, Fiber, Actix-web, Axum, Rocket |
| SPA / клиентские | React, Vue, Angular, Svelte, SolidJS, Qwik, Astro (static) |
| SSR / hybrid | Next.js, Nuxt, SvelteKit, Remix, Astro (SSR) |
| Mobile / native | iOS, Android, Flutter, React Native |
| OIDC-библиотеки | Auth.js / NextAuth, passport-openidconnect, openid-client, Spring Security OAuth2, Microsoft.Identity.Web, authlib, python-keycloak, mozilla-django-oidc, omniauth-keycloak, jumbojett/openid-connect-php, zitadel/oidc, openidconnect-rs |
| Reverse-proxy auth | oauth2-proxy, traefik forward-auth, Authelia, OPNsense |
| Off-the-shelf SaaS (SAML) | Jira, Confluence, SAP, SharePoint, GitLab self-hosted, Grafana, Mattermost |

Discovery опирается на manifest-файлы, конфиги, IaC и reverse-proxy конфиги — то, что есть в любом нормальном проекте независимо от языка. Если узнать ничего не удалось, скилл честно говорит "ничего не вывел из репо, спрошу всё сам" и идёт к интервью.

## Как работает

1. **Discovery** — читает проект:
   - Имя приложения из manifest-а (`package.json`, `pyproject.toml`, `pom.xml`, `go.mod`, `Cargo.toml`, `composer.json`, `Gemfile`, `mix.exs`, `*.csproj`, `Package.swift`, `pubspec.yaml`)
   - Публичный хост и base path из env-файлов, `application.{yml,properties}`, `appsettings*.json`, `helm/values*.yaml`, `k8s/*.yaml`, `docker-compose.yml`, `nginx.conf`, `Caddyfile`, `traefik.yml`
   - Callback-путь — grep по `redirect_uri`, `/oauth2/callback`, `/login/oauth2/code/`, `/api/auth/callback/`, `/signin-oidc`, `/saml/sso`, `/saml2/acs` (зависит от библиотеки — если не нашёл, спросит)
   - Кандидаты на роли — grep по `@PreAuthorize`, `@RolesAllowed`, `hasRole(`, `hasAuthority(`, `IsInRole`, `requires_role`, `roles.includes`, `realm_access`, `resource_access`
2. **Interview** — задаёт через `AskUserQuestion` только то, что не смог вывести. Каждый вопрос — это набор кнопок: первая всегда помечена `(Recommended)` и содержит либо inferred-значение (с источником в описании — `"Inferred from package.json → name"`), либо безопасный платформенный дефолт (например `realm = biocad`), либо самый частый выбор для такого типа проектов. Альтернативы — ещё 1-3 кнопки. Кнопка `Other` для ручного ввода появляется автоматически.

   Это значит: разработчик, который **не знает что выбрать**, просто жмёт первую кнопку и идёт дальше — скилл подставит разумный default. Тот, кто знает — выбирает альтернативу или вводит своё через `Other`.
3. **Confirm** — финальная сводка перед записью файлов.
4. **Generate** — пишет в `keycloak-handoff/`:
   - `<app_name>.tf` — Terraform клиента, ready-to-merge для `route66/TFCODE/`
   - `ldap-groups-snippet.tf` — блок `module "<app>"` для дописывания в `route66_ldap_groups/TFCODE/ldap_groups.tf` (только если нужны новые AD-группы)
   - `README.md` — текст запроса для DevOps-тикета: что создать, в каком порядке применять, что вернуть
   - `.env.example` — справочник ENV-переменных для информации
   - **`IDM_README.md`** — текст и ссылка на тикет IDM «Изменение данных IDM» (только если у приложения есть роли / AD-группы)
   - **`<service_name>_Новые продукты_IDM.xlsx`** — заполненный опросник IDM для прикрепления к тикету (только если есть роли / AD-группы)
5. **Hand-off** — печатает разработчику что делать дальше: куда отправить пакет, что получит обратно, как заполнить env.

## Что НЕ делает

- Не меняет код приложения — это работа других скиллов / библиотек / самого разработчика
- Не пишет в `route66/` или `route66_ldap_groups/` — у разработчика нет к ним доступа, и скилл это уважает
- Не использует legacy-конфигурацию Keycloak 26 (`implicit_flow_enabled`, `direct_access_grants_enabled`, plain PKCE, ROPC)
- Не кладёт `CLIENT_SECRET` в git ни при каких условиях
- Не угадывает значения, которых нет в проекте — спрашивает разработчика

## Использование

После установки (см. [корневой README](../README.md)) попросите AI-агента:

- "Подготовь запрос на создание клиента Keycloak для этого приложения"
- "Сгенерируй конфигурацию Keycloak SSO для DevOps"
- "Я добавил аутентификацию через Keycloak — что отправить в SSO-команду?"
- "Нужен Keycloak-клиент для нашего сервиса"

Агент пройдёт по фазам Discovery → Interview → Confirm → Generate → Hand-off, в финале покажет содержимое `keycloak-handoff/` и инструкции по передаче DevOps.

## Поддерживаемые auth-сценарии

| Сценарий | Когда |
|---|---|
| `auth_code` + `confidential` | Серверное приложение, может хранить секрет (любой backend-фреймворк, SSR, reverse-proxy auth) |
| `auth_code` + `public` (PKCE S256) | SPA / mobile / native — секрет жил бы у пользователя, поэтому secret-less + PKCE |
| `client_credentials` | Сервис-к-сервису, фоновый воркер, cron, k8s-оператор, message-queue consumer без UI |
| `saml` | Off-the-shelf SaaS, который не умеет OIDC. Если умеет — предпочесть OIDC. |

## Что DevOps должен сделать после получения handoff

Подробно расписано в `keycloak-handoff/README.md`, который генерирует скилл. Кратко:

1. *(если есть `ldap-groups-snippet.tf`)* Дописать блок в `route66_ldap_groups/TFCODE/ldap_groups.tf`, открыть MR, применить
2. Подождать AD→Keycloak sync (≤15 минут)
3. Положить `<app_name>.tf` в `route66/TFCODE/<app_name>.tf`, открыть MR, применить
4. *(для confidential / client_credentials)* Прочитать сгенерированный `CLIENT_SECRET` из Keycloak Admin UI, передать разработчику через Vault / корпоративный password-share
5. Подтвердить готовность в тикете

## Заявка в IDM (если у приложения есть роли / AD-группы)

Запрос в SSO-команду создаёт клиента Keycloak и AD-группы. Чтобы эти группы можно было назначать сотрудникам штатным порядком, систему и её доступы нужно зарегистрировать в **IDM** — это отдельный трек. Для него скилл генерирует:

- `IDM_README.md` — тело тикета: ссылка на ServiceDesk «Изменение данных IDM», текст обращения, список доступов.
- `<service_name>_Новые продукты_IDM.xlsx` — опросник (лист «Опросник») по образцу `Portal4_Новые продукты_IDM.numbers`: 12 колонок, по строке на каждый доступ, сгруппированные по контурам (Test / Stage / Prod).

Что делает разработчик:

1. Открыть тикет: <https://jira.biocad.ru/plugins/servlet/desk/portal/3/create/992> («Изменение данных IDM»).
2. Вставить текст обращения из `IDM_README.md`.
3. Приложить `<service_name>_Новые продукты_IDM.xlsx`.
4. Отправить.

**Важно:** имена AD-групп в опроснике (`KC-Role-<app>[-<env>]-<role>`) обязаны совпадать с теми, что создаёт SSO-команда через `route66_ldap_groups`. Скилл строит обе стороны из одного списка ролей через `scripts/build_idm_xlsx.py`, поэтому вручную опросник править не нужно — расхождение приведёт к тому, что IDM зарегистрирует доступ, не привязанный к реальной группе, и роль не попадёт в токен.

## Структура скилла

```
keycloak-sso-scaffold/
  README.md                                   # Этот файл
  SKILL.md                                    # Инструкции для AI-агента
  references/
    target-platform-conventions.md            # Что route66 / route66_ldap_groups ожидают
    repo-conventions.md                        # Соглашения репозиториев платформы
    keycloak-26-modern-config.md              # Не-legacy конфиг Keycloak 26
  templates/
    oidc-client.tf.tmpl                       # OIDC-клиент (auth_code public/confidential, client_credentials)
    saml-client.tf.tmpl                       # Минимальный SAML-клиент
    ldap-group-module.tf.tmpl                 # Блок для ldap_groups.tf
    env-example.tmpl                          # Справочник ENV-переменных
    handoff-readme.md.tmpl                    # README для DevOps-тикета
    mr-readme.md.tmpl                          # README для MR в платформенный репозиторий
    idm-readme.md.tmpl                         # IDM_README.md — тело тикета IDM (если есть роли)
  scripts/
    build_idm_xlsx.py                          # Генератор опросника <service>_Новые продукты_IDM.xlsx
    idm-spec.example.json                      # Пример входного spec для генератора (воспроизводит Portal4)
```

## Архитектурные решения

- **Handoff-пакет, не прямой commit.** У разработчика нет прав на платформенные репозитории — скилл это эксплуатирует, а не пытается обойти. Всё, что генерируется, лежит в его собственном репо в одной папке.
- **Stack-agnostic discovery.** Скилл опирается на универсальные сигналы: manifest-файлы, конфиги, env-файлы, IaC, reverse-proxy. Никаких предположений о Python, Node, Java, наличии Docker, monorepo-структуре. Если стек незнаком — честно говорит и идёт спрашивать.
- **Discovery-first интервью с дефолтом на каждом шаге.** Сначала вытаскивает максимум из проекта, потом задаёт вопросы только по недостающему. Каждый вопрос приходит с готовой recommended-кнопкой (либо inferred, либо платформенный дефолт, либо самый частый выбор) и показывает источник — чтобы разработчик мог либо доверять и идти дальше, либо поймать неверное предположение и поправить через альтернативу или `Other`. Никаких пустых вопросов с принуждением печатать.
- **Никакого `client_secret` в git.** Поле `client_secret` в `keycloak_openid_client` не указывается. Keycloak генерирует секрет при apply, DevOps читает его из Admin UI и передаёт через корпоративный канал обмена секретами.
- **Append-only для AD-групп.** Сниppet всегда добавляется в конец `ldap_groups.tf`. Переименование = пересоздание группы в AD = потеря членства, поэтому модули не редактируются автоматически.
- **Keycloak 26, без legacy.** Никаких implicit flow, direct access grants без явной необходимости, plain PKCE, ROPC. Public-клиенты обязательно с `pkce_code_challenge_method = "S256"`. Refusal на просьбы включить legacy с указанием на reference.
