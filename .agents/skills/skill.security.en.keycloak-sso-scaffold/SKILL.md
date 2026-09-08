---
name: keycloak-sso-scaffold
description: >-
  Prepares a developer-side DevOps hand-off package for Keycloak SSO, optional
  AD groups, and IDM role onboarding. Use when an application needs corporate
  login, OIDC/SAML client setup, Keycloak redirect URI configuration, role
  groups, or a ready `keycloak-handoff/` package for DevOps and IDM.
---

# Keycloak SSO Scaffold (developer side)

## Audience and scope

Run this skill in the **developer's application repository**, regardless of language or framework. The developer:

- needs Keycloak SSO configured for their app
- does **not** have write access to the platform Terraform repos (`route66/`, `route66_ldap_groups/`) and likely does not have those repos checked out at all
- needs the SSO platform team ("DevOps") to create the matching client + AD groups so the app can actually authenticate

### The skill works at any stage

| Stage | What the skill does |
|---|---|
| **Before** auth code is written | Treats every parameter as `null`, asks the developer with sensible defaults (`AskUserQuestion`), and produces both the DevOps hand-off and a clear set of env vars / redirect URIs the developer will use later as the spec for their integration. |
| **During** integration | Discovers what's already in the repo (env files, callback paths, role checks), uses each finding as a default in the interview, asks only the unresolved gaps. |
| **After** integration is complete | Reads everything from the project, asks 1–2 confirmation questions, generates the hand-off. |

The skill produces a **hand-off package** the developer attaches to a Jira / Slack / email / MR request. DevOps copies the snippets into their repos, opens MRs, applies, and returns a `CLIENT_SECRET` (for confidential clients) through a secure channel.

### Both sides of the SSO config

- **Keycloak side** *(primary deliverable)*: Terraform for `route66/TFCODE/<app>.tf` and an append-snippet for `route66_ldap_groups/TFCODE/ldap_groups.tf`, both in the hand-off package for DevOps.
- **Application side** *(reference output)*: a snapshot of env vars and redirect URIs in `keycloak-handoff/.env.example` plus reference values in `keycloak-handoff/README.md` — the developer copies what they need into their real `.env*` / secret manager. This skill **does not** modify the application source code; that is done separately (by hand, via an OIDC library, or via a stack-specific auth skill).

### Stack-agnostic

No assumption about Python, Node, Java, Go, .NET, monorepo layout, Docker presence, or any specific OIDC library. Discovery uses well-known manifest names across ecosystems and falls back to asking when nothing can be inferred.

### Repo isolation

The skill **never** writes into `route66/` or `route66_ldap_groups/`. Those paths are referenced only inside generated comments so DevOps knows where to land each snippet.

## Output

Everything lands under `keycloak-handoff/` at the developer's repo root. The skill never touches application source code.

| File | What DevOps does with it |
|---|---|
| `keycloak-handoff/<app_name>.tf` | Drop in as `route66/TFCODE/<app_name>.tf` |
| `keycloak-handoff/ldap-groups-snippet.tf` *(only if new AD groups)* | Append the `module "<app_name>"` block to the end of `route66_ldap_groups/TFCODE/ldap_groups.tf`. Never reorder existing modules. |
| `keycloak-handoff/README.md` | Plain-English request: what was generated, why, in what order to apply, what to send back, full verification checklist |
| `keycloak-handoff/.env.example` | Copy of the Keycloak vars the developer's app expects — for DevOps awareness only; the developer keeps the real `.env*` in the repo where it already lives |
| `keycloak-handoff/IDM_README.md` *(only if roles / AD groups)* | Body of the IDM ServiceDesk ticket "Изменение данных IDM" — links the ticket, holds the request text and the list of accesses |
| `keycloak-handoff/<service_name>_Новые продукты_IDM.xlsx` *(only if roles / AD groups)* | The IDM "Опросник" questionnaire to attach to that ticket — one row per access, grouped by contour |

**Two separate tracks.** The first four files go to the **SSO platform team** (they create the Keycloak client + AD groups via Terraform). The two `IDM_*` files go to the **IDM team** via the ServiceDesk ticket — they register the system and its accesses in IDM so the AD groups can actually be granted to people. The AD-group names must be identical across both tracks (see Hard rule 9).

