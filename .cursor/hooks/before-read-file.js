#!/usr/bin/env node
"use strict";

const SENSITIVE_PATTERN = /\.(env|key|pem|p12|pfx)$|\.env\.|id_rsa|id_dsa|id_ecdsa|id_ed25519|credentials|kubeconfig|master\.key|credentials\.yml/i;

let data = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { data += chunk; });
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(data);
    const filePath = input.path || input.file || input.filePath || "";
    if (SENSITIVE_PATTERN.test(filePath)) {
      process.stderr.write(`[SECURITY] WARNING: Reading sensitive file: ${filePath}\n`);
      process.stderr.write("[SECURITY] Ensure this data is not exposed in outputs.\n");
    }
  } catch {}
  process.stdout.write(data);
});
