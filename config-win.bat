@echo off
setlocal enabledelayedexpansion

where node >nul 2>nul
if errorlevel 1 (
  echo [WARN] Node.js 18+ is required for AI hooks and setup helpers.
  echo [WARN] Install Node.js, then rerun this script.
  exit /b 1
)

echo [INFO] Installing verified AI security hook...
node scripts\ai-hooks\run-hook-tool.mjs gitleaks --install
if errorlevel 1 exit /b 1
echo [OK] AI security hook installed and verified.

echo [INFO] Merging Cursor user settings without overwriting unrelated keys...
node scripts\bootstrap\merge-cursor-settings.mjs
if errorlevel 1 exit /b 1
echo [OK] Cursor settings merged. Restart Cursor to apply them.

if exist ".git" (
  echo [INFO] Installing repository git hooks...
  powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\git-hooks\git-hooks.win.install.ps1"
) else (
  echo [WARN] .git directory not found; git hook installation skipped.
)

echo [INFO] Updating local project metadata...
powershell -NoProfile -Command "& { $p='.project-metadata.local.json'; $m=if(Test-Path $p){Get-Content $p -Raw|ConvertFrom-Json}else{[PSCustomObject]@{}}; $hooks=(Test-Path '.git\hooks\pre-commit') -and (Test-Path '.git\hooks\pre-push'); $m|Add-Member -NotePropertyName isGitHooksInited -NotePropertyValue $hooks -Force; $m|Add-Member -NotePropertyName lastAiTemplateSetupAt -NotePropertyValue ([DateTime]::UtcNow.ToString('o')) -Force; $m|ConvertTo-Json|Set-Content $p -Encoding UTF8 }"
if errorlevel 1 exit /b 1
echo [OK] .project-metadata.local.json updated. This file is gitignored.

echo.
echo Setup complete.
echo.
echo No .env file was created. Create local environment files manually from your
echo project's own non-secret template when the application actually needs them.
echo.
echo Run validation:
echo   node scripts\validate-ai-template.mjs
echo.

endlocal