If `keycloak-handoff/` already exists, **never overwrite silently**. Show a diff for each file and ask for explicit confirmation before replacing.

## Process

### Phase 0 — Discover the app's intent (stack-agnostic)

Read the project before asking anything. The goal is to fill in as many parameters as possible so the interview is short. Treat every signal as a hint, never as proof. **Never invent values.**

Skim files in priority order. Stop when you have enough to draft a profile.

#### App identity

First non-empty hit wins:

1. **Manifest files** (any of these, root or first nested workspace):
   - `package.json` → `name` (Node, deno, bun)
   - `pyproject.toml` → `[project].name` or `[tool.poetry].name`; `setup.py` / `setup.cfg` → `name=`; `Pipfile` parent dir
   - `pom.xml` → `<artifactId>`; `build.gradle` / `build.gradle.kts` → `rootProject.name`
   - `go.mod` → module path basename
   - `Cargo.toml` → `[package].name`
   - `composer.json` → `name`
   - `Gemfile` + `*.gemspec` → `spec.name`
   - `mix.exs` → `app:`
   - `*.csproj` / `*.fsproj` → `<AssemblyName>` or filename
   - `Package.swift` → `name:` in `Package(...)`
   - `pubspec.yaml` → `name:` (Dart/Flutter)
2. Top-level `README.md` heading
3. Repository directory basename

Normalize to kebab-case for `client_id` / `system_name` (`MyApp_Service` → `my-app-service`). Lowercase, no spaces.

#### Public URLs and callback path

These determine `valid_redirect_uris` and `web_origins`. They are the values the skill is **most likely to need to ask** because they vary completely by deployment.

Search anywhere in the tree for:

1. **Env files**: `.env`, `.env.example`, `.env.template`, `.env.local`, `.env.dev`, `.env.production`, `.envrc`
2. **Config formats**:
   - `config/*.{yml,yaml,toml,ini,json,js,ts,py,exs}`
   - `application.{yml,yaml,properties}`, `bootstrap.{yml,yaml}` (Spring / Micronaut)
   - `appsettings*.json` (.NET)
   - `nest-cli.json`, `next.config.{js,ts,mjs}`, `nuxt.config.*`, `vite.config.*`, `astro.config.*`
   - `wrangler.toml` (Cloudflare), `fly.toml`, `render.yaml`, `vercel.json`
3. **IaC / orchestration**:
   - `Dockerfile`, `docker-compose*.{yml,yaml}`
   - `helm/values*.yaml`, `Chart.yaml`, `k8s/**/*.yaml`, `kustomization.yaml`
   - `*.tf`, `*.tfvars`, `serverless.yml`, `sam.yaml`, `cdk.json`
4. **Reverse proxies**: `nginx.conf`, `*.nginx`, `Caddyfile`, `traefik.{yml,yaml}`, `haproxy.cfg`, `apache2.conf`, `*.htaccess`
5. **Code grep** for any of:
   - Env var refs: `KEYCLOAK_*`, `OIDC_*`, `OAUTH_*`, `OPENID_*`, `AUTH_*`, `IDP_*`, `SSO_*`
   - Field names: `redirect_uri`, `redirect-uri`, `redirectUri`, `redirect_uris`, `RedirectUris`, `post_logout_redirect_uri`
   - Path strings: `/auth/callback`, `/oauth/callback`, `/oauth2/callback`, `/login/oauth2/code/`, `/api/auth/callback/`, `/signin-oidc`, `/saml/sso`, `/saml2/acs`

The callback path is **library-specific**. Common defaults (do not guess unless you find a signal):

| Library / framework | Default callback |
|---|---|
| Auth.js / NextAuth | `/api/auth/callback/<provider>` |
| Spring Security OAuth2 client | `/login/oauth2/code/<registration-id>` |
| ASP.NET OpenIdConnect handler | `/signin-oidc` |
| oauth2-proxy | `/oauth2/callback` |
| passport-openidconnect | custom (often `/auth/callback`) |
| omniauth-keycloak | `/auth/keycloak/callback` |
| python-keycloak / authlib (FastAPI/Flask/Django) | custom (often `/auth/callback`, `/oidc/callback`) |
| Keycloak JS / Keycloak Java adapter | varies; usually the app's own routes |
| Microsoft.Identity.Web | `/signin-oidc` |
| Pac4j | `/callback` |

