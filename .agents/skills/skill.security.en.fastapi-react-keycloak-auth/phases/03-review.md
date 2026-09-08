# Phase 3: Review

After implementation, review the project against ALL of these checklists.
For each item, **search the actual code** to verify. Do not assume.

---

## 3.0a: Architecture Review (from Phase 0)

```
Architecture:
- [ ] docker-compose.yml has exactly 2 services: backend and frontend
- [ ] No separate nginx service exists
- [ ] backend/Dockerfile exists (not backend.Dockerfile or other name)
- [ ] frontend/Dockerfile exists and is multi-stage (node build + nginx serve)
- [ ] frontend/nginx/nginx.conf exists with large buffer sizes for Keycloak
- [ ] frontend/nginx/generate-conf.sh exists and is executable
- [ ] Backend has NO ports section in docker-compose
- [ ] Frontend maps port 80 to host PORT
- [ ] nginx config is NOT hardcoded -- generated dynamically from BASE_PATH
- [ ] No old Dockerfiles remain (backend.Dockerfile, frontend.Dockerfile)
- [ ] No old nginx config at project root (if it was moved to frontend/nginx/)
```

---

## 3.0b: Pre-Flight Checks (Most Common Failures)

These are the issues that cause the most failures in practice. Check them FIRST.

```
Pre-Flight:
- [ ] ALL Python files use the SAME import prefix (no mixing bare and prefixed)
      Determine correct prefix: read Dockerfile WORKDIR + docker-compose volume mount.
      If WORKDIR=/app and volume=./backend/app:/app, prefix is BARE (no "app." prefix).
      Search: grep -r "from app\." backend/app/   -- should find 0 if using bare imports
      Search: grep -r "from config import" backend/ -- all must resolve correctly
- [ ] main.py uvicorn.run uses correct module path (e.g. 'main:app' not 'app.main:app')
- [ ] Config migration did not break existing imports
      Search: grep -r "from config import" backend/ -- each imported name must exist
      If config uses BaseSettings: names like CLOUD_AD_GROUP are on settings object,
      not module-level. Either aliases exist or consumers use settings.FIELD_NAME
- [ ] Config migration preserved ALL original default values
      Compare each BaseSettings field default with the original config value.
      Hardcoded values (URLs, service addresses, constants) must be IDENTICAL.
      NEVER replaced with "", "https://example.com", or other placeholders.
      Security masking applies to chat output only, NOT to source code files.
- [ ] Frontend auth store export matches all import sites
      If store has "export default useAuthStore" -> all imports must be "import useAuthStore from ..."
      If store has "export const useAuthStore" -> all imports must be "import { useAuthStore } from ..."
- [ ] Auth API calls reach correct URL (not 404)
      If baseURL is /api/v1 and auth is at /api/auth, a SEPARATE authApi instance
      with baseURL: AUTH_API_URL is REQUIRED. Passing BASE_PATH + "/api/auth/me"
      to the business api client does NOT work -- axios concatenates baseURL with
      the path, producing a doubled URL like /prefix/api/v1/prefix/api/auth/me.
      Open browser Network tab and verify /auth/me goes to ${BASE_PATH}/api/auth/me.
- [ ] config.js does not crash on undefined env var
      Must use import.meta.env.BASE_URL (always defined) or add fallback for custom vars
- [ ] docker-compose passes ALL auth env vars to backend
      Required: KEYCLOAK_DISCOVERY_URL, KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET,
      JWT_SECRET, JWT_EXPIRE_MINUTES, BASE_PATH, EXTERNAL_HOST, COOKIE_SECURE
- [ ] jwt_secret validation is CONDITIONAL (only when keycloak_discovery_url is set)
      Unconditional validation breaks dev mode / tests without auth
- [ ] Step 2.9 was completed (existing endpoints are protected)
      Check each router file for Depends(get_current_user)
- [ ] Login page does NOT show layout components (sidebar, header)
      Layout must be conditional on auth state or inside ProtectedRoute
- [ ] A logout button exists somewhere in the UI
- [ ] Non-API backend routes have nginx location blocks
      Search backend for app.mount(), StaticFiles, and non-/api/ @app.get() routes.
      Each needs a location ${BASE_PATH}<path>/ block in generate-conf.sh.
      Backend URLs returned to browser must include BASE_PATH.
      Frontend hardcoded paths must use BASE_PATH from config.
```

---

## 3.1: Security Review

