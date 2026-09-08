# ======================================================
# uninstall-serena-mcp.ps1 - Fully remove Serena MCP from this machine
# Removes: MCP config files + serena binary (via uv).
# Does NOT remove LSP servers (pylsp, etc.) - they may be used elsewhere.
# Run: .\scripts\uninstall-serena-mcp.ps1
# To only disable (keep binary): .\scripts\disable-serena-mcp.ps1
# ======================================================

$RepoRoot = Split-Path -Parent $PSScriptRoot

# --- Disable: remove config files ---
$McpFile = Join-Path $RepoRoot ".mcp.json"
if (Test-Path $McpFile) {
    Remove-Item $McpFile
    Write-Host "[INFO] .mcp.json removed."
} else {
    Write-Host "[INFO] .mcp.json not found - already disabled."
}

$CursorMcp = Join-Path $RepoRoot ".cursor\mcp.json"
if (Test-Path $CursorMcp) {
    Remove-Item $CursorMcp
    Write-Host "[INFO] .cursor/mcp.json removed."
} else {
    Write-Host "[INFO] .cursor/mcp.json not found - already disabled."
}

# --- Uninstall: remove serena binary ---
if (Get-Command serena -ErrorAction SilentlyContinue) {
    Write-Host "[INFO] Uninstalling serena-agent via uv..."
    uv tool uninstall serena-agent
    Write-Host "[INFO] serena-agent uninstalled."
} else {
    Write-Host "[INFO] serena not found in PATH - already uninstalled or not installed."
}

# --- Optional: remove Serena global config ---
$SerenaHome = Join-Path $env:USERPROFILE ".serena"
if (Test-Path $SerenaHome) {
    Write-Host "[INFO] Removing Serena global config: $SerenaHome"
    Remove-Item -Recurse -Force $SerenaHome
    Write-Host "[INFO] ~/.serena removed."
} else {
    Write-Host "[INFO] ~/.serena not found - nothing to remove."
}

Write-Host "[INFO] Serena MCP fully uninstalled."
Write-Host ""
Write-Host "[INFO] LSP servers were NOT removed (they may be used outside Serena)."
Write-Host "       To remove them manually:"
Write-Host "         python:     pip uninstall python-lsp-server"
Write-Host "         typescript: npm uninstall -g typescript-language-server typescript"
Write-Host "         go:         go clean -i golang.org/x/tools/gopls"
Write-Host "         csharp:     dotnet tool uninstall --global csharp-ls"
Write-Host "         rust:       rustup component remove rust-analyzer"
Write-Host ""
Write-Host "[INFO] To reinstall Serena: .\scripts\init-serena-mcp.ps1"
