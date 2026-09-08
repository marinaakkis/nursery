# Agent-Managed Security Hook Installation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pin published `gitleaks-hook v2.0.1` in `ai-project-template`, install it proactively during bootstrap, and wire native Cursor, Claude Code, and Codex hooks with a tested lazy recovery path.

**Architecture:** `scripts/ai-hooks/run-hook-tool.mjs` remains the only registry, integrity, cache, and execution boundary. A reserved `gitleaks --install` invocation verifies and caches the current-platform binary without starting it; project bootstrap calls this mode, while normal client hooks retain automatic verified recovery.

**Tech Stack:** Node.js 18+ ESM, Node test runner, JSON hook configs, Bash 3.2+, Windows batch, GitLab Generic Package Registry.

## Global Constraints

- Pin exactly `gitleaks-hook v2.0.1` from GitLab project `3168`.
- Use only SHA-256 values from the published and independently verified release manifest.
- Use a 15-second outer hook timeout, explicit `--client cursor|claude|codex`, and no trust bypass.
- Remove sanitizer hook registration and compatibility launchers.
- Never edit the first nine lines of `.gitlab-ci.yml`.
- Do not stage, commit, or push template changes without explicit authorization.
- Preserve unrelated changes and report known baseline failures separately.

---

### Task 1: Proactive Install Mode

**Files:**
- Create: `scripts/ai-hooks/run-hook-tool.test.mjs`
- Modify: `scripts/ai-hooks/run-hook-tool.mjs`

**Interfaces:**
- Existing run: `node scripts/ai-hooks/run-hook-tool.mjs TOOL -- TOOL_ARGS`.
- New install: `node scripts/ai-hooks/run-hook-tool.mjs TOOL --install`.

- [ ] **Step 1: Write a failing local-registry integration test**

Copy the real runner and a synthetic manifest into a temporary directory. Start a local HTTP server serving one executable fixture whose independent SHA-256 is in the manifest. Assert:

```js
test("install caches a verified binary without executing it", async (t) => {
  const fixture = await createRunnerFixture(t);
  const first = await fixture.invoke(["synthetic", "--install"]);
  assert.equal(first.code, 0);
  assert.match(first.stdout, /installed synthetic v-test/);
  assert.equal(fixture.executionLog(), "");
  assert.equal(fixture.requestCount(), 1);

  const second = await fixture.invoke(["synthetic", "--install"]);
  assert.equal(second.code, 0);
  assert.equal(fixture.requestCount(), 1);
});
```

Add cases for corrupted-cache redownload, hash mismatch rejection, exact forwarding of `--client codex`, `off` skipping download, and security-gate forcing strict behavior.

- [ ] **Step 2: Verify RED**

Run `node --test scripts/ai-hooks/run-hook-tool.test.mjs`.

Expected: FAIL because `--install` is currently forwarded to the executable.

- [ ] **Step 3: Implement minimal parsing and branching**