```
Security:
- [ ] JWT cookie has httponly=True (search: set_cookie, httponly)
- [ ] JWT cookie has secure=settings.cookie_secure (not hardcoded False)
- [ ] JWT cookie has samesite="lax"
- [ ] OAuth state generated with secrets.token_urlsafe (not random.random or uuid)
- [ ] OAuth state validated in /callback BEFORE code exchange
- [ ] State cookie has httponly=True and short max_age (300s)
- [ ] No secrets hardcoded in source code (search: password=, secret=, key=)
- [ ] All secrets loaded from environment variables via Settings class
- [ ] .env is in .gitignore
- [ ] .env files are NOT committed (check git status)
- [ ] httpx calls use verify=True in production (search: verify=False)
- [ ] Cookie path is scoped to BASE_PATH (not always "/")
- [ ] No PII logged (search: logger, print, console.log for tokens/passwords)
- [ ] JWT payload contains only non-sensitive fields (no passwords, no full tokens)
```

---

## 3.2: Auth Flow Review

```
Auth Flow:
- [ ] OIDC discovery loaded at startup via lifespan (not on every request)
- [ ] /login redirects to Keycloak with response_type=code
- [ ] /login includes scope=openid email profile
- [ ] /login sets state cookie before redirect
- [ ] /callback reads state from cookie and compares with query param
- [ ] /callback rejects request if state does not match
- [ ] /callback exchanges code for access_token via POST with form data
- [ ] /callback fetches userinfo using the access_token
- [ ] /callback creates app JWT from userinfo (not from Keycloak token)
- [ ] /callback sets JWT cookie and redirects to frontend_url
- [ ] /callback deletes state cookie after successful auth
- [ ] /me returns user data from JWT payload (not from Keycloak)
- [ ] /me requires authentication (uses get_current_user dependency)
- [ ] /logout deletes JWT cookie
- [ ] /logout uses POST method (not GET)
- [ ] /logout returns JSONResponse (not RedirectResponse)
- [ ] Sliding session middleware re-issues JWT on successful responses
- [ ] Middleware skips /api/auth/logout path
- [ ] Middleware skips responses with status >= 400
- [ ] Middleware skips requests without auth cookie
- [ ] Middleware calls decode_token(token) with correct variable name (not parse_token etc.)
```

---

## 3.3: Backend Code Quality

```
Backend Code:
- [ ] No unused imports in any file (especially main.py)
- [ ] create_token() uses user_data.get() consistently (not user.get())
- [ ] exchange_code() function signature is correct: async def exchange_code(code: str) -> dict
- [ ] /me endpoint returns user.get("name"), not user.get("keycloak") or other wrong key
- [ ] config.py model_post_init validates jwt_secret ONLY when keycloak is configured
- [ ] config.py does not have unused "import os" if not needed
- [ ] All router files have correct Depends import from fastapi
- [ ] No duplicate Settings classes
- [ ] settings singleton is created at module level
```

---

## 3.4: Frontend Review

```
Frontend:
- [ ] Axios client has withCredentials: true
- [ ] 401 interceptor redirects to /login on auth failure
- [ ] If single API prefix: 401 interceptor EXCLUDES /auth/me from redirect
- [ ] If dual API prefix: authApi exists as separate axios instance with baseURL: AUTH_API_URL
- [ ] If dual API prefix: auth store imports authApi (named export), NOT default api
- [ ] If dual API prefix: authApi does NOT have a 401 redirect interceptor
- [ ] If dual API prefix: business api 401 interceptor does NOT need /auth/me exclusion
- [ ] Auth store NEVER concatenates BASE_PATH with axios calls (baseURL already has it)
- [ ] Auth store isLoading starts as true (prevents login page flash)
- [ ] Auth store init() calls fetchMe() exactly once
- [ ] fetchMe() sets user on success, sets null on failure
- [ ] fetchMe() sets isLoading to false in BOTH success and failure paths
- [ ] logout() calls POST /auth/logout then clears user state
- [ ] Auth store export style matches all import sites (default vs named)
- [ ] Auth store API calls reach the correct URL (check dual prefix scenario)
- [ ] ProtectedRoute shows loading state while isLoading is true
- [ ] ProtectedRoute redirects to /login when user is null
- [ ] ProtectedRoute renders children when user exists
- [ ] ProtectedRoute uses correct auth store import style
- [ ] ProtectedRoute loading UI uses project's CSS system (not Tailwind if project uses CSS modules)
- [ ] App component calls init() in useEffect on mount
- [ ] BrowserRouter basename matches BASE_PATH
- [ ] Login route is PUBLIC (not wrapped in ProtectedRoute)
- [ ] Login page checks auth state (redirects to / if already logged in)
- [ ] Login page uses window.location.href for login (not fetch/axios)
- [ ] Login page loading UI uses project's CSS system
- [ ] Layout components (Sidebar, Header) do NOT render on login page
- [ ] All existing routes are preserved and wrapped in ProtectedRoute
- [ ] All existing components and business logic are unchanged
- [ ] A logout button exists in the UI and calls authStore.logout()
- [ ] config.js uses import.meta.env.BASE_URL (not custom undefined-prone var)
- [ ] config.js strips trailing slashes from BASE_PATH
- [ ] No TypeScript syntax in .js/.jsx files (if project uses JavaScript)
- [ ] No variable shadowing in interceptors
```

