# Phase 0: Refactor Project to Target Architecture

**This phase MUST be completed BEFORE any auth integration begins.**

The auth integration requires a specific project structure. If the current project
does not match, it must be refactored first. Attempting to add auth to a
non-conforming project structure is the #1 cause of broken integrations.

---

## THE IMPORT STANDARD (read this first)

This is the single most important section in the entire skill. Getting imports
wrong causes `ModuleNotFoundError` at startup and NOTHING works.

### How Python Imports Work in Docker

Python resolves imports relative to directories in `sys.path`. The most important
entry in `sys.path` is the directory where the entrypoint script lives (or WORKDIR
if using `uvicorn module:app`).

**The rule is simple:**

```
WORKDIR in Dockerfile  +  volume mount in docker-compose  =  Python import root
```

### The Standard for This Project

```
backend/
  Dockerfile          # WORKDIR /app
  requirements.txt
  app/                # <-- This is the Python source root
    main.py           #     Entrypoint: python main.py (runs from /app)
    config.py         #     Import: from config import settings
    auth/             #     Import: from auth.keycloak import ...
      __init__.py
      keycloak.py
      jwt_utils.py
      dependencies.py
      router.py
      middleware.py
    routers/          #     Import: from routers.users import users_router
    core/             #     Import: from core.auth import ...
    schemas/          #     Import: from schemas.comparisons import ...
```

**Docker setup:**
```dockerfile
# backend/Dockerfile
WORKDIR /app
COPY requirements.txt .
RUN pip install ...
# In dev mode, source code is NOT copied -- it's mounted via volume
CMD ["python", "main.py"]
```

```yaml
# docker-compose.yml
backend:
  build:
    context: backend
    dockerfile: Dockerfile
  volumes:
    - ./backend/app:/app        # Maps backend/app/ -> /app inside container
  command: python main.py       # Runs from WORKDIR=/app
```

**What Python sees at runtime:**
```
/app/                     <-- WORKDIR, this is sys.path[0]
  main.py                 <-- entrypoint
  config.py               <-- from config import settings  ✓
  auth/
    keycloak.py            <-- from auth.keycloak import ... ✓
  routers/
    users.py               <-- from routers.users import ... ✓
  core/
    comparisons.py         <-- from core.comparisons import ... ✓
  schemas/
    comparisons.py         <-- from schemas.comparisons import ... ✓
```

### CORRECT vs WRONG imports

```python
# ✓ CORRECT (bare imports -- relative to WORKDIR /app):
from config import settings
from auth.keycloak import load_oidc_config
from auth.middleware import SlidingSessionMiddleware
from auth.router import router as auth_router
from routers.users import users_router
from core.comparisons import compare_texts
from schemas.comparisons import Comparison

# ✗ WRONG (app. prefix -- "app" is NOT a package inside /app):
from app.config import settings              # ModuleNotFoundError!
from app.auth.keycloak import load_oidc_config  # ModuleNotFoundError!
from app.auth.router import router           # ModuleNotFoundError!
```

**Why `from app.X` is wrong:** The volume mount maps `./backend/app` to `/app`.
Inside the container, `/app` IS the working directory. There is no package called
`app` inside `/app`. Python looks for `/app/app/config.py` which does not exist.

### How to determine the correct import style for ANY project

1. Read the Dockerfile — find `WORKDIR`
2. Read docker-compose.yml — find `volumes` mount and `command`
3. The directory that gets mounted to WORKDIR is the import root
4. All imports are relative to that root, with NO prefix

| Dockerfile WORKDIR | docker-compose volume | command | Import style |
|---|---|---|---|
| `/app` | `./backend/app:/app` | `python main.py` | `from config import ...` (bare) |
| `/app` | `./backend:/app` | `python app/main.py` | `from app.config import ...` (app-prefixed) |
| `/app/src` | `./backend/src:/app/src` | `python main.py` | `from config import ...` (bare) |
| `/app` | `./backend:/app` | `uvicorn src.main:app` | `from src.config import ...` (src-prefixed) |