If no callback path is declared in the project, **ask in Phase 1** — do not pick one.

#### Auth scenario

Decide based on the combination of signals. Each is a hint:

- **Server-side framework that handles HTTP requests + sets cookies / sessions** → `auth_code` + `confidential`. Heuristic markers across ecosystems:
  - Node: Express, Fastify, NestJS, Hono, Koa, Hapi, AdonisJS, RemixJS server
  - Python: FastAPI, Django, Flask, Starlette, Pyramid, Tornado, Sanic
  - Java/Kotlin: Spring (Boot/MVC/WebFlux), Micronaut, Quarkus, Ktor, Vert.x, Helidon
  - Go: net/http, Gin, Echo, Fiber, Chi, Buffalo, Gorilla
  - .NET: ASP.NET Core (MVC/Razor/Blazor Server)
  - PHP: Laravel, Symfony, CodeIgniter, Slim
  - Ruby: Rails, Sinatra, Hanami
  - Elixir: Phoenix, Plug
  - Rust: Actix-web, Axum, Rocket, Warp
- **Frontend-only project** (no backend in repo, static-host build output) → `auth_code` + `public` + PKCE S256. Markers:
  - React/Vue/Angular/Svelte/SolidJS/Qwik/Astro static
  - `dist/`, `build/`, `out/` as the only deploy artifact
  - No server route handlers, no cookie/session libraries
- **Hybrid (Next.js / Nuxt / SvelteKit / Remix with server)** — if there's a server runtime, treat as confidential.
- **Mobile / native** (iOS, Android, Flutter, React Native) → `auth_code` + `public` + PKCE S256, with a custom-scheme redirect URI (`com.example.app:/oauth/callback`).
- **Background worker / cron / CLI / k8s operator / message-queue consumer with no UI** → `client_credentials`.
- **Configuring an off-the-shelf SaaS** the company runs (Jira, Confluence, SAP, SharePoint, GitLab self-hosted, Grafana, Mattermost, Outline, etc.) where the product only speaks SAML 2.0 → `saml`. If the product also supports OIDC, prefer OIDC.

#### Roles

Each unique role string passed to a role-checking function is a candidate AD group. Patterns to grep for, in order of confidence:

1. **Annotations / decorators**: `@PreAuthorize`, `@RolesAllowed`, `@Secured`, `@HasRole`, `@requires_role`, `@authorize`, `[Authorize(Roles = ...)]`
2. **Function calls**: `hasRole(`, `hasAuthority(`, `inRole(`, `IsInRole(`, `requireRole(`, `requires_role(`, `check_role(`
3. **Inline checks**: `roles.includes(`, `roles.contains(`, `'admin' in roles`, `if role ==`, `match role`
4. **JWT claim references**: `realm_access`, `resource_access`, `claims['roles']`, `decoded.roles`, `token.roles`
5. **RBAC tables / config files**: `roles/`, `permissions/`, `authorization.{yml,json}`, `casbin*`

If no roles are found in code, the developer may still want them — ask in Phase 1 with `needs_roles: false` as the default.

#### Compile a profile

Build a structured `app_profile`. Show the inference source for every non-null field so the developer can spot a wrong guess.

```
app_name:        my-app                       (source: <manifest file path>)
external_host:   https://my-app.biocad.ru     (source: <config/ingress/env file path>)
callback_path:   <library-specific path>      (source: <code grep hit>)
auth_scenario:   auth_code                    (source: <signal description>)
client_type:     confidential | public        (source: <signal description>)
candidate_roles: [admin, viewer]              (source: <annotation/grep hit>)
unresolved:      [redirect_uris, web_origins] (will ask in Phase 1)
```

#### Failure mode — empty / unrecognised project

If discovery yields nothing (empty repo, only a README, unfamiliar stack), **say so explicitly** to the developer:

> "I couldn't infer anything from this repository. I'll ask each parameter from scratch."

Then proceed to Phase 1 and ask everything. Do not block; do not invent.

### Phase 1 — Interview (only what is missing)

Use the `AskUserQuestion` tool. Group questions in batches of 1–4 questions per call. Each question takes 2–4 options; the system **automatically** appends an `Other` option for free-form input — never add it yourself. Do **not** ask questions whose answer is unambiguous from Phase 0.

