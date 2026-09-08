---
name: fastapi-react-keycloak-auth
description: >-
  Integrates Keycloak authentication into FastAPI + React applications using
  OAuth2 Authorization Code flow, backend token exchange, httpOnly cookies,
  React auth state, and nginx frontend routing. Use after Keycloak SSO hand-off
  exists and the application needs application-side corporate login.
---

# FastAPI + React Keycloak Auth

Use this skill to implement application-side Keycloak auth in a FastAPI + React
repository. Keycloak remains the identity provider; the app handles OAuth2 code
exchange, session cookie issuance, `/api/auth/me`, logout, and frontend route
protection.

## Preconditions

- The user has confirmed that corporate SSO is required.
- Keycloak hand-off data exists or is being prepared with
  `.agents/skills/skill.security.en.keycloak-sso-scaffold/SKILL.md`.
- Secrets such as `CLIENT_SECRET`, passwords, tokens, and private keys are never
  committed, printed, or placed in generated docs.
- Backend and frontend ownership boundaries are clear.

## Target Shape

- Two app services by default: `backend` and `frontend`.
- Frontend container embeds nginx and proxies `/api/*` to FastAPI.
- Backend is not exposed directly outside the internal network.
- FastAPI exchanges authorization code for provider tokens, fetches userinfo,
  creates an app session/JWT, and stores it in an httpOnly secure cookie.
- React reads auth state from `/api/auth/me`; it does not store provider tokens.

## Phase Routing

Load only the phase file needed for the current task:

- Repository normalization: `phases/00-refactor.md`
- Preconditions and config validation: `phases/01-validate.md`
- Backend auth implementation: `phases/02-backend.md`
- Frontend auth implementation: `phases/02-frontend.md`
- Docker/nginx/runtime integration: `phases/02-infra.md`
- Security review and final checks: `phases/03-review.md`

The full previous playbook is retained for deep migration context in
`references/legacy-full-skill.md`. Do not load it unless the phase files are
insufficient.

## Implementation Order

1. Validate repository shape and SSO inputs.
2. Refactor layout only if required by the app structure.
3. Implement backend auth routes, config, cookie/session handling, and tests.
4. Implement frontend auth store, route guards, login/logout flow, and API
   client behavior.
5. Update Docker/nginx/runtime config with non-secret env variables only.
6. Run security review and verification commands.

## Security Constraints

- Use OAuth2 Authorization Code flow; do not use implicit flow or Resource Owner
  Password Credentials.
- Keep provider access/refresh tokens server-side only.
- Use `Secure`, `HttpOnly`, `SameSite` cookies where deployment allows it.
- Validate `state`, issuer, audience/client, token expiry, and user identity.
- Make CORS and cookie domain/path explicit; mark unknowns with `# REVIEW:`.
- Never include real secrets in `.env.template`, README, generated docs, tests,
  or logs.

## Done Criteria

- Login, callback, `/me`, and logout flows are implemented and tested.
- Frontend never receives provider tokens.
- Runtime config is documented with placeholder-only values.
- Security review phase has been completed or explicitly blocked with reasons.
- The final response tells the developer whether SSO hand-off, Jira Asset/IDM
  role onboarding, and deploy readiness still need action.
