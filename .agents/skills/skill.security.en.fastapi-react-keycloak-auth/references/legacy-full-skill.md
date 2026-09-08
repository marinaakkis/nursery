---
name: fastapi-react-keycloak-auth
description: >-
  Integrates Keycloak authentication into FastAPI + React applications using
  OAuth2 Authorization Code flow, httpOnly cookies, backend session/JWT handling,
  and nginx-based frontend routing. Use when a FastAPI + React app needs
  application-side corporate login after the Keycloak hand-off is defined.
---

# FastAPI + React Keycloak Auth

Implements OAuth2 Authorization Code flow: Keycloak handles login UI, FastAPI
exchanges the code for tokens and issues its own JWT in an httpOnly cookie,
React reads auth state via `/api/auth/me`.

## Target Architecture

The project MUST conform to this structure before auth integration begins.
If it does not, run Phase 0 (refactor) first.

```
project-root/
  docker-compose.yml        # 2 services: backend + frontend (nginx embedded)
  .env.template             # All env vars with descriptions
  backend/
    Dockerfile              # Python, installs deps, runs uvicorn
    requirements.txt
    app/                    # Python source (WORKDIR /app)
      main.py               # FastAPI entrypoint
      config.py             # Pydantic BaseSettings
      auth/                 # Auth package (created by this skill)
      routers/              # Business logic routers
      core/                 # Business logic services
      schemas/              # Pydantic models
  frontend/
    Dockerfile              # Multi-stage: node build + nginx serve
    nginx/
      nginx.conf            # Base nginx config (buffer sizes)
      generate-conf.sh      # Generates server block from BASE_PATH at runtime
    app/                    # Frontend source
      package.json
      vite.config.js
      src/
        App.jsx
        config.js
        api.js              # Axios client
        store/              # Zustand stores
        components/
        pages/
```

**Key rules:**
- Only 2 Docker services. No separate nginx service.
- nginx is embedded in the frontend container (multi-stage build).
- Backend has NO exposed ports -- only reachable through nginx.
- nginx config is generated dynamically from BASE_PATH at container start.

**Request flow:**

```
Browser --> nginx (frontend container, port 7020)
  |-- BASE_PATH/api/*  --> FastAPI (backend container :8000)
  |-- BASE_PATH/*      --> React SPA (static files in nginx)

FastAPI <-> Keycloak (OIDC discovery, token exchange, userinfo)
FastAPI --> Browser   (JWT in httpOnly cookie)
```

**Auth flow sequence:**

```
1. Browser GET /api/auth/login
2. FastAPI generates state, sets state cookie, redirects to Keycloak
3. User authenticates in Keycloak
4. Keycloak redirects to /api/auth/callback?code=...&state=...
5. FastAPI validates state, exchanges code for access_token
6. FastAPI fetches userinfo from Keycloak
7. FastAPI creates its own JWT, sets auth_token cookie
8. FastAPI redirects to frontend URL
9. React calls GET /api/auth/me to get user data from JWT
```

---

## Environment Variables Explained

These variables are required for auth. Understanding WHY each exists prevents
misconfiguration.

| Variable | Purpose |
|----------|---------|
| `KEYCLOAK_DISCOVERY_URL` | URL to Keycloak's OIDC discovery endpoint. FastAPI fetches auth endpoints (login, token, userinfo) from here at startup. Format: `https://<host>/realms/<realm>/.well-known/openid-configuration` |
| `KEYCLOAK_CLIENT_ID` | Identifies this app to Keycloak. Registered in Keycloak admin console. |
| `KEYCLOAK_CLIENT_SECRET` | Secret key for this app's Keycloak client. Used to exchange authorization codes for access tokens. Must be kept secret. |
| `JWT_SECRET` | Random string (min 32 chars) for signing the app's own JWT session tokens. Generate with `openssl rand -base64 32`. This is NOT a Keycloak secret -- it is the app's internal signing key. |
| `JWT_EXPIRE_MINUTES` | Minutes of INACTIVITY before session expires. Default: 60. The sliding session middleware resets this timer on every successful request. |
| `BASE_PATH` | URL prefix for the app (e.g. `/text-comparison/`). Used by nginx routing, Vite asset paths, FastAPI cookie scope, and BrowserRouter basename. MUST end with `/`. Use `/` if app is at root. |
| `EXTERNAL_HOST` | Full public URL users type in their browser (e.g. `https://ml-platform.example.com`). Used for Keycloak redirect URIs and post-login redirects. Must match EXACTLY what users see in the address bar (scheme + host + port). If behind a reverse proxy, use the proxy's public URL. |
| `COOKIE_SECURE` | `true` when using HTTPS, `false` for local HTTP dev. Controls the Secure flag on auth cookies. |

