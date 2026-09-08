---
name: skill.arch.ru.frontend-clean-architecture
description: >-
  Enforces Clean Architecture + Feature-Domain + Atomic Design for TypeScript
  SPA frontend: layer boundaries (Domain Types / Application State+Service /
  Infrastructure ClientHttp / Component / View / Composition Root), Atomic
  Design levels (atom/molecule/organism/template), State/Service SRP split,
  contract-first API client naming without I-prefix (OrderClient interface /
  OrderClientHttp impl), feature-module layout with public index.ts barrel,
  shared/ LLM-safe guard, and inter-feature dependency rules. Use when:
  designing a new frontend feature module, reviewing AI-generated code, naming
  objects (Store / Service / Client / Props / Guard), choosing the correct
  Atomic Design level, setting up SPA project structure, or recovering feature
  structure after AI-assisted development sprints.
---

# SKILL: frontend-clean-architecture — Clean Architecture + Feature-Domain + Atomic Design (TS SPA)

> **Scope:** structure of TypeScript SPA frontends. This `SKILL.md` is a router; the full standard (layer rules, naming, Atomic Design, examples, checklists) lives in [`references/full-skill.md`](references/full-skill.md). Read it before designing or reviewing frontend architecture.

## When to apply

Designing a new frontend feature module; reviewing AI-generated frontend code; naming objects (Store / Service / Client / Props / Guard); choosing an Atomic Design level; setting up SPA project structure; recovering feature structure after AI-assisted sprints.

## Operating rules (summary — full detail in `references/full-skill.md`)

- **Layers & dependency direction:** Domain Types → Application (State + Service, SRP split) → Infrastructure (`ClientHttp`) → Component → View → Composition Root.
- **Atomic Design levels:** atom / molecule / organism / template.
- **Contract-first API client naming (no `I`-prefix):** `OrderClient` (interface) / `OrderClientHttp` (impl).
- **Feature module layout:** public `index.ts` barrel; `shared/` is LLM-safe guarded; follow inter-feature dependency rules.
- **Full layer/naming/Atomic rules, examples, and checklists:** [`references/full-skill.md`](references/full-skill.md).

## References

- [`references/full-skill.md`](references/full-skill.md) — complete canonical standard.
- [`reference.md`](reference.md) — supplementary reference.