---

## 3.5: Infrastructure Review

```
Infrastructure:
- [ ] Only 2 Docker services: backend and frontend (no separate nginx)
- [ ] nginx is embedded in frontend container (multi-stage Dockerfile)
- [ ] backend/Dockerfile WORKDIR matches docker-compose volume mount target
      (e.g. WORKDIR /app + volume ./backend/app:/app -> Python root is /app)
- [ ] backend/Dockerfile does NOT copy source code (dev uses volume mount)
- [ ] frontend/Dockerfile COPY paths are relative to build context (frontend/)
- [ ] frontend/Dockerfile build output path matches actual Vite output dir
- [ ] frontend/nginx/nginx.conf has proxy_buffer_size >= 128k
- [ ] frontend/nginx/nginx.conf has large_client_header_buffers >= 4 32k
- [ ] frontend/nginx/generate-conf.sh exists and is executable
- [ ] nginx proxies BASE_PATH/api/* to http://backend:8000/api/
- [ ] nginx serves SPA with try_files fallback to index.html
- [ ] nginx sets proxy headers: Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto
- [ ] generate-conf.sh escapes nginx variables (\$host, \$uri, etc.)
- [ ] generate-conf.sh uses exec nginx for proper PID 1
- [ ] generate-conf.sh uses rewrite ... last (NOT return 301) for trailing-slash
- [ ] generate-conf.sh has TWO rewrite rules when BASE_PATH != "/":
      1. rewrite ^/prefix([^/].*)$ /prefix/$1 last; (fixes mangled paths)
      2. rewrite ^/prefix$ /prefix/ last; (adds trailing slash)
- [ ] No return 301 or rewrite ... redirect/permanent in internal nginx
- [ ] docker-compose passes ALL 8 auth env vars to backend
- [ ] docker-compose passes BASE_PATH as build arg to frontend
- [ ] docker-compose mounts generate-conf.sh and nginx.conf as read-only volumes
- [ ] docker-compose sets command to run generate-conf.sh
- [ ] Backend container does NOT expose ports externally
- [ ] .env.template documents all variables with descriptions
- [ ] .env.template includes BOTH auth vars AND existing app vars
- [ ] .env.template explains WHY each auth var is needed (not just the name)
- [ ] BASE_PATH is consistent across: Vite base, BrowserRouter basename,
      nginx location, FastAPI cookie_path, docker-compose env/args
- [ ] EXTERNAL_HOST matches the URL users type in their browser
- [ ] No old Dockerfiles remain (backend.Dockerfile, frontend.Dockerfile)
- [ ] No old nginx config at project root
- [ ] Non-API backend routes (StaticFiles, /videos/, /uploads/, etc.) have
      their own location blocks in generate-conf.sh
      Search: grep -r "app.mount\|StaticFiles" backend/ for all mounts
      Search: grep -r "@app.get\|@app.post" backend/ for non-/api/ endpoints
      Each non-/api/ path needs: nginx location, BASE_PATH in backend URLs,
      BASE_PATH in frontend references
```

---

## 3.6: Common Pitfalls Checklist

