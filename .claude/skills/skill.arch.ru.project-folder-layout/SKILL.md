---
name: "skill.arch.ru.project-folder-layout"
description: >-
  Defines a portable top-level layout for self-contained modules: root folder named
  project-name-projectType with docs as the primary subfolder. .input/ is optional
  (pre-requirements temp area, must be gitignored). Requires that markdown under docs/
  does not link to .input/. Use when creating a new module, reorganizing a repository
  tree, placing specifications or generated docs, or when the user asks about folder
  structure for utilities, services, applications, libraries, or systems.
  Repository-agnostic; no dependency on a particular requirements or interview workflow.
---

# Claude Code Adapter

This is a generated adapter for the canonical shared skill:

`../../../.agents/skills/skill.arch.ru.project-folder-layout/SKILL.md`

When this skill is invoked:

1. Read the canonical `SKILL.md` above.
2. Follow the canonical instructions and only load referenced files when needed.
3. Do not treat this adapter as the source of truth.

Regenerate adapters with:

```bash
node scripts/ai-template-indexing/sync-claude-skill-adapters.mjs
```
