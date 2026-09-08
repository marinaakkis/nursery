#!/usr/bin/env node

import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const mode = process.argv[2] ?? "--check";
if (!new Set(["--check", "--apply"]).has(mode)) throw new Error("usage: sync-deploy-skills.mjs [--check|--apply]");
const manifest = JSON.parse(readFileSync(join(root, "scripts/skills/deploy-skills.json"), "utf8"));
if (!manifest.branch) throw new Error("deploy-skills.json must declare the tracked source branch");
const checkout = mkdtempSync(join(tmpdir(), "deploy-skills-"));

function run(command, args) {
  const result = spawnSync(command, args, { cwd: checkout, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function snapshot(dir, prefix = "") {
  const result = new Map();
  for (const entry of readdirSync(dir).sort()) {
    const relative = prefix ? `${prefix}/${entry}` : entry;
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      for (const [path, content] of snapshot(fullPath, relative)) result.set(path, content);
    } else {
      result.set(relative, readFileSync(fullPath).toString("base64"));
    }
  }
  return result;
}

try {
  run("git", ["clone", "--no-checkout", manifest.repository, checkout]);
  run("git", ["fetch", "--depth", "1", "origin", manifest.branch]);
  const sourceCommit = run("git", ["rev-parse", "FETCH_HEAD"]);
  run("git", ["checkout", "--detach", sourceCommit]);

  const mismatches = [];
  for (const [source, target] of Object.entries(manifest.skills)) {
    const sourcePath = join(checkout, source);
    const targetPath = join(root, ".agents", "skills", target);
    if (!existsSync(sourcePath)) throw new Error(`source skill missing: ${source}`);
    if (!existsSync(targetPath) || JSON.stringify([...snapshot(sourcePath)]) !== JSON.stringify([...snapshot(targetPath)])) {
      mismatches.push(`${source} -> ${target}`);
    }
    if (mode === "--apply") {
      rmSync(targetPath, { recursive: true, force: true });
      cpSync(sourcePath, targetPath, { recursive: true });
    }
  }
  if (mode === "--apply") {
    manifest.lastSyncedCommit = sourceCommit;
    writeFileSync(join(root, "scripts/skills/deploy-skills.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Updated ${Object.keys(manifest.skills).length} deploy skills from ${manifest.branch}@${sourceCommit}.`);
  } else if (mismatches.length > 0) {
    throw new Error(`deploy skills are out of sync with ${manifest.branch}@${sourceCommit}: ${mismatches.join(", ")}. Run with --apply.`);
  } else if (manifest.lastSyncedCommit !== sourceCommit) {
    throw new Error(`deploy/${manifest.branch} advanced to ${sourceCommit}; run with --apply to record and review the update.`);
  } else {
    console.log(`Deploy skills match ${manifest.branch}@${sourceCommit}.`);
  }
} finally {
  rmSync(checkout, { recursive: true, force: true });
}
