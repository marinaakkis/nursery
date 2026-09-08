#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
HOOKS_SOURCE="$REPO_ROOT/.githooks"
HOOKS_TARGET="$REPO_ROOT/.git/hooks"

if [ ! -d "$HOOKS_SOURCE" ]; then
    echo "[ERROR] Directory .githooks not found: $HOOKS_SOURCE"
    exit 1
fi

if [ ! -d "$REPO_ROOT/.git" ]; then
    echo "[ERROR] .git not found — not a git repository"
    exit 1
fi

mkdir -p "$HOOKS_TARGET"

for hook in pre-commit pre-push; do
    src="$HOOKS_SOURCE/$hook"
    dst="$HOOKS_TARGET/$hook"

    if [ ! -f "$src" ]; then
        echo "[ERROR] Hook file not found: $src"
        exit 1
    fi

    cp "$src" "$dst"
    chmod +x "$dst"
    echo "[INFO] Installed hook $hook -> $dst"
done

echo "[INFO] Git hooks installed successfully."

if command -v node &>/dev/null; then
    node -e "
      const fs = require('fs');
      const p = '$REPO_ROOT/.project-metadata.local.json';
      const m = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
      m.isGitHooksInited = true;
      fs.writeFileSync(p, JSON.stringify(m, null, 2) + '\n', 'utf8');
    " && echo "[INFO] .project-metadata.local.json updated (isGitHooksInited=true)" \
      || echo "[WARN] .project-metadata.local.json not updated"
else
    echo "[WARN] node not found — .project-metadata.local.json not updated"
fi
