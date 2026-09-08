import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir, platform, arch } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const sourceRunner = join(scriptDir, "run-hook-tool.mjs");

test("install caches a verified binary without executing it", async (t) => {
  const fixture = await createRunnerFixture(t);
  const first = await fixture.invoke(["synthetic", "--install"]);
  assert.equal(first.code, 0, first.stderr);
  assert.match(first.stdout, /installed synthetic v-test/);
  assert.equal(fixture.executionLog(), "");
  assert.equal(fixture.requestCount(), 1);

  const second = await fixture.invoke(["synthetic", "--install"]);
  assert.equal(second.code, 0, second.stderr);
  assert.equal(fixture.executionLog(), "");
  assert.equal(fixture.requestCount(), 1);
});

test("install replaces a corrupted cached binary", async (t) => {
  const fixture = await createRunnerFixture(t);
  assert.equal((await fixture.invoke(["synthetic", "--install"])).code, 0);
  writeFileSync(fixture.binaryPath, "corrupted", "utf8");

  const repaired = await fixture.invoke(["synthetic", "--install"]);
  assert.equal(repaired.code, 0, repaired.stderr);
  assert.equal(fixture.requestCount(), 2);
  assert.equal(sha256(readFileSync(fixture.binaryPath)), fixture.expectedHash);
});

test("hash mismatch never installs the downloaded file", async (t) => {
  const fixture = await createRunnerFixture(t, { wrongHash: true });
  const result = await fixture.invoke(["synthetic", "--install"]);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /integrity check failed/);
  assert.equal(existsSync(fixture.binaryPath), false);
});

test("normal execution forwards explicit client arguments", async (t) => {
  const fixture = await createRunnerFixture(t);
  const result = await fixture.invoke(["synthetic", "--", "--client", "codex"]);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, "{}\n");
  assert.equal(fixture.executionLog(), "--client codex\n");
});

test("off skips install unless the security gate forces strict", async (t) => {
  const fixture = await createRunnerFixture(t);
  const skipped = await fixture.invoke(["synthetic", "--install"], { AI_HOOKS_MODE: "off" });
  assert.equal(skipped.code, 0, skipped.stderr);
  assert.equal(fixture.requestCount(), 0);

  const forced = await fixture.invoke(["synthetic", "--install"], {
    AI_HOOKS_MODE: "off",
    AI_HOOKS_SECURITY_GATE: "1",
  });
  assert.equal(forced.code, 0, forced.stderr);
  assert.equal(fixture.requestCount(), 1);
});

async function createRunnerFixture(t, { wrongHash = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "ai-hook-runner-test-"));
  const fixtureScriptDir = join(root, "scripts", "ai-hooks");
  mkdirSync(fixtureScriptDir, { recursive: true });
  copyFileSync(sourceRunner, join(fixtureScriptDir, "run-hook-tool.mjs"));

  const executionLogPath = join(root, "execution.log");
  const executable = Buffer.from("#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$EXECUTION_LOG\"\nprintf '{}\\n'\n");
  const expectedHash = sha256(executable);
  let requests = 0;
  const server = createServer((request, response) => {
    requests += 1;
    if (!request.url?.endsWith("/synthetic-hook")) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": "application/octet-stream" });
    response.end(executable);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const registry = `http://127.0.0.1:${address.port}`;

  const manifest = {
    defaultGitlabUrl: registry,
    defaultRequestTimeoutMs: 2000,
    tools: {
      synthetic: {
        packageName: "synthetic-package",
        projectId: "1",
        version: "v-test",
        vendorDir: "synthetic",
        binaries: {
          [`${platform()}-${arch()}`]: {
            file: "synthetic-hook",
            sha256: wrongHash ? "0".repeat(64) : expectedHash,
          },
        },
      },
    },
  };
  writeFileSync(join(fixtureScriptDir, "tool-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  const binaryPath = join(fixtureScriptDir, "vendor", "synthetic", "v-test", "synthetic-hook");
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    rmSync(root, { recursive: true, force: true });
  });

  return {
    binaryPath,
    expectedHash,
    executionLog: () => (existsSync(executionLogPath) ? readFileSync(executionLogPath, "utf8") : ""),
    requestCount: () => requests,
    invoke: (args, extraEnv = {}) => invokeRunner(join(fixtureScriptDir, "run-hook-tool.mjs"), root, args, {
      EXECUTION_LOG: executionLogPath,
      ...extraEnv,
    }),
  };
}

function invokeRunner(runner, cwd, args, extraEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [runner, ...args], {
      cwd,
      env: { ...process.env, ...extraEnv },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
