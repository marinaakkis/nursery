#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const errors = [];

function fail(message) {
  errors.push(message);
}

function exists(path) {
  try {
    statSync(join(root, path));
    return true;
  } catch {
    return false;
  }
}

function isDirectory(path) {
  try {
    return statSync(join(root, path)).isDirectory();
  } catch {
    return false;
  }
}

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function walk(dir, out = []) {
  if (!exists(dir)) return out;
  for (const name of readdirSync(join(root, dir))) {
    const rel = join(dir, name).replace(/\\/g, "/");
    if (rel === ".git" || rel.includes("/.git/") || rel === "node_modules" || rel.includes("/node_modules/")) {
      continue;
    }
    if (rel === "scripts/ai-hooks/vendor" || rel.includes("/scripts/ai-hooks/vendor/")) {
      continue;
    }
    const st = statSync(join(root, rel));
    if (st.isDirectory()) {
      out.push(...walk(rel));
    } else {
      out.push(rel);
    }
  }
  return out;
}

function parseJson(path) {
  try {
    return JSON.parse(read(path));
  } catch (error) {
    fail(`${path}: invalid JSON (${error.message})`);
    return {};
  }
}

function parseJsonc(path) {
  try {
    const stripped = read(path)
      .split("\n")
      .filter((line) => !/^\s*\/\//.test(line))
      .join("\n");
    JSON.parse(stripped);
  } catch (error) {
    fail(`${path}: invalid JSONC after comment stripping (${error.message})`);
  }
}

function frontmatter(text) {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return null;
  const end = normalized.indexOf("\n---", 4);
  if (end === -1) return null;
  return normalized.slice(4, end).trimEnd();
}

function field(fm, name) {
  const lines = fm.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith(`${name}: >-`)) {
      const values = [];
      for (let j = i + 1; j < lines.length; j += 1) {
        if (!/^\s+/.test(lines[j])) break;
        values.push(lines[j].trim());
      }
      return values.join(" ").trim();
    }
    if (line.startsWith(`${name}:`)) {
      return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return "";
}

function checkNoNestedGit() {
  function scan(dir) {
    for (const name of readdirSync(join(root, dir))) {
      const rel = join(dir, name).replace(/\\/g, "/");
      if (rel === ".git") continue;
      const st = statSync(join(root, rel));
      if (st.isDirectory()) {
        if (name === ".git") fail(`nested git repository is not allowed: ${rel}`);
        else scan(rel);
      }
    }
  }
  scan(".");
}

function checkGitlabCiBlock() {
  const expected = read("templates/gitlab-ci.security-block.yml").replace(/\r\n/g, "\n");
  const lines = read(".gitlab-ci.yml").replace(/\r\n/g, "\n").split("\n");
  const stageIndex = lines.findIndex((line) => /^stages:\s*\[.*\]$/.test(line));
  if (stageIndex < 0 || lines[stageIndex + 1] !== "####################################") {
    fail(".gitlab-ci.yml immutable security block has no closing stages marker");
    return;
  }
  const actual = `${lines.slice(0, stageIndex + 2).join("\n")}\n`;
  if (actual !== expected) fail(".gitlab-ci.yml immutable security block changed");
}

function checkCodexConfig() {
  const text = read(".codex/config.toml");
  for (const banned of ["codex_hooks", "persistent_instructions", "[profiles."]) {
    if (text.includes(banned)) fail(`.codex/config.toml contains deprecated/noisy key: ${banned}`);
  }
  for (const required of ['approval_policy = "on-request"', 'sandbox_mode = "workspace-write"', "hooks = true"]) {
    if (!text.includes(required)) fail(`.codex/config.toml missing required setting: ${required}`);
  }
}

function collectHookValues(cursorHooks, codexHooks, claudeSettings) {
  const values = [];
  for (const hooks of Object.values(cursorHooks.hooks ?? {})) {
    for (const hook of hooks) values.push(hook.command ?? "");
  }
  for (const groups of Object.values(codexHooks.hooks ?? {})) {
    for (const group of groups) {
      for (const hook of group.hooks ?? []) values.push(hook.command ?? "");
    }
  }
  for (const groups of Object.values(claudeSettings.hooks ?? {})) {
    for (const group of groups) {
      for (const hook of group.hooks ?? []) {
        values.push(hook.command ?? "");
        values.push(...(hook.args ?? []));
      }
    }
  }
  return values;
}

function checkHookManifest(manifest) {
  const toolNames = Object.keys(manifest.tools ?? {});
  if (toolNames.length !== 1 || toolNames[0] !== "gitleaks") {
    fail("tool-manifest.json must declare only the unified gitleaks hook");
  }
  for (const [toolName, config] of Object.entries(manifest.tools ?? {})) {
    for (const required of ["packageName", "projectId", "version", "vendorDir"]) {
      if (!config[required]) fail(`tool-manifest.json ${toolName}: missing ${required}`);
    }
    for (const [platformName, spec] of Object.entries(config.binaries ?? {})) {
      if (!spec.file) fail(`tool-manifest.json ${toolName}/${platformName}: missing file`);
      if (!/^[a-f0-9]{64}$/i.test(spec.sha256 || "")) {
        fail(`tool-manifest.json ${toolName}/${platformName}: invalid sha256`);
      }
    }
  }
  const gitleaks = manifest.tools?.gitleaks;
  if (gitleaks?.version !== "v2.0.1") fail("tool-manifest.json must pin gitleaks v2.0.1");
  const expectedPlatforms = ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "win32-x64"];
  if (JSON.stringify(Object.keys(gitleaks?.binaries ?? {}).sort()) !== JSON.stringify(expectedPlatforms.sort())) {
    fail("tool-manifest.json must declare exactly five supported gitleaks binaries");
  }
}

