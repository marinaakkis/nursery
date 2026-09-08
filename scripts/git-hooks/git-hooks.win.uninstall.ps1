[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "Medium")]
param()

$ErrorActionPreference = "Stop"

function Write-Info {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "[INFO] $Message"
}

function New-ErrorMessage {
    param([Parameter(Mandatory = $true)][string]$Message)
    return "[ERROR] $Message"
}

$repoRoot = git -C $PSScriptRoot rev-parse --show-toplevel
if ($LASTEXITCODE -ne 0) { throw "Not inside a git repository." }
$hooksTarget = Join-Path $repoRoot ".git/hooks"

if (-not (Test-Path $hooksTarget)) {
    throw (New-ErrorMessage "Directory not found: $hooksTarget")
}

$hookFiles = @("pre-commit", "pre-push")

foreach ($hookName in $hookFiles) {
    $targetPath = Join-Path $hooksTarget $hookName

    if (-not (Test-Path $targetPath)) {
        Write-Info "Skip: $hookName not installed."
        continue
    }

    if ($PSCmdlet.ShouldProcess($targetPath, "Remove installed hook")) {
        Remove-Item -Path $targetPath -Force
        Write-Info "Removed hook: $hookName"
    }
}

Write-Info "Git hooks uninstall completed."

$metadataPath = Join-Path $repoRoot ".project-metadata.local.json"
$metadata = if (Test-Path $metadataPath) { Get-Content $metadataPath -Raw | ConvertFrom-Json } else { [PSCustomObject]@{} }
$metadata | Add-Member -NotePropertyName isGitHooksInited -NotePropertyValue $false -Force
$metadata | ConvertTo-Json | Set-Content $metadataPath -Encoding UTF8
Write-Info ".project-metadata.local.json updated (isGitHooksInited=false)"
