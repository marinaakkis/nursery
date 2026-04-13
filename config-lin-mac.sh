#!/usr/bin/env bash
# ============================================================================
# CURSOR AI TEMPLATE - SETUP SCRIPT
# ============================================================================
# Поддерживаемые платформы: Linux, macOS
# ============================================================================

set -euo pipefail

# ============================================================================
# ЦВЕТА — ИСПРАВЛЕНИЕ: $'\033[...]' вместо '\033[...]'
# echo -e ненадёжен в разных окружениях → используем printf
# ============================================================================
if [ -t 1 ] && [ "${NO_COLOR:-}" != "1" ]; then
    RED=$'\033[0;31m'
    GREEN=$'\033[0;32m'
    YELLOW=$'\033[1;33m'
    BLUE=$'\033[0;34m'
    NC=$'\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' NC=''
fi

log_info()    { printf "${BLUE}[INFO]${NC} %s\n"    "$1"; }
log_success() { printf "${GREEN}[✓]${NC} %s\n"     "$1"; }
log_warning() { printf "${YELLOW}[⚠]${NC} %s\n"   "$1"; }
log_error()   { printf "${RED}[✗]${NC} %s\n"       "$1" >&2; }

# ============================================================================
# ОПРЕДЕЛЕНИЕ ПЛАТФОРМЫ
# ============================================================================
detect_os() {
    case "$(uname -s)" in
        Darwin)  echo "macos" ;;
        Linux)
            if grep -qiE '(microsoft|wsl)' /proc/version 2>/dev/null; then
                echo "wsl"
            else
                echo "linux"
            fi
            ;;
        *) echo "unknown" ;;
    esac
}

OS="$(detect_os)"

# ============================================================================
# БАННЕР
# ============================================================================
echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║   🛡️  CURSOR AI TEMPLATE SETUP           ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
log_info "Платформа: $OS"
echo ""

# ============================================================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ============================================================================
has_cmd() {
    command -v "$1" &>/dev/null
}

# ============================================================================
# 2. СОЗДАНИЕ .env
# ============================================================================
log_info "Проверка .env..."

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log_success ".env создан из .env.example"
        log_warning "Отредактируйте .env (vim .env / nano .env — НЕ открывайте в Cursor!)"
    else
        log_info ".env.example не найден — создаём шаблон..."
        cat > .env.example << 'EOF'
# Пример переменных окружения
# APP_ENV=development
# DATABASE_URL=postgresql://user:password@localhost:5432/dbname
# SECRET_KEY=changeme
EOF
        cp .env.example .env
        log_success ".env.example и .env созданы"
        log_warning "Заполните переменные в .env перед запуском проекта"
    fi
else
    log_success ".env уже существует"
fi

# ============================================================================
# 3. НАСТРОЙКА CURSOR — ИСПРАВЛЕНЫ КЛЮЧИ SETTINGS.JSON
# ============================================================================
log_info "Настройка Cursor Privacy Mode..."

case "$OS" in
    macos)
        CURSOR_SETTINGS="${HOME}/Library/Application Support/Cursor/User/settings.json"
        ;;
    wsl)
        WIN_APPDATA="$(cmd.exe /C 'echo %APPDATA%' 2>/dev/null | tr -d '\r\n')" || true
        if [ -n "$WIN_APPDATA" ]; then
            CURSOR_SETTINGS="$(wslpath "$WIN_APPDATA")/Cursor/User/settings.json"
        else
            CURSOR_SETTINGS="${HOME}/.config/Cursor/User/settings.json"
        fi
        ;;
    linux|*)
        CURSOR_SETTINGS="${HOME}/.config/Cursor/User/settings.json"
        ;;
esac

log_info "Путь к настройкам Cursor: $CURSOR_SETTINGS"
mkdir -p "$(dirname "$CURSOR_SETTINGS")"

if [ -f "$CURSOR_SETTINGS" ]; then
    cp "$CURSOR_SETTINGS" "${CURSOR_SETTINGS}.bak"
    log_info "Резервная копия: ${CURSOR_SETTINGS}.bak"
fi

# ИСПРАВЛЕНИЕ ключей:
#   cursor.privacyMode        → boolean true  (было: "strict" — неверный тип)
#   telemetry.telemetryLevel  → "off"         (стандартный VSCode ключ)
#   telemetry.enableCrashReporter / telemetry.enableTelemetry
#                             → правильные VSCode ключи (cursor.telemetry.* не существуют)
cat > "$CURSOR_SETTINGS" << 'EOF'
{
  "cursor.privacyMode": true,
  "cursor.ghostMode": true,
  "cursor.autoRun": false,
  "telemetry.telemetryLevel": "off",
  "telemetry.enableCrashReporter": false,
  "telemetry.enableTelemetry": false
}
EOF

log_success "Настройки Cursor применены"
log_warning "Перезапустите Cursor IDE для применения настроек"


# ============================================================================
# ЗАВЕРШЕНИЕ
# ============================================================================
echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║   ✅ SETUP ЗАВЕРШЁН!                      ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
echo "Следующие шаги:"
echo "  1. Отредактируйте .env     → vim .env"
echo "  2. Закройте Cursor, затем откройте проект заново"
echo "  3. DevContainer → Cmd + Shift + P → 'Open Folder in Container'"
