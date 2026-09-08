# Phase 2: Backend Implementation (Steps 2.1 -- 2.9)

**Prerequisites:**
- Phase 1 (validate) is complete
- Step 0 from SKILL.md is complete -- you know:
  - `IMPORT_PREFIX` (e.g. `""` for bare imports, `"src."` for src-prefixed)
  - Config format (module-level vars or BaseSettings)
  - List of config consumers (files that `from config import ...`)
  - `BUSINESS_API_PREFIX` (e.g. `/api/v1`)

**In all code examples below, `<pkg>` is a placeholder for your `IMPORT_PREFIX`.**
Replace `<pkg>.` with your actual prefix. If bare imports (the standard case when
WORKDIR=/app and volume is ./backend/app:/app), remove `<pkg>.` entirely
(e.g. `from config import settings`, `from auth.keycloak import ...`).

**REMINDER:** The import prefix is determined by the Docker setup, NOT by the
directory name on the host. If the Dockerfile has `WORKDIR /app` and docker-compose
mounts `./backend/app:/app`, then `/app` is the Python root and imports are BARE.
`from app.config import ...` is WRONG because it looks for `/app/app/config.py`.
See `phases/00-refactor.md` "THE IMPORT STANDARD" for the full explanation.

---

## Step 2.1: Backend Config (`config.py`)

**Precondition:** `pydantic-settings` is installed.

**Action:** Read the existing config file. Then:

**If config already uses BaseSettings:** ADD auth fields to the existing class.
Do NOT create a second Settings class.

**If config uses module-level variables (e.g. `FIELD = os.getenv(...)`):**
Convert to BaseSettings AND add backward-compatible aliases. See Step 0.3 in SKILL.md.

**CRITICAL: Preserve ALL existing default values EXACTLY as they are.**
When converting `FIELD = 'http://real-service:8080'` to a BaseSettings field,
the default MUST be `'http://real-service:8080'` -- the SAME value. NEVER replace
real URLs, service addresses, or constants with placeholders, empty strings, or
example values. Security masking rules apply only to chat output, NOT to source files.
If a value was hardcoded in the original config, it stays hardcoded as the default.
If a value came from `os.environ['VAR']` (no default), make the field required or
default to `""` and ensure the env var is passed via docker-compose.

**Fields to add:**

| Field | Type | Default | Env Var |
|-------|------|---------|---------|
| `keycloak_discovery_url` | `Optional[str]` | `None` | `KEYCLOAK_DISCOVERY_URL` |
| `keycloak_client_id` | `Optional[str]` | `None` | `KEYCLOAK_CLIENT_ID` |
| `keycloak_client_secret` | `Optional[str]` | `None` | `KEYCLOAK_CLIENT_SECRET` |
| `jwt_secret` | `Optional[str]` | `None` | `JWT_SECRET` |
| `jwt_algorithm` | `str` | `"HS256"` | `JWT_ALGORITHM` |
| `jwt_expire_minutes` | `int` | `60` | `JWT_EXPIRE_MINUTES` |
| `base_path` | `str` | `"/"` | `BASE_PATH` |
| `external_host` | `Optional[str]` | `None` | `EXTERNAL_HOST` |
| `cookie_secure` | `bool` | `True` | `COOKIE_SECURE` |

**Computed properties to add:**

```python
@property
def redirect_uri(self) -> str:
    base = self.external_host.rstrip("/")
    path = self.base_path.rstrip("/")
    return f"{base}{path}/api/auth/callback"

@property
def frontend_url(self) -> str:
    base = self.external_host.rstrip("/")
    path = self.base_path.rstrip("/")
    return f"{base}{path}/"

@property
def cookie_path(self) -> str:
    return self.base_path if self.base_path != "/" else "/"
```

**Startup validation -- MUST be conditional on auth being enabled:**

```python
def model_post_init(self, __context):
    if self.keycloak_discovery_url:
        if not self.keycloak_client_id:
            raise ValueError("KEYCLOAK_CLIENT_ID required when KEYCLOAK_DISCOVERY_URL is set")
        if not self.keycloak_client_secret:
            raise ValueError("KEYCLOAK_CLIENT_SECRET required when KEYCLOAK_DISCOVERY_URL is set")
        if not self.external_host:
            raise ValueError("EXTERNAL_HOST required when Keycloak is configured")
        if not self.jwt_secret:
            raise ValueError("JWT_SECRET required when Keycloak is configured")
```