#### Question phrasing — mandatory pattern

Every question must have a clear recommended default so a developer who has no opinion can pick it and move on without typing.

1. **First option = the default**, with `(Recommended)` appended to the label.
2. **Description shows the source** of the default — "Inferred from `package.json` → `name`", "Platform default — only realm with application clients", "Most common choice for backend services".
3. **Add 1–3 alternatives** so the developer can pick a different valid answer with one click instead of typing.
4. **No `Other` in your options list** — it appears automatically. Use `Other` mentally as the escape hatch for genuine custom values (specific URIs, role names, etc.).

When Phase 0 inferred a value, use it as the default. When it didn't, fall back to:

- a hard platform default (e.g. `realm = biocad`, `base_ou = OU=keycloak,...,DC=biocad,DC=loc`)
- the most common choice for the kind of project detected (e.g. `confidential` for any backend service)
- the safest choice (e.g. `groups_already_exist = no` — DevOps will deduplicate during review)

**Never write a question without a recommended option.** A blank question forces the developer to type, which defeats the point of discovery.

#### Phrasing examples

These are the canonical shapes — adapt the actual labels and descriptions to the discovered project.

**App name** (default = inferred from manifest):

```
question:  "What should the Keycloak client_id and AD system_name be?"
header:    "Client ID"
options:
  - label:       "my-app (Recommended)"
    description: "Inferred from package.json -> name. Already kebab-case, fits Keycloak."
  - label:       "my-app-prod"
    description: "Add an environment suffix if you'll have separate dev/test/prod clients."
  - label:       "<repo-dir-basename>"
    description: "Use the repository directory name instead."
# Other -> custom value typed by the developer
```

**Realm** (no inference possible — hard platform default):

```
question:  "Which Keycloak realm should the client live in?"
header:    "Realm"
options:
  - label:       "biocad (Recommended)"
    description: "Only realm with application clients today. AD-backed corporate users."
  - label:       "external"
    description: "Public registration realm. Pick this only if your app must self-register users."
```

**Auth scenario** (default = inferred from stack):

```
question:  "Which OAuth flow does this application use?"
header:    "Auth flow"
options:
  - label:       "Authorization Code (Recommended)"
    description: "<stack-specific reason>, e.g. 'Server-side framework + cookies detected'."
  - label:       "Client Credentials"
    description: "Service-to-service / cron / worker. No UI."
  - label:       "SAML 2.0"
    description: "Off-the-shelf SaaS that doesn't speak OIDC."
```

**Client type** (default = inferred from stack):

```
question:  "Public or confidential client?"
header:    "Client type"
options:
  - label:       "Confidential (Recommended)"
    description: "Backend service detected — secret stays server-side. Get CLIENT_SECRET from DevOps."
  - label:       "Public + PKCE"
    description: "SPA / mobile / native. No secret; PKCE S256 enforced."
```

**Roles** (default = use the inferred candidate list):

```
question:  "Use these roles for the client?"
header:    "Roles"
options:
  - label:       "admin, viewer, editor (Recommended)"
    description: "Inferred from <signal>, e.g. '@PreAuthorize annotations across 4 files'. Pick Other to edit."
  - label:       "Skip roles for now"
    description: "Create the client without roles. Can be added later by DevOps."
# Other -> developer types a custom comma-separated list
```

**Groups already exist?** (no inference — safest default):

```
question:  "Do AD groups for this app already exist in route66_ldap_groups?"
header:    "AD groups"
options:
  - label:       "No — please create them (Recommended)"
    description: "If unsure, pick this. DevOps will deduplicate during review."
  - label:       "Yes — already there"
    description: "Pick only if DevOps confirmed module 'my-app' already exists in ldap_groups.tf."
```

**Free-form values** (redirect URIs, web origins, audience): default = inferred composition. The developer most often picks `Other` here, so make the default option self-contained and copy-pasteable:

```
question:  "Confirm the redirect URI for the OAuth callback?"
header:    "Redirect URI"
options:
  - label:       "https://my-app.biocad.ru/api/auth/callback (Recommended)"
    description: "Inferred from EXTERNAL_HOST + callback path detected in code."
  - label:       "Add localhost for dev"
    description: "Adds http://localhost:8080/api/auth/callback alongside the prod URI."
# Other -> developer pastes / types the actual list
```

