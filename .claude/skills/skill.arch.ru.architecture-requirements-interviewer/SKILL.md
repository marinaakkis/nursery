---
name: "skill.arch.ru.architecture-requirements-interviewer"
description: >-
  Conducts structured stakeholder interviews after spec and derived docs exist. Creates
  .input/proposals/<theme>-proposal.md for the user to type answers; on explicit
  completion signal, merges into the survey file and updates requirements in docs/.
  Portable across repositories; does not assume fixed survey filenames or Cursor commands.
---

# Claude Code Adapter

This is a generated adapter for the canonical shared skill:

`../../../.agents/skills/skill.arch.ru.architecture-requirements-interviewer/SKILL.md`

When this skill is invoked:

1. Read the canonical `SKILL.md` above.
2. Follow the canonical instructions and only load referenced files when needed.
3. Do not treat this adapter as the source of truth.

Regenerate adapters with:

```bash
node scripts/ai-template-indexing/sync-claude-skill-adapters.mjs
```
