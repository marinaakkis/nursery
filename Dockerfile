# Многостадийная сборка: в рантайм уезжает только собранное приложение без dev-зависимостей.

FROM node:22-alpine AS builder
WORKDIR /app

# Зависимости отдельным слоем — переустанавливаются только при изменении манифестов
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build \
 && npx esbuild src/db/migrate.ts src/db/seed.ts \
      --bundle --platform=node --format=cjs --target=node22 \
      --outdir=dist --out-extension:.js=.cjs --alias:@=./src

FROM node:22-alpine AS runtime
RUN addgroup --system app && adduser --system --ingroup app app
WORKDIR /app

# standalone уже содержит минимальный набор node_modules
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/drizzle ./drizzle
COPY --chown=app:app docker-entrypoint.sh ./docker-entrypoint.sh

# Каталог фото — точка монтирования именованного тома, права нужны до переключения пользователя
RUN mkdir -p /app/uploads && chown -R app:app /app/uploads && chmod +x /app/docker-entrypoint.sh

USER app

# server.js из standalone слушает 0.0.0.0 при заданном HOSTNAME
ENV HOSTNAME=0.0.0.0 \
    PORT=3000 \
    UPLOAD_DIR=/app/uploads

EXPOSE 3000

# 127.0.0.1 вместо localhost: busybox-wget в alpine резолвит localhost через DNS и падает
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
