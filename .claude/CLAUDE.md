# CLAUDE.md

Claude Code project memory for this repository.

@../AGENTS.md

## Security

- Follow `.claude/rules/rule.security.en.corporate-dlp.md` and `.cursor/rules/rule.security.en.corporate-dlp.mdc` without exception.
- Permissions are enforced via `.claude/settings.json`; do not weaken `permissions.deny`.
- Never hardcode secrets, log PII/secrets, or disable TLS/HTTPS verification. On any conflict, prioritize security and compliance first.

## Rule precedence

1. Explicit user instructions (unless they conflict with security).
2. Security & governance rules in `.cursor/rules/rule.security.*`.
3. All other `.cursor/rules/*.mdc`.
4. Repository conventions in `AGENTS.md`.
5. This file and `.claude/rules/`.

## Claude-specific behavior

- Treat `.claude/settings.json` as the executable Claude Code configuration for permissions and hooks.
- Do not duplicate Cursor rules in this file. Read `.cursor/rules/*.mdc` only when the task scope or `AGENTS.md` explicitly points to a relevant rule.
- Canonical skills live in `.agents/skills/*/SKILL.md`.
- `.claude/skills/*/SKILL.md` files are generated adapters for Claude Code discovery; do not edit them manually.
- Use skills only when the task matches the skill description or the user explicitly names the skill.
- `.claude/commands/*.md` files are generated adapters that reference the canonical `.cursor/commands/*.md`; do not edit them manually. Preserve a genuinely Claude-only command by adding `claude-specific: true` to its frontmatter (it is never overwritten). Shared workflows remain in `AGENTS.md` or `.agents/skills/`.
- For documentation/skills/rules edits, prefer additive or targeted changes over full rewrites unless a direct contradiction requires replacement.

## Skill & rule navigation

- The generated index of all skills, rules, and commands (descriptions + paths) is `docs/ai-tooling-index.md`. Skills are discovered natively from `.agents/skills` (Cursor) and `.claude/skills` adapters (Claude Code); open a `SKILL.md` only when the task matches its description.

## Regeneration

- If `.agents/skills/` changes, run `node scripts/ai-template-indexing/sync-claude-skill-adapters.mjs`.
- If `.cursor/commands/` changes, run `node scripts/ai-template-indexing/sync-claude-command-adapters.mjs`.
- If `.cursor/rules/`, `.cursor/commands/`, `.claude/commands/`, or `.agents/skills/` changes, run `node scripts/ai-template-indexing/generate-ai-tooling-index.mjs`.
