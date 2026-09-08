# Dockerfile Templates

Production-ready templates per language. All follow modern BuildKit best practices.

## Mandatory directives (every Dockerfile)

```dockerfile
# syntax=docker.io/docker/dockerfile:1
# check=error=true;skip=SecretsUsedInArgOrEnv

ARG SOURCE_DATE_EPOCH=context
```

- `# syntax=docker.io/docker/dockerfile:1` — tracks the stable Dockerfile frontend and enables `COPY --link`, `--mount=type=secret`, `--mount=type=cache`, `RUN --network=none`, `ADD --checksum`, Dockerfile lint checks
- `# check=error=true` — fails build on lint violations (typos in flags, unused args, bad COPY paths). `skip=SecretsUsedInArgOrEnv` allowed only when an `ARG` is intentionally a public token name (e.g. `LIBS_USER`)
- `ARG SOURCE_DATE_EPOCH=context` — reproducible builds; resolves to git commit timestamp when context is a remote git URL

## Universal requirements

| Requirement | Rationale |
|---|---|
| Multi-stage (build + runtime) | discard SDK/build tools from final image |
| Pin base image by tag (or digest) | reproducibility |
| Parameterize bases via `ARG *_IMAGE` | renovate-friendly, swappable in CI |
| `COPY --link` for cross-stage copies | independent layer chain, better cache reuse |
| **Numeric `--chown=UID:GID`** with `--link` | `--link` layer has no `/etc/passwd`, name resolution fails |
| `--mount=type=cache` for package managers | speeds up `go mod`, `npm ci`, `pip install`, `dotnet restore`, gradle |
| `--mount=type=secret,required=false` for private registries | never bakes tokens into layers/history |
| `--mount=type=tmpfs,target=/tmp` when secret-derived files (e.g. `.npmrc`) are written | guaranteed no leakage |
| Non-root user (numeric `USER`) | bcd-web enforces `runAsNonRoot: true` |
| Distroless / chiseled / alpine runtime | smaller, smaller attack surface |
| Exec-form `CMD`/`ENTRYPOINT` | proper signal handling, no extra shell PID |
| `EXPOSE <port>` | documents port for tooling and Helm probes |
| `HEALTHCHECK` (if runtime has shell + wget/curl) | omit on chiseled/distroless — K8s probes cover this |

## Non-root UID by base image

| Base image | UID | Notes |
|---|---|---|
| `gcr.io/distroless/static:nonroot` | 65532 | `nonroot` user, no shell |
| `gcr.io/distroless/base:nonroot` | 65532 | glibc, no shell |
| `mcr.microsoft.com/dotnet/aspnet:*-chiseled` | 1654 | `app` user pre-created; use `$APP_UID` env or hardcode 1654 |
| `nginx:*` | 101 | `nginx` user; chown runtime paths before running with UID 101 |
| `node:*-alpine` | 1000 | `node` user pre-created |
| Custom (own UID) | 1000 (bcd-web default) | must be set in Helm `securityContext` to match |

When the image uses a non-1000 UID, override in `values.yaml`:

```yaml
containers:
  my-service:
    securityContext:
      runAsUser: 1654   # match image
      runAsGroup: 1654
```

## CI passthrough for secrets & cache

In matrix-build jobs, secrets are passed to BuildKit via `SECRET_VARS`, cache namespace via `BUILDKIT_CACHE_MOUNT_NS`:

```yaml
build:services:
  extends: .image.Matrix-Build
  variables:
    BUILD_ARGS: >-
      --build-arg LIBS_USER=${LIBS_READ_USER_ENV}
      --build-arg BUILDKIT_CACHE_MOUNT_NS=$CI_PROJECT_PATH_SLUG
    SECRET_VARS: >-
      --secret id=LIBS_TOKEN,env={LIBS_READ_TOKEN_ENV}
```

The `BUILDKIT_CACHE_MOUNT_NS` arg namespaces cache buckets per project so concurrent CI jobs don't corrupt each other's caches.

---

## Go (distroless)