---

## CRITICAL SAFETY RULES

Follow these rules throughout ALL phases to avoid breaking existing functionality:

1. **NEVER delete or rename existing files** unless explicitly confirmed by the user.
   Auth code goes into NEW files (e.g. `auth/` subpackage). Existing routers,
   models, and business logic must remain untouched.

2. **NEVER modify existing endpoint signatures, request/response models, or
   business logic.** Auth is added by importing `get_current_user` and adding
   `Depends(get_current_user)` to endpoint parameters. Nothing else changes.

3. **NEVER overwrite `main.py` entirely.** Read the existing file first, then
   ADD the auth imports, lifespan, middleware, and router include alongside
   whatever already exists.

4. **NEVER overwrite `App.tsx`/`App.jsx` entirely.** Read the existing file first,
   then WRAP existing routes with `<ProtectedRoute>` and add the login route.
   Preserve all existing routes, components, and imports.

5. **NEVER overwrite `package.json` or `requirements.txt` entirely.** Only
   APPEND missing dependencies. Preserve existing ones and their versions.

6. **NEVER modify `.env` files.** Only create/update `.env.template`.

7. **Always read a file before editing it.** Compare what exists with what
   needs to be added. Only add the delta.

8. **After EACH step, verify** the file is syntactically valid (no duplicate
   imports, no missing commas, no broken indentation). Use linter checks.

9. **Ask the user before installing new dependencies.** List what will be added
   and wait for confirmation.

10. **Preserve the project's existing code style** (indentation, quotes,
    trailing commas, import ordering). Match what is already in the codebase.

---

## MANDATORY PRE-IMPLEMENTATION: Determine Project Conventions

**You MUST complete this section BEFORE creating or editing ANY file.**
Skip this only for Phase 3 (review).

### Step 0.1: Determine Python Import Style

This is the #1 source of bugs. Get it wrong and NOTHING will work.

**The rule:** The import prefix is determined by the relationship between
the Dockerfile WORKDIR, the docker-compose volume mount, and the Python
source directory. See `phases/00-refactor.md` section "THE IMPORT STANDARD"
for a detailed explanation with diagrams.

**Quick determination:**

1. Read the backend Dockerfile — find `WORKDIR` (e.g. `/app`)
2. Read docker-compose.yml — find `volumes` (e.g. `./backend/app:/app`)
3. The directory mounted to WORKDIR is the import root
4. All imports are relative to that root

| Dockerfile WORKDIR | docker-compose volume | command | Import style |
|---|---|---|---|
| `/app` | `./backend/app:/app` | `python main.py` | `from config import ...` (bare) |
| `/app` | `./backend:/app` | `python app/main.py` | `from app.config import ...` |
| `/app` | `./backend:/app` | `uvicorn src.main:app` | `from src.config import ...` |
| `/app/src` | `./backend/src:/app/src` | `python main.py` | `from config import ...` (bare) |

5. Read 2-3 existing `.py` files and CONFIRM they match the expected style
6. If any files use a DIFFERENT prefix (e.g. auth files use `from app.` but
   business logic uses bare imports), the mismatched files are WRONG