function checkHooks(cursorHooks, codexHooks, claudeSettings, manifest) {
  for (const path of [".cursor/hooks", ".claude/hooks"]) {
    if (exists(path)) fail(`${path} should not exist in the cleaned baseline`);
  }
  for (const path of [
    ".cursor/hooks.json",
    "scripts/ai-hooks/run-hook-tool.mjs",
    "scripts/ai-hooks/tool-manifest.json",
  ]) {
    if (!exists(path)) fail(`missing AI hook file: ${path}`);
  }
  for (const path of ["scripts/ai-hooks/gitleaks-launcher.mjs", "scripts/ai-hooks/sanitizer-launcher.mjs"]) {
    if (exists(path)) fail(`superseded AI hook wrapper must be removed: ${path}`);
  }
  checkHookManifest(manifest);

  const values = collectHookValues(cursorHooks, codexHooks, claudeSettings);
  if (!values.some((value) => value.includes("run-hook-tool.mjs"))) {
    fail("hook configs do not reference scripts/ai-hooks/run-hook-tool.mjs");
  }
  for (const value of values) {
    for (const stale of [".cursor/hooks", ".claude/hooks", "before-submit-prompt", "codex-in", "local-smoke", "$(git"]) {
      if (value.includes(stale)) fail(`stale or shell-fragile hook reference: ${value}`);
    }
    for (const match of value.matchAll(/scripts\/ai-hooks\/[A-Za-z0-9_.-]+/g)) {
      if (!exists(match[0])) fail(`hook reference points to missing file: ${match[0]}`);
    }
  }

  const runnerText = read("scripts/ai-hooks/run-hook-tool.mjs");
  if (!runnerText.includes("integrity check failed") || !runnerText.includes("AI_HOOKS_SECURITY_GATE") || !runnerText.includes('=== "--install"')) {
    fail("run-hook-tool.mjs must verify integrity, support --install, and enforce security-gate strict mode");
  }
  if (runnerText.includes("skipping check due to unavailable registry")) {
    fail("run-hook-tool.mjs must not contain old fail-open behavior");
  }

  const agentEvents = ["UserPromptSubmit", "PreToolUse", "PostToolUse"];
  for (const [name, config, client] of [
    ["Claude", claudeSettings, "claude"],
    ["Codex", codexHooks, "codex"],
  ]) {
    if (JSON.stringify(Object.keys(config.hooks ?? {})) !== JSON.stringify(agentEvents)) {
      fail(`${name} hooks must cover UserPromptSubmit, PreToolUse, and PostToolUse`);
    }
    for (const groups of Object.values(config.hooks ?? {})) {
      for (const group of groups) {
        for (const hook of group.hooks ?? []) {
          const invocation = [hook.command, ...(hook.args ?? [])].join(" ");
          if (!invocation.includes(`gitleaks -- --client ${client}`)) fail(`${name} hook missing explicit --client ${client}`);
          if (hook.timeout !== 15) fail(`${name} hook timeout must be 15 seconds`);
        }
      }
    }
  }

  const cursorEvents = [
    "beforeSubmitPrompt", "preToolUse", "postToolUse", "postToolUseFailure",
    "beforeShellExecution", "afterShellExecution", "beforeMCPExecution", "afterMCPExecution",
    "beforeReadFile", "beforeTabFileRead", "afterFileEdit", "afterTabFileEdit",
  ];
  if (JSON.stringify(Object.keys(cursorHooks.hooks ?? {})) !== JSON.stringify(cursorEvents)) {
    fail("Cursor hooks must cover the reviewed prompt, tool, shell, MCP, read, and edit events");
  }
  const failClosedEvents = new Set([
    "beforeSubmitPrompt", "preToolUse", "beforeShellExecution",
    "beforeMCPExecution", "beforeReadFile", "beforeTabFileRead",
  ]);
  for (const [event, hooks] of Object.entries(cursorHooks.hooks ?? {})) {
    for (const hook of hooks) {
      if (!hook.command?.includes("gitleaks -- --client cursor")) fail(`Cursor ${event} hook missing explicit --client cursor`);
      if (hook.timeout !== 15) fail(`Cursor ${event} hook timeout must be 15 seconds`);
      if (failClosedEvents.has(event) && hook.failClosed !== true) fail(`Cursor ${event} hook must fail closed`);
    }
  }
}

