# ======================================================
# disable-serena-mcp.ps1 - Disable Serena MCP for Claude Code and Cursor
# Removes per-machine MCP config files. Does NOT uninstall serena binary.
# Run: .\scripts\disable-serena-mcp.ps1
# To re-enable: .\scripts\init-serena-mcp.ps1
# To fully uninstall: .\scripts\uninstall-serena-mcp.ps1
# ======================================================

$RepoRoot = Split-Path -Parent $PSScriptRoot

# --- Claude Code ---
$McpFile = Join-Path $RepoRoot ".mcp.json"
if (Test-Path $McpFile) {
    Remove-Item $McpFile
    Write-Host "[INFO] .mcp.json removed - Serena disabled for Claude Code."
} else {
    Write-Host "[INFO] .mcp.json not found - already disabled for Claude Code."
}

# --- Cursor ---
$CursorMcp = Join-Path $RepoRoot ".cursor\mcp.json"
if (Test-Path $CursorMcp) {
    Remove-Item $CursorMcp
    Write-Host "[INFO] .cursor/mcp.json removed - Serena disabled for Cursor."
} else {
    Write-Host "[INFO] .cursor/mcp.json not found - already disabled for Cursor."
}

Write-Host "[INFO] Serena MCP disabled. Changes take effect on next session start."
Write-Host "[INFO] To re-enable: .\scripts\init-serena-mcp.ps1"
Write-Host "[INFO] To fully uninstall: .\scripts\uninstall-serena-mcp.ps1"
