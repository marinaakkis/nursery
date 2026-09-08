# Phase 2: Frontend Implementation (Steps 2.10 -- 2.16)

**Prerequisites:**
- Phase 1 (validate) is complete
- Step 0 from SKILL.md is complete -- you know:
  - `LANGUAGE`: `"js"` or `"ts"`
  - `EXPORT_STYLE`: `"default"` or `"named"`
  - `QUOTES`: `"single"` or `"double"`
  - `PATH_STYLE`: `"relative"` or `"alias"`
  - `BUSINESS_API_PREFIX` (e.g. `/api/v1`)
  - `AUTH_API_PREFIX` = `/api/auth`
- Backend auth steps (2.1-2.9) are complete

**In all code examples below:**
- Examples use TypeScript (`.ts`/`.tsx`). If project uses JavaScript, omit type
  annotations, interfaces, and generics. Create `.js`/`.jsx` files.
- Examples use named exports (`export const X`). If project uses default exports,
  change to `export default X` and update all imports accordingly.
- Examples use `@/` path aliases. If project uses relative imports, convert to
  `../` style.
- Examples use double quotes. Match the project's quote style.

---

## Step 2.10: Frontend Config

**Precondition:** Vite is configured with a `base` option.

**Action:** Create or update the config file (`src/config.ts` or `src/config.js`).

**If a config file already exists:** ADD the auth-related exports to it.
Do NOT overwrite existing exports.

```javascript
const base = import.meta.env.BASE_URL.replace(/\/+$/, "");

export const BASE_PATH = base || "";
export const API_BASE_URL = `${BASE_PATH}/api`;
export const LOGIN_URL = `${BASE_PATH}/api/auth/login`;
```

**CRITICAL:** Use `import.meta.env.BASE_URL`, NOT `import.meta.env.VITE_BASE_PATH`.
`BASE_URL` is Vite's built-in variable that always exists and matches the `base`
config option. Custom env vars like `VITE_BASE_PATH` may be undefined, causing
`undefined.replace(...)` to crash.

**If the project already defines API_BASE_URL with a different path (e.g. `/api/v1`):**
Keep the existing `API_BASE_URL` for business logic. Add a SEPARATE constant:

```javascript
const base = import.meta.env.BASE_URL.replace(/\/+$/, "");

export const BASE_PATH = base || "";
export const API_BASE_URL = `${BASE_PATH}/api/v1`;      // existing business API
export const AUTH_API_URL = `${BASE_PATH}/api`;           // auth API (no /v1)
export const LOGIN_URL = `${BASE_PATH}/api/auth/login`;
```

**VERIFY after this step:**
- [ ] Uses `import.meta.env.BASE_URL`, not a custom env var
- [ ] Trailing slashes are stripped
- [ ] If dual API prefixes: both `API_BASE_URL` and `AUTH_API_URL` are exported

---

## Step 2.11: Frontend Types (TypeScript only)

**Skip this step entirely if the project uses JavaScript (.js/.jsx).**

**Action:** Add the `User` interface. If a types file already exists, ADD to it.

```typescript
export interface User {
  sub: string;
  email: string;
  name: string;
  preferred_username: string;
}
```

Fields match the JWT payload created by the backend's `create_token()`.

---

## Step 2.12: Frontend API Client

**Precondition:** `axios` is installed. Config file exists.

**Action:** If an axios client already exists, MODIFY it. If not, create one.

**Scenario A: Single API prefix (business and auth both at `/api`)**

Add `withCredentials: true` to the existing client config and add the 401 interceptor:

```javascript
import axios from "axios";
import { API_BASE_URL, BASE_PATH } from "./config";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,   // <-- ADD THIS if missing
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    if (error.response?.status === 401 && !url.includes("/auth/me")) {
      window.location.href = `${BASE_PATH}/login`;
    }
    return Promise.reject(error);
  }
);

export default api;
```

**Scenario B: Dual API prefixes (business at `/api/v1`, auth at `/api/auth`)**

The existing axios client has `baseURL: API_BASE_URL` (e.g. `${BASE_PATH}/api/v1`).
Auth endpoints are at `${BASE_PATH}/api/auth/`. You MUST create a separate
`authApi` client with `baseURL: AUTH_API_URL` (`${BASE_PATH}/api`).

**WHY a separate client is required:** Axios concatenates `baseURL` with the
request URL for ALL paths, even those starting with `/`. Passing
`BASE_PATH + "/api/auth/me"` to an axios instance with
`baseURL: "${BASE_PATH}/api/v1"` produces a DOUBLED path like
`/text-comparison/api/v1/text-comparison/api/auth/me`. Axios only ignores
`baseURL` for fully-qualified URLs starting with `http://` or `https://`.
There is NO way to "override" `baseURL` with a leading-slash path.

