#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
temp_root="$(mktemp -d)"
trap 'rm -rf "$temp_root"' EXIT

mkdir -p "$temp_root/scripts"
cp -R "$repo_root/.githooks" "$temp_root/.githooks"
cp -R "$repo_root/scripts/git-hooks" "$temp_root/scripts/git-hooks"
git -C "$temp_root" init -q

(cd "$temp_root" && bash scripts/git-hooks/git-hooks.lin-mac.install.sh)
test -x "$temp_root/.git/hooks/pre-commit"
test -x "$temp_root/.git/hooks/pre-push"
(cd "$temp_root" && bash scripts/git-hooks/git-hooks.lin-mac.uninstall.sh)
test ! -e "$temp_root/.git/hooks/pre-commit"
test ! -e "$temp_root/.git/hooks/pre-push"
