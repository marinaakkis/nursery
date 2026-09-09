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

step "5/5 сборка"
npx next build

printf '\n\033[1m✓ check.sh пройден\033[0m\n'