**The key insight:** The prefix in imports matches the path from WORKDIR to the
Python source directory. If WORKDIR IS the source directory, imports are bare.

### The `uvicorn 'main:app'` pattern

When the entrypoint is `python main.py` and main.py contains:
```python
if __name__ == '__main__':
    uvicorn.run('main:app', host='0.0.0.0', port=8000)
```

The string `'main:app'` tells uvicorn to import `main` module and find `app` in it.
This works because Python runs from WORKDIR (`/app`), so `main` resolves to
`/app/main.py`. Do NOT write `'app.main:app'` — that would look for
`/app/app/main.py`.

---

## Target Architecture

```
project-root/
  docker-compose.yml          # Orchestrates backend + frontend (2 services only)
  .env.template               # All env vars documented
  .env                        # Actual values (gitignored)
  .gitignore
  Makefile                    # Optional: convenience commands

  backend/
    Dockerfile                # WORKDIR /app, bare imports
    requirements.txt          # Python dependencies
    app/                      # Python source root (mounted as /app)
      main.py                 # FastAPI entrypoint
      config.py               # Pydantic BaseSettings
      auth/                   # Auth package (added by this skill)
        __init__.py
        keycloak.py
        jwt_utils.py
        dependencies.py
        router.py
        middleware.py
      routers/                # Business logic routers
      core/                   # Business logic services
      schemas/                # Pydantic models

  frontend/
    Dockerfile                # Multi-stage: node build + nginx serve
    nginx/                    # nginx config lives INSIDE frontend/
      nginx.conf              # Base nginx config (http block, buffer sizes)
      generate-conf.sh        # Script that generates server block from BASE_PATH
    app/                      # Frontend source code
      package.json
      vite.config.js
      src/
        main.jsx
        App.jsx
        config.js
        api.js                # Axios client
        store/                # Zustand stores
        components/
        pages/
```

**Key architectural decisions:**

1. **Only 2 Docker services:** `backend` and `frontend`. No separate nginx service.
2. **nginx is embedded in the frontend container.** The frontend Dockerfile uses a
   multi-stage build: stage 1 builds the React app, stage 2 copies the build output
   into an nginx image. nginx serves static files AND proxies `/api/*` to the backend.
3. **Backend has NO exposed ports.** It is only reachable through nginx via the
   Docker network.
4. **Each Dockerfile lives in its service directory:** `backend/Dockerfile`,
   `frontend/Dockerfile`.
5. **nginx config lives inside `frontend/nginx/`**, not at the project root.
6. **Backend source code is in `backend/app/`**, with `WORKDIR /app` and volume
   mount `./backend/app:/app` in dev mode. **All Python imports are bare** (no prefix).
7. **Frontend source code is in `frontend/app/`**, with all npm files there.

---

## Step 0.1: Analyze Current Structure

Read and record:

```
Current Structure Analysis:
- [ ] Where is docker-compose.yml?
- [ ] How many Docker services exist? List them.
- [ ] Is there a separate nginx service?
- [ ] Where are Dockerfiles? (e.g. backend/Dockerfile, backend/backend.Dockerfile)
- [ ] What is WORKDIR in each Dockerfile?
- [ ] Where is nginx config? (root? nginx/ dir? frontend/nginx/?)
- [ ] Where is backend source code? (backend/app/? backend/src/? src/?)
- [ ] Where is frontend source code? (frontend/app/? frontend/src/? frontend/?)
- [ ] How is the app launched in dev? (Makefile? docker-compose command?)
- [ ] What volume mounts exist in docker-compose?
- [ ] What is the current Python import style? (read 3-4 .py files)
```

**CRITICAL: Determine the current import style.**
Read `main.py` and 2-3 other Python files. Record every import pattern you see:
```
Current imports:
- main.py:       from routers.users import ...     (bare)
- config.py:     from pydantic_settings import ... (third-party, ignore)
- core/auth.py:  from config import ...            (bare)
- routers/comparisons.py: from schemas.comparisons import ... (bare)
```

