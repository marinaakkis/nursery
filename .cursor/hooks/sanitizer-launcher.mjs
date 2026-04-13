#!/usr/bin/env node

import { spawn } from "node:child_process";
import { accessSync, chmodSync, constants, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { arch, platform } from "node:os";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const CONFIG = {
  toolName: "sanitizer-launcher",
  packageNameEnv: "SANITIZER_HOOK_PACKAGE_NAME",
  projectIdEnv: "SANITIZER_HOOK_PROJECT_ID",
  versionEnv: "SANITIZER_HOOK_VERSION",
  gitlabUrlEnv: "HOOKS_GITLAB_URL",
  requestTimeoutEnv: "HOOKS_REGISTRY_TIMEOUT_MS",
  defaultGitlabUrl: "https://gitlab.biocad.ru",
  defaultPackageName: "sanitizer",
  defaultProjectId: "3228",
  defaultRequestTimeoutMs: 5000,
  vendorDirName: "sanitizer",
  binaries: {
    "darwin-arm64": "sanitizer-darwin-arm64",
    "darwin-x64": "sanitizer-darwin-amd64",
    "linux-x64": "sanitizer-linux-amd64",
    "linux-arm64": "sanitizer-linux-arm64",
    "win32-x64": "sanitizer-windows-amd64.exe"
  }
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const vendorRoot = join(scriptDir, "vendor", CONFIG.vendorDirName);
const versionFilePath = join(vendorRoot, "installed-version.txt");

function getPlatformBinary() {
  const key = `${platform()}-${arch()}`;
  const binaryName = CONFIG.binaries[key];
  if (!binaryName) {
    throw new Error(
      `${CONFIG.toolName}: unsupported platform "${key}". Supported: ${Object.keys(CONFIG.binaries).join(", ")}`
    );
  }
  return binaryName;
}

function getPackageName() {
  const value = process.env[CONFIG.packageNameEnv];
  return value && value.trim() ? value.trim() : CONFIG.defaultPackageName;
}

function getProjectId() {
  const value = process.env[CONFIG.projectIdEnv];
  const projectId = value && value.trim() ? value.trim() : CONFIG.defaultProjectId;
  if (!projectId) {
    throw new Error(`${CONFIG.toolName}: set ${CONFIG.projectIdEnv} to the GitLab project id for the sanitizer package`);
  }
  return projectId;
}

function getGitlabUrl() {
  const value = process.env[CONFIG.gitlabUrlEnv];
  return value && value.trim() ? value.trim().replace(/\/$/, "") : CONFIG.defaultGitlabUrl;
}

function getRequestedVersion() {
  const value = process.env[CONFIG.versionEnv];
  return value && value.trim() ? value.trim() : "";
}

function getRequestTimeoutMs() {
  const value = Number(process.env[CONFIG.requestTimeoutEnv]);
  return Number.isFinite(value) && value > 0 ? value : CONFIG.defaultRequestTimeoutMs;
}

function getInstalledVersion() {
  try {
    const value = readFileSync(versionFilePath, "utf8").trim();
    return value || "";
  } catch {
    return "";
  }
}

function ensureExecutable(filePath) {
  const checkFlag = platform() === "win32" ? constants.R_OK : constants.R_OK | constants.X_OK;
  accessSync(filePath, checkFlag);
}

function getInstalledBinaryPath(version, binaryName) {
  return join(vendorRoot, version, binaryName);
}

async function resolveLatestVersion(packageName, projectId, gitlabUrl) {
  const url = new URL(`${gitlabUrl}/api/v4/projects/${encodeURIComponent(projectId)}/packages`);
  url.searchParams.set("package_name", packageName);
  url.searchParams.set("order_by", "version");
  url.searchParams.set("sort", "desc");
  url.searchParams.set("per_page", "1");

  const response = await fetch(url, { signal: AbortSignal.timeout(getRequestTimeoutMs()) });
  if (!response.ok) {
    throw new Error(`${CONFIG.toolName}: failed to resolve latest version (${response.status} ${response.statusText})`);
  }

  const packages = await response.json();
  const version = Array.isArray(packages) && packages[0] && typeof packages[0].version === "string"
    ? packages[0].version.trim()
    : "";

  if (!version) {
    throw new Error(`${CONFIG.toolName}: package registry returned no versions for ${packageName}`);
  }

  return version;
}

async function downloadBinary(version, binaryName, packageName, projectId, gitlabUrl) {
  const versionDir = join(vendorRoot, version);
  const binaryPath = join(versionDir, binaryName);

  if (existsSync(binaryPath)) {
    ensureExecutable(binaryPath);
    return binaryPath;
  }

  mkdirSync(versionDir, { recursive: true });

  const url = `${gitlabUrl}/api/v4/projects/${encodeURIComponent(projectId)}/packages/generic/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}/${encodeURIComponent(binaryName)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(getRequestTimeoutMs()) });
  if (!response.ok || !response.body) {
    throw new Error(`${CONFIG.toolName}: failed to download ${binaryName} (${response.status} ${response.statusText})`);
  }

  const tempPath = `${binaryPath}.download-${process.pid}-${Date.now()}`;

  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(tempPath));

    if (platform() !== "win32") {
      chmodSync(tempPath, 0o755);
    }

    try {
      renameSync(tempPath, binaryPath);
    } catch (error) {
      if (error && error.code === "EEXIST") {
        unlinkSync(tempPath);
      } else {
        throw error;
      }
    }

    ensureExecutable(binaryPath);
    writeFileSync(versionFilePath, `${version}\n`);
    return binaryPath;
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}

async function ensureBinary() {
  const binaryName = getPlatformBinary();
  const requestedVersion = getRequestedVersion();
  const installedVersion = getInstalledVersion();

  if (requestedVersion) {
    const requestedPath = getInstalledBinaryPath(requestedVersion, binaryName);
    if (existsSync(requestedPath)) {
      ensureExecutable(requestedPath);
      return requestedPath;
    }
  }

  if (!requestedVersion && installedVersion) {
    const installedPath = getInstalledBinaryPath(installedVersion, binaryName);
    if (existsSync(installedPath)) {
      ensureExecutable(installedPath);
      return installedPath;
    }
  }

  const packageName = getPackageName();
  const projectId = getProjectId();
  const gitlabUrl = getGitlabUrl();
  const version = requestedVersion || await resolveLatestVersion(packageName, projectId, gitlabUrl);

  return downloadBinary(version, binaryName, packageName, projectId, gitlabUrl);
}

function runBinary(binaryPath) {
  const child = spawn(binaryPath, process.argv.slice(2), { stdio: "inherit" });

  child.on("error", (error) => {
    process.stderr.write(`${CONFIG.toolName}: failed to start binary: ${error.message}\n`);
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

try {
  const binaryPath = await ensureBinary();
  runBinary(binaryPath);
} catch (error) {
  process.stderr.write(`${CONFIG.toolName}: warning — ${error.message}\n`);
  process.stderr.write(`${CONFIG.toolName}: skipping check due to unavailable registry\n`);
  process.exit(0);
}