```dockerfile
# syntax=docker.io/docker/dockerfile:1
# check=error=true

ARG SOURCE_DATE_EPOCH=context
ARG GO_IMAGE=golang:1.27-alpine@sha256:cf6fca6641884b8433441b2b0652976f975e1d0fdd26d177eaaf8596087f3125
ARG RUNTIME_IMAGE=gcr.io/distroless/static:nonroot@sha256:1c2c046bc09ed40fad370b599a0b1ae7987f55b01e247cf27a7c27cd97e5bbc7

FROM --platform=$BUILDPLATFORM ${GO_IMAGE} AS build
WORKDIR /src

ARG TARGETOS
ARG TARGETARCH

COPY --link go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod,sharing=locked \
    go mod download

COPY --link . .
RUN --mount=type=cache,target=/go/pkg/mod,sharing=locked \
    --mount=type=cache,target=/root/.cache/go-build,sharing=locked \
    --network=none \
    CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags="-s -w" -o /out/app ./cmd/app

FROM ${RUNTIME_IMAGE}
COPY --link --from=build --chown=65532:65532 /out/app /usr/local/bin/app
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/app"]
```

Notes: `--platform=$BUILDPLATFORM` keeps the toolchain on the builder's native arch while cross-compiling; `--network=none` on the build step proves no hidden network deps after `go mod download`; distroless has no shell so no HEALTHCHECK.

## Python (slim + pip cache)

```dockerfile
# syntax=docker.io/docker/dockerfile:1
# check=error=true

ARG SOURCE_DATE_EPOCH=context
ARG PYTHON_IMAGE=python:3.14-alpine3.22@sha256:6b91e66ab2a880ce9ca5a1b91c70f45963ff71ff68268df056336e1a657d5efd
ARG UV_IMAGE=docker.biocad.ru/ghcr.io/astral-sh/uv:0.12.10@sha256:2bb3ebca0a796a155094a27773d290c4b074572e6107f171d88d086682fd2500

FROM ${UV_IMAGE} AS uv
FROM ${PYTHON_IMAGE} AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

COPY --link pyproject.toml uv.lock ./

COPY --from=uv /uv /usr/local/bin/uv

RUN apk upgrade --no-cache && \
    apk add --no-cache build-base linux-headers

RUN --mount=type=cache,id={project}-uv,target=/root/.cache/uv,sharing=locked \
    uv sync --locked --no-install-project --no-dev

FROM ${PYTHON_IMAGE} AS runtime

ARG TZ=Europe/Moscow

RUN apk upgrade --no-cache && \
    apk add --no-cache ca-certificates tzdata && \
    ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
    echo $TZ > /etc/timezone && \
    addgroup -g 1000 -S app && \
    adduser -u 1000 -S -D -H -G app -s /sbin/nologin app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=Europe/Moscow \
    PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH=/app/src

WORKDIR /app

COPY --link --chown=1000:1000 --from=builder /app/.venv /app/.venv
COPY --link --chown=1000:1000 src/ /app/src/

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=5).read()" || exit 1

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Notes:
- **uv** is the standard Python package manager (replaces pip). Installed via `COPY --from=docker.biocad.ru/ghcr.io/astral-sh/uv:0.9.2`
- `uv sync --locked` uses `uv.lock` lockfile for deterministic installs (equivalent to `pip install -r requirements.txt` but faster and stricter)
- `UV_LINK_MODE=copy` + `UV_COMPILE_BYTECODE=1` — copy mode for venv portability, bytecode precompilation for faster startup
- Runtime copies source to `/app/src`, so `PYTHONPATH=/app/src` is required when the project is not installed into the venv
- Alpine-based images (`python:3.13-alpine3.22`) are preferred over `slim` for smaller attack surface
- `build-base` + `linux-headers` are needed in builder for C-extension wheels (psycopg, cryptography, etc.)
- UID 1000 / group `app` — standard non-root user for Python services
- Cache mount for uv store: `target=/root/.cache/uv`, `id={project}-uv`

## Node.js (frontend → nginx) — pnpm (preferred)

**pnpm is the standard package manager for Node.js projects.** It is faster, more disk-efficient, and enforces strict dependency isolation (`node_modules` is not flat). Use pnpm for all new projects and migrate existing npm/yarn projects with `pnpm import`.

**Commit `.npmrc` template with `${LIBS_TOKEN}` placeholder.** pnpm (like npm) natively expands `${VAR}` from the environment at read time — no shell logic in the Dockerfile.

`.npmrc` (committed alongside `package.json`):

```ini
@scope:registry=https://gitlab.biocad.ru/api/v4/groups/5451/-/packages/npm/
//gitlab.biocad.ru/api/v4/groups/5451/-/packages/npm/:_authToken=${LIBS_TOKEN}
```

`package.json` — add `packageManager` field:

```json
{
  "packageManager": "pnpm@10.18.3"
}
```

`Dockerfile`:

```dockerfile
# syntax=docker.io/docker/dockerfile:1
# check=error=true;skip=SecretsUsedInArgOrEnv