If ALL existing business logic uses bare imports AND the Dockerfile has
`WORKDIR /app` with volume `./backend/app:/app`, then the standard is **bare imports**.

If you see ANY files using `from app.` prefix, check: are those files from a
previous broken LLM attempt? If the original business logic uses bare imports
but auth files use `from app.`, the auth files are WRONG and must be fixed.

---

## Step 0.2: Identify Required Changes

Compare the current structure with the target. Create a checklist of changes:

```
Refactoring Checklist:

DOCKER / INFRASTRUCTURE:
- [ ] Merge separate nginx service into frontend container (if nginx is a separate service)
- [ ] Rename Dockerfiles to standard names (e.g. backend.Dockerfile -> Dockerfile)
- [ ] Move nginx config into frontend/nginx/ (if at project root or elsewhere)
- [ ] Create frontend/nginx/generate-conf.sh (dynamic config from BASE_PATH)
- [ ] Update frontend Dockerfile to multi-stage build (node + nginx)
- [ ] Update docker-compose.yml to remove nginx service, update frontend service
- [ ] Update docker-compose.yml to pass all required env vars
- [ ] Ensure backend has no exposed ports in docker-compose
- [ ] Update Makefile if it references old paths/services

PYTHON IMPORTS (if any files have wrong prefix):
- [ ] Fix all Python files that use wrong import prefix
- [ ] Verify EVERY .py file uses bare imports (from config import ..., from auth.X import ...)
- [ ] Verify main.py uvicorn.run uses 'main:app' (not 'app.main:app')
```

---

## Step 0.3: Present Refactoring Plan to User

**You MUST present the plan and get explicit approval before making changes.**

Present the plan in this format:

```
=== PROJECT REFACTORING PLAN ===

Current structure has the following differences from the target architecture:

1. [CHANGE] nginx is a separate Docker service
   -> Will be merged into the frontend container (multi-stage build)
   -> The frontend container will serve static files AND proxy API requests

2. [CHANGE] Dockerfiles are named backend.Dockerfile / frontend.Dockerfile
   -> Will be renamed to Dockerfile (standard Docker convention)

3. [MOVE] nginx.conf is at project root
   -> Will be moved to frontend/nginx/nginx.conf
   -> A new frontend/nginx/generate-conf.sh will be created

4. [UPDATE] docker-compose.yml has 3 services (backend, frontend, nginx)
   -> Will be reduced to 2 services (backend, frontend)
   -> frontend service will include nginx

5. [FIX] Python imports in auth/ files use wrong prefix "from app."
   -> Backend Dockerfile: WORKDIR /app
   -> docker-compose volume: ./backend/app:/app
   -> Therefore Python import root is /app, and imports must be BARE
   -> All "from app.config import ..." will become "from config import ..."
   -> All "from app.auth.X import ..." will become "from auth.X import ..."
   -> Files to fix: auth/router.py, auth/keycloak.py, auth/middleware.py,
      auth/dependencies.py, auth/jwt_utils.py, main.py (auth imports only)

6. [UPDATE] docker-compose.yml is missing auth environment variables
   -> Will add: KEYCLOAK_DISCOVERY_URL, KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET,
      JWT_SECRET, BASE_PATH, EXTERNAL_HOST, COOKIE_SECURE, JWT_EXPIRE_MINUTES

WHY these env vars are needed:
  - KEYCLOAK_DISCOVERY_URL: URL to Keycloak's OIDC discovery endpoint. FastAPI
    fetches auth endpoints (login, token, userinfo) from here at startup.
  - KEYCLOAK_CLIENT_ID: Identifies this app to Keycloak. Registered in Keycloak admin.
  - KEYCLOAK_CLIENT_SECRET: Secret key for this app's Keycloak client. Used to
    exchange authorization codes for tokens. Keep it secret.
  - JWT_SECRET: Random string (min 32 chars) used to sign the app's own JWT tokens.
    Generate with: openssl rand -base64 32. NOT related to Keycloak -- this is
    the app's internal session token signing key.
  - JWT_EXPIRE_MINUTES: How many minutes of INACTIVITY before the session expires.
    Default: 60. The sliding session middleware resets this on every request.
  - BASE_PATH: URL prefix for the app (e.g. /text-comparison/). Used by nginx to
    route requests, by Vite to set asset paths, by FastAPI to scope cookies.
    MUST end with /. Use / if the app is at the root.
  - EXTERNAL_HOST: The full public URL users type in their browser
    (e.g. http://ml-platform.example.com). Used to construct Keycloak redirect
    URIs and post-login redirects. Must match EXACTLY what users see in the
    browser address bar (scheme + host + port). If behind a reverse proxy,
    use the proxy's public URL, not the internal Docker URL.
  - COOKIE_SECURE: Set to true when using HTTPS, false for local HTTP dev.
    Controls the Secure flag on auth cookies.

Files that will be MODIFIED:
  - docker-compose.yml
  - auth/*.py (import prefix fix)
  - main.py (import prefix fix for auth imports)
  - Makefile (if exists)

Files that will be MOVED:
  - nginx.conf -> frontend/nginx/nginx.conf

Files that will be CREATED:
  - frontend/Dockerfile (replaces frontend.Dockerfile)
  - backend/Dockerfile (replaces backend.Dockerfile)
  - frontend/nginx/generate-conf.sh

Files that will be DELETED (after move):
  - backend/backend.Dockerfile (replaced by backend/Dockerfile)
  - frontend/frontend.Dockerfile (replaced by frontend/Dockerfile)
  - nginx.conf at root (moved to frontend/nginx/)

Proceed with refactoring? (yes/no)
```