| # | Pitfall | How to detect | Fix |
|---|---------|--------------|-----|
| 1 | Wrong import prefix | `ModuleNotFoundError` at startup | All files must use same prefix. Check Dockerfile/WORKDIR/PYTHONPATH. |
| 2 | Config broke existing imports | `ImportError: cannot import name 'X' from 'config'` | Add backward-compatible aliases or update all consumers |
| 3 | Export/import mismatch | `X is undefined` at runtime | Default export needs default import (no curly braces) |
| 4 | Auth calls go to wrong URL | 404 on `/api/v1/auth/me` or double-prefixed URL in Network tab | Create separate `authApi` axios instance with `baseURL: AUTH_API_URL`. NEVER pass `BASE_PATH + "/api/..."` to an axios instance that already has a baseURL -- axios concatenates them, producing a doubled path. |
| 5 | config.js undefined crash | `TypeError: Cannot read properties of undefined` | Use `import.meta.env.BASE_URL` (always defined) |
| 6 | Missing env vars in docker-compose | Backend starts without auth config | Add all 8 auth vars to backend service |
| 7 | Unconditional jwt_secret validation | App won't start without JWT_SECRET | Make validation conditional on keycloak_discovery_url |
| 8 | Endpoints not protected | API accessible without auth | Add `Depends(get_current_user)` to every existing endpoint |
| 9 | Sidebar on login page | Layout renders before auth | Restructure App.jsx to exclude layout from login route |
| 10 | Wrong CSS framework in loading UI | Loading state invisible | Match project's CSS approach (modules, Tailwind, etc.) |
| 11 | No logout button | Users can't log out | Add logout button to user menu/settings |
| 12 | BASE_PATH double slash | URLs like `//api` in network tab | Strip trailing slashes in config.js |
| 13 | Variable shadowing in interceptor | Headers not being set | Use different variable names inside interceptor callbacks |
| 14 | POST endpoint returns RedirectResponse | Frontend gets HTML instead of JSON | Use JSONResponse for endpoints called via fetch/axios |
| 15 | LoginPage missing auth check | Authenticated user sees login page | Check user/isLoading state, redirect if authenticated |
| 16 | `verify=False` in production | Insecure TLS | Use valid certs or mount CA bundle in production |
| 17 | Cookie path mismatch | Cookies not sent for some paths | cookie_path must match nginx location (both use BASE_PATH) |
| 18 | Missing `withCredentials` on axios | Cookies not sent/received | Set `withCredentials: true` on axios client |
| 19 | Infinite redirect loop (401) | App keeps redirecting | If single prefix: exclude `/auth/me` from 401 interceptor. If dual prefix: put 401 interceptor only on business `api`, not on `authApi` (auth store handles errors in try/catch). |
| 20 | `decode_token(wrong_var)` in middleware | Middleware crashes or does nothing | Must be `decode_token(token)`, not `decode_token(parse_token)` |
| 21 | `user.get()` instead of `user_data.get()` in jwt_utils | `NameError` in create_token | Parameter is `user_data`, all .get() calls must use it |
| 22 | `user.get("keycloak")` in /me | Name field returns None | Must be `user.get("name")` |
| 23 | TypeScript files in JS project | Build errors | Create .js/.jsx files if project uses JavaScript |
| 24 | EXTERNAL_HOST mismatch | Wrong redirect after login, cookie on wrong origin | Must match browser URL exactly (scheme + host + port) |
| 25 | Redirect loop behind reverse proxy | "Too many redirects" in browser | Use `rewrite ... last` (not `return 301`) in internal nginx |
| 26 | Separate nginx service | 3 services instead of 2, complex networking | Embed nginx in frontend container via multi-stage Dockerfile |
| 27 | Backend ports exposed | Backend accessible directly, bypassing nginx auth | Remove `ports` from backend service in docker-compose |
| 28 | nginx config hardcoded | BASE_PATH change requires manual nginx edit | Use generate-conf.sh to generate config from BASE_PATH at runtime |
| 29 | Old Dockerfiles not deleted | Confusion about which Dockerfile to use | Delete backend.Dockerfile / frontend.Dockerfile after creating Dockerfile |
| 30 | .env.template missing explanations | Users don't understand what to put in env vars | Add WHY comments for each auth var (see SKILL.md "Environment Variables Explained") |
| 31 | `from app.` prefix when WORKDIR=/app | `ModuleNotFoundError` at startup | If WORKDIR=/app and volume=./backend/app:/app, imports are BARE. `app` is the mount target, not a package. |
| 32 | `uvicorn.run('app.main:app')` | `ModuleNotFoundError` for main module | Must be `'main:app'` when running from WORKDIR=/app |
| 33 | Dockerfile COPY paths wrong for build context | `COPY failed: file not found` during build | COPY paths are relative to docker-compose `build.context`, not project root |
| 34 | Mixed import styles (bare + prefixed) | Some files work, others crash | ALL files must use the same prefix. Fix mismatched files in Phase 0. |
| 35 | Config default values replaced with placeholders | Business logic fails (connection errors, wrong URLs) even though auth works | When converting config to BaseSettings, default values MUST be copied EXACTLY from the original. `FIELD = 'http://real-service:8080'` becomes `field: str = 'http://real-service:8080'`. NEVER replace with `""`, `"https://example.com"`, or any other placeholder. Security masking rules apply to chat output only, NOT to source files. |
| 36 | Non-API backend routes missing from nginx | Static files (videos, uploads, media) return `index.html` or 404 behind nginx with subpath | Add a `location ${BASE_PATH}<path>/` block in `generate-conf.sh` for every non-`/api/` path the backend serves (StaticFiles mounts, file endpoints). Also prefix backend-returned URLs and frontend hardcoded paths with BASE_PATH. |
| 37 | Backend URLs missing BASE_PATH | Browser requests `/videos/file.mp4` instead of `${BASE_PATH}/videos/file.mp4`, gets SPA fallback | Backend endpoints that return file URLs must include BASE_PATH in the URL. Frontend fallback/hardcoded paths must use `${BASE_PATH}/path` from config. |