```javascript
import axios from "axios";
import { API_BASE_URL, AUTH_API_URL, BASE_PATH } from "./config";

// Business API client (existing -- add withCredentials)
const api = axios.create({
  baseURL: API_BASE_URL,        // e.g. /text-comparison/api/v1
  withCredentials: true,
});

// Auth API client (new -- separate baseURL)
export const authApi = axios.create({
  baseURL: AUTH_API_URL,         // e.g. /text-comparison/api
  withCredentials: true,
});

// 401 interceptor on the BUSINESS client only.
// The auth store uses authApi and handles its own errors in try/catch.
// This interceptor redirects to /login when a BUSINESS endpoint returns 401
// (meaning the session expired mid-use).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = `${BASE_PATH}/login`;
    }
    return Promise.reject(error);
  }
);

// Keep ALL existing interceptor logic (timeout handling, etc.) intact.

export default api;
```

**Key points:**
- `authApi` does NOT need a 401 interceptor. The auth store's `fetchMe()` catches
  errors itself and sets `user: null` / `isLoading: false`. Adding a 401 redirect
  to `authApi` would cause an infinite loop on the initial `/auth/me` check.
- The business `api` client's 401 interceptor does NOT need to exclude `/auth/me`
  because `api` is never used for auth calls.
- Both clients MUST have `withCredentials: true` to send/receive cookies.

**VERIFY after this step:**
- [ ] `withCredentials: true` is set on BOTH axios clients
- [ ] Business `api` has 401 interceptor that redirects to `/login`
- [ ] `authApi` does NOT have a 401 redirect interceptor
- [ ] `authApi` is exported as a named export
- [ ] Existing interceptor logic (timeout handling, etc.) is preserved on `api`
- [ ] `AUTH_API_URL` is imported from config (created in Step 2.10)

---

## Step 2.13: Frontend Auth Store

**Precondition:** `zustand` is installed. API client exists. Config exists.

**Action:** Create the auth store file. Match the project's file location pattern
(e.g. `src/store/authStore.js` if other stores are in `src/store/`).

**CRITICAL about exports:** If other stores use `export default`, this store
MUST also use `export default`. If they use named exports, use named exports.

**Template (default export, single API prefix):**

```javascript
import { create } from "zustand";
import api from "../api";

const useAuthStore = create((set) => ({
  user: null,
  isLoading: true,

  logout: async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      set({ user: null });
    }
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get("/auth/me");
      set({ user: data, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  init: () => {
    useAuthStore.getState().fetchMe();
  },
}));

export default useAuthStore;
```

**Template (default export, DUAL API prefix -- business at /api/v1, auth at /api/auth):**

```javascript
import { create } from "zustand";
import { authApi } from "../api";

const useAuthStore = create((set) => ({
  user: null,
  isLoading: true,

  logout: async () => {
    try {
      await authApi.post("/auth/logout");
    } finally {
      set({ user: null });
    }
  },

  fetchMe: async () => {
    try {
      const { data } = await authApi.get("/auth/me");
      set({ user: data, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  init: () => {
    useAuthStore.getState().fetchMe();
  },
}));

export default useAuthStore;
```

**CRITICAL:** The dual-prefix template imports `authApi` (named export from
`api.js`), NOT the default `api` export. `authApi` has `baseURL: AUTH_API_URL`
(`${BASE_PATH}/api`), so `"/auth/me"` resolves to `${BASE_PATH}/api/auth/me`.
Using the default `api` (which has `baseURL: ${BASE_PATH}/api/v1`) would produce
a broken double-prefixed URL.

**Template (named export, TypeScript, single API prefix):**

```typescript
import { create } from "zustand";
import client from "@/api/client";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  init: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  logout: async () => {
    try {
      await client.post("/auth/logout");
    } finally {
      set({ user: null });
    }
  },

  fetchMe: async () => {
    try {
      const { data } = await client.get<User>("/auth/me");
      set({ user: data, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  init: () => {
    useAuthStore.getState().fetchMe();
  },
}));
```

**VERIFY after this step:**
- [ ] Export style matches existing stores (default vs named)
- [ ] Import path to API client matches existing pattern (../api vs @/api/client)
- [ ] If dual prefixes: imports `authApi` (named export), uses relative paths (`"/auth/me"`)
- [ ] If single prefix: imports default `api`, uses relative paths (`"/auth/me"`)
- [ ] Auth store NEVER concatenates `BASE_PATH + "/api/..."` with an axios call --
      the base path is already in the axios client's `baseURL`
- [ ] `isLoading` starts as `true`

---

## Step 2.14: Frontend ProtectedRoute Component

**Precondition:** Auth store exists. `react-router-dom` is installed.

**Action:** Create the component. Match the project's CSS approach.