**Wait for user confirmation before proceeding.**

---

## Step 0.4: Execute Refactoring

Only after user approval. Execute changes in this order:

### 0.4.1: Fix Python Imports

**Do this FIRST, before touching Docker/infra files.**

If any Python files use the wrong import prefix, fix them now.

**How to find files with wrong imports:**
Search for `from app.` in all Python files under `backend/app/`:
```
grep -r "from app\." backend/app/
```

**For each file found:**
Replace `from app.` with bare imports. Examples:

```python
# BEFORE (wrong):
from app.config import settings
from app.auth.keycloak import load_oidc_config
from app.auth.middleware import SlidingSessionMiddleware
from app.auth.router import router as auth_router
from app.auth.dependencies import get_current_user
from app.auth.jwt_utils import decode_token

# AFTER (correct):
from config import settings
from auth.keycloak import load_oidc_config
from auth.middleware import SlidingSessionMiddleware
from auth.router import router as auth_router
from auth.dependencies import get_current_user
from auth.jwt_utils import decode_token
```

**Also check main.py:** If `uvicorn.run()` uses `'app.main:app'`, change to `'main:app'`.

**VERIFY after fixing imports:**
```
Verify: grep -r "from app\." backend/app/
Expected result: 0 matches (no files should use "from app." prefix)
```

### 0.4.2: Create frontend/nginx/ directory and move nginx config

1. Create `frontend/nginx/` directory
2. Move the existing nginx config to `frontend/nginx/nginx.conf`
3. Simplify it to a base config (http block with buffer sizes only):

```nginx
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    sendfile on;
    keepalive_timeout 65;

    # Large buffers required for Keycloak auth headers and cookies
    proxy_buffer_size       128k;
    proxy_buffers           4 256k;
    proxy_busy_buffers_size 256k;
    large_client_header_buffers 4 32k;

    # Timeouts
    client_max_body_size 100M;
    proxy_connect_timeout 600s;
    proxy_send_timeout 600s;
    proxy_read_timeout 600s;

    include /etc/nginx/conf.d/*.conf;
}
```