ARG SOURCE_DATE_EPOCH=context
ARG NODE_IMAGE=node:24-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf
ARG NGINX_IMAGE=nginx:1.31-alpine@sha256:72ba65eb42c10344912a84ff42408db7d34f2feb642204570ab8fc5ffd29f1d3
ARG PNPM_VERSION=10.18.3

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY --link package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=secret,id=LIBS_TOKEN,env=LIBS_TOKEN,required=false \
    --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile --prod=false --ignore-scripts

FROM deps AS build
COPY --link . .
RUN --mount=type=cache,id=vite,target=/app/node_modules/.vite,sharing=locked \
    pnpm build

FROM ${NGINX_IMAGE} AS runtime
COPY --link --from=build --chown=101:101 /app/dist /usr/share/nginx/html
COPY --link --chown=101:101 nginx.conf /etc/nginx/conf.d/default.conf
RUN chown -R 101:101 /etc/nginx /var/cache/nginx /var/log/nginx \
 && touch /run/nginx.pid && chown 101:101 /run/nginx.pid

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --spider -q http://127.0.0.1:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

Notes:
- **pnpm** — installed via `corepack enable && corepack prepare`. Pin version in both `ARG PNPM_VERSION` and `package.json` `packageManager` field
- `.npmrc` in the repo is **safe to commit** — it contains only the registry URL and `${LIBS_TOKEN}` placeholder, never the actual token
- pnpm reads `${LIBS_TOKEN}` from the env at install time; the secret-mounted env value never lands in a layer
- `--ignore-scripts` blocks malicious postinstall in transitive deps
- `pnpm-lock.yaml` is **required** — `pnpm install --frozen-lockfile` refuses to run without it. Generate with `pnpm install` locally and commit the result. Renovate keeps it fresh
- **Migrating from npm/yarn:** run `pnpm import` to convert an existing `package-lock.json` or `yarn.lock` to `pnpm-lock.yaml`. Requires registry access for metadata resolution. Alternatively, use `pnpm import` inside the Dockerfile as a transitional step: `COPY package-lock.json ./` then `pnpm import && pnpm install --frozen-lockfile`
- **Legacy Create React App:** add `node-linker=hoisted` to `.npmrc` and run a real `pnpm build` before merging. CRA and its webpack dependency resolution were designed around a flat `node_modules` layout
- `--mount=type=cache` target for pnpm is the content-addressable store at `/root/.local/share/pnpm/store`
- Cache mount `id` should be unique per project: `id={project}-pnpm`
- `nginx:1.29-alpine` is the standard runtime. For K8s, chown nginx paths to UID 101 in the image, set `securityContext.runAsUser: 101`, and route the Service to the named container port

## Node.js (backend, no nginx) — pnpm

```dockerfile
# syntax=docker.io/docker/dockerfile:1
# check=error=true

ARG SOURCE_DATE_EPOCH=context
ARG NODE_IMAGE=node:24-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf
ARG PNPM_VERSION=10.18.3

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY --link package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=secret,id=LIBS_TOKEN,env=LIBS_TOKEN,required=false \
    --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile --prod=false --ignore-scripts

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --link --from=deps --chown=1000:1000 /app/node_modules ./node_modules
COPY --link --chown=1000:1000 . .
USER 1000:1000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --spider -q http://127.0.0.1:3000/health || exit 1
CMD ["node", "src/index.js"]
```

## Java / Spring Boot (gradle cache)

