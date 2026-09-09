#!/bin/sh
# Порядок старта контейнера: миграции → сид (идемпотентный) → сервер.
set -e

echo "▸ миграции"
node /app/dist/migrate.cjs

if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "▸ демо-данные"
  node /app/dist/seed.cjs
else
  echo "▸ демо-данные пропущены: SEED_ON_START=${SEED_ON_START}"
fi

echo "▸ приложение на порту ${PORT:-3000}"
exec node /app/server.js
