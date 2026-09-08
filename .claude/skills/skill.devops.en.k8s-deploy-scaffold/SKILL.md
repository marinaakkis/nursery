---
name: "k8s-deploy-scaffold"
description: >-
  Scaffold Kubernetes deployment for GitLab projects: generates Helm charts (bcd-web),
  .gitlab-ci.yml, docker-compose.yaml, Dockerfiles directly in the repo, plus a
  DEPLOYMENT.md file with Vault, ExternalSecret or SealedSecret guidance, Argo CD
  manifests, PowerDNS records, and a review checklist. Use when creating helm/,
  .gitlab-ci.yml, docker-compose, Dockerfile, or when the user says "deploy", "release",
  "pipeline", "scaffold", "infra" — even without mentioning Helm explicitly.
---

# Claude Code Adapter

This is a generated adapter for the canonical shared skill:

`../../../.agents/skills/skill.devops.en.k8s-deploy-scaffold/SKILL.md`

When this skill is invoked:

1. Read the canonical `SKILL.md` above.
2. Follow the canonical instructions and only load referenced files when needed.
3. Do not treat this adapter as the source of truth.

Regenerate adapters with:

```bash
node scripts/ai-template-indexing/sync-claude-skill-adapters.mjs
```
