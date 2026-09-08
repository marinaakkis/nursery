#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir, platform } from "node:os";

const requiredSettings = {
  "cursor.privacyMode": true,
  "cursor.ghostMode": true,
  "cursor.autoRun": false,
  "telemetry.telemetryLevel": "off",
  "telemetry.enableCrashReporter": false,
  "telemetry.enableTelemetry": false,
};

function defaultSettingsPath() {
  if (process.env.CURSOR_SETTINGS_PATH) {
    return process.env.CURSOR_SETTINGS_PATH;
  }
  if (platform() === "darwin") {
    return join(homedir(), "Library", "Application Support", "Cursor", "User", "settings.json");
  }
  if (platform() === "win32") {
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return join(appData, "Cursor", "User", "settings.json");
  }
  return join(homedir(), ".config", "Cursor", "User", "settings.json");
}

function readExisting(path) {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${path}: invalid JSON; fix it before running setup (${error.message})`);
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

const settingsPath = defaultSettingsPath();
mkdirSync(dirname(settingsPath), { recursive: true });

const existing = readExisting(settingsPath);
const next = { ...existing, ...requiredSettings };

if (existsSync(settingsPath)) {
  writeFileSync(`${settingsPath}.bak-${timestamp()}`, JSON.stringify(existing, null, 2) + "\n", "utf8");
}

writeFileSync(settingsPath, JSON.stringify(next, null, 2) + "\n", "utf8");
console.log(`Merged Cursor settings: ${settingsPath}`);
