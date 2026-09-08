#!/usr/bin/env node

import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const canonicalRoot = join(root, ".agents", "skills");
const adapterRoot = join(root, ".claude", "skills");

function read(path) {
  return readFileSync(path, "utf8");
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

function yamlBlock(value) {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > 88) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return ["description: >-", ...lines.map((line) => `  ${line}`)].join("\n");
}

if (!statSync(canonicalRoot).isDirectory()) {
  throw new Error(`missing canonical skills directory: ${canonicalRoot}`);
}

rmSync(adapterRoot, { recursive: true, force: true });
mkdirSync(adapterRoot, { recursive: true });

const skillDirs = readdirSync(canonicalRoot)
  .filter((name) => statSync(join(canonicalRoot, name)).isDirectory())
  .sort();

for (const dir of skillDirs) {
  const skillPath = join(canonicalRoot, dir, "SKILL.md");
  const fm = frontmatter(read(skillPath));
  if (!fm) throw new Error(`${skillPath}: missing frontmatter`);
  const name = field(fm, "name") || dir;
  const description = field(fm, "description") || `Claude Code adapter for ${dir}.`;

  const outDir = join(adapterRoot, dir);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "SKILL.md"),
    `---\nname: ${JSON.stringify(name)}\n${yamlBlock(description)}\n---\n\n# Claude Code Adapter\n\nThis is a generated adapter for the canonical shared skill:\n\n\`../../../.agents/skills/${dir}/SKILL.md\`\n\nWhen this skill is invoked:\n\n1. Read the canonical \`SKILL.md\` above.\n2. Follow the canonical instructions and only load referenced files when needed.\n3. Do not treat this adapter as the source of truth.\n\nRegenerate adapters with:\n\n\`\`\`bash\nnode scripts/ai-template-indexing/sync-claude-skill-adapters.mjs\n\`\`\`\n`,
    "utf8",
  );
}

writeFileSync(
  join(adapterRoot, "README.md"),
  "# Claude Skill Adapters\n\nThis directory is generated from `.agents/skills` so Claude Code can discover project skills natively without duplicating the skill corpus.\n\nDo not edit adapters by hand. Run:\n\n```bash\nnode scripts/ai-template-indexing/sync-claude-skill-adapters.mjs\n```\n",
  "utf8",
);

console.log(`Synced ${skillDirs.length} Claude skill adapters.`);
