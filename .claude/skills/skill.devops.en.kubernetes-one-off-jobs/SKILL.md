---
name: "kubernetes-one-off-jobs"
description: >-
  Scaffold reusable GitLab CI/CD jobs for manual one-off Kubernetes tasks using
  bcd-web-chart 0.2.3 and the standard main CI component. Use when adding or reviewing
  migration down/to, seed up/down, Alembic or dotnet commands, legacy data imports,
  backfills, verification jobs, S3/object storage upload jobs, app rollback buttons, or
  other scripts that must run inside Kubernetes from the same Helm values, Vault values,
  images, secrets, security context, and NetworkPolicy as the service.
---

# Claude Code Adapter

This is a generated adapter for the canonical shared skill:

`../../../.agents/skills/skill.devops.en.kubernetes-one-off-jobs/SKILL.md`

When this skill is invoked:

1. Read the canonical `SKILL.md` above.
2. Follow the canonical instructions and only load referenced files when needed.
3. Do not treat this adapter as the source of truth.

Regenerate adapters with:

```bash
node scripts/ai-template-indexing/sync-claude-skill-adapters.mjs
```
