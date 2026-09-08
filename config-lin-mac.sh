#!/usr/bin/env bash

set -euo pipefail

info() { printf '[INFO] %s\n' "$1"; }
ok() { printf '[OK] %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; }

if ! command -v node >/dev/null 2>&1; then
  warn "Node.js 18+ is required for AI hooks and setup helpers."
  warn "Install Node.js, then rerun this script."
  exit 1
fi

info "Installing verified AI security hook..."
node scripts/ai-hooks/run-hook-tool.mjs gitleaks --install
ok "AI security hook installed and verified."

info "Merging Cursor user settings without overwriting unrelated keys..."
node scripts/bootstrap/merge-cursor-settings.mjs
ok "Cursor settings merged. Restart Cursor to apply them."

if [ -d ".git" ]; then
  info "Installing repository git hooks..."
  bash scripts/git-hooks/git-hooks.lin-mac.install.sh
else
  warn ".git directory not found; git hook installation skipped."
fi

info "Updating local project metadata..."
node -e "const fs=require('fs');const p='.project-metadata.local.json';let m={};if(fs.existsSync(p)){m=JSON.parse(fs.readFileSync(p,'utf8'));}m.isGitHooksInited=fs.existsSync('.git/hooks/pre-commit')&&fs.existsSync('.git/hooks/pre-push');m.lastAiTemplateSetupAt=new Date().toISOString();fs.writeFileSync(p,JSON.stringify(m,null,2)+'\n');"
ok ".project-metadata.local.json updated. This file is gitignored."

cat <<'EOF'

Setup complete.

No .env file was created. Create local environment files manually from your
project's own non-secret template when the application actually needs them.

Run validation:
  node scripts/validate-ai-template.mjs
EOF
