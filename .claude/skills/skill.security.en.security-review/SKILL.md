---
name: "security-review"
description: >-
  Reviews code and infrastructure artifacts for security issues across the full delivery
  stack: Dockerfiles, docker-compose, Helm charts, Kubernetes manifests, GitLab CI
  pipelines, and application source code. Provides FAIL/PASS tables, checklists, and
  remediation guidance aligned with corporate rules. Use when creating or editing
  Dockerfiles, docker-compose.yaml, Helm values/templates, K8s manifests, .gitlab-ci.yml,
  handling secrets, env vars, auth, API endpoints, or when the user asks for a security
  review, security audit, or hardening check.
---

# Claude Code Adapter

This is a generated adapter for the canonical shared skill:

`../../../.agents/skills/skill.security.en.security-review/SKILL.md`

When this skill is invoked:

1. Read the canonical `SKILL.md` above.
2. Follow the canonical instructions and only load referenced files when needed.
3. Do not treat this adapter as the source of truth.

Regenerate adapters with:

```bash
node scripts/ai-template-indexing/sync-claude-skill-adapters.mjs
```