#### Batches

Group up to 4 related questions per `AskUserQuestion` call:

- **Batch 1**: app_name, realm, auth_scenario, client_type
- **Batch 2** *(depends on auth_scenario)*: redirect_uris, web_origins, needs_roles (or SAML-specific endpoints)
- **Batch 3** *(only if needs_roles)*: roles list, groups_already_exist
- **Batch 4** *(only if needs_roles — IDM access request)*: system_display_name, owner, environments, per-role sensitivity flags

If a question genuinely has no good 2–4 option set (rare — usually you can craft one default + 1–2 alternatives), drop it from the batch and ask as free-form text after the batch.

#### Question content

The actual parameters to gather:

**Batch A — Identity & flow** (always run; fields prefilled from Phase 0):

1. `app_name` — short kebab-case identifier, used as Keycloak `client_id` and AD `system_name`. Default: inferred. Show the inference source.
2. `realm` — default `biocad`. Only ask if the project hints at external/customer realm.
3. `auth_scenario` — `auth_code` / `client_credentials` / `saml`. Default: inferred from stack.
4. `client_type` *(only if `auth_scenario == auth_code`)* — `public` or `confidential`. Default: inferred.

**Batch B — Endpoints** (only the ones not inferred):

If `auth_code`:
- `redirect_uris` — list. Default: `[<external_host><base_path>api/auth/callback]` if all parts inferred. Allow add/remove. Reject `*` wildcards in production URIs.
- `web_origins` — list. Default: `[<external_host>]`. `+` to mirror redirect URIs is allowed; `*` is not.
- `post_logout_redirect_uris` — optional, default `[<external_host><base_path>]`.

If `client_credentials`:
- `service_audience` — optional, the `client_id` of the API the service will call. Skip if the developer is unsure.

If `saml`:
- `sp_entity_id` — usually the SP base URL.
- `acs_url` — Assertion Consumer Service URL.
- `name_id_format` — default `username`.
- Inform the developer: SAML signing/encryption keys are managed by DevOps via `var.saml_*` variables and will not appear in this hand-off.

**Batch C — Roles & AD groups** (skip entirely for `client_credentials` with no roles in the codebase):

1. `needs_roles` — yes/no. Default yes if Phase 0 found role checks in code.
2. `roles` — list of `{name, description}`. Default: candidate roles from Phase 0. Names lowercase, kebab/dot-case (`admin`, `viewer`, `kv-admin`).
3. `groups_already_exist` — yes/no. Tell the developer: ask DevOps before answering yes; if unsure, answer no and DevOps will deduplicate.
4. *(if creating)* `base_ou` — default `OU=keycloak,OU=Groups,OU=biocad,DC=biocad,DC=loc`. Only override if DevOps told the developer to.

**Batch D — IDM access request** (only if `needs_roles == yes`; this drives `IDM_README.md` and the `*_Новые продукты_IDM.xlsx` questionnaire):

1. `system_display_name` — human-readable system name shown in the "Наименование системы или бизнес-сервиса" column and the IDM ticket title (e.g. `Portal 4.0`). Default: a Title-Cased form of `app_name`. The machine `app_name` is still used to build AD-group names.
2. `owner` — corporate email of the access owner ("Владелец" column). Default: the developer's own email if known, else ask. Required — IDM rejects an empty owner.
3. `environments` — which deployment contours get their own accesses. Default `test, stage, prod` (matches the reference file). Each contour multiplies the role list and inserts its key into the AD-group name (`KC-Role-<app>-<env>-<role>`). The developer may pick a single contour (then groups are `KC-Role-<app>-<role>`, flat).
4. `roles[].sensitivity` — for each role, three Yes/No flags: `commercial_secret` ("Доступ к коммерческой тайне"), `personal_data` ("Доступ к персональным данным"), `admin_privileges` ("Административные привилегии"). Default heuristic: a role whose name/description reads as admin/owner/manage → all three `Да`; a plain user/viewer/reader role → all three `Нет`. Always show the guess; the developer confirms or flips per role.

Fields the developer rarely changes (use the platform defaults, mention them in the Phase 2 summary, let the developer override via `Other`):

