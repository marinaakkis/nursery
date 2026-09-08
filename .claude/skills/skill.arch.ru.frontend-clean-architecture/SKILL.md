---
name: "skill.arch.ru.frontend-clean-architecture"
description: >-
  Enforces Clean Architecture + Feature-Domain + Atomic Design for TypeScript SPA
  frontend: layer boundaries (Domain Types / Application State+Service / Infrastructure
  ClientHttp / Component / View / Composition Root), Atomic Design levels
  (atom/molecule/organism/template), State/Service SRP split, contract-first API client
  naming without I-prefix (OrderClient interface / OrderClientHttp impl), feature-module
  layout with public index.ts barrel, shared/ LLM-safe guard, and inter-feature dependency
  rules. Use when: designing a new frontend feature module, reviewing AI-generated code,
  naming objects (Store / Service / Client / Props / Guard), choosing the correct Atomic
  Design level, setting up SPA project structure, or recovering feature structure after
  AI-assisted development sprints.
---

# Claude Code Adapter

This is a generated adapter for the canonical shared skill:

`../../../.agents/skills/skill.arch.ru.frontend-clean-architecture/SKILL.md`

When this skill is invoked:

1. Read the canonical `SKILL.md` above.
2. Follow the canonical instructions and only load referenced files when needed.
3. Do not treat this adapter as the source of truth.

Regenerate adapters with:

```bash
node scripts/ai-template-indexing/sync-claude-skill-adapters.mjs
```
