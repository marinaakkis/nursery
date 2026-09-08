#!/usr/bin/env bash
set -euo pipefail

# ======================================================
# uninstall-serena-mcp.sh — Fully remove Serena MCP from this machine
# Removes: MCP config files + serena binary (via uv).
# Does NOT remove LSP servers (pylsp, gopls, etc.) — they may be used elsewhere.
# Run: bash scripts/uninstall-serena-mcp.sh
# To only disable (keep binary): bash scripts/disable-serena-mcp.sh
# ======================================================

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# --- Disable: remove config files ---
MCP_FILE="$REPO_ROOT/.mcp.json"
if [ -f "$MCP_FILE" ]; then
    rm "$MCP_FILE"
    echo "[INFO] .mcp.json removed."
else
    echo "[INFO] .mcp.json not found — already disabled."
fi

CURSOR_MCP="$REPO_ROOT/.cursor/mcp.json"
if [ -f "$CURSOR_MCP" ]; then
    rm "$CURSOR_MCP"
    echo "[INFO] .cursor/mcp.json removed."
else
    echo "[INFO] .cursor/mcp.json not found — already disabled."
fi

# --- Uninstall: remove serena binary ---
if command -v serena &>/dev/null; then
    echo "[INFO] Uninstalling serena-agent via uv..."
    uv tool uninstall serena-agent
    echo "[INFO] serena-agent uninstalled."
else
    echo "[INFO] serena not found in PATH — already uninstalled or not installed."
fi

# --- Optional: remove Serena global config ---
SERENA_HOME="${HOME}/.serena"
if [ -d "$SERENA_HOME" ]; then
    echo "[INFO] Removing Serena global config: $SERENA_HOME"
    rm -rf "$SERENA_HOME"
    echo "[INFO] ~/.serena removed."
else
    echo "[INFO] ~/.serena not found - nothing to remove."
fi

echo "[INFO] Serena MCP fully uninstalled."
echo ""
echo "[INFO] LSP servers were NOT removed (they may be used outside Serena)."
echo "       To remove them manually:"
echo "         python:     pip uninstall python-lsp-server"
echo "         typescript: npm uninstall -g typescript-language-server typescript"
echo "         go:         go clean -i golang.org/x/tools/gopls"
echo "         csharp:     dotnet tool uninstall --global csharp-ls"
echo "         rust:       rustup component remove rust-analyzer"
echo ""
echo "[INFO] To reinstall Serena: bash scripts/init-serena-mcp.sh"