- `approval_order` — default `руководитель -> владелец  > ИБ`.
- `confirmers` — default `-`.
- `location_binding` — default `Нет`.
- `related_access` — default `Нет`.

### Phase 2 — Confirm before writing

Before any file write, summarize back to the developer:

- The full file list to be written under `keycloak-handoff/`, with absolute paths (including `IDM_README.md` and `<service_name>_Новые продукты_IDM.xlsx` when roles are present)
- The final values of every parameter (especially redirect URIs, web origins, role list)
- The resulting AD group names: `KC-Role-<lower(app_name)>-<lower(role_name)>`, or `KC-Role-<lower(app_name)>-<env>-<lower(role_name)>` when multiple contours were chosen. These must be identical in the LDAP snippet and the IDM questionnaire.
- *(if roles)* The IDM access matrix: for each contour × role, the access name, the three sensitivity flags, and the AD group
- An explicit note: `client_secret` will **not** be written to git; DevOps reads it from Keycloak after apply and hands it back through the corporate secret-sharing channel

Ask for explicit "go ahead" before writing. If the dev wants to tweak — go back to Phase 1, change only the affected answers, re-confirm.

### Phase 3 — Generate the hand-off

Render templates into `keycloak-handoff/`:

1. **Client TF** — pick `templates/oidc-client.tf.tmpl` for `auth_code` / `client_credentials`, or `templates/saml-client.tf.tmpl` for `saml`. Write to `keycloak-handoff/<app_name>.tf`. The template's header comment instructs DevOps to drop the file at `route66/TFCODE/<app_name>.tf`.
2. **AD groups snippet** — only if `needs_roles == yes` AND `groups_already_exist == no`. Render `templates/ldap-group-module.tf.tmpl` to `keycloak-handoff/ldap-groups-snippet.tf`. Header comment: "APPEND this block at the end of `route66_ldap_groups/TFCODE/ldap_groups.tf` — do not reorder existing modules, do not create a new file."
3. **Hand-off README** — render `templates/handoff-readme.md.tmpl` to `keycloak-handoff/README.md`. This is the document the developer will paste / link in the DevOps ticket.
4. **`.env.example` reference** — render `templates/env-example.tmpl` to `keycloak-handoff/.env.example`. The developer's *real* `.env*` lives wherever their app expects it; this copy is a snapshot of what variables the app needs from DevOps.
5. **IDM access-request package** — *only if `needs_roles == yes`* (the app has roles / AD groups). Two files:
   - **IDM questionnaire** — assemble a JSON spec from the interview answers (shape documented in `scripts/idm-spec.example.json`) and run the generator:
     ```
     python3 scripts/build_idm_xlsx.py --spec <spec.json> --out "keycloak-handoff/<service_name>_Новые продукты_IDM.xlsx"
     ```
     `<service_name>` is the `system_display_name` (e.g. `Portal4`). The script reproduces the corporate "Опросник" layout: 12 columns with verbatim Russian headers (keep the original spelling, including "Привелегии"), one row per `contour × role`, blank separator rows between contours, and the AD-group column derived the **same way** as the LDAP snippet. Do not hand-build the `.xlsx` — always go through the script so the layout and naming stay consistent.
   - **IDM README** — render `templates/idm-readme.md.tmpl` to `keycloak-handoff/IDM_README.md`. It links the ServiceDesk ticket (`https://jira.biocad.ru/plugins/servlet/desk/portal/3/create/992`), carries the request text, lists every access, and tells the developer to attach the `.xlsx`.

After writing, run `terraform fmt` mentally on each `.tf`: 2-space indent, aligned `=` within blocks, trailing newline. The platform repo's CI runs `gitlab-terraform fmt` and DevOps will reject mis-formatted snippets.

The AD groups listed in the `.xlsx` and `IDM_README.md` **must** byte-for-byte match the `CN`s the LDAP snippet creates. Build all three (LDAP snippet, xlsx, IDM README) from the same role list + contour list so they cannot drift (Hard rule 9).

### Phase 4 — Hand-off summary

Print to the developer:

