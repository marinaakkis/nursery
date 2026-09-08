#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=0
for arg in "$@"; do
    case "$arg" in
        --dry-run|--whatif) DRY_RUN=1 ;;
    esac
done

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
HOOKS_TARGET="$REPO_ROOT/.git/hooks"

if [ ! -d "$HOOKS_TARGET" ]; then
    echo "[ERROR] Directory not found: $HOOKS_TARGET"
    exit 1
fi

for hook in pre-commit pre-push; do
    dst="$HOOKS_TARGET/$hook"

    if [ ! -f "$dst" ]; then
        echo "[INFO] Skip: $hook not installed."
        continue
    fi

    if [ "$DRY_RUN" -eq 1 ]; then
        echo "[INFO] WhatIf: Would remove $dst"
    else
        rm -f "$dst"
        echo "[INFO] Removed hook: $hook"
    fi
done

echo "[INFO] Git hooks uninstall completed."

if command -v node &>/dev/null; then
    node -e "
      const fs = require('fs');
      const p = '$REPO_ROOT/.project-metadata.local.json';
      const m = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
      m.isGitHooksInited = false;
      fs.writeFileSync(p, JSON.stringify(m, null, 2) + '\n', 'utf8');
    " && echo "[INFO] .project-metadata.local.json updated (isGitHooksInited=false)" \
      || echo "[WARN] .project-metadata.local.json not updated"
else
    echo "[WARN] node not found — .project-metadata.local.json not updated"
fi