**IMPORTANT:** Preserve any existing settings from the old nginx config that are
relevant (timeouts, buffer sizes, client_max_body_size). Do NOT lose them.

### 0.4.3: Create frontend/nginx/generate-conf.sh

```bash
#!/bin/sh
set -e

BASE_PATH="${BASE_PATH:-/}"
BASE_NO_SLASH="${BASE_PATH%/}"

REWRITE_BLOCK=""
if [ "$BASE_NO_SLASH" != "" ]; then
    REWRITE_BLOCK="
    rewrite ^${BASE_NO_SLASH}([^/].*)\$ ${BASE_PATH}\$1 last;
    rewrite ^${BASE_NO_SLASH}\$ ${BASE_PATH} last;"
fi

cat > /etc/nginx/conf.d/default.conf <<EOF
server {
    listen 80;
    absolute_redirect off;
${REWRITE_BLOCK}

    location ${BASE_PATH}api/ {
        proxy_pass http://backend:8000/api/;

        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_http_version 1.1;
        proxy_set_header Connection "";

        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }

    # IMPORTANT: Add a location block for EVERY non-/api/ path that the backend
    # serves (StaticFiles mounts, file-serving endpoints). Without these, the
    # SPA catch-all returns index.html instead of proxying to the backend.
    # Example for a /videos/ mount:
    #
    #   location ${BASE_PATH}videos/ {
    #       proxy_pass http://backend:8000/videos/;
    #       proxy_set_header Host              \$host;
    #       proxy_set_header X-Real-IP         \$remote_addr;
    #       proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
    #       proxy_set_header X-Forwarded-Proto \$scheme;
    #   }
    #
    # Search the backend for: app.mount(), StaticFiles, and non-/api/ @app.get()
    # routes to find all paths that need proxying.

    location ${BASE_PATH} {
        alias /usr/share/nginx/html/;
        try_files \$uri \$uri/ ${BASE_PATH}index.html;
    }
}
EOF

echo "Generated /etc/nginx/conf.d/default.conf with BASE_PATH=${BASE_PATH}"

exec nginx -g 'daemon off;'
```

Make executable: `chmod +x frontend/nginx/generate-conf.sh`

### 0.4.4: Create/update frontend/Dockerfile (multi-stage)

```dockerfile
FROM node:22-alpine AS build

ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}

WORKDIR /app
COPY app/package.json app/package-lock.json* ./
RUN npm install
COPY app/ .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/generate-conf.sh /docker-entrypoint.d/generate-conf.sh
RUN chmod +x /docker-entrypoint.d/generate-conf.sh
EXPOSE 80
CMD ["/bin/sh", "/docker-entrypoint.d/generate-conf.sh"]
```

**IMPORTANT: Understand the COPY context.**

The `build.context` in docker-compose is `frontend/`. So paths in the Dockerfile
are relative to `frontend/`:

```
frontend/           <-- Docker build context
  Dockerfile        <-- This file
  nginx/
    nginx.conf      <-- COPY nginx/nginx.conf ...
    generate-conf.sh <-- COPY nginx/generate-conf.sh ...
  app/
    package.json    <-- COPY app/package.json ...
    src/            <-- COPY app/ .
```

In the build stage, `WORKDIR /app` means npm runs from `/app`. `COPY app/ .`
copies `frontend/app/*` into `/app/` inside the container. After `npm run build`,
the output is at `/app/build` (or `/app/dist` -- check `vite.config` for `build.outDir`).

In the nginx stage, `COPY --from=build /app/build /usr/share/nginx/html` copies
the build output to nginx's serve directory.

### 0.4.5: Create/update backend/Dockerfile

```dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Add any system dependencies the project needs (e.g. wkhtmltopdf, tzdata)
# RUN apt-get update && apt-get install -y ... && rm -rf /var/lib/apt/lists/*

EXPOSE 8000
CMD ["python", "main.py"]
```

**IMPORTANT: Understand the COPY context and WORKDIR.**