// Cursor rules permitted to declare `alwaysApply: true`. Each is injected into
// every agent context, so the list is explicit and reviewed on change.
const ALWAYS_APPLY_ALLOWLIST = new Set([
  // Security and workspace scope.
  ".cursor/rules/rule.security.en.corporate-dlp.mdc",
  ".cursor/rules/rule.security.en.gitlab-ci-immutable-security-block.mdc",
  ".cursor/rules/rule.governance.ru.workspace-scope-boundary.mdc",
  ".cursor/rules/rule.governance.ru.git-agent-no-staging.mdc",
  // Governance / authoring conventions.
  ".cursor/rules/rule.governance.ru.cursor-skill-command-rule-filenames.mdc",
  ".cursor/rules/rule.governance.ru.incremental-governance-edits.mdc",
  ".cursor/rules/rule.governance.ru.translation-ru-en-fidelity.mdc",
  ".cursor/rules/rule.governance.ru.folder-transfer-script-and-risk-gate.mdc",
  // Legacy-code safety.
  ".cursor/rules/rule.dev.ru.no-legacy-converters.mdc",
  ".cursor/rules/rule.dev.ru.no-silent-rewrite-legacy-code.mdc",
  // Integration reliability gate.
  ".cursor/rules/rule.integration.ru.integration-passport-and-reliability-gate.mdc",
]);

function checkCursorRules() {
  for (const file of walk(".cursor/rules").filter((path) => path.endsWith(".mdc"))) {
    const fm = frontmatter(read(file));
    if (!fm) {
      fail(`${file}: missing YAML frontmatter`);
      continue;
    }
    if (!field(fm, "description")) fail(`${file}: missing description`);
    const always = field(fm, "alwaysApply");
    if (!always) fail(`${file}: missing alwaysApply`);
    if (always === "true" && !ALWAYS_APPLY_ALLOWLIST.has(file)) fail(`${file}: unexpected alwaysApply true`);
  }
}

function canonicalSkillDirs() {
  return readdirSync(join(root, ".agents/skills"))
    .map((name) => `.agents/skills/${name}`)
    .filter((path) => isDirectory(path))
    .sort();
}

function externallyManagedSkillDirs() {
  const manifest = parseJson("scripts/skills/deploy-skills.json");
  return new Set(Object.values(manifest.skills ?? {}).map((name) => `.agents/skills/${name}`));
}

function checkSkills() {
  if (!isDirectory(".agents/skills")) fail("missing canonical skills directory: .agents/skills");
  const dirPattern = /^\.agents\/skills\/skill\.[a-z][a-z0-9-]*\.(ru|en)\.[a-z0-9-]+$/;
  const externallyManaged = externallyManagedSkillDirs();
  for (const dir of canonicalSkillDirs()) {
    if (!dirPattern.test(dir)) fail(`${dir}: skill directory does not match skill.<domain>.<ru|en>.<name>`);
    const skill = `${dir}/SKILL.md`;
    if (!exists(skill)) {
      fail(`${dir}: missing SKILL.md`);
      continue;
    }
    const text = read(skill);
    const fm = frontmatter(text);
    if (!fm) {
      fail(`${skill}: missing YAML frontmatter`);
      continue;
    }
    const name = field(fm, "name");
    const description = field(fm, "description");
    if (!/^[a-z0-9.-]{1,128}$/.test(name) || name.startsWith(".") || name.endsWith(".")) {
      fail(`${skill}: invalid name "${name}"`);
    }
    if (!description) fail(`${skill}: missing description`);
    if (description.length > 1024) fail(`${skill}: description is too long (${description.length} chars)`);
    const lineCount = text.split("\n").length;
    if (lineCount > 500 && !externallyManaged.has(dir)) fail(`${skill}: too long (${lineCount} lines); move details into references/`);
  }
  const cursorSkillFiles = walk(".cursor/skills").filter((path) => path.endsWith("/SKILL.md"));
  if (cursorSkillFiles.length > 0) fail(`.cursor/skills must not contain skill copies: ${cursorSkillFiles.join(", ")}`);
  if (!exists(".cursor/skills/README.md")) fail(".cursor/skills/README.md adapter note is required");
}

