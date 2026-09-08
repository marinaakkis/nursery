#!/usr/bin/env bash
# Полная локальная настройка хранилища dev-артефактов на Obsidian (macOS/Linux).
# macOS: Homebrew; Linux: Flatpak (Flathub). Скаффолдит хранилище, скачивает community-плагины (best-effort).
#
# Использование: bash setup-obsidian.lin-mac.sh <project-key> [vault-path] [--skip-plugins] [--dry-run]
#
# Параметры:
#   <project-key>   Обязательно. Ключ проекта — папка верхнего уровня в Obsidian vault
#                   и значение docsStorage.projectKey. Пример: my-service, archi-study-2026.
#   [vault-path]    Путь к хранилищу Obsidian. По умолчанию: $HOME/dev-vaults/<project-key>.
#   --skip-plugins  Не скачивать плагины.
#   --dry-run       Показать действия без выполнения.
set -euo pipefail

if [ -z "${1:-}" ] || [[ "${1:-}" == --* ]]; then
  echo "Ошибка: первый аргумент <project-key> обязателен."
  echo "Использование: bash setup-obsidian.lin-mac.sh <project-key> [vault-path] [--skip-plugins] [--dry-run]"
  exit 1
fi

PROJECT_KEY="$1"; shift
VAULT_PATH=""
SKIP_PLUGINS=0
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --skip-plugins) SKIP_PLUGINS=1 ;;
    --dry-run) DRY_RUN=1 ;;
    /*|./*|~/*) VAULT_PATH="$arg" ;;
    *) [ -z "$VAULT_PATH" ] && VAULT_PATH="$arg" ;;
  esac
done
# Приоритет: 1) явный аргумент  2) docsStorage.vaultPath из metadata  3) дефолт
if [ -z "$VAULT_PATH" ]; then
  _repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || true
  if [ -n "$_repo_root" ] && [ -f "$_repo_root/.project-metadata.local.json" ]; then
    _stored=$(command -v jq >/dev/null 2>&1 \
      && jq -r '.docsStorage.vaultPath // empty' "$_repo_root/.project-metadata.local.json" || true)
    [ -n "$_stored" ] && VAULT_PATH="$_stored"
  fi
fi
[ -z "$VAULT_PATH" ] && VAULT_PATH="$HOME/dev-vaults/$PROJECT_KEY"

step() { printf '\033[36m==> %s\033[0m\n' "$1"; }
warn() { printf '\033[33m[!] %s\033[0m\n' "$1"; }
run()  { if [ "$DRY_RUN" -eq 1 ]; then echo "[dry-run] $*"; else eval "$*"; fi; }

step "ProjectKey: $PROJECT_KEY; хранилище: $VAULT_PATH"

# --- 1. Установка Obsidian ---
if [ "$(uname)" = "Darwin" ]; then
  if ! command -v brew >/dev/null 2>&1; then
    warn "Homebrew не найден. Установите: https://brew.sh, затем повторите."; exit 1
  fi
  step "Устанавливаю Obsidian (brew cask)"
  run "brew install --cask obsidian || true"
else
  if command -v flatpak >/dev/null 2>&1; then
    step "Устанавливаю Obsidian (flatpak)"
    run "flatpak install -y flathub md.obsidian.Obsidian || true"
  else
    warn "Flatpak не найден. Установите Obsidian вручную (https://obsidian.md/download) или поставьте flatpak."
  fi
fi

# --- 2. Каркас хранилища ---
OBSIDIAN_DIR="$VAULT_PATH/.obsidian"
PLUGINS_DIR="$OBSIDIAN_DIR/plugins"
step "Создаю каркас хранилища"
run "mkdir -p \"$VAULT_PATH/$PROJECT_KEY\" \"$PLUGINS_DIR\""

# --- 3. Плагины (best-effort) ---
install_plugin() {
  local repo="$1" id="$2" dest="$PLUGINS_DIR/$2"
  step "Плагин $id ($repo)"
  run "mkdir -p \"$dest\""
  if [ "$DRY_RUN" -eq 1 ]; then return; fi
  local api="https://api.github.com/repos/$repo/releases/latest"
  for name in manifest.json main.js styles.css; do
    url=$(curl -fsSL "$api" | grep -o "https://[^\" ]*${name}" | head -n1 || true)
    if [ -n "${url:-}" ]; then curl -fsSL "$url" -o "$dest/$name" || warn "не скачан $id/$name"; fi
  done
}
if [ "$SKIP_PLUGINS" -eq 0 ]; then
  install_plugin "coddingtonbear/obsidian-local-rest-api" "obsidian-local-rest-api"
  install_plugin "brianpetro/obsidian-smart-connections" "smart-connections"
  run "printf '[\"obsidian-local-rest-api\",\"smart-connections\"]' > \"$OBSIDIAN_DIR/community-plugins.json\""
else
  warn "Плагины пропущены (--skip-plugins). Установите Local REST API и Smart Connections вручную."
fi

# --- 4. .project-metadata.local.json — записываем vaultPath ---
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || cd "$(dirname "$0")/../../.." && pwd)"
LOCAL_META="$REPO_ROOT/.project-metadata.local.json"

if command -v jq >/dev/null 2>&1 && [ -f "$LOCAL_META" ]; then
  if [ "$DRY_RUN" -eq 0 ]; then
    if jq -e '.docsStorage' "$LOCAL_META" >/dev/null 2>&1; then
      # Повторный запуск — обновляем только vaultPath
      jq --arg vp "$VAULT_PATH" '.docsStorage.vaultPath = $vp' "$LOCAL_META" > "$LOCAL_META.tmp" && mv "$LOCAL_META.tmp" "$LOCAL_META"
      step "docsStorage.vaultPath обновлён: $VAULT_PATH"
    else
      # Первый запуск — создаём docsStorage
      jq --arg pk "$PROJECT_KEY" --arg vp "$VAULT_PATH" \
        '.docsStorage = {"backend":"obsidian","baseUrl":"https://127.0.0.1:27124","projectKey":$pk,"apiKey":null,"vaultPath":$vp}' \
        "$LOCAL_META" > "$LOCAL_META.tmp" && mv "$LOCAL_META.tmp" "$LOCAL_META"
      step "docsStorage.obsidian добавлен в .project-metadata.local.json"
    fi
  else
    echo "[dry-run] обновил бы docsStorage.vaultPath = $VAULT_PATH в $LOCAL_META"
  fi
else
  warn "jq не найден или $LOCAL_META отсутствует — обновите docsStorage.vaultPath вручную."
fi

cat <<EOF

==> Готово. Осталось вручную:
  1. Открыть vault проекта в Obsidian: $VAULT_PATH
  2. Settings → Community plugins → включить Local REST API (доверить плагин если потребуется).
  3. Settings → Local REST API → скопировать API Key.
  4. Вставить ключ в docsStorage.apiKey в .project-metadata.local.json.
  5. Проверить что docsStorage.projectKey совпадает с именем vault в Obsidian.
  6. Проверка: node scripts/publish-dev-requests-docs/publish-dev-requests-docs.mjs --request r-nnn --backend obsidian
EOF
