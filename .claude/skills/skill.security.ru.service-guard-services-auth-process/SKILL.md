---
name: "service-guard-services-auth-process"
description: >-
  Implements service-to-service authentication and authorization through Service-Guard
  (Keycloak OAuth2.0 client_credentials): a Consumer obtains a JWT access token, attaches
  it as an Authorization Bearer header, and calls a Provider; the Provider validates the
  token (signature via JWKS, issuer, expiry, azp) and enforces roles from the
  resource_access claim. Use when integrating two backend services via Service-Guard,
  obtaining or caching a client_credentials JWT, enriching the Authorization header,
  validating a JWT, checking resource_access roles, or implementing 401-vs-403 logic.
  Ships reference code for curl, Go (Gin), .NET (ASP.NET Core) and Python (FastAPI).
---

# Claude Code Adapter

This is a generated adapter for the canonical shared skill:

`../../../.agents/skills/skill.security.ru.service-guard-services-auth-process/SKILL.md`

When this skill is invoked:

1. Read the canonical `SKILL.md` above.
2. Follow the canonical instructions and only load referenced files when needed.
3. Do not treat this adapter as the source of truth.

Regenerate adapters with:

```bash
node scripts/ai-template-indexing/sync-claude-skill-adapters.mjs
```
