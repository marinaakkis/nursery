#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  accessSync,
  chmodSync,
  constants,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { arch, platform } from "node:os";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(scriptDir, "tool-manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

function parseInvocation() {
  const [toolName, separator, ...rest] = process.argv.slice(2);
  if (!toolName || toolName === "--") {
    throw new Error("usage: run-hook-tool.mjs <tool-name> [--install | -- <tool-args...>]");
  }
  if (separator === "--install") {
    if (rest.length > 0) {
      throw new Error("--install does not accept tool arguments");
    }
    return { toolName, action: "install", toolArgs: [] };
  }
  return {
    toolName,
    action: "run",
    toolArgs: separator === "--" ? rest : [separator, ...rest].filter(Boolean),
  };
}

function getMode() {
  const requested = (process.env.AI_HOOKS_MODE || "strict").trim().toLowerCase();
  const mode = ["strict", "warn", "off"].includes(requested) ? requested : "strict";
  const securityGate = process.env.CI === "true" || process.env.CI === "1" || process.env.AI_HOOKS_SECURITY_GATE === "1";
  return securityGate ? "strict" : mode;
}

function platformKey() {
  return `${platform()}-${arch()}`;
}

function toolConfig(toolName) {
  const config = manifest.tools?.[toolName];
  if (!config) {
    throw new Error(`unknown hook tool "${toolName}". Known tools: ${Object.keys(manifest.tools || {}).join(", ")}`);
  }
  return config;
}

function binarySpec(config) {
  const key = platformKey();
  const spec = config.binaries?.[key];
  if (!spec) {
    throw new Error(`unsupported platform "${key}" for ${config.packageName}`);
  }
  if (!/^[a-f0-9]{64}$/i.test(spec.sha256 || "")) {
    throw new Error(`missing or invalid sha256 for ${config.packageName} ${key}`);
  }
  return spec;
}

function gitlabUrl() {
  return (process.env.HOOKS_GITLAB_URL || manifest.defaultGitlabUrl || "").replace(/\/$/, "");
}

function requestTimeoutMs() {
  const value = Number(process.env.HOOKS_REGISTRY_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : manifest.defaultRequestTimeoutMs || 5000;
}

function headers() {
  if (process.env.HOOKS_GITLAB_TOKEN) {
    return { "PRIVATE-TOKEN": process.env.HOOKS_GITLAB_TOKEN };
  }
  if (process.env.CI_JOB_TOKEN) {
    return { "JOB-TOKEN": process.env.CI_JOB_TOKEN };
  }
  return {};
}

function sha256(filePath) {
  const hash = createHash("sha256");
  hash.update(readFileSync(filePath));
  return hash.digest("hex");
}

function verify(filePath, expected) {
  const actual = sha256(filePath);
  if (actual !== expected) {
    throw new Error(`integrity check failed for ${filePath}: expected ${expected}, got ${actual}`);
  }
}

function ensureExecutable(filePath) {
  const flag = platform() === "win32" ? constants.R_OK : constants.R_OK | constants.X_OK;
  if (platform() !== "win32") {
    chmodSync(filePath, 0o755);
  }
  accessSync(filePath, flag);
}

function binaryPath(config, spec) {
  return join(scriptDir, "vendor", config.vendorDir, config.version, spec.file);
}

function packageUrl(config, spec) {
  const base = gitlabUrl();
  if (!base) throw new Error("HOOKS_GITLAB_URL is empty and manifest defaultGitlabUrl is not set");
  return `${base}/api/v4/projects/${encodeURIComponent(config.projectId)}/packages/generic/${encodeURIComponent(config.packageName)}/${encodeURIComponent(config.version)}/${encodeURIComponent(spec.file)}`;
}

async function download(config, spec, targetPath) {
  mkdirSync(dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.download-${process.pid}-${Date.now()}`;
  try {
    const response = await fetch(packageUrl(config, spec), {
      headers: headers(),
      signal: AbortSignal.timeout(requestTimeoutMs()),
    });
    if (!response.ok || !response.body) {
      throw new Error(`download failed for ${spec.file}: ${response.status} ${response.statusText}`);
    }
    await pipeline(Readable.fromWeb(response.body), createWriteStream(tempPath));
    verify(tempPath, spec.sha256);
    ensureExecutable(tempPath);
    renameSync(tempPath, targetPath);
    writeFileSync(join(scriptDir, "vendor", config.vendorDir, "installed-version.txt"), `${config.version}\n`, "utf8");
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}

async function ensureBinary(config, spec) {
  const path = binaryPath(config, spec);
  if (existsSync(path)) {
    try {
      verify(path, spec.sha256);
      ensureExecutable(path);
      return path;
    } catch {
      rmSync(path, { force: true });
    }
  }
  await download(config, spec, path);
  verify(path, spec.sha256);
  ensureExecutable(path);
  return path;
}

function run(binary, args) {
  const child = spawn(binary, args, { stdio: "inherit" });
  child.on("error", (error) => {
    process.stderr.write(`ai-hook: failed to start ${binary}: ${error.message}\n`);
    process.exit(1);
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

function handleFailure(error, mode) {
  process.stderr.write(`ai-hook: ${error.message}\n`);
  if (mode === "warn") {
    process.stderr.write("ai-hook: local warn mode is enabled; skipping hook. CI/security-gate mode always fails closed.\n");
    process.exit(0);
  }
  process.exit(1);
}

const mode = getMode();
if (mode === "off") {
  process.exit(0);
}

try {
  const { toolName, action, toolArgs } = parseInvocation();
  const config = toolConfig(toolName);
  const spec = binarySpec(config);
  const binary = await ensureBinary(config, spec);
  if (action === "install") {
    process.stdout.write(`installed ${toolName} ${config.version}\n`);
  } else {
    run(binary, toolArgs);
  }
} catch (error) {
  handleFailure(error, mode);
}