```
✅ Generated under keycloak-handoff/:
   <app_name>.tf
   ldap-groups-snippet.tf                    [only if applicable]
   README.md
   .env.example
   IDM_README.md                             [only if roles / AD groups]
   <service_name>_Новые продукты_IDM.xlsx    [only if roles / AD groups]

📨 How to deliver to DevOps (Keycloak client + AD groups):
   1. Commit keycloak-handoff/ to a branch (or attach the folder to the ticket)
   2. Open a request with the SSO platform team. Paste keycloak-handoff/README.md
      as the ticket body or link the file from the MR description.
   3. The expected DevOps actions are listed in that README — they apply in two
      Terraform repos you do not have access to.

🪪  How to deliver to IDM (only if roles / AD groups — register accesses):
   1. Open the IDM ServiceDesk ticket "Изменение данных IDM":
      https://jira.biocad.ru/plugins/servlet/desk/portal/3/create/992
   2. Paste the request text from IDM_README.md as the ticket body.
   3. Attach <service_name>_Новые продукты_IDM.xlsx.
   4. The AD groups in the xlsx must match the ones DevOps creates — submit after
      (or alongside) the SSO request, but accesses only work once the groups exist.

🔐 What you get back from DevOps:
   - For confidential / client_credentials clients: a CLIENT_SECRET delivered
     through the corporate secret-sharing tool (Vault / password share). NOT
     git, Slack, email, or ticket comments.
   - Confirmation that AD groups are created and replicated into Keycloak
     (sync runs every 15 minutes).

▶️  Next step on your side:
   - Once DevOps confirms apply is green and you have CLIENT_SECRET (if any),
     fill the corresponding values in your real .env* file.
   - Test the login flow end-to-end. The Keycloak discovery endpoint is:
     https://route66.biocad.ru/realms/<realm>/.well-known/openid-configuration
```

## Hard rules

These are not opinions. The skill must enforce them; if a developer asks to break one, refuse and explain why — they can still raise an exception with the SSO platform team.

1. **Never write into `route66/` or `route66_ldap_groups/`.** The developer does not own those repos. All output goes into `keycloak-handoff/` in the current repo.
2. **No legacy flows.** Never set `implicit_flow_enabled = true`. Never set `direct_access_grants_enabled = true`. Public clients always get `pkce_code_challenge_method = "S256"`. Reasoning and exceptions: `references/keycloak-26-modern-config.md`.
3. **No `client_secret` in git.** Omit `client_secret` entirely from the generated `keycloak_openid_client`. Keycloak auto-generates one; DevOps hands it over out-of-band. The hardcoded UUIDs visible in some legacy files inside `route66` are mistakes — do not replicate them.
4. **AD group naming is mechanical.** Always `KC-Role-<lower(app_name)>-<lower(role_name)>`. The `system_name` in the LDAP module always equals the `app_name`. Mismatches break role mapping silently — Keycloak will not error, claims just won't appear in tokens.
5. **No per-app file in `route66_ldap_groups/`.** All AD-group modules live in the single `ldap_groups.tf` in that repo. Generate a *snippet* for DevOps to append; do not pretend a new file is acceptable.
6. **Append-only for AD groups.** Existing modules and existing `groups = [...]` entries in `ldap_groups.tf` are never reordered or renamed. Renaming recreates the AD group and drops user memberships.
7. **Browser flow binding override is mandatory** for OIDC clients in the `biocad` realm:
   ```hcl
   authentication_flow_binding_overrides {
     browser_id = keycloak_authentication_flow.custom-browser-login.id
   }
   ```
8. **Don't fabricate.** If Phase 0 cannot infer a value (e.g., the app has no docker-compose and no env template), ask the developer in Phase 1. Never guess redirect URIs from thin air.
9. **IDM and AD groups must match.** When the IDM package is generated, the AD-group names in the `.xlsx` and `IDM_README.md` must be byte-for-byte identical to the `CN`s the LDAP snippet creates (`KC-Role-<lower(app)>[-<env>]-<lower(role)>`). Generate all of them from one shared role + contour list via `scripts/build_idm_xlsx.py` — never hand-edit the spreadsheet. A mismatch means IDM registers an access that maps to no real group, and the role silently never appears in tokens. The IDM ticket link is fixed: `https://jira.biocad.ru/plugins/servlet/desk/portal/3/create/992`.

## Heuristics for ambiguous answers

Cross-language disambiguation. Each rule is a default — the developer can override.