function checkClaudeAdapters() {
  if (!isDirectory(".claude/skills")) fail("missing Claude skill adapters directory: .claude/skills");
  for (const dir of canonicalSkillDirs()) {
    const name = dir.split("/").pop();
    const adapter = `.claude/skills/${name}/SKILL.md`;
    if (!exists(adapter)) {
      fail(`${adapter}: missing generated Claude adapter`);
      continue;
    }
    if (!read(adapter).includes(`../../../.agents/skills/${name}/SKILL.md`)) {
      fail(`${adapter}: does not point to canonical skill`);
    }
  }
}

function checkOpenCode(opencode) {
  if ("tools" in opencode) fail(".opencode/opencode.json: legacy tools key is not allowed");
  if (!opencode.permission || opencode.permission["*"] !== "ask") {
    fail(".opencode/opencode.json: permission.* must default to ask");
  }
  if (!opencode.permission?.bash || opencode.permission.bash["git push*"] !== "deny") {
    fail(".opencode/opencode.json: git push must be denied by default");
  }
  if (!opencode.permission?.read || opencode.permission.read[".env"] !== "deny") {
    fail(".opencode/opencode.json: .env reads must be denied");
  }
}

function checkSetupScripts() {
  for (const file of ["config-lin-mac.sh", "config-win.bat"]) {
    const text = read(file);
    const banned = [
      "DATABASE_URL=postgresql://user:" + "password",
      "SECRET_KEY=change" + "me",
      "copy \".env.example\" \".env\"",
      "cp .env.example .env",
      "cat > .env.example",
    ];
    for (const pattern of banned) {
      if (text.includes(pattern)) fail(`${file}: destructive or secret-shaped setup behavior remains`);
    }
  }
  if (!exists("scripts/bootstrap/merge-cursor-settings.mjs")) {
    fail("missing safe Cursor settings merge helper");
  }
}

function checkGeneratedIndex() {
  if (!exists("docs/ai-tooling-index.md")) fail("missing generated docs/ai-tooling-index.md");
  if (!read("README.md").includes("docs/ai-tooling-index.md")) {
    fail("README.md must reference docs/ai-tooling-index.md");
  }
}

function checkReferences() {
  const files = [
    "AGENTS.md",
    "README.md",
    "scripts/README.md",
    "docs/ai-tooling-index.md",
    ".gitignore",
    ...walk(".cursor/rules").filter((path) => path.endsWith(".mdc")),
    ...walk(".cursor/commands").filter((path) => path.endsWith(".md")),
    ...walk(".claude").filter((path) => path.endsWith(".md") || path.endsWith(".json")),
    ...walk(".codex").filter((path) => path.endsWith(".json") || path.endsWith(".toml")),
    ...walk(".opencode").filter((path) => path.endsWith(".json") || path.endsWith(".md")),
    ...walk("scripts").filter((path) => /\.(md|mjs|sh|bat|ps1)$/.test(path)),
  ];
  for (const file of files) {
    const text = read(file);
    if (file.replace(/\\/g, "/") !== "scripts/validate-ai-template.mjs") {
      for (const stale of ["corporate-auth/", ".claude/hooks", "before-submit-prompt.js"]) {
        if (text.includes(stale)) fail(`${file}: stale reference to ${stale}`);
      }
    }
    if (/\.cursor\/skills\/skill\./.test(text)) fail(`${file}: stale reference to .cursor/skills skill copy`);
    for (const match of text.matchAll(/\.agents\/skills\/[^`\s)]+\/SKILL\.md/g)) {
      if (/[<*$]|\.\.\./.test(match[0])) continue;
      if (!exists(match[0])) fail(`${file}: missing referenced skill ${match[0]}`);
    }
  }
}

const claudeSettings = parseJson(".claude/settings.json");
const codexHooks = parseJson(".codex/hooks.json");
const cursorHooks = parseJson(".cursor/hooks.json");
const opencode = parseJson(".opencode/opencode.json");
const manifest = parseJson("scripts/ai-hooks/tool-manifest.json");

parseJsonc(".devcontainer/devcontainer.json");
checkNoNestedGit();
checkGitlabCiBlock();
checkCodexConfig();
checkHooks(cursorHooks, codexHooks, claudeSettings, manifest);
checkCursorRules();
checkSkills();
checkClaudeAdapters();
checkOpenCode(opencode);
checkSetupScripts();
checkGeneratedIndex();
checkReferences();

if (errors.length > 0) {
  console.error("AI template validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("AI template validation passed.");
