# Docker Compose Reference for Dokploy

Detailed rules and patterns for writing `docker-compose.yml` files that deploy correctly on Dokploy.
Rules sourced from [official docs](https://docs.dokploy.com/docs/core/docker-compose) and verified against server source code (`packages/server/src/`).

## Port Configuration

**Rule:** Use short syntax only. Never bind to a host port.

```yaml
# CORRECT — Dokploy + Traefik route traffic automatically
ports:
  - "3000"

# WRONG — host binding causes conflicts with other tenants
ports:
  - "3000:3000"
```

Source: [Troubleshooting — Docker Compose Domain Not Working](https://docs.dokploy.com/docs/core/troubleshooting)

## Environment Variables

**Rule:** Use inline `environment:` with `${VAR}` references. Dokploy UI writes variables to `.env` file.

How it works internally (`packages/server/src/utils/builders/compose.ts:99-130`):
- `getCreateEnvFileCommand` generates `.env` next to `docker-compose.yml`
- Auto-injects: `APP_NAME=<appName>`, `COMPOSE_PROJECT_NAME=<appName>`, `DOCKER_CONFIG=/root/.docker`
- Variables from UI are interpolated via `prepareEnvironmentVariables` (project → environment → service)
- Deploy runs with `env -i PATH="$PATH"` — only `.env` contents reach containers

```yaml
# CORRECT — Dokploy resolves from its .env
environment:
  - DATABASE_URL=${DATABASE_URL:?Укажите DATABASE_URL в Environment Dokploy}
  - REDIS_URL=${REDIS_URL:-redis://redis:6379}
```

Variable syntax in `docker-compose.yml`:
- `${VAR:?Error message}` — required, deployment fails with message if missing
- `${VAR:-default}` — optional, uses default when not set
- `${VAR}` — optional, empty if not set

Dokploy-specific syntax in Environment UI (NOT in compose file):
- `${{project.VAR_NAME}}` — resolves from project-level shared variables
- `${{environment.VAR_NAME}}` — resolves from environment-level variables
- `${{VAR_NAME}}` — self-reference within service variables
- Invalid references throw an error and block deployment

Source: [Docker Compose — Environment](https://docs.dokploy.com/docs/core/docker-compose), `packages/server/src/utils/docker/utils.ts:399-451`

## Volume Mounts

**Rule:** Use named volumes only. Never use repo-relative paths (`./`) or bind mounts (`../files/`).

```yaml
# CORRECT — Docker-managed named volume, supports Volume Backups
volumes:
  - db-data:/var/lib/postgresql/data

# WRONG — cleared on every AutoDeploy (git clone wipes the repo dir)
volumes:
  - "./config:/etc/app/config"
  - "/absolute/path:/data"
```

If an app needs config files from the repository, COPY them inside the Dockerfile
during the build stage. Do NOT mount them as volumes.

```dockerfile
COPY config/ /app/config/
```

All named volumes must be declared in the `volumes:` section at the root of compose:

```yaml
volumes:
  db-data:
  app-uploads:
```

Source: [Docker Compose — Volumes](https://docs.dokploy.com/docs/core/docker-compose), [Troubleshooting — Using Files from Your Repository](https://docs.dokploy.com/docs/core/troubleshooting)

## Container Naming

**Rule:** Never set `container_name`. Dokploy manages container naming for logs, metrics, and scaling.

```yaml
# WRONG
services:
  app:
    container_name: my-app  # Breaks Dokploy features

# CORRECT — omit container_name entirely
services:
  app:
    build: .
```

Source: [Docker Compose Example](https://docs.dokploy.com/docs/core/docker-compose/example)

## Healthchecks

**Rule:** Define healthchecks for every service. Broken healthchecks block domain routing.

**CRITICAL: Always use `127.0.0.1`, NEVER `localhost` in healthcheck URLs.**
BusyBox `wget` in Alpine images resolves `localhost` via DNS, which fails in non-root
container contexts — the container reports "Connection refused" even though the app
is listening correctly on `0.0.0.0`. Using the IP literal `127.0.0.1` bypasses DNS entirely.

```yaml
# HTTP app
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/health"]
  interval: 30s
  timeout: 5s
  start_period: 10s
  retries: 3

# PostgreSQL
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-app}"]
  interval: 30s
  timeout: 5s
  retries: 3

# Redis
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 30s
  timeout: 5s
  retries: 3

# MySQL / MariaDB
healthcheck:
  test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1"]
  interval: 30s
  timeout: 5s
  retries: 3

# MongoDB
healthcheck:
  test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
  interval: 30s
  timeout: 5s
  retries: 3
```

Source: [Troubleshooting — domains not working due to healthchecks](https://docs.dokploy.com/docs/core/troubleshooting), [Healthcheck & Rollbacks](https://docs.dokploy.com/docs/core/applications/going-production)

## Networking

**Rule:** Do NOT manually add `dokploy-network`. Use Isolated Deployments instead.

How it works internally (`packages/server/src/utils/builders/compose.ts:56-58`):

When Isolated Deployments is enabled:
1. Dokploy runs `docker network create --attachable <appName>`
2. `addDomainToCompose` calls `randomizeDeployableSpecificationFile` which prefixes
   all service names with `appName` and optionally suffixes volumes
3. After compose up, runs `docker network connect <appName> $(docker ps --filter "name=dokploy-traefik" -q)`
4. No manual `networks:` section needed in compose file

**Warning:** Isolated Deployments renames services. If your compose has `db` service,
it becomes `<appName>-db` internally. Use compose service names (not hardcoded hostnames)
in your application config — Docker Compose DNS resolves them correctly within the project.

When Isolated Deployments is disabled, `addDokployNetworkToService` adds `dokploy-network`
and `default` network to each service with a domain, and `addDokployNetworkToRoot` adds
`dokploy-network: { external: true }` to the root `networks:` section.

Source: [Isolated Deployments](https://docs.dokploy.com/docs/core/docker-compose/utilities), `packages/server/src/utils/docker/domain.ts:223-234`, `packages/server/src/utils/docker/collision.ts`

## Security Hardening (Multi-Tenant Sandbox)

These rules ensure tenant isolation on a shared Dokploy instance.

**Never allow in a sandbox environment:**

```yaml
# ALL OF THESE ARE FORBIDDEN
privileged: true
network_mode: host
pid: host
ipc: host
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
cap_add:
  - SYS_ADMIN
  - NET_ADMIN
```

**Critical:** Dokploy does NOT enforce these restrictions server-side.
The platform has no compose validation that rejects `privileged` or socket mounts
(verified: no such checks exist in `packages/server/src/`). Security enforcement
is entirely the responsibility of the compose file author — which is why this
skill exists.

## Domain Configuration

Domains are configured in Dokploy UI, not in compose file (recommended approach since v0.7.0).

1. Go to the compose app → Domains tab
2. Click Add Domain
3. Select Service Name (from compose services)
4. Set Host (use dice icon for traefik.me or enter custom domain)
5. Set Container Port (the port your app listens on)
6. Enable HTTPS if using a real domain with certificates
7. Click Create/Update → Deploy

Dokploy automatically injects Traefik labels at deploy time.

Source: [Domains — Method 1: Dokploy Domains (Recommended)](https://docs.dokploy.com/docs/core/docker-compose/domains)

## Complete Example

A Node.js app with PostgreSQL, fully Dokploy-ready:

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3000"
    environment:
      - DATABASE_URL=${DATABASE_URL:?Укажите DATABASE_URL в Environment Dokploy}
      - LOG_LEVEL=${LOG_LEVEL:-info}
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/health"]
      interval: 30s
      timeout: 5s
      start_period: 15s
      retries: 3
    depends_on:
      db:
        condition: service_healthy

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
