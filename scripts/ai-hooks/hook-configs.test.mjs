import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDir, "..", "..");

test("manifest pins the published v2.0.1 artifacts", () => {
  const manifest = readJSON("scripts/ai-hooks/tool-manifest.json");
  assert.equal(manifest.defaultRequestTimeoutMs, 30000);
  const expectedHashes = {
    "darwin-x64": "b24afd81ac6d35fadcca22d8330a38426ebb5f7d31aa9fbb006db968ae89bff2",
    "darwin-arm64": "6a574508494b5429c68819ee48e3042e7c9998f36173c22a8f66197e31089408",
    "linux-x64": "deebd077896e8f9e8e84efcf00363c918321d5e861e39ba363fdf6fef4bc13e8",
    "linux-arm64": "085b102d53512da97d594c22ffab42326d669c7f108abfd06c121c57513ed853",
    "win32-x64": "2f16232c762cf2937e053689dc0dbc5143f9fbfec675df280849de9b72e73d98",
  };
  const gitleaks = manifest.tools.gitleaks;
  assert.equal(gitleaks.packageName, "gitleaks-hook");
  assert.equal(gitleaks.projectId, "3168");
  assert.equal(gitleaks.version, "v2.0.1");
  assert.equal(gitleaks.vendorDir, "gitleaks");
  assert.deepEqual(
    Object.fromEntries(Object.entries(gitleaks.binaries).map(([key, value]) => [key, value.sha256])),
    expectedHashes,
  );
  assert.equal(manifest.tools.sanitizer, undefined);
});

test("Cursor hooks use the native client contract", () => {
  const config = readJSON(".cursor/hooks.json");
  const expectedEvents = [
    "beforeSubmitPrompt", "preToolUse", "postToolUse", "postToolUseFailure",
    "beforeShellExecution", "afterShellExecution", "beforeMCPExecution", "afterMCPExecution",
    "beforeReadFile", "beforeTabFileRead", "afterFileEdit", "afterTabFileEdit",
  ];
  assert.deepEqual(Object.keys(config.hooks), expectedEvents);
  const critical = new Set([
    "beforeSubmitPrompt", "preToolUse", "beforeShellExecution",
    "beforeMCPExecution", "beforeReadFile", "beforeTabFileRead",
  ]);
  for (const [event, entries] of Object.entries(config.hooks)) {
    assert.equal(entries.length, 1, event);
    assert.equal(entries[0].command, "node scripts/ai-hooks/run-hook-tool.mjs gitleaks -- --client cursor", event);
    assert.equal(entries[0].timeout, 15, event);
    assert.equal(entries[0].failClosed, critical.has(event) ? true : undefined, event);
  }
});

test("Claude hooks pass the explicit native client", () => {
  const settings = readJSON(".claude/settings.json");
  assertAgentHooks(settings, "claude", false);
});

test("Codex hooks pass the explicit native client", () => {
  const settings = readJSON(".codex/hooks.json");
  assertAgentHooks(settings, "codex", true);
});

test("hook configs contain no superseded launcher or sanitizer", () => {
  const text = [".cursor/hooks.json", ".claude/settings.json", ".codex/hooks.json"]
    .map((path) => readFileSync(join(root, path), "utf8"))
    .join("\n");
  assert.doesNotMatch(text, /launcher|sanitizer/i);
});

test("shared agent instructions offer verified hook installation and repair", () => {
  const text = readFileSync(join(root, "AGENTS.md"), "utf8");
  assert.match(text, /config-win\.bat/);
  assert.match(text, /config-lin-mac\.sh/);
  assert.match(text, /run-hook-tool\.mjs gitleaks --install/);
  assert.match(text, /isGitHooksInited.*only|only.*isGitHooksInited/is);
});

function assertAgentHooks(settings, client, usesResolver) {
  assert.deepEqual(Object.keys(settings.hooks), ["UserPromptSubmit", "PreToolUse", "PostToolUse"]);
  for (const [event, groups] of Object.entries(settings.hooks)) {
    assert.equal(groups.length, 1, event);
    assert.equal(groups[0].hooks.length, 1, event);
    const hook = groups[0].hooks[0];
    assert.equal(hook.type, "command", event);
    assert.equal(hook.timeout, 15, event);
    if (usesResolver) {
      assert.match(hook.command, /run-hook-tool\.mjs/);
      assert.match(hook.command, new RegExp(`gitleaks -- --client ${client}$`));
    } else {
      assert.equal(hook.command, "node", event);
      assert.deepEqual(hook.args, [
        "${CLAUDE_PROJECT_DIR}/scripts/ai-hooks/run-hook-tool.mjs",
        "gitleaks", "--", "--client", client,
      ]);
    }
  }
}

function readJSON(path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}
