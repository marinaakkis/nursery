---
name: "skill.integration.ru.integration-doc"
description: >-
  Defines the standard documentation format for describing integration interaction between
  two systems: integration-level header (protocol, auth, reliability), and an endpoints
  table with interaction type enum (sync-pull, sync-push, sync-polling, async). Covers
  mandatory reliability fields (timeout, retry, circuit breaker) per governance rule.
  Complements the full integration passport template at docs/integrations/. Use when
  documenting how system A calls system B in architecture docs, integration registers, or
  API contracts.
---

# Claude Code Adapter

This is a generated adapter for the canonical shared skill:

`../../../.agents/skills/skill.integration.ru.integration-doc/SKILL.md`

When this skill is invoked:

1. Read the canonical `SKILL.md` above.
2. Follow the canonical instructions and only load referenced files when needed.
3. Do not treat this adapter as the source of truth.

Regenerate adapters with:

```bash
node scripts/ai-template-indexing/sync-claude-skill-adapters.mjs
```
