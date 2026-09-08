---
name: dokploy-repo-prep
description: >-
  Prepare a Git repository for deployment on Dokploy (Docker Compose mode) with
  best-practice Dockerfile, docker-compose.yml, environment variable templates,
  and supporting files. Outputs recommendations in Russian. Use when the user
  wants to deploy an app to Dokploy, prepare a repo for Dokploy, create a
  Dockerfile or docker-compose.yml for Dokploy, or onboard onto the Dokploy
  platform. Также срабатывает на: задеплоить приложение в Dokploy,
  подготовить репозиторий для Dokploy, создать Dockerfile для Dokploy,
  настроить docker-compose для Dokploy, онбординг в Dokploy.
---

# Dokploy Repository Preparation

Restructure any application source code into a Dokploy-ready Git repository.
All user-facing recommendations and comments in generated files MUST be in Russian.

## Hard Constraints

1. **NEVER use the word "production"** in any generated file or recommendation.
   Dokploy is a sandbox platform. Use "staging", "development", or omit the term.
2. **Dockerfile must follow official Docker best practices.**
   All generated Dockerfiles must comply with [Best practices for writing Dockerfiles](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/) from Docker documentation. When in doubt, consult the source.
3. **Prefer named volumes and Dockerfile COPY for persistence.**
   Do NOT use `./` relative paths in compose volumes — they break on AutoDeploy.
   If an app needs config files from the repo, COPY them in the Dockerfile build stage.
   Do NOT suggest `../files/` bind mounts or Dokploy File Mounts (`Advanced → Mounts`)
   to users — keep things simple and self-contained in compose + Dockerfile.

## When to Use

- User wants to deploy an existing app to Dokploy / Пользователь хочет задеплоить приложение в Dokploy
- User asks to "prepare repo for Dokploy" / «подготовить репозиторий для Dokploy»
- User needs a Dockerfile + docker-compose.yml for Dokploy / Нужен Dockerfile и docker-compose.yml для Dokploy
- User asks how to start using Dokploy (onboarding) / Как начать работу с Dokploy (онбординг)
- User asks to create or fix a Dockerfile for Dokploy / Создать или исправить Dockerfile для Dokploy

## Workflow

```
Task Progress:
- [ ] Step 1: Analyze the source code
- [ ] Step 2: Generate Dockerfile
- [ ] Step 3: Generate docker-compose.yml
- [ ] Step 4: Generate supporting files (.env.example, .dockerignore, .gitignore)
- [ ] Step 5: Generate DEPLOY.md (platform engineer guide)
- [ ] Step 6: Generate README.md (only if missing)
- [ ] Step 7: Validate the result
- [ ] Step 8: Provide onboarding instructions
```

### Step 1: Analyze the Source Code

Identify:
- Language / framework / runtime
- Package manager and lockfile
- Build command and output directory
- Application listen port and host binding (must be `0.0.0.0`)
- Required environment variables (DB, API keys, feature flags)
- Static assets or config files that need mounting
- Whether the app is a monorepo

### Step 2: Generate Dockerfile

Follow [official Dockerfile best practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/) — layer caching, minimal layers, pinned base image tags, `.dockerignore`, non-root user, multi-stage builds.

