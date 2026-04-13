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
    process.stderr.write(`[MCP] Invocation: ${server}/${tool}\n`);
  } catch {}
  process.stdout.write(data);
});