```dockerfile
# syntax=docker.io/docker/dockerfile:1
# check=error=true

ARG SOURCE_DATE_EPOCH=context
ARG JDK_IMAGE=eclipse-temurin:25.0.4_7-jdk-alpine@sha256:09349d79941fd53bb3d487b393ca118d8853c08c09193f416fe6a8718df9e732
ARG JRE_IMAGE=eclipse-temurin:25.0.4_7-jre-alpine@sha256:3137541deb3cac6626b5d9a4a2187bc0d6a34312f858bd2c67dd01e732e6b682

FROM ${JDK_IMAGE} AS build
WORKDIR /app

COPY --link gradlew build.gradle settings.gradle ./
COPY --link gradle ./gradle
RUN --mount=type=cache,target=/root/.gradle,sharing=locked \
    ./gradlew dependencies --no-daemon

COPY --link src ./src
RUN --mount=type=cache,target=/root/.gradle,sharing=locked \
    ./gradlew bootJar --no-daemon -x test

FROM ${JRE_IMAGE} AS runtime
WORKDIR /app
RUN addgroup -g 1000 app && adduser -u 1000 -G app -D -H app

COPY --link --from=build --chown=1000:1000 /app/build/libs/*.jar app.jar

USER 1000:1000
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget --spider -q http://127.0.0.1:8080/actuator/health || exit 1
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
```

## .NET (chiseled)

**Preferred pattern: commit `NuGet.Config` with sources + `packageSourceMapping`, no credentials block.** Add credentials inline only when the build-time secret is present — keeps local `dotnet build` working without a token (since `NuGet.Config` itself is valid).

`NuGet.Config` (alongside `.csproj`):

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" protocolVersion="3" />
    <add key="PrivateFeed" value="https://gitlab.biocad.ru/api/v4/groups/5451/-/packages/nuget/index.json" />
  </packageSources>
  <packageSourceMapping>
    <packageSource key="nuget.org">
      <package pattern="*" />
    </packageSource>
    <packageSource key="PrivateFeed">
      <package pattern="MyOrg.*" />
    </packageSource>
  </packageSourceMapping>
</configuration>
```

`Dockerfile`:

```dockerfile
# syntax=docker.io/docker/dockerfile:1
# check=error=true;skip=SecretsUsedInArgOrEnv

ARG SOURCE_DATE_EPOCH=context
ARG SDK_IMAGE=mcr.microsoft.com/dotnet/sdk:10.0@sha256:4beef5b8919dcaa2dc924233bd069257e883cc7a061e09088a97d152d6a48510
ARG RUNTIME_IMAGE=mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled@sha256:0839314d08bb65da369135389a5d8291f75ace587fbb0488f469eb92c62eef68
ARG APP_UID=1654

FROM ${SDK_IMAGE} AS build
WORKDIR /src

# LIBS_USER must match the token type passed via SECRET_VARS:
#   - CI_JOB_TOKEN          → "gitlab-ci-token"
#   - Deploy token          → "gitlab+deploy-token-<name>"
#   - Personal Access Token → any non-empty string
# Mismatch silently passes `nuget update source` but fails `dotnet restore` with HTTP 401.
ARG LIBS_USER=gitlab-ci-token

ENV LIBS_USER=${LIBS_USER} \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1 \
    NUGET_PACKAGES=/root/.nuget/packages

COPY --link NuGet.Config *.csproj ./
RUN --mount=type=secret,id=LIBS_TOKEN,env=LIBS_TOKEN,required=false \
    --mount=type=cache,id=nuget,target=/root/.nuget/packages,sharing=locked \
    if [ -n "${LIBS_TOKEN:-}" ]; then dotnet nuget update source PrivateFeed -u "$LIBS_USER" -p "$LIBS_TOKEN" --store-password-in-clear-text --configfile NuGet.Config; fi \
 && dotnet restore

COPY --link . .
RUN --mount=type=cache,id=nuget,target=/root/.nuget/packages,sharing=locked \
    dotnet publish -c Release -o /app/publish \
      /p:UseAppHost=false /p:DeterministicSourcePaths=true

FROM ${RUNTIME_IMAGE} AS runtime
ARG APP_UID
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_CLI_TELEMETRY_OPTOUT=1

COPY --link --from=build --chown=${APP_UID}:${APP_UID} /app/publish ./

USER ${APP_UID}
EXPOSE 8080

# Chiseled image has no shell or wget — K8s liveness/readiness probes cover health.
# If you need a Docker-level HEALTHCHECK, switch RUNTIME_IMAGE to aspnet:10.0 (non-chiseled).