Dokploy-specific requirements (source: [Dokploy Build Type docs](https://docs.dokploy.com/docs/core/applications/build-type)):

1. **Multi-stage build** — separate builder and runtime stages
2. **Non-root user** — create and switch to a dedicated user in the runtime stage
3. **Minimal final image** — copy only build artifacts, no dev dependencies
4. **EXPOSE directive** — declare the application port
5. **Listen on `0.0.0.0`** — NOT `127.0.0.1` (source: [Troubleshooting](https://docs.dokploy.com/docs/core/troubleshooting))
6. **HEALTHCHECK instruction** — `curl` or `wget` based check on the app port.
   **Always use `127.0.0.1`, NEVER `localhost`** — BusyBox `wget` in Alpine resolves
   `localhost` via DNS, which fails in non-root container contexts with "Connection refused".

Template:

```dockerfile
FROM <base>:<tag> AS builder
WORKDIR /app
COPY <lockfile> <manifest> ./
RUN <install-deps>
COPY . .
RUN <build-command>

FROM <base>:<tag>-slim AS runtime
RUN addgroup --system app && adduser --system --ingroup app app
WORKDIR /app
COPY --from=builder --chown=app:app /app/<output> ./<output>
USER app
EXPOSE <port>
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:<port>/health || exit 1
CMD ["<start-command>"]
```

### Step 3: Generate docker-compose.yml

Follow Dokploy-specific rules (source: [Docker Compose docs](https://docs.dokploy.com/docs/core/docker-compose), [Domains docs](https://docs.dokploy.com/docs/core/docker-compose/domains), [Troubleshooting](https://docs.dokploy.com/docs/core/troubleshooting)):

**Mandatory rules:**

| Rule | Rationale | Source |
|------|-----------|--------|
| Ports: short syntax only `- "<port>"` | No host binding; Traefik routes traffic. Host-bound ports cause conflicts. | Troubleshooting: "Docker Compose Domain Not Working?" |
| No `container_name` | Breaks Dokploy logs, metrics, and scaling | Compose Example docs |
| Environment vars: inline `environment:` with `${VAR}` syntax | Dokploy writes UI env vars to `.env`; referenced via `${VAR}` | Docker Compose → Environment |
| No `env_file` directive | Admin sets variables in Dokploy UI; `env_file` duplicates/conflicts | Platform convention |
| Volumes: named volumes only | Dokploy clears repo dir on each AutoDeploy (`git clone`). Repo-relative paths (`./`) break. All persistent data must use named volumes declared in compose. | Troubleshooting: "Using Files from Your Repository" |
| `restart: unless-stopped` | Keeps containers alive after crashes | Docker best practice |
| Healthcheck per service | Broken healthchecks block domain routing | Troubleshooting: domains not working |

**Security rules for sandbox / multi-tenant environment:**

| Rule | Rationale |
|------|-----------|
| No `privileged: true` | Prevents container escape |
| No `network_mode: host` | Prevents port collisions and sniffing |
| No bind-mounting Docker socket | Prevents host takeover |
| No `cap_add` unless strictly required | Minimize Linux capabilities |

**Template:**

```yaml
services:
  <app-name>:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "<port>"
    environment:
      - DATABASE_URL=${DATABASE_URL:?Укажите DATABASE_URL в Environment Dokploy}
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:<port>/health"]
      interval: 30s
      timeout: 5s
      start_period: 10s
      retries: 3
```

If the app needs a database, add it as a second service with a named volume:

```yaml
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    ports:
      - "5432"
    environment:
      - POSTGRES_DB=${POSTGRES_DB:-app}
      - POSTGRES_USER=${POSTGRES_USER:-app}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:?Укажите POSTGRES_PASSWORD в Environment Dokploy}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-app}"]
      interval: 30s
      timeout: 5s
      retries: 3
    volumes:
      - db-data:/var/lib/postgresql/data

volumes:
  db-data:
```

### Step 4: Generate Supporting Files

**.env.example** — list every variable from `docker-compose.yml` with descriptions in Russian:

```bash
# === Обязательные переменные ===
DATABASE_URL=           # Строка подключения к БД (пример: postgres://user:pass@db:5432/app)
POSTGRES_PASSWORD=      # Пароль для PostgreSQL

# === Необязательные переменные ===
NODE_ENV=development    # Окружение (development | staging)
POSTGRES_DB=app         # Имя базы данных
POSTGRES_USER=app       # Имя пользователя PostgreSQL
```

**.dockerignore** — exclude everything not needed in the build context:

```
node_modules
.git
.env
.env.*
*.md
docker-compose*.yml
.dockerignore
.gitignore
```

**.gitignore** — ensure secrets never get committed:

```
.env
.env.local
.env.*.local
```

### Step 5: Generate DEPLOY.md (Platform Engineer Guide)

Generate `DEPLOY.md` — a standalone operations document for platform / DevOps engineers.
Write in Russian. This file is NOT a project description; it covers only what an engineer
needs to deploy, operate, and troubleshoot the service on Dokploy.

Include sections:
1. **Сервисы** — list of compose services, their images, exposed ports
2. **Переменные окружения** — table from `.env.example` with types (`required` / `optional`) and examples
3. **Volumes и persistent data** — what is stored, backup strategy
4. **Healthcheck-и** — endpoints, intervals, expected responses
5. **Локальный запуск** — `docker compose up --build` and how to simulate Dokploy's `env -i`
6. **Деплой в Dokploy** — reference onboarding steps, domain setup, environment variables in UI, enabling Isolated Deployment (Advanced), accessing container terminal (General → Open Terminal)
7. **Troubleshooting** — common issues (port conflicts, missing env vars, volume wipe on redeploy)
8. **Ресурсные лимиты** — recommended CPU / memory for each service, how to request limit changes from platform admin

### Step 6: Generate README.md (Only If Missing)

Check whether `README.md` already exists in the repository root.

- **If it exists** — do NOT modify or overwrite it. Leave the existing README untouched.
- **If it does NOT exist** — generate a minimal README in Russian with sections:
  1. **Описание** — what the app does (one paragraph)
  2. **Требования** — Docker, Docker Compose
  3. **Быстрый старт** — `docker compose up --build`
  4. **Документация** — link to `DEPLOY.md` for deployment details

### Step 7: Validate

Checklist (present to user):

- [ ] `docker-compose.yml` has no `container_name`
- [ ] All ports use short syntax (e.g. `- "3000"`, NOT `- "3000:3000"`)
- [ ] No `env_file` directive
- [ ] All required env vars use `${VAR:?error message}` syntax
- [ ] No real secrets in any committed file
- [ ] Dockerfile runs as non-root user
- [ ] Healthcheck defined for every service
- [ ] Healthcheck URLs use `127.0.0.1`, NOT `localhost` (Alpine/BusyBox DNS issue)
- [ ] No `privileged`, `network_mode: host`, or Docker socket mounts
- [ ] All persistent data uses named volumes declared in compose (no `./` or `../files/` paths)
- [ ] App listens on `0.0.0.0`, NOT `127.0.0.1`
- [ ] `.env.example` documents every variable with Russian descriptions
- [ ] `DEPLOY.md` exists and covers all operations sections
- [ ] Existing `README.md` was NOT overwritten (if it was present before)
- [ ] Dockerfile follows [official Docker best practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)

### Step 8: Provide Onboarding Instructions

After repo preparation, output the Dokploy onboarding guide in Russian.
For full onboarding text, see [onboarding-guide.md](onboarding-guide.md).

Key points to include:
1. How to request access (IDM / admin invitation)
2. Account activation flow
3. What the user sees in the dashboard (repo is pre-connected by admin)
4. How to open the container terminal (General → Open Terminal)
5. How to enable Isolated Deployment (Advanced → Enable Isolated Deployment)
6. How to manage environment variables in Dokploy UI
7. How to configure a domain (HTTP via traefik.me, HTTPS via custom domain)
8. How to deploy and monitor
9. What NOT to do (disconnect repo, change provider settings)

## Dokploy Internals (verified from source code)

These details come from inspecting the actual Dokploy server codebase
(`packages/server/src/`), not just the docs. Cite these when users ask "why?".

### Deploy pipeline (what actually happens)

1. **Clone** — Dokploy runs `rm -rf` + `git clone` on every deploy. This is why
   `./`-relative volume mounts break. Source: `packages/server/src/services/compose.ts`
   `deployCompose()` dispatches to `cloneGithubRepository`, `cloneGitlabRepository`,
   `cloneGitRepository`, `cloneBitbucketRepository`, `cloneGiteaRepository`, or
   `getCreateComposeFileCommand` (for raw mode).

2. **Write .env** — `getCreateEnvFileCommand` generates `.env` next to `docker-compose.yml`.
   It auto-injects `APP_NAME`, `COMPOSE_PROJECT_NAME`, `DOCKER_CONFIG=/root/.docker`,
   and optional `COMPOSE_PREFIX` for randomized deploys. Env vars from Dokploy UI
   (project → environment → service) are interpolated via `prepareEnvironmentVariables`.
   Source: `packages/server/src/utils/builders/compose.ts:99-130`.

3. **Rewrite compose for domains** — `writeDomainsToCompose` → `addDomainToCompose`
   parses YAML, injects Traefik labels via `createDomainLabels`, and optionally adds
   `dokploy-network` or creates an isolated network. The rewritten compose is
   base64-encoded and written to disk. Source: `packages/server/src/utils/docker/domain.ts`.

4. **Run docker command** — `env -i PATH="$PATH" docker compose -p <appName> -f <path> up -d --build --remove-orphans`.
   Note: `env -i` strips host env vars to prevent leakage into containers.
   Source: `packages/server/src/utils/builders/compose.ts:57`.

5. **Connect Traefik to isolated network** — if `isolatedDeployment` is on, Dokploy
   runs `docker network connect <appName> $(docker ps --filter "name=dokploy-traefik" -q)`.
   Source: `packages/server/src/utils/builders/compose.ts:58`.

### What Dokploy validates (and what it does NOT)

| Validated | Where |
|-----------|-------|
| YAML alias bomb limit (`maxAliasCount: 10000`) | `domain.ts:66-68` |
| Domain → service name must exist in compose | `domain.ts:169-172` |
| `services` key must exist | `compose.ts:180-184` |
| `appName` regex (`/^[a-z][a-z0-9-]*$/`) + uniqueness | `schema/utils.ts`, `services/compose.ts:52-60` |

**NOT validated server-side** (platform does NOT reject):
- `privileged: true`
- `network_mode: host`
- Docker socket bind mounts
- `cap_add` directives
- Resource limits

This means our skill MUST enforce security rules at the compose-file level,
because Dokploy will happily deploy insecure configurations.

### Variable interpolation syntax (Dokploy-specific)

Dokploy supports special `${{...}}` syntax in Environment UI for cross-referencing:
- `${{project.VAR_NAME}}` — resolves from project-level shared variables
- `${{environment.VAR_NAME}}` — resolves from environment-level variables
- `${{VAR_NAME}}` — self-reference within service variables

Invalid references throw an error and block deployment.
Source: `packages/server/src/utils/docker/utils.ts:399-451`.

Standard Docker `${VAR}` / `${VAR:-default}` / `${VAR:?error}` work in
`docker-compose.yml` because Dokploy writes the resolved `.env` file.

### Compose naming and collision prevention

When Isolated Deployments is enabled, Dokploy:
- Prefixes all service names with `appName` via `addAppNameToAllServiceNames`
- Optionally suffixes all volume names via `addSuffixToAllVolumes`
- Creates a unique `--attachable` network named after `appName`

This means users should NOT hardcode service names in inter-service URLs.
Use compose service names (e.g. `db:5432`) — Dokploy rewrites them consistently.
Source: `packages/server/src/utils/docker/collision.ts`.

### Permissions model (who sees what)

- **Roles**: `owner` | `admin` | `member` (or custom role with enterprise license)
- **Scoped access**: Members have `accessedProjects`, `accessedEnvironments`,
  `accessedServices`, `accessedServers`, `accessedGitProviders` arrays
- Enforcement: `checkServiceAccess` requires both the permission AND membership
  in the scoped array for non-owner/admin users
- Source: `packages/server/src/services/permission.ts:213-310`

### Git providers (how repos connect)

Supported: `github`, `gitlab`, `bitbucket`, `gitea`, `git` (generic SSH/HTTPS).
Admin creates a Git Provider (token-based), then associates it with a compose service.
Users see the repo but cannot modify the provider connection.
Source: `packages/server/src/db/schema/git-provider.ts`.

## Dokploy-Specific Gotchas

These are verified from both docs and source code — always warn users:

1. **AutoDeploy = fresh `git clone` every time** — repo dir is wiped. `./`-relative
   volume mounts will be empty on next deploy. Use named volumes in compose.
   (source: `services/compose.ts`, [troubleshooting docs](https://docs.dokploy.com/docs/core/troubleshooting))

2. **Domains require redeploy** — Traefik labels are injected at deploy time by
   `addDomainToCompose`. Domain changes in UI do nothing until you redeploy.
   (source: `utils/docker/domain.ts`, [troubleshooting docs](https://docs.dokploy.com/docs/core/troubleshooting))

3. **Isolated Deployments rewrites service names** — if enabled, `my-app` becomes
   `<appName>-my-app`. Don't hardcode service names in application config.
   (source: `utils/docker/collision.ts`)

4. **`env -i` strips host env** — the deploy command runs with `env -i PATH="$PATH"`,
   so only `.env` file contents reach the containers. Test locally with
   `env -i PATH="$PATH" docker compose up` to simulate.
   (source: `utils/builders/compose.ts:57`)

5. **Variable inheritance: project → environment → service** — `${{project.X}}` and
   `${{environment.X}}` are resolved before Docker sees them. Invalid refs = deploy failure.
   (source: `utils/docker/utils.ts:399-451`, [multi-tenancy docs](https://docs.dokploy.com/docs/core/multi-tenancy))

6. **Named volumes for backups** — only named volumes support Dokploy Volume Backups.
   ([source](https://docs.dokploy.com/docs/core/docker-compose))

7. **No server-side security policy** — Dokploy does NOT reject `privileged`, `network_mode: host`,
   or Docker socket mounts. Security enforcement is entirely at the compose-file level.

8. **Healthcheck: `127.0.0.1`, not `localhost`** — BusyBox `wget` in Alpine images resolves
   `localhost` via DNS instead of using `/etc/hosts`. In non-root container contexts this
   DNS resolution fails silently, causing "Connection refused" even though the app listens
   on `0.0.0.0`. Always use the IP literal `127.0.0.1` in healthcheck URLs to bypass DNS.

## Additional Resources

- For detailed docker-compose.yml rules, see [compose-reference.md](compose-reference.md)
- For user onboarding guide, see [onboarding-guide.md](onboarding-guide.md)
