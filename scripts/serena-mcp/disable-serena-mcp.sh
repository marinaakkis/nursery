#!/usr/bin/env bash
set -euo pipefail

# ======================================================
# disable-serena-mcp.sh — Disable Serena MCP for Claude Code and Cursor
# Removes per-machine MCP config files. Does NOT uninstall serena binary.
# Run: bash scripts/disable-serena-mcp.sh
# To re-enable: bash scripts/init-serena-mcp.sh
# To fully uninstall: bash scripts/uninstall-serena-mcp.sh
# ======================================================

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# --- Claude Code ---
MCP_FILE="$REPO_ROOT/.mcp.json"
if [ -f "$MCP_FILE" ]; then
    rm "$MCP_FILE"
    echo "[INFO] .mcp.json removed — Serena disabled for Claude Code."
else
    echo "[INFO] .mcp.json not found — already disabled for Claude Code."
fi

# --- Cursor ---
CURSOR_MCP="$REPO_ROOT/.cursor/mcp.json"
if [ -f "$CURSOR_MCP" ]; then
    rm "$CURSOR_MCP"
    echo "[INFO] .cursor/mcp.json removed — Serena disabled for Cursor."
else
    echo "[INFO] .cursor/mcp.json not found — already disabled for Cursor."
fi

echo "[INFO] Serena MCP disabled. Changes take effect on next session start."
echo "[INFO] To re-enable: bash scripts/init-serena-mcp.sh"
echo "[INFO] To fully uninstall: bash scripts/uninstall-serena-mcp.sh"
