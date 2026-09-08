# Agent-Managed Security Hook Installation Design

**Date:** 2026-08-14

## Goal

Make the cross-agent secret and PII hook reliably available in projects created
from `ai-project-template`. Project initialization should install and verify the
hook proactively, while ordinary hook execution retains a lazy self-healing
fallback.

The installation mechanism must work for Cursor, Claude Code, and Codex without
depending on an agent remembering to load a skill or interpret a natural-language
rule before the first protected event.

## Decision

Use the existing `scripts/ai-hooks/run-hook-tool.mjs` as the single download,
integrity-verification, cache, and execution boundary.

Add a reserved management invocation:

```bash
node scripts/ai-hooks/run-hook-tool.mjs gitleaks --install
```

This command resolves the current platform, downloads the pinned artifact when
needed, verifies its SHA-256, makes it executable where applicable, records the
installed version, and exits without starting the hook binary.

Normal hook invocations continue to call:

```bash
node scripts/ai-hooks/run-hook-tool.mjs gitleaks -- --client cursor
node scripts/ai-hooks/run-hook-tool.mjs gitleaks -- --client claude
node scripts/ai-hooks/run-hook-tool.mjs gitleaks -- --client codex
```

If the cached binary is absent or fails integrity verification, the normal path
redownloads and verifies it before execution. This preserves protection when
project bootstrap was skipped or the local cache was damaged.

## Why Not a Skill

Installing a mandatory security control is infrastructure behavior rather than
a task-specific workflow. Skills are loaded only when relevant and therefore
cannot guarantee execution before the first prompt or tool call.

The template's bootstrap scripts provide the deterministic installation path.
The existing project-initialization rule tells an agent when to offer those
scripts and how to repair an incomplete setup. Hook configurations themselves
provide the final lazy fallback.

## Bootstrap Integration

The Linux/macOS and Windows root bootstrap scripts invoke the install command
after confirming that Node.js is available. A failed download or integrity
check fails initialization in strict mode; it is never silently converted into
a successful protected setup.

The scoped project-init rule is updated to:

1. treat the AI security hook as part of project initialization;
2. tell the user that the full bootstrap installs both Git hooks and the AI
   security hook;
3. provide the explicit install command as a repair action;
4. avoid claiming that `isGitHooksInited` proves the AI hook binary is present,
   because the cached binary may later be deleted.

No new metadata flag is added. The runner's verified cache is the source of
truth for installation state.

## Hook Wiring

All three clients use the same pinned tool entry and pass an explicit client:

- Cursor: `.cursor/hooks.json`, including prompt, tool, shell, MCP, read, and
  supported post events. Critical pre-events use `failClosed: true` and a
  15-second process timeout.
- Claude Code: `.claude/settings.json` with `UserPromptSubmit`, `PreToolUse`, and
  `PostToolUse`, passing `--client claude`.
- Codex: `.codex/hooks.json` with `UserPromptSubmit`, `PreToolUse`, and
  `PostToolUse`, passing `--client codex`.

The separate sanitizer hook and compatibility launchers are removed after the
unified hook covers high-confidence PII. Hook configuration must not register
two scanners for the same payload.

Codex trust settings remain unchanged. Installation does not bypass a client's
project trust or command approval model.

## Release Pinning

`scripts/ai-hooks/tool-manifest.json` pins the published `gitleaks-hook` release
and the SHA-256 for each supported platform. Version and hashes must be copied
from the actual `release-manifest.json` produced by the `secrets-block-hook`
GitLab tag pipeline.

The template pins published release `v2.0.1`. Its hashes must come from the
verified registry `release-manifest.json`; locally built hashes are not an
acceptable substitute. The release was verified externally by downloading all
five artifacts and independently checking each SHA-256 before template work.

Supported artifacts are:

- `gitleaks-hook-darwin-arm64`;
- `gitleaks-hook-darwin-amd64`;
- `gitleaks-hook-linux-arm64`;
- `gitleaks-hook-linux-amd64`;
- `gitleaks-hook-windows-amd64.exe`.

## Failure Handling

- A missing or damaged cached binary triggers one verified download attempt.
- Download, timeout, unsupported-platform, and integrity failures are concise
  and do not include hook input.
- `strict` is the default and fails closed.
- `warn` may skip locally after a clear diagnostic.
- CI and `AI_HOOKS_SECURITY_GATE=1` force strict behavior.
- `off` skips both installation and execution only when explicitly selected
  outside a security gate.
- Temporary downloads are removed after every failure.
- The final path is replaced only after successful verification.

## Tests

Runner tests use a local temporary HTTP registry and a synthetic executable
fixture. They do not depend on GitLab, published packages, credentials, or the
developer's real cache.

The tests cover:

1. first install downloads the platform artifact and verifies its hash;
2. a second install reuses the verified cached file without another request;
3. a corrupted cached file is removed and restored from the registry;
4. a hash mismatch never installs the downloaded file;
5. normal execution forwards `--client cursor`, `--client claude`, and
   `--client codex` unchanged;
6. strict, warn, off, CI, and security-gate behavior;
7. all hook configs reference existing scripts, use a 15-second timeout, and do
   not reference deleted launchers or sanitizer integration;
8. the template validator and generated tooling index reflect the final wiring.

The installer logic is tested in a temporary copy of the runner and manifest so
the repository's real `scripts/ai-hooks/vendor/` cache is never modified.

## Documentation

`README.md`, `QUICK-START.md`, and `scripts/README.md` explain:

- full bootstrap installs the AI security hook proactively;
- the explicit repair/install command;
- the lazy verified fallback on the first client hook event;
- the one-time registry requirement and offline operation afterward;
- strict/warn/off behavior;
- the metadata-only opt-in audit behavior of the hook.

The generated `docs/ai-tooling-index.md` is regenerated after hook wiring and
rule text are updated.

## Acceptance Criteria

- A freshly initialized project contains a verified current-platform hook
  binary in the runner's gitignored vendor cache.
- Cursor, Claude Code, and Codex all call the same binary with the correct
  explicit client argument.
- Deleting or corrupting the cached binary is repaired by the next normal hook
  invocation.
- No compatibility launcher or sanitizer registration remains.
- Tests exercise installation without external network access.
- The template cannot pass validation with missing scripts, placeholder hashes,
  stale versions, or incomplete client event wiring.