The `build.context` in docker-compose is `backend/`. So paths in the Dockerfile
are relative to `backend/`:

```
backend/            <-- Docker build context
  Dockerfile        <-- This file
  requirements.txt  <-- COPY requirements.txt .
  app/              <-- NOT copied in dev mode (mounted as volume instead)
    main.py
    config.py
    ...
```

`WORKDIR /app` sets the working directory. In dev mode, `docker-compose` mounts
`./backend/app:/app`, so the container's `/app` contains the source code.
`CMD ["python", "main.py"]` runs `main.py` from `/app`.

**This is why imports are bare:** Python's `sys.path[0]` is `/app` (the directory
containing `main.py`). So `from config import settings` resolves to `/app/config.py`.

**IMPORTANT:** Preserve any existing system dependencies from the old Dockerfile
(e.g. `wkhtmltopdf`, timezone setup). Copy them into the new Dockerfile.

### 0.4.6: Update docker-compose.yml

Transform to 2-service architecture:

```yaml
version: "3.8"

services:
  backend:
    platform: linux/amd64
    build:
      context: backend
      dockerfile: Dockerfile
    container_name: <project-name>.backend
    environment:
      # Existing app env vars (preserve all of them):
      MONGO_URI: ${MONGO_URI}
      POSTGRESQL_URI: ${POSTGRESQL_URI}
      # ... keep all existing vars ...

      # Auth env vars (new):
      KEYCLOAK_DISCOVERY_URL: ${KEYCLOAK_DISCOVERY_URL}
      KEYCLOAK_CLIENT_ID: ${KEYCLOAK_CLIENT_ID}
      KEYCLOAK_CLIENT_SECRET: ${KEYCLOAK_CLIENT_SECRET}
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRE_MINUTES: ${JWT_EXPIRE_MINUTES:-60}
      BASE_PATH: ${BASE_PATH:-/}
      EXTERNAL_HOST: ${EXTERNAL_HOST}
      COOKIE_SECURE: ${COOKIE_SECURE:-true}
    volumes:
      - ./backend/app:/app
    command: python main.py
    restart: unless-stopped
    networks:
      - app-network

  frontend:
    platform: linux/amd64
    build:
      context: frontend
      dockerfile: Dockerfile
      args:
        BASE_PATH: ${BASE_PATH:-/}
    container_name: <project-name>.frontend
    ports:
      - "${PORT:-7020}:80"
    environment:
      BASE_PATH: ${BASE_PATH:-/}
    volumes:
      - ./frontend/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./frontend/nginx/generate-conf.sh:/docker-entrypoint.d/generate-conf.sh:ro
    command: ["/bin/sh", "/docker-entrypoint.d/generate-conf.sh"]
    restart: unless-stopped
    depends_on:
      - backend
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

**Key points:**
- `build.context: backend` means Dockerfile paths are relative to `backend/`
- `volumes: ./backend/app:/app` mounts source code into WORKDIR for dev
- Backend has NO `ports` section -- only reachable through nginx
- Frontend `build.context: frontend` means Dockerfile paths are relative to `frontend/`
- Frontend `build.args.BASE_PATH` is available at build time for Vite
- Frontend `environment.BASE_PATH` is available at runtime for generate-conf.sh

**IMPORTANT:** Preserve ALL existing environment variables, volumes, and settings
from the old docker-compose. Only ADD the new auth vars and restructure services.

### 0.4.7: Update Makefile (if exists)

Update any targets that reference old service names or paths. For example:
- If `make run` uses `docker compose up`, it should still work
- If paths to Dockerfiles changed, update build targets
- If the nginx service was referenced, remove those references

### 0.4.8: Delete old files

After confirming the new structure works:
- Delete old Dockerfiles (e.g. `backend/backend.Dockerfile`, `frontend/frontend.Dockerfile`)
- Delete old nginx config at project root (if moved to `frontend/nginx/`)

### 0.4.9: Update .env.template

Add all auth env vars with explanations:

```bash
# === Auth: Keycloak OIDC ===
# URL to Keycloak's OpenID Connect discovery endpoint.
# FastAPI fetches login/token/userinfo endpoints from here at startup.
# Format: https://<keycloak-host>/realms/<realm>/.well-known/openid-configuration
KEYCLOAK_DISCOVERY_URL=