**Write down your answer:**
```
IMPORT_PREFIX = ""       # e.g. "" for bare, "src." for src-prefixed, "app." for app-prefixed
EXAMPLE: from {IMPORT_PREFIX}config import settings
```

**CRITICAL:** Every `.py` file you create MUST use this same prefix. A single
file with a wrong prefix will crash the app with `ModuleNotFoundError`.

**COMMON TRAP:** If WORKDIR is `/app` and the source is in `backend/app/`,
the prefix is BARE (empty string), NOT `app.`. The `app` directory name is
the mount target, not a Python package. `from app.config import ...` would
look for `/app/app/config.py` which does not exist.

### Step 0.2: Determine Frontend Language and Export Style

1. Check file extensions: `.js`/`.jsx` or `.ts`/`.tsx`?
2. Read 2-3 existing store/component files. Note:
   - Default export (`export default X`) vs named export (`export const X`)?
   - Quote style: single or double?
   - Semicolons: yes or no?
   - Path aliases: `@/` or relative `../`?

**Write down your answer:**
```
LANGUAGE = "js"          # "js" or "ts"
EXPORT_STYLE = "default" # "default" or "named"
QUOTES = "single"        # "single" or "double"
PATH_STYLE = "relative"  # "relative" (../foo) or "alias" (@/foo)
```

**CRITICAL on exports:** If existing stores use `export default useXStore`,
then your auth store MUST also use `export default useAuthStore`, and all
imports MUST use `import useAuthStore from '...'` (without curly braces).
Mixing `export default` with `import { X }` will crash at runtime.

### Step 0.3: Determine Config Format and Consumers

1. Read the backend config file (`config.py` or similar)
2. Note the format: module-level variables or Pydantic BaseSettings?
3. If module-level variables: search for ALL files that import from config:
   `grep -r "from config import" backend/`
4. Record every consumer file and what it imports

**If config uses module-level variables and you need to add BaseSettings:**
You have TWO options (pick one):

**Option A (recommended): Add backward-compatible aliases at end of config.py**
```python
class Settings(BaseSettings):
    CLOUD_AD_GROUP: str = 'default'
    # ... all fields ...

settings = Settings()

# Backward compatibility -- existing code imports these names directly
CLOUD_AD_GROUP = settings.CLOUD_AD_GROUP
AIGATEWAY_URL = settings.AIGATEWAY_URL
# ... one alias per consumed name ...
```

**Option B: Update all consumers**
Change every `from config import FIELD_NAME` to
`from config import settings` then use `settings.FIELD_NAME`.

**NEVER leave consumers importing names that no longer exist.** This crashes
the app with `ImportError`. Search and verify EVERY import.

**CRITICAL: Preserve ALL existing default values exactly as they are.**
When converting from module-level variables to BaseSettings fields:
- If the original has a hardcoded value (`FIELD = 'http://service:8080'`),
  the BaseSettings field MUST use that SAME value as its default.
- If the original reads from env (`FIELD = os.environ['VAR']`), the
  BaseSettings field should have no default or `""`, and the env var
  must be passed via docker-compose `environment` section.
- NEVER replace real URLs, service addresses, or constants with
  placeholders like `"https://example.com"` or empty strings.
- NEVER sanitize or mask values in the actual source file. Security
  rules about masking apply only to chat output, NOT to code files.

### Step 0.4: Determine API Route Prefixes

1. Read the existing routers. Note their URL prefix (e.g. `/api/v1`, `/api`).
2. The auth router will be mounted at `/api/auth`.
3. If the existing prefix differs from `/api` (e.g. `/api/v1`), the frontend
   must handle TWO base URLs:
   - Business API: `${BASE_PATH}/api/v1`
   - Auth API: `${BASE_PATH}/api/auth`

Record:
```
BUSINESS_API_PREFIX = "/api/v1"   # or "/api" or whatever exists
AUTH_API_PREFIX = "/api/auth"     # always this
```

This affects the axios client configuration in Step 2.12.

---

## COMMON AGENT MISTAKES

