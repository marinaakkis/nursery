# Phase 2: Infrastructure (Step 2.17)

**Prerequisites:**
- Phase 0 (refactor) is complete -- project has target architecture
- Phase 1 (validate) is complete
- Backend steps (2.1-2.9) are complete
- Frontend steps (2.10-2.16) are complete

**Note:** Phase 0 already created the Dockerfiles, nginx config, generate-conf.sh,
and docker-compose structure. This phase covers remaining tweaks and verification.

---

## Step 2.17.1: Vite Config

**Read the existing `vite.config.ts` / `vite.config.js` first.**

Ensure these settings exist (ADD, do not overwrite):

- `base: process.env.BASE_PATH || "/"` -- sets the public base path.
  Note: Vite reads `process.env` (Node.js env) at build time. This is then
  available in the browser as `import.meta.env.BASE_URL`.

- Dev proxy for API requests (if not already present):
```javascript
server: {
  proxy: {
    "/api": {
      target: "http://localhost:8000",
      changeOrigin: true,
      secure: false,
    },
  },
},
```

If the project uses a BASE_PATH prefix in dev mode, adapt the proxy key:
```javascript
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");
// ...
proxy: {
  [`${basePath}/api`]: {
    target: "http://localhost:8000",
    changeOrigin: true,
    rewrite: (p) => p.replace(new RegExp(`^${basePath}`), ""),
  },
},
```

**VERIFY:** Existing vite config options (plugins, build options) are preserved.

---

## Step 2.17.2: Verify nginx Config (from Phase 0)

Phase 0 created `frontend/nginx/nginx.conf` and `frontend/nginx/generate-conf.sh`.
Verify they are correct:

```
nginx Verification:
- [ ] frontend/nginx/nginx.conf has proxy_buffer_size >= 128k
- [ ] frontend/nginx/nginx.conf has large_client_header_buffers >= 4 32k
- [ ] frontend/nginx/nginx.conf includes /etc/nginx/conf.d/*.conf
- [ ] frontend/nginx/generate-conf.sh is executable (chmod +x)
- [ ] generate-conf.sh escapes nginx variables with \$ (not bare $)
- [ ] generate-conf.sh uses rewrite ... last (NOT return 301)
- [ ] generate-conf.sh uses exec nginx (proper PID 1)
- [ ] generate-conf.sh has absolute_redirect off
- [ ] API location proxies to http://backend:8000/api/
- [ ] SPA location uses try_files with fallback to index.html
- [ ] Non-API backend routes have their own location blocks
      Search backend for: app.mount(), StaticFiles, and non-/api/ routes.
      Each must have a location ${BASE_PATH}<path>/ block in generate-conf.sh.
      Without this, the SPA catch-all returns index.html for those paths.
```

If any check fails, fix the file now.

---

## Step 2.17.3: Verify docker-compose (from Phase 0)

Phase 0 restructured docker-compose.yml. Verify auth env vars are present:

```
docker-compose Verification:
- [ ] Backend service has: KEYCLOAK_DISCOVERY_URL, KEYCLOAK_CLIENT_ID,
      KEYCLOAK_CLIENT_SECRET, JWT_SECRET, JWT_EXPIRE_MINUTES, BASE_PATH,
      EXTERNAL_HOST, COOKIE_SECURE
- [ ] Frontend service has: BASE_PATH as build arg AND runtime env var
- [ ] Frontend service mounts nginx.conf and generate-conf.sh as :ro volumes
- [ ] Frontend service command runs generate-conf.sh
- [ ] Backend has NO ports section
- [ ] Existing app env vars are preserved (MONGO_URI, POSTGRESQL_URI, etc.)
```

---

## Step 2.17.4: .env.template

Phase 0 should have added auth vars to `.env.template`. Verify they are present
with clear descriptions. If not, add them now:

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

**IMPORTANT:** Preserve all existing env vars. Only ADD these if missing.

---

## Step 2.17.5: .gitignore

Ensure `.gitignore` contains:

```
.env
.env.*
!.env.template
```

---

## Step 2.17.6: External Reverse Proxy (optional)

If the app is deployed behind an external reverse proxy, create a reference config
at `external_nginx/conf.d/default.conf`:

```nginx
server {
    listen 80;

    location = /service {
        return 301 /service/;
    }

    location /service/ {
        proxy_pass http://<internal-host>:7020/service/;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Replace `/service` with actual BASE_PATH (without trailing slash).
Replace `<internal-host>:7020` with actual host and port.

**EXTERNAL_HOST** in `.env` must match the external proxy's public URL,
NOT the internal Docker URL.

---

## Step 2.17.7: Keycloak Client Configuration

Remind the user to configure in Keycloak admin:

| Setting | Value |
|---------|-------|
| Client Protocol | openid-connect |
| Access Type | confidential |
| Valid Redirect URIs | `EXTERNAL_HOST + BASE_PATH + api/auth/callback` |
| Post Logout Redirect URIs | `EXTERNAL_HOST + BASE_PATH` |
| Web Origins | `EXTERNAL_HOST` (or `+` for same as redirect URIs) |

---

## Next Step

Proceed to `phases/03-review.md` for Phase 3 (review checklists).
