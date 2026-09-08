# Template Defects Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a fresh `ai-project-template` install and validate cleanly while preserving the canonical aggregate CI security block and integration-passport governance.

**Architecture:** The CI block becomes a checked template fixture, installers ask Git for the repository root, and the integration validator separates discovery/setup states from invalid data. The Kubernetes skill becomes a concise router with progressive references.

**Tech Stack:** Node.js ESM tests, Bash, PowerShell, Git hooks, Markdown.

**Spec:** `docs/superpowers/specs/2026-08-27-template-defects-design.md`

## Global Constraints

- Canonical CI block is the current `main/ci@2.1.2` aggregate block.
- Never infer `internal` or `external` Scope when the detector is ambiguous.
- Existing integration logs take priority; duplicate logs are errors.
- No destructive modifications outside temporary test repositories.
- Keep `SKILL.md` at or below the validator's 500-line limit.

---

### Task 1: Reliable repository-root detection for Git hook installers

**Files:**
- Modify: `scripts/git-hooks/git-hooks.lin-mac.install.sh`
- Modify: `scripts/git-hooks/git-hooks.lin-mac.uninstall.sh`
- Modify: `scripts/git-hooks/git-hooks.win.install.ps1`
- Modify: `scripts/git-hooks/git-hooks.win.uninstall.ps1`
- Create: `scripts/git-hooks/git-hooks.lin-mac.test.sh`

**Interfaces:**
- Produces installers that resolve the checkout root through `git -C "$script_dir" rev-parse --show-toplevel`.
- Test creates a temporary Git repository and asserts `pre-commit` and `pre-push` are installed and removed.

- [ ] **Step 1: Write a failing installer smoke test**

```bash
bash scripts/git-hooks/git-hooks.lin-mac.test.sh
# Expected before fix: installer looks for <repo>/scripts/.githooks and exits 1.
```

- [ ] **Step 2: Implement Git-based root lookup in all four installers**

```bash
REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
$repoRoot = git -C $PSScriptRoot rev-parse --show-toplevel
```

- [ ] **Step 3: Run installer smoke test and Bash syntax validation**

```bash
bash scripts/git-hooks/git-hooks.lin-mac.test.sh
bash -n scripts/git-hooks/git-hooks.lin-mac.{install,uninstall}.sh
```

### Task 2: Canonical CI block validation and documentation

**Files:**
- Create: `templates/gitlab-ci.security-block.yml`
- Modify: `scripts/validate-ai-template.mjs`
- Create: `scripts/validate-ai-template.test.mjs`
- Modify: `.cursor/rules/rule.security.en.gitlab-ci-immutable-security-block.mdc`
- Modify: `AGENTS.md`
- Modify: `.agents/skills/skill.devops.en.k8s-deploy-scaffold/SKILL.md`

**Interfaces:**
- `extractGitlabCiSecurityBlock(content)` returns the leading block ending at the separator after `stages:`.
- Validator compares the extracted block to `templates/gitlab-ci.security-block.yml`.

- [ ] **Step 1: Add failing tests for exact canonical match, mutation, and closing-marker extraction**

```js
assert.equal(extractGitlabCiSecurityBlock(fixture), canonical);
assert.notEqual(extractGitlabCiSecurityBlock(mutated), canonical);
```

- [ ] **Step 2: Add the canonical fixture and replace the hard-coded nine-line array**

```js
const expected = read("templates/gitlab-ci.security-block.yml");
const actual = extractGitlabCiSecurityBlock(read(".gitlab-ci.yml"));
if (actual !== expected) fail(".gitlab-ci.yml immutable security block changed");
```

- [ ] **Step 3: Make rule, shared instructions, and deployment skill reference the fixture**

```markdown
Canonical block: `templates/gitlab-ci.security-block.yml`.
Do not edit the source block in `.gitlab-ci.yml`.
```

- [ ] **Step 4: Run validator tests and the template validator**

```bash
node --test scripts/validate-ai-template.test.mjs
node scripts/validate-ai-template.mjs
```

### Task 3: Split the Kubernetes deployment skill and synchronize adapters

**Files:**
- Modify: `.agents/skills/skill.devops.en.k8s-deploy-scaffold/SKILL.md`
- Create: `.agents/skills/skill.devops.en.k8s-deploy-scaffold/references/*.md`
- Modify/generated: `.claude/skills/skill.devops.en.k8s-deploy-scaffold/SKILL.md`

**Interfaces:**
- `SKILL.md` routes to named references only when their detailed procedure is needed.

- [ ] **Step 1: Identify sections that are detailed execution reference material**
- [ ] **Step 2: Move those sections into linked references without changing policy**
- [ ] **Step 3: Regenerate Claude skill adapters**

```bash
node scripts/ai-template-indexing/sync-claude-skill-adapters.mjs
```

- [ ] **Step 4: Assert entrypoint line count and validate the template**

```bash
test "$(wc -l < .agents/skills/skill.devops.en.k8s-deploy-scaffold/SKILL.md)" -le 500
node scripts/validate-ai-template.mjs
```

### Task 4: Correct integration-log identity, setup, and lifecycle handling

**Files:**
- Modify: `.githooks/integration-passports.validate.mjs`
- Modify: `.githooks/integration-passports.validate.test.mjs`
- Modify: `.agents/skills/skill.arch.ru.project-folder-layout/SKILL.md`

**Interfaces:**
- `computeLogPathForModule(moduleRootAbs)` returns an `integrations-log.<lower-kebab>.md` path.
- `syncIntegrationLogs(hookMode)` reports duplicate logs, new unscoped setup rows, and skips deletion in modules with no source files.
- `extractRequiredFieldValue(content, fieldName)` accepts label rows with or without `[ОБЯЗАТЕЛЬНО]`.

- [ ] **Step 1: Add failing unit tests for name normalization and optional passport marker**

```js
assert.match(basename(computeLogPathForModule("/tmp/MyProject.Api")), /^integrations-log\.myproject-api\.md$/);
assert.equal(extractRequiredFieldValue("| **Статус** | Active |", "Статус"), "Active");
```

- [ ] **Step 2: Add failing integration tests for existing-log priority, duplicate detection, empty-module deletion protection, and first-run Scope guidance**
- [ ] **Step 3: Implement one invariant at a time, then rerun the focused tests**
- [ ] **Step 4: Update the folder-layout skill with the normalized filename rule**
- [ ] **Step 5: Run all integration-passport tests**

```bash
node --test .githooks/integration-passports.validate.test.mjs
```

### Task 5: Safe unborn-HEAD pre-push and final verification

**Files:**
- Modify: `.githooks/integration-passports.validate.mjs`
- Modify: `.githooks/integration-passports.validate.test.mjs`

**Interfaces:**
- `main()` exits 0 before repository scanning when `pre-push` is requested and no `HEAD` exists.

- [ ] **Step 1: Add an isolated no-commit repository test expecting exit 0 and a skip message**
- [ ] **Step 2: Add the `git rev-parse --verify --quiet HEAD` guard**
- [ ] **Step 3: Run full verification**

```bash
node --test .githooks/integration-passports.validate.test.mjs scripts/validate-ai-template.test.mjs scripts/ai-hooks/*.test.mjs
bash scripts/git-hooks/git-hooks.lin-mac.test.sh
node scripts/validate-ai-template.mjs
git diff --check
```

- [ ] **Step 4: Commit and push the implementation branch without opening an MR**

```bash
git add <only remediation files>
git commit -m "fix: remediate template validation and hook defects"
git push -u origin fix/template-defects
```