- "I want OAuth2" / "I want SSO" → `auth_code`. Disambiguate `public` vs `confidential` by where the secret can live: backend service that holds secrets → `confidential`; SPA / mobile / native client where the secret would ship to the user → `public` + PKCE S256.
- **Common OIDC libraries → flow defaults** (use only as a hint; verify with code/config):
  - JS/TS: Auth.js / NextAuth, openid-client, oidc-client-ts, oauth4webapi, passport-openidconnect → `auth_code` + (confidential if there's a server runtime, else public)
  - Python: authlib, python-keycloak, fastapi-keycloak, django-allauth, python-social-auth, mozilla-django-oidc → `auth_code` + confidential
  - Java / Kotlin: Spring Security OAuth2 client, Keycloak Java adapters, Pac4j, Micronaut Security OAuth → `auth_code` + confidential
  - Go: zitadel/oidc, coreos/go-oidc, golang.org/x/oauth2 → `auth_code` + confidential
  - .NET: Microsoft.AspNetCore.Authentication.OpenIdConnect, IdentityModel, Microsoft.Identity.Web → `auth_code` + confidential
  - PHP: jumbojett/openid-connect-php, league/oauth2-client, laravel/socialite, web-auth/oauth2-client → `auth_code` + confidential
  - Ruby: omniauth-keycloak, omniauth-openid-connect → `auth_code` + confidential
  - Elixir: ueberauth_oidc, openid_connect → `auth_code` + confidential
  - Rust: openidconnect-rs, oauth2 → `auth_code` + confidential
  - Frontend SPAs (React/Vue/Angular/Svelte/SolidJS/Qwik) without a server runtime → `auth_code` + public + PKCE S256
  - Mobile (iOS / Android / Flutter / React Native) → `auth_code` + public + PKCE S256 with a custom-scheme redirect URI
  - Reverse-proxy auth (oauth2-proxy, traefik forward-auth, OPNsense, Authelia) → `auth_code` + confidential — the proxy holds the secret
- "Service to call our API, no UI" / "background worker" / "cron" / "Kubernetes operator" / "message-queue consumer" → `client_credentials`.
- "Configuring Jira / Confluence / SAP / SharePoint / GitLab self-hosted / Grafana / Mattermost" → check first whether the product also supports OIDC (most modern ones do); prefer OIDC. Fall back to `saml` only if the product is OIDC-blind.
- Developer asks for ROPC / direct access grants → refuse, point at `references/keycloak-26-modern-config.md`. For genuine CLI / headless cases, suggest the OAuth 2.0 Device Authorization Grant or `client_credentials` with a service identity. Otherwise, escalate to the SSO platform team for an exception.
- Developer asks for implicit flow → refuse. Use `auth_code` + PKCE S256.

## References

- `references/target-platform-conventions.md` — what the platform Terraform repos expect (paths, modules, mappers, naming). The generated TF must match these conventions exactly so DevOps can drop it in without rewriting.
- `references/keycloak-26-modern-config.md` — exact attribute matrix per scenario, what counts as legacy in Keycloak 26, and why each flag is set the way it is.

## Templates

- `templates/oidc-client.tf.tmpl` — OIDC client (covers `auth_code` public, `auth_code` confidential, `client_credentials`).
- `templates/saml-client.tf.tmpl` — minimal SAML client; signing keys are added separately by DevOps.
- `templates/ldap-group-module.tf.tmpl` — `module "<app_name>"` block to **append** to `ldap_groups.tf`.
- `templates/env-example.tmpl` — Keycloak vars the developer's app needs.
- `templates/handoff-readme.md.tmpl` — the README that lives in `keycloak-handoff/` and doubles as the DevOps ticket body.
- `templates/idm-readme.md.tmpl` — `IDM_README.md`; the body of the IDM ServiceDesk ticket, generated only when the app has roles / AD groups.

## Scripts

- `scripts/build_idm_xlsx.py` — generates the `<service_name>_Новые продукты_IDM.xlsx` "Опросник" from a JSON spec (`openpyxl`). Run only when the app has roles. Reproduces the corporate reference layout and derives AD-group names identically to the LDAP snippet.
- `scripts/idm-spec.example.json` — documented example spec (reproduces the reference `Portal4_Новые продукты_IDM` file). Copy its shape, fill from the interview answers, feed to the generator.