Read this section BEFORE implementing. Check each item AFTER implementing.

### 1. Wrong Import Prefix (CRITICAL)

**Symptom:** `ModuleNotFoundError` at startup.
**Cause:** Auth files use `from app.config import settings` but the project uses
bare imports (`from config import settings`). This happens when the agent sees
the directory is called `backend/app/` and assumes imports need an `app.` prefix.
But the Docker volume mounts `backend/app` to WORKDIR `/app`, so `/app` IS the
Python root and imports are bare.
**Fix:** Complete Step 0.1. Read the Dockerfile WORKDIR + docker-compose volume
to determine the correct prefix. Use the SAME prefix in every file. See
`phases/00-refactor.md` "THE IMPORT STANDARD" for the full explanation.

### 2. Config Migration Breaks Existing Code (CRITICAL)

**Symptom:** `ImportError: cannot import name 'FIELD_NAME' from 'config'`.
**Cause:** Config was converted from module-level variables to BaseSettings class
but existing files still do `from config import FIELD_NAME`.
**Fix:** Complete Step 0.3. Add backward-compatible aliases or update all consumers.

### 2b. Config Migration Replaces Hardcoded Default Values (CRITICAL)

**Symptom:** Business logic fails at runtime (connection errors, wrong URLs, wrong
behavior) even though auth works fine.
**Cause:** When converting `config.py` from module-level variables to BaseSettings,
the agent replaced existing hardcoded default values (URLs, service addresses,
constants) with empty strings or placeholder values like `"https://example.com"`.
**Example of the bug:**
```python
# ORIGINAL config.py:
USERS_SERVICE_URL = 'http://internal-service.corp:18080'
MARKER_URL = 'http://internal-service.corp:16666'

# WRONG -- agent replaced real defaults with placeholders:
class Settings(BaseSettings):
    users_service_url: str = "https://example.com:18080"  # WRONG!
    marker_url: str = ""                                    # WRONG!

# CORRECT -- preserve the original default values exactly:
class Settings(BaseSettings):
    users_service_url: str = "http://internal-service.corp:18080"  # SAME as original
    marker_url: str = "http://internal-service.corp:16666"          # SAME as original
```
**Rule:** When migrating config to BaseSettings, the default value for each field
MUST be EXACTLY the same as the original hardcoded value. If the original code had
`FIELD = 'some-value'`, the BaseSettings field must have `field: str = 'some-value'`.
If the original code had `FIELD = os.environ['VAR']` (no default), the BaseSettings
field should have NO default (or `""` if it must be optional) and the env var must
be passed via docker-compose. NEVER replace real values with placeholders or examples.

### 3. Export/Import Mismatch in JavaScript (CRITICAL)

**Symptom:** `X is not a function` or `X is undefined` at runtime.
**Cause:** Store uses `export default useAuthStore` but components import as
`import { useAuthStore }` (named import), or vice versa.
**Fix:** Complete Step 0.2. Match the project's export convention exactly.

### 4. Auth API Calls Go to Wrong URL (CRITICAL)

**Symptom:** 404 errors on `/api/v1/auth/me` or double-prefixed URLs like
`/text-comparison/api/v1/text-comparison/api/auth/me`.
**Cause:** Axios client `baseURL` is set to `${BASE_PATH}/api/v1` but auth
endpoints are at `/api/auth`. Passing `BASE_PATH + "/api/auth/me"` to
`api.get()` does NOT bypass `baseURL` -- axios only ignores `baseURL` for
fully-qualified URLs (starting with `http://`). A path starting with `/` is
still treated as relative and gets concatenated with `baseURL`.
**Fix:** Create a SEPARATE `authApi` axios instance with
`baseURL: AUTH_API_URL` (`${BASE_PATH}/api`). The auth store imports `authApi`
and uses clean relative paths (`"/auth/me"`, `"/auth/logout"`).
See Step 2.12 Scenario B for the correct implementation.

