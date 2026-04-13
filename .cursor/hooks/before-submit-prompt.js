#!/usr/bin/env node
"use strict";

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/,
  /sk-proj-[a-zA-Z0-9_-]{20,}/,
  /ghp_[a-zA-Z0-9]{36,}/,
  /gho_[a-zA-Z0-9]{36,}/,
  /github_pat_[a-zA-Z0-9_]{20,}/,
  /glpat-[a-zA-Z0-9_-]{20,}/,
  /AKIA[A-Z0-9]{16}/,
  /xox[bpsa]-[a-zA-Z0-9\-]+/,
  /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  /eyJ[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{10,}\./,
];

let data = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { data += chunk; });
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(data);
    const prompt = input.prompt || input.content || input.message || input.userMessage || "";
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(prompt)) {
        process.stderr.write("[SECURITY] WARNING: Potential secret detected in prompt!\n");
        process.stderr.write("[SECURITY] Remove secrets before submitting. Use environment variables instead.\n");
        break;
      }
    }
  } catch {}
  process.stdout.write(data);
});