**CRITICAL:** The `jwt_secret` check MUST be inside the `if self.keycloak_discovery_url`
block. If it's unconditional, the app won't start without `JWT_SECRET` even when
auth is disabled (dev mode, tests, etc.).

Set `model_config = SettingsConfigDict(env_prefix="")` (pydantic-settings v2) or
`class Config: env_prefix = ""` (v1) so env var names match field names in uppercase.

**VERIFY after this step:**
- [ ] `from <pkg>config import settings` works (test mentally: does the import match the project's style?)
- [ ] All EXISTING imports from config still work (check every consumer from Step 0.3)
- [ ] If you added backward-compatible aliases, verify each alias matches an existing consumer

---

## Step 2.2: Backend Auth Package Init

**Action:** Create `auth/__init__.py` in the backend source directory:

```python
"""Authentication package for Keycloak OIDC + JWT cookie authentication."""
```

**VERIFY:** The `auth/` directory is at the same level as `config.py` so that
`from <pkg>auth.keycloak import ...` resolves correctly.

---

## Step 2.3: Backend Keycloak OIDC Client (`auth/keycloak.py`)

**Precondition:** `config.py` with `settings` singleton exists. `httpx` is installed.

**Action:** Create `auth/keycloak.py`:

```python
import logging
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

from <pkg>config import settings

logger = logging.getLogger(__name__)


@dataclass
class OIDCConfig:
    authorization_endpoint: str
    token_endpoint: str
    userinfo_endpoint: str
    end_session_endpoint: str


_oidc_config: OIDCConfig | None = None


def get_oidc_config() -> OIDCConfig:
    if _oidc_config is None:
        raise RuntimeError("OIDC config not loaded -- call load_oidc_config() first")
    return _oidc_config


async def load_oidc_config() -> None:
    global _oidc_config
    async with httpx.AsyncClient(verify=False) as client:
        resp = await client.get(settings.keycloak_discovery_url, timeout=10)
        resp.raise_for_status()
        data = resp.json()

    _oidc_config = OIDCConfig(
        authorization_endpoint=data["authorization_endpoint"],
        token_endpoint=data["token_endpoint"],
        userinfo_endpoint=data["userinfo_endpoint"],
        end_session_endpoint=data["end_session_endpoint"],
    )
    logger.info("OIDC discovery loaded from %s", settings.keycloak_discovery_url)


def get_authorization_url(state: str) -> str:
    cfg = get_oidc_config()
    params = {
        "response_type": "code",
        "client_id": settings.keycloak_client_id,
        "redirect_uri": settings.redirect_uri,
        "state": state,
        "scope": "openid email profile",
    }
    return f"{cfg.authorization_endpoint}?{urlencode(params)}"


async def exchange_code(code: str) -> dict:
    cfg = get_oidc_config()
    payload = {
        "grant_type": "authorization_code",
        "client_id": settings.keycloak_client_id,
        "client_secret": settings.keycloak_client_secret,
        "code": code,
        "redirect_uri": settings.redirect_uri,
    }
    async with httpx.AsyncClient(verify=False) as client:
        resp = await client.post(cfg.token_endpoint, data=payload, timeout=10)
        resp.raise_for_status()
        return resp.json()


async def get_userinfo(access_token: str) -> dict:
    cfg = get_oidc_config()
    async with httpx.AsyncClient(verify=False) as client:
        resp = await client.get(
            cfg.userinfo_endpoint,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
```

**Key details:**
- `verify=False` is for dev only. In production, use valid TLS certs or mount CA.
- `exchange_code` sends form data (not JSON) -- required by OAuth2 spec.
- `load_oidc_config()` is called once at startup via FastAPI lifespan.

**VERIFY after this step:**
- [ ] The import `from <pkg>config import settings` uses YOUR determined prefix
- [ ] No typos in function signatures (especially `async def exchange_code(code: str)`)

---

## Step 2.4: Backend JWT Utilities (`auth/jwt_utils.py`)

**Precondition:** `config.py` with `settings` exists. `python-jose` is installed.

**Action:** Create `auth/jwt_utils.py`:

```python
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from <pkg>config import settings


def create_token(user_data: dict) -> str:
    payload = {
        "sub": user_data.get("sub", ""),
        "email": user_data.get("email", ""),
        "name": user_data.get("name", ""),
        "preferred_username": user_data.get("preferred_username", ""),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
```

**CRITICAL:** The parameter name is `user_data`. Every `.get()` call MUST use
`user_data.get(...)`, not `user.get(...)`. This is a common copy-paste error.

**VERIFY after this step:**
- [ ] All `.get()` calls use `user_data`, not `user` or any other name
- [ ] Import uses YOUR determined prefix

---

## Step 2.5: Backend Auth Dependency (`auth/dependencies.py`)

**Precondition:** `auth/jwt_utils.py` exists.

**Action:** Create `auth/dependencies.py`:

```python
from fastapi import HTTPException, Request, status

from <pkg>auth.jwt_utils import decode_token

COOKIE_NAME = "auth_token"


def get_current_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = decode_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    return payload
```

**VERIFY:** Import `from <pkg>auth.jwt_utils` uses YOUR determined prefix.

---

## Step 2.6: Backend Auth Router (`auth/router.py`)

**Precondition:** Steps 2.3-2.5 are complete.

**Action:** Create `auth/router.py`:

```python
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, RedirectResponse

from <pkg>auth.dependencies import COOKIE_NAME, get_current_user
from <pkg>auth.jwt_utils import create_token
from <pkg>auth.keycloak import exchange_code, get_authorization_url, get_userinfo
from <pkg>config import settings

router = APIRouter()

STATE_COOKIE = "oauth_state"


@router.get("/login")
async def login():
    state = secrets.token_urlsafe(32)
    authorization_url = get_authorization_url(state)
    response = RedirectResponse(
        url=authorization_url, status_code=status.HTTP_302_FOUND
    )
    response.set_cookie(
        key=STATE_COOKIE,
        value=state,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=300,
        path=settings.cookie_path,
    )
    return response


@router.get("/callback")
async def callback(code: str, state: str, request: Request):
    saved_state = request.cookies.get(STATE_COOKIE)
    if not saved_state or saved_state != state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid state parameter",
        )

    token_data = await exchange_code(code)
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to obtain access token",
        )

    userinfo = await get_userinfo(access_token)
    jwt_token = create_token(userinfo)

    response = RedirectResponse(
        url=settings.frontend_url, status_code=status.HTTP_302_FOUND
    )
    response.set_cookie(
        key=COOKIE_NAME,
        value=jwt_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.jwt_expire_minutes * 60,
        path=settings.cookie_path,
    )
    response.delete_cookie(key=STATE_COOKIE, path=settings.cookie_path)
    return response


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {
        "sub": user.get("sub"),
        "email": user.get("email"),
        "name": user.get("name"),
        "preferred_username": user.get("preferred_username"),
    }


@router.post("/logout")
async def logout():
    resp = JSONResponse(content={"detail": "Logged out"})
    resp.delete_cookie(key=COOKIE_NAME, path=settings.cookie_path)
    return resp
```

**Key details:**
- `/login` is accessed via browser navigation (`window.location.href`), so
  `RedirectResponse` is correct here.
- `/logout` is called via `axios.post()`, so it returns `JSONResponse`.
- In `/me`, `user.get("name")` is correct -- `user` here is the decoded JWT
  payload dict returned by `get_current_user`, NOT the `user_data` parameter.

**VERIFY after this step:**
- [ ] ALL imports use YOUR determined prefix
- [ ] `/me` returns `user.get("name")`, NOT `user.get("keycloak")` or any other wrong key

---

## Step 2.7: Backend Sliding Session Middleware (`auth/middleware.py`)

**Precondition:** Steps 2.4-2.5 are complete.

**Action:** Create `auth/middleware.py`:

```python
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from <pkg>auth.dependencies import COOKIE_NAME
from <pkg>auth.jwt_utils import create_token, decode_token
from <pkg>config import settings


class SlidingSessionMiddleware(BaseHTTPMiddleware):
    SKIP_PATHS = ("/api/auth/logout",)

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)

        token = request.cookies.get(COOKIE_NAME)
        if token is None or response.status_code >= 400:
            return response

        if request.url.path in self.SKIP_PATHS:
            return response

        payload = decode_token(token)
        if payload is None:
            return response

        new_token = create_token(payload)
        response.set_cookie(
            key=COOKIE_NAME,
            value=new_token,
            httponly=True,
            secure=settings.cookie_secure,
            samesite="lax",
            max_age=settings.jwt_expire_minutes * 60,
            path=settings.cookie_path,
        )
        return response
```

**CRITICAL:** The argument to `decode_token()` MUST be `token` (the variable
from line `token = request.cookies.get(COOKIE_NAME)`). A common copy-paste error
is writing `decode_token(parse_token)` or `decode_token(request)` instead.

**VERIFY after this step:**
- [ ] `decode_token(token)` -- argument is `token`, not anything else
- [ ] ALL imports use YOUR determined prefix

---

## Step 2.8: Backend -- Wire Up main.py

**CRITICAL: Read the existing main.py first. Do NOT overwrite it.**

**Action:** Make these ADDITIONS to the existing main.py:

1. **Add imports** (at the top, alongside existing imports):

```python
from contextlib import asynccontextmanager
from <pkg>auth.keycloak import load_oidc_config
from <pkg>auth.middleware import SlidingSessionMiddleware
from <pkg>auth.router import router as auth_router
```

2. **Add or modify the lifespan** function. If the project already has a lifespan,
   add `await load_oidc_config()` as the FIRST line inside it. If no lifespan
   exists, create one:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await load_oidc_config()
    yield
```

Then pass `lifespan=lifespan` to the `FastAPI()` constructor.

3. **Add middleware** (AFTER the app is created, BEFORE routers):

```python
app.add_middleware(SlidingSessionMiddleware)
```

4. **Add auth router** (alongside existing routers):

```python
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
```

5. **Add health endpoint** if one does not already exist:

```python
@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

**DO NOT remove or modify any existing routers, middleware, or endpoints.**

**VERIFY after this step:**
- [ ] Auth imports use YOUR determined prefix (same as steps 2.2-2.7)
- [ ] Existing imports are UNCHANGED (same bare/prefixed style as before)
- [ ] No duplicate imports
- [ ] `lifespan=lifespan` is passed to `FastAPI()` constructor
- [ ] No unused imports added

---

## Step 2.9: Backend -- Protect Existing Endpoints

**CRITICAL: This step modifies EXISTING files. Do NOT skip it.**

**Action:** For EACH existing router/endpoint file:

1. **Read the file** completely.
2. **Add the import** (if not already present):
   ```python
   from <pkg>auth.dependencies import get_current_user
   ```
   Make sure `Depends` is imported from `fastapi`.
3. **Replace the old auth dependency** with `get_current_user` in each endpoint:

**If endpoints currently use a Username-header auth:**
```python
# BEFORE:
from core.auth import authenticate_username_header

@router.get('/')
async def handler(username: Annotated[str, Depends(authenticate_username_header)]):
    # username is used in business logic
    ...

# AFTER:
from <pkg>auth.dependencies import get_current_user

@router.get('/')
async def handler(user: dict = Depends(get_current_user)):
    username = user.get("preferred_username", "")
    # rest of business logic unchanged, using username as before
    ...
```

**If endpoints are currently unprotected:**
```python
# BEFORE:
@router.post("/calculate")
async def calculate(body: CalcRequest):

# AFTER:
@router.post("/calculate")
async def calculate(body: CalcRequest, _user: dict = Depends(get_current_user)):
```

**Rules:**
- Use `_user` (with underscore) if the endpoint does not need user data.
- Use `user` (without underscore) if the endpoint needs user info, then extract
  `username = user.get("preferred_username", "")` at the start of the function body.
- Do NOT change the endpoint's URL, method, request body, or response model.
- Do NOT change any business logic inside the endpoint beyond the username extraction.
- If the old auth provided a username that the business logic uses, extract it
  from the JWT payload (`preferred_username` field) to maintain compatibility.

**ALSO:** Check if any other files import from the old auth module and import
names from config as module-level variables. If so, those imports must be updated
to work with the new config format (see Step 0.3 in SKILL.md).

**VERIFY after this step:**
- [ ] Every endpoint that should be protected has `Depends(get_current_user)`
- [ ] Business logic still works the same way (username is extracted from JWT)
- [ ] No imports of the old auth dependency remain (unless kept for non-auth functions)
- [ ] All config imports still work

---

## Next Step

Proceed to `phases/02-frontend.md` for Steps 2.10-2.16.