### 5. config.js Crashes When Env Var Is Undefined (CRITICAL)

**Symptom:** `TypeError: Cannot read properties of undefined (reading 'replace')`.
**Cause:** `import.meta.env.VITE_BASE_PATH.replace(...)` when `VITE_BASE_PATH` is not set.
**Fix:** Always use `import.meta.env.BASE_URL` (Vite's built-in, always defined) or
add a fallback: `(import.meta.env.VITE_BASE_PATH || "").replace(...)`.

### 6. docker-compose Missing Auth Env Vars (CRITICAL)

**Symptom:** Backend starts without Keycloak config, or crashes with `ValueError`.
**Cause:** New auth env vars not added to docker-compose `environment` section.
**Fix:** Add ALL auth vars to backend service: `KEYCLOAK_DISCOVERY_URL`,
`KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, `JWT_SECRET`, `JWT_EXPIRE_MINUTES`,
`BASE_PATH`, `EXTERNAL_HOST`, `COOKIE_SECURE`.

### 7. Unconditional jwt_secret Validation (HIGH)

**Symptom:** App won't start without `JWT_SECRET` even in dev mode without auth.
**Cause:** `model_post_init` always raises `ValueError` when `jwt_secret is None`.
**Fix:** Only validate `jwt_secret` when `keycloak_discovery_url` is set (auth enabled).

### 8. Step 2.9 Skipped -- Endpoints Not Protected (HIGH)

**Symptom:** All API endpoints accessible without authentication.
**Cause:** Existing router files still use the old auth dependency.
**Fix:** Go through EVERY existing router file and replace the old auth dependency
with `Depends(get_current_user)`. This step modifies existing files.

### 9. Sidebar/Layout Renders on Login Page (HIGH)

**Symptom:** Login page shows the app's sidebar, header, or other layout components.
Sidebar may trigger API calls that fail with 401 before user is authenticated.
**Cause:** App.jsx renders layout components outside `<Routes>`, so they appear
on every page including `/login`.
**Fix:** In Step 2.16, conditionally render layout based on auth state or restructure
routes so the login page has its own layout.

### 10. Loading States Use Wrong CSS Framework (MEDIUM)

**Symptom:** Loading spinner/text is unstyled or invisible.
**Cause:** Skill examples use Tailwind classes (`flex`, `items-center`, `h-screen`)
but the project uses CSS modules or another system.
**Fix:** Adapt loading UI to match the project's existing design system. Read existing
components to see what CSS approach is used.

### 11. No Logout Button in UI (MEDIUM)

**Symptom:** Users can log in but never log out.
**Cause:** `authStore.logout` exists but no UI element calls it.
**Fix:** Add a logout button/link to the user menu or settings panel.

### 12. BASE_PATH Trailing Slash in Frontend Config

**Rule:** BASE_PATH must NOT end with a trailing slash. Strip it:
```javascript
const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
export const BASE_PATH = base || "";
```
If BASE_PATH ends with `/`, then `${BASE_PATH}/api` produces `//api`.

### 13. Variable Shadowing in Interceptors

When adding request interceptors, NEVER reuse the parameter name for inner variables:
```javascript
// BAD -- shadows the axios config parameter
api.interceptors.request.use((config) => {
  const config = JSON.parse(...)  // SHADOWS outer config!
})
// GOOD
api.interceptors.request.use((config) => {
  const savedCfg = JSON.parse(...)
  return config
})
```

### 14. POST Endpoints Called via fetch/axios Must Return JSONResponse

If the frontend calls an endpoint via `fetch()` or `axios.post()`, the backend
MUST return `JSONResponse`, NOT `RedirectResponse`. Only use `RedirectResponse`
for endpoints the browser navigates to directly (like `/api/auth/login`).

### 15. LoginPage Must Check Auth State

The login page MUST import the auth store, show loading while `isLoading` is true,
and redirect to `/` if `user` is already set.

### 16. JavaScript vs TypeScript

If the project uses `.js`/`.jsx`: create `.js`/`.jsx` files, not `.ts`/`.tsx`.
Do NOT add TypeScript type annotations to JavaScript files.
Do NOT create TypeScript interfaces -- use JSDoc `@typedef` if needed.

### 17. Unused Imports

Do NOT add imports that are not used in the file.

### 18. Non-API Backend Routes Missing from nginx (CRITICAL)

**Symptom:** Static files served by FastAPI (videos, uploads, media) return
`index.html` or 404 when the app is deployed behind nginx with a subpath.
**Cause:** nginx only has location blocks for `${BASE_PATH}api/` and the SPA
catch-all `${BASE_PATH}`. If the backend serves files at `/videos/`, `/uploads/`,
or any other non-`/api/` path, there is no nginx location to proxy those
requests to the backend. The SPA catch-all matches instead and returns
`index.html`.
**Fix:** For EVERY non-`/api/` path that the backend serves (e.g. StaticFiles
mounts, file-serving endpoints), add a corresponding location block in
`generate-conf.sh`:
```
location ${BASE_PATH}videos/ {
    proxy_pass http://backend:8000/videos/;
    # ... same proxy headers as the api location ...
}
```
**Also fix the URLs returned by the backend.** If an endpoint returns URLs
like `"/videos/file.mp4"`, those URLs must include BASE_PATH so the browser
requests `${BASE_PATH}/videos/file.mp4`, not `/videos/file.mp4`.
**Also fix frontend fallback URLs.** If the frontend has hardcoded paths like
`const FALLBACK_URL = '/videos/file.mp4'`, they must use BASE_PATH from config:
`` const FALLBACK_URL = `${BASE_PATH}/videos/file.mp4` ``

### 19. Audit for Non-API Backend Routes

**MANDATORY during Phase 0 and Phase 2 (infra):** Before finalizing the nginx
config, scan the backend for ALL routes and static file mounts that are NOT
under `/api/`:
```python
# Search for StaticFiles mounts:
app.mount("/videos", StaticFiles(...))
app.mount("/uploads", StaticFiles(...))
app.mount("/static", StaticFiles(...))

# Search for non-/api/ endpoints:
@app.get("/files/{filename}")
@app.get("/download/{id}")
```
Each of these needs:
1. A `location` block in `generate-conf.sh` to proxy to the backend
2. Backend URLs prefixed with BASE_PATH (if returned to the browser)
3. Frontend references prefixed with BASE_PATH (if hardcoded)

---

## How to Use This Skill

Four phases -- run in order. **Each phase is in a separate file.**
Read ONLY the phase file you need at each step.

| Phase | File | When to use |
|-------|------|-------------|
| **Phase 0: Refactor** | `phases/00-refactor.md` | FIRST: bring project to target architecture |
| **Phase 1: Validate** | `phases/01-validate.md` | Check stack, dependencies, Keycloak readiness |
| **Phase 2: Implement (Backend)** | `phases/02-backend.md` | Steps 2.1-2.9: all backend auth code |
| **Phase 2: Implement (Frontend)** | `phases/02-frontend.md` | Steps 2.10-2.16: all frontend auth code |
| **Phase 2: Implement (Infra)** | `phases/02-infra.md` | Step 2.17: remaining infra tweaks |
| **Phase 3: Review** | `phases/03-review.md` | After implementation -- verify correctness |

**Workflow:**
1. Read `phases/00-refactor.md` -- refactor project to target architecture.
   **Present a refactoring plan to the user and wait for approval.**
   Explain WHY each env var is needed (see "Environment Variables Explained" above).
2. Read `phases/01-validate.md` -- validate dependencies and Keycloak readiness
3. Complete Step 0 (above) -- determine import style, export style, config format
4. Read `phases/02-backend.md` -- complete backend steps
5. Read `phases/02-frontend.md` -- complete frontend steps
6. Read `phases/02-infra.md` -- complete remaining infrastructure steps
7. Read `phases/03-review.md` -- run all checklists
