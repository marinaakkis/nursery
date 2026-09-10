#!/usr/bin/env bash
# Единая проверка проекта: typecheck → lint → тесты → миграции → сборка.
# Падает на первом же провале. Используется в AGENTS.md как единственный ответ на вопрос «зелено ли».

set -euo pipefail

step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }

step "1/5 typecheck"
npx next typegen >/dev/null   # типы маршрутов нужны tsc на чистом клоне
npx tsc --noEmit
echo "  типы в порядке"

step "2/5 lint"
npx eslint .
echo "  линтер чист"

step "3/5 тесты"
npx vitest run

step "4/5 миграции на чистой БД"
if [ -z "${DATABASE_URL:-}" ]; then
  echo "  ПРОПУЩЕНО: DATABASE_URL не задан"
elif ! command -v psql >/dev/null 2>&1 || ! command -v createdb >/dev/null 2>&1; then
  echo "  ПРОПУЩЕНО: нет psql/createdb для создания временной базы"
else
  CHECK_DB="nursery_check_$$"
  createdb "$CHECK_DB"
  trap 'dropdb --if-exists "$CHECK_DB" >/dev/null 2>&1 || true' EXIT
  CHECK_URL="$(printf '%s' "$DATABASE_URL" | sed -E "s#/[^/?]+(\?|\$)#/${CHECK_DB}\1#")"
  DATABASE_URL="$CHECK_URL" npx drizzle-kit migrate
  TABLES=$(psql -d "$CHECK_DB" -tAc "select count(*) from pg_tables where schemaname='public'")
  echo "  миграции применились на пустой базе: таблиц $TABLES"
  dropdb --if-exists "$CHECK_DB"
  trap - EXIT
fi

step "5/5 сборка без базы"
# env -i и отсутствие DATABASE_URL — это ровно то, что видит контейнер сборки.
# Сборка, проверенная в окружении с базой, ничего не доказывает: пререндер
# страницы с данными пройдёт локально и упадёт на стенде.
# Разбор — memory/mistakes/2026-09-10-sborka-tolko-s-bazoy.md
BUILD_LOG="$(mktemp)"
trap 'rm -f "$BUILD_LOG"' EXIT
env -i PATH="$PATH" HOME="$HOME" npx next build 2>&1 | tee "$BUILD_LOG"
BUILD_STATUS=${PIPESTATUS[0]}
[ "$BUILD_STATUS" -eq 0 ] || exit "$BUILD_STATUS"

# Второй рубеж: данные в продукте живые, поэтому статических страниц быть не должно.
# Отсутствие базы ловит не всякую среду — а это условие проверяемо где угодно.
STATIC_PAGES=$(sed -n '/^Route (app)/,/^$/p' "$BUILD_LOG" | grep -E '○' | grep -v '/_not-found' || true)
if [ -n "$STATIC_PAGES" ]; then
  echo
  echo "  СТАТИЧЕСКИЕ СТРАНИЦЫ — их не должно быть:"
  echo "$STATIC_PAGES"
  echo "  Данные живые: страница, собранная заранее, покажет состояние на момент сборки"
  echo "  образа, а при обращении к базе уронит саму сборку. Ставьте dynamic = \"force-dynamic\"."
  exit 1
fi
echo "  статических страниц нет — все рендерятся на запрос"

printf '\n\033[1m✓ check.sh пройден\033[0m\n'
