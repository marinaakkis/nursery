#!/usr/bin/env node
"use strict";

let data = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { data += chunk; });
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(data);
    const server = input.server || input.mcp_server || input.serverName || "unknown";
    const tool = input.tool || input.mcp_tool || input.toolName || "unknown";
    const success = input.success !== false && !input.error;
    process.stderr.write(`[MCP] Result: ${server}/${tool} — ${success ? "OK" : "FAILED"}\n`);
  } catch {}
  process.stdout.write(data);
});
