# Phase 1: Validate Project

**Prerequisite:** Phase 0 (refactor) is complete. The project matches the target
architecture described in SKILL.md.

Before implementing auth, verify the project meets the prerequisites.
Do NOT skip this phase -- it prevents wasted work and broken builds.

---

## Step 1.0: Verify Target Architecture

Confirm Phase 0 was completed successfully:

```
Architecture Check:
- [ ] docker-compose.yml has exactly 2 services: backend and frontend
- [ ] No separate nginx service
- [ ] backend/Dockerfile exists
- [ ] frontend/Dockerfile exists (multi-stage: node + nginx)
- [ ] frontend/nginx/nginx.conf exists with large buffer sizes
- [ ] frontend/nginx/generate-conf.sh exists and is executable
- [ ] Backend has NO exposed ports in docker-compose
- [ ] Frontend maps port 80 to host
- [ ] docker-compose backend has ALL auth env vars (8 total)
- [ ] .env.template has all auth vars with descriptions
```

**If any check fails, go back to `phases/00-refactor.md` and complete it first.**

---

## Step 1.1: Discover Project Structure

Search for and read these files to understand the project layout:

```
Discovery:
- [ ] Find the backend entrypoint (main.py or equivalent with FastAPI app)
- [ ] Find the backend dependency file (requirements.txt / pyproject.toml)
- [ ] Find the backend config file (config.py or equivalent)
- [ ] Find the frontend package.json
- [ ] Find the frontend entrypoint (App.tsx / App.jsx or equivalent)
- [ ] Find the frontend bundler config (vite.config.ts / vite.config.js)
- [ ] Find the frontend API client (axios instance, if exists)
- [ ] Find .gitignore
```

Record the EXACT paths. All subsequent steps reference these paths.

**IMPORTANT:** Also record:
- The backend directory structure (flat? `src/`? `app/`?)
- How the backend is launched (check Makefile, docker-compose `command`, Dockerfile `CMD`)
- Whether PYTHONPATH is set anywhere
- What import style existing Python files use (bare? `src.` prefix? `app.` prefix?)

---

## Step 1.2: Check Backend Dependencies

Read the backend dependency file. Verify these packages exist:

| Package | Min Version | Purpose | Required |
|---------|-------------|---------|----------|
| `fastapi` | >= 0.100 | Web framework | Yes |
| `uvicorn` or `uvicorn[standard]` | any | ASGI server | Yes |
| `pydantic-settings` | any | Settings from env vars | Yes |
| `httpx` | any | Async HTTP client for Keycloak | Yes |
| `python-jose[cryptography]` | any | JWT encode/decode | Yes |

For each missing package, add it to a "missing backend dependencies" list.

---

## Step 1.3: Check Frontend Dependencies

Read `package.json`. Verify these packages exist in `dependencies`:

| Package | Min Version | Purpose | Required |
|---------|-------------|---------|----------|
| `react` | >= 18 | UI library | Yes |
| `react-dom` | >= 18 | React DOM renderer | Yes |
| `react-router-dom` | >= 6 | Client-side routing | Yes |
| `axios` | >= 1 | HTTP client with interceptors | Yes |
| `zustand` | >= 4 | Auth state management | Yes |

Verify in `devDependencies`:

| Package | Purpose | Required |
|---------|---------|----------|
| `vite` | Bundler with env var support | Yes |

For each missing package, add it to a "missing frontend dependencies" list.

---

## Step 1.4: Check Infrastructure

```
Infrastructure:
- [ ] docker-compose.yml exists (or compose.yaml)
- [ ] nginx config exists with proxy rules
- [ ] .env.template or .env.example exists
- [ ] .gitignore contains .env entry
```

---

## Step 1.5: Check Keycloak Readiness

Ask the user (do NOT read .env files):

1. "What is the Keycloak OIDC discovery URL?"
   (format: `https://<host>/realms/<realm>/.well-known/openid-configuration`)
2. "What is the Keycloak client ID?"
3. "Is the client secret configured? (yes/no)"
4. "What redirect URI is registered in Keycloak?"
   (should be: `EXTERNAL_HOST + BASE_PATH + api/auth/callback`)

---

## Step 1.6: Output Validation Report

Present a structured report:

```
=== AUTH INTEGRATION VALIDATION REPORT ===

Backend entrypoint: <path>
Frontend entrypoint: <path>
Import style: <bare / src-prefixed / app-prefixed>
Frontend language: <js / ts>
Frontend export style: <default / named>
Config format: <module-level vars / BaseSettings>
Config consumers: <list of files that import from config>
Business API prefix: <e.g. /api/v1>
Auth API prefix: /api/auth

BACKEND DEPENDENCIES:
  [OK]  fastapi 0.115.8
  [OK]  uvicorn 0.34.0
  [MISSING] pydantic-settings -- needs to be installed
  [MISSING] httpx -- needs to be installed
  [MISSING] python-jose[cryptography] -- needs to be installed

FRONTEND DEPENDENCIES:
  [OK]  react 19.2.0
  [OK]  react-dom 19.2.0
  [OK]  react-router-dom 7.13.1
  [OK]  axios 1.13.6
  [MISSING] zustand -- needs to be installed

INFRASTRUCTURE:
  [OK]  docker-compose.yml found
  [OK]  nginx config found
  [MISSING] .env.template -- needs to be created

KEYCLOAK:
  [OK]  Discovery URL provided
  [OK]  Client ID provided
  [WARN] Redirect URI not yet configured in Keycloak

READY TO PROCEED: NO (3 backend deps, 1 frontend dep, 1 infra file missing)
```

Wait for user confirmation before proceeding to Phase 2.
If dependencies need to be installed, list the exact commands and ask for approval.

---

## Next Step

After validation passes, complete **Step 0** in the main `SKILL.md`
(Determine Import Style, Export Style, Config Format, API Prefixes),
then proceed to `phases/02-backend.md`.
