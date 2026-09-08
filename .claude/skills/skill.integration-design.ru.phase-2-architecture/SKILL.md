---
name: "skill.integration-design.ru.phase-2-architecture"
description: >-
  Phase 2 (Architecture) of the inter-service integration design-and-approval process —
  "Проектирование архитектуры межсервисной интеграции". Produces the integration project
  card and the full technical documentation set: a connection technology table (data
  format, interaction type, auth model, protocol/transport, frequency, sync/async), C2
  container view, environment-linking tables, endpoint descriptions, data models with
  PII/commercial-secret sensitivity columns, field mappings, an adaptive
  authentication/authorization template (OAuth2.0 via an Access Token Provider, Basic
  Auth, mTLS, API key), and a related-requests log. Tables are the source of truth for
  agents; diagrams (C2, sequence, environment links) are derived for humans, mermaid by
  default. Use after the concept phase, when designing the detailed architecture of an
  inter-service integration.
---

# Claude Code Adapter

This is a generated adapter for the canonical shared skill:

`../../../.agents/skills/skill.integration-design.ru.phase-2-architecture/SKILL.md`

When this skill is invoked:

1. Read the canonical `SKILL.md` above.
2. Follow the canonical instructions and only load referenced files when needed.
3. Do not treat this adapter as the source of truth.

Regenerate adapters with:

```bash
node scripts/ai-template-indexing/sync-claude-skill-adapters.mjs
```
