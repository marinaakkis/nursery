#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const required = ["CI_JOB_TOKEN", "CI_API_V4_URL", "CI_PROJECT_ID", "CI_PROJECT_PATH", "CI_SERVER_HOST"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required to create a deployment-skills merge request`);
}

function run(command, args) {
  return execFileSync(command, args, { cwd: root, encoding: "utf8" }).trim();
}

run("node", ["scripts/skills/sync-deploy-skills.mjs", "--apply"]);
run("node", ["scripts/ai-template-indexing/sync-claude-skill-adapters.mjs"]);
run("node", ["scripts/ai-template-indexing/generate-ai-tooling-index.mjs"]);

try {
  run("git", ["diff", "--quiet"]);
  console.log("Deploy skills already match master; no merge request needed.");
  process.exit(0);
} catch {}

const manifest = JSON.parse(readFileSync(join(root, "scripts/skills/deploy-skills.json"), "utf8"));
const branch = `chore/sync-deploy-skills-${manifest.lastSyncedCommit.slice(0, 8)}`;
run("git", ["switch", "-c", branch]);
run("git", ["config", "user.name", "GitLab CI"]);
run("git", ["config", "user.email", "gitlab-ci@users.noreply.gitlab.biocad.ru"]);
run("git", ["add", ".agents/skills", ".claude/skills", "docs/ai-tooling-index.md", "scripts/skills/deploy-skills.json"]);
run("git", ["commit", "-m", `chore: sync deployment skills from ${manifest.lastSyncedCommit.slice(0, 8)}`]);
run("git", ["remote", "set-url", "origin", `https://gitlab-ci-token:${process.env.CI_JOB_TOKEN}@${process.env.CI_SERVER_HOST}/${process.env.CI_PROJECT_PATH}.git`]);
try {
  run("git", ["push", "-u", "origin", branch]);
} catch (error) {
  console.warn(`Branch ${branch} already exists or cannot be pushed again: ${error.message}`);
}

const api = `${process.env.CI_API_V4_URL}/projects/${encodeURIComponent(process.env.CI_PROJECT_ID)}/merge_requests`;
const headers = { "JOB-TOKEN": process.env.CI_JOB_TOKEN, "Content-Type": "application/json" };
const existing = await fetch(`${api}?state=opened&source_branch=${encodeURIComponent(branch)}`, { headers });
if (!existing.ok) throw new Error(`cannot query merge requests: ${existing.status} ${await existing.text()}`);
if ((await existing.json()).length > 0) {
  console.log(`Merge request already exists for ${branch}.`);
  process.exit(0);
}
const created = await fetch(api, {
  method: "POST",
  headers,
  body: JSON.stringify({
    source_branch: branch,
    target_branch: process.env.CI_DEFAULT_BRANCH || "master",
    title: `chore: sync deployment skills (${manifest.lastSyncedCommit.slice(0, 8)})`,
    description: `Automated synchronization from ${manifest.repository} branch ${manifest.branch} at ${manifest.lastSyncedCommit}.`,
  }),
});
if (!created.ok) throw new Error(`cannot create merge request: ${created.status} ${await created.text()}`);
console.log(`Created merge request: ${(await created.json()).web_url}`);