ENTRYPOINT ["dotnet", "App.dll"]
```

Notes:
- `NuGet.Config` is **safe to commit** — only sources and package mapping, no credentials
- Why not put credentials with `%LIBS_TOKEN%` placeholder in `NuGet.Config`? NuGet validates `<ClearTextPassword>` upfront; an empty value (when secret isn't mounted) breaks `dotnet restore` even if no private packages are actually needed. Adding credentials at runtime sidesteps that
- `packageSourceMapping` restricts the private feed to packages matching `MyOrg.*` — defense-in-depth against dependency confusion attacks

In `values.yaml` for chiseled .NET, override the default 1000:

```yaml
containers:
  service:
    securityContext:
      runAsUser: 1654
      runAsGroup: 1654
```

## Rust (musl static binary)

```dockerfile
# syntax=docker.io/docker/dockerfile:1
# check=error=true

ARG SOURCE_DATE_EPOCH=context
ARG RUST_IMAGE=rust:1.98-alpine@sha256:a10e64dd139b7387337c7fbe8aca31b959b57b2fd4c8ae20a02cf1d6ea424dce
ARG RUNTIME_IMAGE=gcr.io/distroless/static:nonroot@sha256:1c2c046bc09ed40fad370b599a0b1ae7987f55b01e247cf27a7c27cd97e5bbc7

FROM ${RUST_IMAGE} AS build
WORKDIR /src
RUN apk add --no-cache musl-dev

COPY --link Cargo.toml Cargo.lock ./
RUN mkdir src && echo 'fn main(){}' > src/main.rs
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    --mount=type=cache,target=/src/target,sharing=locked \
    cargo build --release && rm -rf src

COPY --link src ./src
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    --mount=type=cache,target=/src/target,sharing=locked \
    cargo build --release && cp /src/target/release/app /out

FROM ${RUNTIME_IMAGE}
COPY --link --from=build --chown=65532:65532 /out /usr/local/bin/app
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/app"]
```

---

## .dockerignore (universal)

Generate alongside every Dockerfile. Critical for build performance (smaller context) and security (no `.env` leakage):

```
.git
.gitignore
.gitlab-ci.yml
.dockerignore
Dockerfile
*.md
README*

# secrets / local-only
.env
.env.*
!.env.example
secrets/
certs/

# build artefacts
node_modules
__pycache__
*.pyc
.venv
venv/
.pytest_cache
.mypy_cache
.ruff_cache
bin/
obj/
build/
dist/
out/
target/
.gradle/
.next/
.angular/cache
coverage/

# IDE
.idea
.vscode
*.swp

# deploy configs (don't ship to image)
helm/
docker-compose*.yml
docker-compose*.yaml
.argocd/
```

## Anti-patterns to avoid

| Anti-pattern | Why bad | Use instead |
|---|---|---|
| `ARG SECRET_TOKEN` + `RUN ... $SECRET_TOKEN` | secret bakes into history/cache/layers | `--mount=type=secret` |
| `COPY .npmrc ./` then `RUN npm ci` then `rm .npmrc` | npmrc still in earlier layer | `NPM_CONFIG_USERCONFIG=/tmp/.npmrc` + tmpfs mount |
| `RUN curl ... -o file` for unverified downloads | supply-chain risk, non-reproducible | `ADD --checksum=sha256:... URL file` |
| `USER root` + `chown -R` then `USER 1000` | extra layer, slower build | `COPY --link --chown=1000:1000` |
| `--chown=app:app` with `--link` | resolves to UID -1, build fails | numeric UID |
| Referencing `$ARG_NAME` inside `RUN <<EOF … EOF` heredoc | heredoc body runs in `/bin/sh`, which sees ENV not ARG → variable expands to empty | promote with `ENV LIBS_USER=${LIBS_USER}` before the RUN, or use `<<-EOF` outside heredoc body |
| Hardcoded `-u gitlab-ci-token` for private registry auth | works only with `CI_JOB_TOKEN`; deploy tokens require their own username, silently fails with 401 on first download | accept `ARG LIBS_USER` and use `-u "$LIBS_USER"`, pass via `--build-arg LIBS_USER=$REGISTRY_USER` |
| `apt-get update && apt-get install ...` without `--no-install-recommends` | bloated images | `apt-get install -y --no-install-recommends` + `rm -rf /var/lib/apt/lists/*` |
| Single-stage build with SDK in final image | SDK + cache in production image | multi-stage with minimal runtime |
| `CMD bash -c "..."` shell form | wrong PID 1, signals don't reach app | exec form `CMD ["bin", "arg"]` |
| `latest` tag for base image | non-reproducible | pinned tag or digest |
