# Scripts

Maintenance scripts for the multi-agent template.

## Requirements

- Node.js 18+
- PowerShell 5.1+ or PowerShell 7+ on Windows
- bash 3.2+ on Linux/macOS

## AI Template Maintenance

### `validate-ai-template.mjs`

Validates the AI baseline: JSON/JSONC/TOML shape, canonical skills,
Claude adapters, hook paths, hook integrity manifest, Cursor rules, OpenCode
permissions, stale references, nested `.git`, generated index existence, and
the immutable `.gitlab-ci.yml` security block.

```bash
node scripts/validate-ai-template.mjs
```

### `ai-template-indexing/sync-claude-skill-adapters.mjs`

Regenerates `.claude/skills` adapters from canonical `.agents/skills`.

```bash
node scripts/ai-template-indexing/sync-claude-skill-adapters.mjs
```

### `skills/sync-deploy-skills.mjs`

Checks or updates the four canonical DevOps skills from the current `master`
branch of the public `deploy` repository. The manifest records the last
synchronized commit for audit.

```bash
node scripts/skills/sync-deploy-skills.mjs --check
node scripts/skills/sync-deploy-skills.mjs --apply
```

`skills/create-deploy-skills-mr.mjs` is for scheduled or manually started
GitLab CI pipelines. It applies a new `deploy/master` revision, creates a
template branch, and opens an MR using `CI_JOB_TOKEN`.

### `ai-template-indexing/sync-claude-command-adapters.mjs`

Regenerates `.claude/commands` adapters from canonical `.cursor/commands`. A
command marked `claude-specific: true` in its frontmatter is preserved.

```bash
node scripts/ai-template-indexing/sync-claude-command-adapters.mjs
```

### `ai-template-indexing/generate-ai-tooling-index.mjs`

Regenerates the full tooling index at `docs/ai-tooling-index.md`.

```bash
node scripts/ai-template-indexing/generate-ai-tooling-index.mjs
```

### `bootstrap/merge-cursor-settings.mjs`

Merges required Cursor privacy/telemetry settings into the user's Cursor
settings file without overwriting unrelated keys. Used by root setup scripts.

```bash
node scripts/bootstrap/merge-cursor-settings.mjs
```

Set `CURSOR_SETTINGS_PATH=/path/to/settings.json` to test against a temporary
settings file.

## AI Hooks

### `ai-hooks/run-hook-tool.mjs`

Runs pinned hook tools declared in `scripts/ai-hooks/tool-manifest.json`.

```bash
node scripts/ai-hooks/run-hook-tool.mjs gitleaks --install
node scripts/ai-hooks/run-hook-tool.mjs gitleaks -- --client codex
```

The manifest pins `gitleaks-hook` `v2.0.1` and the SHA256 of all five platform
binaries. Root setup scripts install it proactively; normal hook execution can
repair a missing cache using the same verified download. The first install needs
registry access, while a verified cache runs offline.

Modes:

- `AI_HOOKS_MODE=strict` — default; fail closed.
- `AI_HOOKS_MODE=warn` — local convenience only; warn and skip when setup fails.
- `AI_HOOKS_SECURITY_GATE=1` or `CI=1` — force strict mode.

The runner verifies SHA256 for cached and downloaded binaries. The native hook
receives `--client cursor`, `--client claude`, or `--client codex` so each agent
gets its required blocking protocol and exit behavior. Findings contain metadata,
not the detected secret or PII value.

## Git Hooks

Installers live under `scripts/git-hooks/` and copy versioned hooks from
`.githooks/` (`pre-commit`, `pre-push`, `integration-passports.validate.mjs` + `patterns/`) into `.git/hooks`.

### Windows — `scripts/git-hooks/git-hooks.win.{install,uninstall}.ps1`

```powershell
.\scripts\git-hooks\git-hooks.win.install.ps1
.\scripts\git-hooks\git-hooks.win.uninstall.ps1 -WhatIf
.\scripts\git-hooks\git-hooks.win.uninstall.ps1
```

### Linux/macOS — `scripts/git-hooks/git-hooks.lin-mac.{install,uninstall}.sh`

```bash
bash scripts/git-hooks/git-hooks.lin-mac.install.sh
bash scripts/git-hooks/git-hooks.lin-mac.uninstall.sh --dry-run
bash scripts/git-hooks/git-hooks.lin-mac.uninstall.sh
```

## Documentation Publishing

### `publish-dev-requests-docs/`

Idempotent pipeline that publishes finished dev-request documentation to an
external store (Obsidian; extensible via strategy adapters). Configuration and secrets
live only in the gitignored `.project-metadata.local.json` (`docsStorage`).
See `scripts/publish-dev-requests-docs/README.md`.

```bash
node scripts/publish-dev-requests-docs/publish-dev-requests-docs.mjs
```

## Serena MCP

### `serena-mcp/`

Optional Serena MCP (symbol-level code navigation) management. Disabled by
default; per-machine config (`.mcp.json` / `.cursor/mcp.json`) is gitignored.

```bash
# Windows
powershell -File scripts/serena-mcp/init-serena-mcp.ps1
# Linux/macOS
bash scripts/serena-mcp/init-serena-mcp.sh
```

## Tests

```bash
node --test .githooks/integration-passports.validate.test.mjs
```
