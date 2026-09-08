[CmdletBinding()]
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
$hooksSource = Join-Path $repoRoot ".githooks"
$hooksTarget = Join-Path $repoRoot ".git/hooks"

if (-not (Test-Path $hooksSource)) {
    throw (New-ErrorMessage "Directory .githooks not found: $hooksSource")
}

if (-not (Test-Path $hooksTarget)) {
    throw (New-ErrorMessage "Directory .git/hooks not found: $hooksTarget")
}

$hookFiles = @("pre-commit", "pre-push")

foreach ($hookName in $hookFiles) {
    $sourcePath = Join-Path $hooksSource $hookName
    $targetPath = Join-Path $hooksTarget $hookName

    if (-not (Test-Path $sourcePath)) {
        throw (New-ErrorMessage "Hook file not found: $sourcePath")
    }

    Copy-Item -Path $sourcePath -Destination $targetPath -Force
    Write-Info "Installed hook $hookName -> $targetPath"
}

Write-Info "Git hooks installed successfully."

$metadataPath = Join-Path $repoRoot ".project-metadata.local.json"
$metadata = if (Test-Path $metadataPath) { Get-Content $metadataPath -Raw | ConvertFrom-Json } else { [PSCustomObject]@{} }
$metadata | Add-Member -NotePropertyName isGitHooksInited -NotePropertyValue $true -Force
$metadata | ConvertTo-Json | Set-Content $metadataPath -Encoding UTF8
Write-Info ".project-metadata.local.json updated (isGitHooksInited=true)"
