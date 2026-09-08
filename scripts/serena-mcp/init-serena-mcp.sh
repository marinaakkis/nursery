#!/usr/bin/env bash
set -euo pipefail

# ======================================================
# init-serena-mcp.sh — Install Serena MCP for Claude Code and Cursor
# Run once per machine. Idempotent — safe to re-run.
#
# Usage: bash scripts/init-serena-mcp.sh [language ...]
# Default (no args): installs Python LSP (pylsp)
# Examples:
#   bash scripts/init-serena-mcp.sh
#   bash scripts/init-serena-mcp.sh python typescript go
# ======================================================

LANGUAGES=("${@:-python}")

# --- uv ---
if command -v uv &>/dev/null; then
    echo "[INFO] uv already installed: $(uv --version)"
else
    echo "[INFO] Installing uv (Python package manager)..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
    echo "[INFO] uv installed."
fi

# --- Serena ---
echo "[INFO] Installing Serena MCP (Python 3.13)..."
uv tool install -p 3.13 serena-agent

echo "[INFO] Initializing Serena..."
serena init

echo "[INFO] Connecting Serena to Claude Code..."
serena setup claude-code

echo "[INFO] Connecting Serena to Cursor..."
serena setup cursor

# --- LSP servers ---
echo "[INFO] Installing LSP servers for: ${LANGUAGES[*]}..."
for lang in "${LANGUAGES[@]}"; do
    case "$lang" in
        python)
            echo "[INFO]   python → pip install python-lsp-server"
            pip install python-lsp-server
            ;;
        typescript|javascript|ts|js)
            echo "[INFO]   $lang → npm install -g typescript-language-server typescript"
            npm install -g typescript-language-server typescript
            ;;
        go)
            echo "[INFO]   go → go install golang.org/x/tools/gopls@latest"
            go install golang.org/x/tools/gopls@latest
            ;;
        csharp|dotnet)
            echo "[INFO]   $lang → dotnet tool install --global csharp-ls"
            dotnet tool install --global csharp-ls
            ;;
        rust)
            echo "[INFO]   rust → rustup component add rust-analyzer"
            rustup component add rust-analyzer
            ;;
        java)
            echo "[WARN]   java LSP requires manual setup."
            echo "         See: https://github.com/eclipse-jdtls/eclipse.jdt.ls"
            ;;
        *)
            echo "[WARN]   Unknown language: '$lang'. Check supported servers:"
            echo "         https://oraios.github.io/serena/01-about/020_programming-languages.html"
            ;;
    esac
done

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# --- MCP config for Claude Code ---
echo "[INFO] Creating .mcp.json for Claude Code..."
cat > "$REPO_ROOT/.mcp.json" <<'EOF'
{
  "mcpServers": {
    "serena": {
      "command": "serena",
      "args": ["start-mcp-server", "--context", "claude-code", "--project-from-cwd"]
    }
  }
}
EOF
echo "[INFO] .mcp.json created."

# --- MCP config for Cursor ---
echo "[INFO] Creating .cursor/mcp.json for Cursor..."
mkdir -p "$REPO_ROOT/.cursor"
cat > "$REPO_ROOT/.cursor/mcp.json" <<'EOF'
{
  "mcpServers": {
    "serena": {
      "command": "serena",
      "args": ["start-mcp-server", "--context", "cursor", "--project-from-cwd"]
    }
  }
}
EOF
echo "[INFO] .cursor/mcp.json created."

echo "[INFO] Serena MCP enabled. Start a new Claude Code or Cursor session to activate."
echo "[INFO] To disable: bash scripts/disable-serena-mcp.sh"
echo "[INFO] To uninstall completely: bash scripts/uninstall-serena-mcp.sh"