# OAuth2 client ID registered in Keycloak admin console for this app.
KEYCLOAK_CLIENT_ID=

# OAuth2 client secret (confidential client). Keep this secret.
KEYCLOAK_CLIENT_SECRET=

# === Auth: JWT Session ===
# Random string (min 32 chars) for signing the app's session JWT tokens.
# Generate: openssl rand -base64 32
# This is NOT a Keycloak secret -- it's the app's own signing key.
JWT_SECRET=

# Session timeout in minutes of INACTIVITY (not since login).
# The sliding session middleware resets the timer on every request.
JWT_EXPIRE_MINUTES=60

# === Deployment ===
# URL prefix for the app. MUST end with /.
# Examples: / (root), /text-comparison/, /myapp/
# Used by: nginx routing, Vite asset paths, FastAPI cookie scope, BrowserRouter basename.
BASE_PATH=/

# Full public URL that users type in their browser (scheme + host + port).
# Used for: Keycloak redirect URI, post-login redirect, cookie domain.
# If behind a reverse proxy, use the PROXY's public URL, not the internal Docker URL.
# Examples: http://localhost:7020, https://ml-platform.example.com
EXTERNAL_HOST=http://localhost:7020

# Set to true when using HTTPS, false for local HTTP development.
# Controls the Secure flag on auth cookies.
COOKIE_SECURE=false
```

**IMPORTANT:** Preserve all existing env vars from the old template. Only ADD these.

---

## Step 0.5: Validate Refactoring

Before proceeding to auth integration, verify:

```
Refactoring Validation:

IMPORTS:
- [ ] grep -r "from app\." backend/app/ returns 0 matches
- [ ] All Python files use bare imports (from config import ..., from auth.X import ...)
- [ ] main.py uvicorn.run uses 'main:app' (not 'app.main:app')
- [ ] No mixed import styles (all files consistent)

DOCKER:
- [ ] backend/Dockerfile has WORKDIR /app
- [ ] backend/Dockerfile does NOT copy source code (dev uses volume mount)
- [ ] frontend/Dockerfile is multi-stage (node build + nginx serve)
- [ ] frontend/Dockerfile COPY paths are relative to frontend/ (build context)
- [ ] docker-compose backend volume is ./backend/app:/app
- [ ] docker-compose backend has NO ports section
- [ ] docker-compose frontend has ports section mapping to 80

INFRASTRUCTURE:
- [ ] docker-compose.yml has exactly 2 services: backend and frontend
- [ ] No separate nginx service exists
- [ ] frontend/nginx/nginx.conf exists with buffer sizes
- [ ] frontend/nginx/generate-conf.sh exists and is executable
- [ ] docker-compose backend has ALL auth env vars (8 total)
- [ ] docker-compose frontend has BASE_PATH as build arg AND runtime env var
- [ ] docker-compose frontend mounts nginx.conf and generate-conf.sh as volumes
- [ ] .env.template has all auth vars with explanations
- [ ] Old Dockerfiles deleted (backend.Dockerfile, frontend.Dockerfile)
- [ ] Old nginx config at root deleted (if moved)
- [ ] Makefile updated (if exists)

SMOKE TEST:
- [ ] docker compose build succeeds
- [ ] docker compose up starts both services
- [ ] Backend logs show no ModuleNotFoundError
- [ ] Frontend serves static files through nginx
- [ ] API requests are proxied to backend through nginx
```

**Only proceed to Phase 1 (Validate) after ALL checks pass.**

---

## Next Step

After refactoring is complete and validated, proceed to `phases/01-validate.md`
to validate dependencies and Keycloak readiness.