Return `action: "install"` only for exactly one reserved argument. Reject additional install arguments. After `ensureBinary`, print only `installed TOOL VERSION` and exit without calling `spawn`; otherwise preserve the current run path.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
node --test scripts/ai-hooks/run-hook-tool.test.mjs
node scripts/validate-ai-template.mjs
git diff --check
```

Leave all files unstaged.

---

### Task 2: Exact Release Pin and Three Native Client Configs

**Files:**
- Create: `.cursor/hooks.json`
- Create: `scripts/ai-hooks/hook-configs.test.mjs`
- Modify: `.claude/settings.json`
- Modify: `.codex/hooks.json`
- Modify: `scripts/ai-hooks/tool-manifest.json`
- Delete: `scripts/ai-hooks/gitleaks-launcher.mjs`
- Delete: `scripts/ai-hooks/sanitizer-launcher.mjs`

**Interfaces:**
- Consumes Task 1 runner.
- Produces one pinned binary invoked with an explicit client by all three agents.

- [ ] **Step 1: Write failing config tests**

Parse the manifest and configs. Assert version `v2.0.1`, no sanitizer tool, timeout 15, no launcher reference, full event coverage, and these literal hashes:

```js
const expectedHashes = {
  "darwin-x64": "b24afd81ac6d35fadcca22d8330a38426ebb5f7d31aa9fbb006db968ae89bff2",
  "darwin-arm64": "6a574508494b5429c68819ee48e3042e7c9998f36173c22a8f66197e31089408",
  "linux-x64": "deebd077896e8f9e8e84efcf00363c918321d5e861e39ba363fdf6fef4bc13e8",
  "linux-arm64": "085b102d53512da97d594c22ffab42326d669c7f108abfd06c121c57513ed853",
  "win32-x64": "2f16232c762cf2937e053689dc0dbc5143f9fbfec675df280849de9b72e73d98",
};
```

Cursor critical pre-events must have `failClosed: true`. Claude and Codex must include `UserPromptSubmit`, `PreToolUse`, and `PostToolUse`.

- [ ] **Step 2: Verify RED**

Run `node --test scripts/ai-hooks/hook-configs.test.mjs`.

Expected: FAIL because the template pins v1.0.0, has no Cursor config, retains sanitizer, and lacks explicit client arguments.

- [ ] **Step 3: Pin v2.0.1**

Keep package `gitleaks-hook`, project `3168`, and vendor directory `gitleaks`. Set the exact five artifact filenames and hashes above. Remove the sanitizer entry.

- [ ] **Step 4: Wire client commands**

Cursor entries use:

```json
{"command":"node scripts/ai-hooks/run-hook-tool.mjs gitleaks -- --client cursor","timeout":15,"failClosed":true}
```

Claude entries use command `node` and args:

```json
["CLAUDE_PROJECT_DIR/scripts/ai-hooks/run-hook-tool.mjs","gitleaks","--","--client","claude"]
```

Use the actual Claude variable syntax already present in the repository, including its leading dollar sign and braces.

Codex retains the existing repository-root resolver and appends:

```text
gitleaks -- --client codex
```

Register supported prompt, pre-tool, post-tool, and Cursor-specific shell/MCP/read/post events once each. Delete both launchers.

- [ ] **Step 5: Verify GREEN**

Run both Node test files and `git diff --check`. Leave changes unstaged.

---

### Task 3: Bootstrap and Agent Repair Path

**Files:**
- Modify: `config-lin-mac.sh`
- Modify: `config-win.bat`
- Modify: `.cursor/rules/rule.governance.ru.project-init-check.mdc`
- Modify: `README.md`
- Modify: `QUICK-START.md`
- Modify: `scripts/README.md`

**Interfaces:**
- Consumes `run-hook-tool.mjs gitleaks --install`.
- Produces proactive full-bootstrap installation and an explicit repair command.

- [ ] **Step 1: Add installation to both setup scripts**

Linux/macOS, immediately after the Node check:

```bash
info "Installing verified AI security hook..."
node scripts/ai-hooks/run-hook-tool.mjs gitleaks --install
ok "AI security hook installed and verified."
```

Windows:

```bat
echo [INFO] Installing verified AI security hook...
node scripts\ai-hooks\run-hook-tool.mjs gitleaks --install
if errorlevel 1 exit /b 1
echo [OK] AI security hook installed and verified.
```

Strict failure stops initialization.

- [ ] **Step 2: Update project-init guidance**

Explain that full bootstrap installs Git hooks and the AI security hook. Add the explicit repair command. Keep `isGitHooksInited` scoped to Git hooks; the verified vendor cache remains installation truth.

- [ ] **Step 3: Update documentation**

Document proactive installation, lazy repair on first hook event, one-time registry access, offline subsequent scanning, `v2.0.1`, modes, and metadata-only audit. Remove sanitizer/launcher claims.

- [ ] **Step 4: Verify**

Run Bash syntax, both Node test files, and `git diff --check`. Validate the Windows invocation through the config contract test when Windows is unavailable.

---

### Task 4: Validator, Index, and Release Smoke Test

**Files:**
- Modify: `scripts/validate-ai-template.mjs`
- Modify: `scripts/ai-template-indexing/generate-ai-tooling-index.mjs`
- Regenerate: `docs/ai-tooling-index.md`

**Interfaces:**
- Consumes final runner, manifest, configs, and bootstrap.
- Produces a validation gate rejecting stale launchers, sanitizer, bad version/hash, missing client arguments, or incomplete event wiring.

- [ ] **Step 1: Update validator invariants**

Require three client configs, runner, install mode, version `v2.0.1`, five valid hashes, explicit client args, timeout 15, Cursor fail-closed critical events, and no sanitizer/launcher. Do not alter immutable CI expectations.

- [ ] **Step 2: Regenerate the tooling index**

Update generator hook descriptions to identify the unified secret/PII hook, then run:

```bash
node scripts/ai-template-indexing/generate-ai-tooling-index.mjs
```

- [ ] **Step 3: Run offline verification**

```bash
node --test scripts/ai-hooks/run-hook-tool.test.mjs scripts/ai-hooks/hook-configs.test.mjs
node scripts/validate-ai-template.mjs
node .githooks/integration-passports.validate.mjs pre-commit
node .githooks/integration-passports.validate.mjs pre-push
bash -n config-lin-mac.sh
git diff --check
```

Separate pre-existing baseline failures from regressions.

- [ ] **Step 4: Run isolated real-release smoke**

Copy runner and manifest to a temporary template-shaped directory. Run install, compare the downloaded platform binary with the pinned hash, then send a safe Codex `UserPromptSubmit` payload through the runner with empty `PATH`. Expect exit 0 and response `{}`. Remove temporary files.

- [ ] **Step 5: Unstaged handoff**

Report changed files, exact verification results, known baseline failures, version/hash used, and confirmation that files remain unstaged. Do not commit or push without explicit authorization.

