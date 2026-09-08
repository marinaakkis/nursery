# ======================================================
# init-serena-mcp.ps1 - Install Serena MCP for Claude Code and Cursor
# Run once per machine. Idempotent - safe to re-run.
#
# Usage: .\scripts\init-serena-mcp.ps1 [language ...]
# Default (no args): installs Python LSP (pylsp)
# Examples:
#   .\scripts\init-serena-mcp.ps1
#   .\scripts\init-serena-mcp.ps1 python typescript go
# ======================================================

param(
    [string[]]$Languages = @("python")
)

# --- uv ---
if (Get-Command uv -ErrorAction SilentlyContinue) {
    $uvVersion = uv --version
    Write-Host "[INFO] uv already installed: $uvVersion"
} else {
    Write-Host "[INFO] Installing uv (Python package manager)..."
    powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
    $env:PATH = "$env:USERPROFILE\.local\bin;$env:PATH"
    Write-Host "[INFO] uv installed."
}

# --- Serena ---
Write-Host "[INFO] Installing Serena MCP (Python 3.13)..."
uv tool install -p 3.13 serena-agent

Write-Host "[INFO] Initializing Serena..."
serena init

Write-Host "[INFO] Connecting Serena to Claude Code..."
serena setup claude-code

Write-Host "[INFO] Connecting Serena to Cursor..."
serena setup cursor

# --- LSP servers ---
Write-Host "[INFO] Installing LSP servers for: $($Languages -join ', ')..."
foreach ($lang in $Languages) {
    switch ($lang) {
        "python" {
            Write-Host "[INFO]   python -> pip install python-lsp-server"
            pip install python-lsp-server
        }
        { $_ -in @("typescript", "javascript", "ts", "js") } {
            Write-Host "[INFO]   $lang -> npm install -g typescript-language-server typescript"
            npm install -g typescript-language-server typescript
        }
        "go" {
            Write-Host "[INFO]   go -> go install golang.org/x/tools/gopls@latest"
            go install golang.org/x/tools/gopls@latest
        }
        { $_ -in @("csharp", "dotnet") } {
            Write-Host "[INFO]   $lang -> dotnet tool install --global csharp-ls"
            dotnet tool install --global csharp-ls
        }
        "rust" {
            Write-Host "[INFO]   rust -> rustup component add rust-analyzer"
            rustup component add rust-analyzer
        }
        "java" {
            Write-Host "[WARN]   java LSP requires manual setup."
            Write-Host "         See: https://github.com/eclipse-jdtls/eclipse.jdt.ls"
        }
        default {
            Write-Host "[WARN]   Unknown language: '$lang'. Check supported servers:"
            Write-Host "         https://oraios.github.io/serena/01-about/020_programming-languages.html"
        }
    }
}

$RepoRoot = Split-Path -Parent $PSScriptRoot

# --- MCP config for Claude Code ---
Write-Host "[INFO] Creating .mcp.json for Claude Code..."
$mcpConfig = @'
{
  "mcpServers": {
    "serena": {
      "command": "serena",
      "args": ["start-mcp-server", "--context", "claude-code", "--project-from-cwd"]
    }
  }
}
'@
Set-Content -Path (Join-Path $RepoRoot ".mcp.json") -Value $mcpConfig -Encoding UTF8
Write-Host "[INFO] .mcp.json created."

# --- MCP config for Cursor ---
Write-Host "[INFO] Creating .cursor/mcp.json for Cursor..."
$cursorDir = Join-Path $RepoRoot ".cursor"
if (-not (Test-Path $cursorDir)) { New-Item -ItemType Directory -Path $cursorDir | Out-Null }
$cursorConfig = @'
{
  "mcpServers": {
    "serena": {
      "command": "serena",
      "args": ["start-mcp-server", "--context", "cursor", "--project-from-cwd"]
    }
  }
}
'@
Set-Content -Path (Join-Path $cursorDir "mcp.json") -Value $cursorConfig -Encoding UTF8
Write-Host "[INFO] .cursor/mcp.json created."

Write-Host "[INFO] Serena MCP enabled. Start a new Claude Code or Cursor session to activate."
Write-Host "[INFO] To disable: .\scripts\disable-serena-mcp.ps1"
Write-Host "[INFO] To uninstall completely: .\scripts\uninstall-serena-mcp.ps1"