**IMPORTANT:** Read an existing component to see what CSS system the project uses:
- CSS modules (`import styles from "./Foo.module.css"`)
- Tailwind CSS (`className="flex items-center"`)
- Styled-components
- Plain CSS

Adapt the loading UI to match. Do NOT use Tailwind classes if the project uses
CSS modules -- the classes won't be applied and the loading state will be invisible.

```javascript
import { Navigate } from "react-router-dom";
import useAuthStore from "../store/authStore";  // or { useAuthStore } for named export

export function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

**Note:** The example above uses inline styles as a safe fallback that works with
any CSS system. Replace with CSS modules or the project's own approach.

**VERIFY after this step:**
- [ ] Auth store import matches the export style (default vs named)
- [ ] Loading state uses the project's CSS approach, not unstyled Tailwind classes
- [ ] Component is a named export (`export function ProtectedRoute`) -- this is
      standard for components even in projects that use default exports for stores

---

## Step 2.15: Frontend Login Page

**Precondition:** Auth store and config exist.

**Action:** Create the login page. Adapt UI to the project's design system.

```javascript
import { Navigate } from "react-router-dom";
import useAuthStore from "../store/authStore";  // match import style
import { LOGIN_URL } from "../config";

export default function LoginPage() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        Loading...
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = () => {
    window.location.href = LOGIN_URL;
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div>
        <h1>Sign In</h1>
        <button onClick={handleLogin}>Sign in with Keycloak</button>
      </div>
    </div>
  );
}
```

**CRITICAL:** The login page MUST:
1. Import and use the auth store
2. Show loading state while `isLoading` is true
3. Redirect to `/` if `user` is already set
4. Use `window.location.href = LOGIN_URL` (full-page redirect, NOT an API call)

**VERIFY after this step:**
- [ ] Auth store import matches export style
- [ ] Auth state is checked (not omitted)
- [ ] Loading state is shown
- [ ] Authenticated users are redirected away from login

---

## Step 2.16: Frontend -- Wire Up App Component

**CRITICAL: Read the existing App.jsx/App.tsx first. Do NOT overwrite it.**

**Action:** Make these ADDITIONS to the existing file:

1. **Add imports** (alongside existing imports):
```javascript
import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import useAuthStore from "./store/authStore";  // match import style
import { ProtectedRoute } from "./components/ProtectedRoute";
import { BASE_PATH } from "./config";
import LoginPage from "./pages/LoginPage";
```

2. **Add auth initialization** inside the App component (before the return):
```javascript
const init = useAuthStore((s) => s.init);
useEffect(() => {
  init();
}, [init]);
```

3. **Handle layout around login page.** If the app has layout components (Sidebar,
   Header, etc.) rendered OUTSIDE `<Routes>`, the login page will also show them.
   Fix this by conditionally rendering the layout:

```javascript
// BEFORE (broken -- Sidebar shows on login page):
function App() {
  return (
    <Router basename={BASE_PATH || undefined}>
      <Sidebar />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

// AFTER (fixed -- Sidebar only shows when authenticated):
function App() {
  const { user, isLoading } = useAuthStore();
  const init = useAuthStore((s) => s.init);
  useEffect(() => { init(); }, [init]);

  return (
    <Router basename={BASE_PATH || undefined}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={
          <ProtectedRoute>
            <div className={styles.appContainer}>
              <Sidebar />
              <MainContentWrapper>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/about" element={<About />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </MainContentWrapper>
            </div>
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}
```

4. **If the project already uses `BrowserRouter`:** Add `basename={BASE_PATH || undefined}`
   to it. Do NOT create a second Router.

5. **Add catch-all** redirect inside the protected routes.

**DO NOT remove any existing routes, components, or logic.**

**VERIFY after this step:**
- [ ] Auth store import matches export style (default vs named)
- [ ] `useEffect` calls `init()` on mount
- [ ] Login route is PUBLIC (not wrapped in ProtectedRoute)
- [ ] All existing routes are preserved and wrapped in ProtectedRoute
- [ ] Layout components (Sidebar, etc.) do NOT render on the login page
- [ ] BrowserRouter has `basename` set
- [ ] No duplicate Router components

---

## Step 2.16b: Frontend -- Add Logout to UI

**CRITICAL: Do NOT skip this step.**

The auth store has `logout()` but it must be callable from the UI.

**Action:** Find the user menu, settings panel, or similar component (e.g. UserCard).
Add a logout button that calls `useAuthStore().logout()`:

```javascript
import useAuthStore from "../store/authStore";

// Inside the component:
const { logout } = useAuthStore();

// In the JSX:
<button onClick={logout}>Logout</button>
```

Adapt styling to match the project's design system.

**VERIFY:** The logout button is visible and calls `authStore.logout()`.

---

## Next Step

Proceed to `phases/02-infra.md` for Step 2.17 (infrastructure).
