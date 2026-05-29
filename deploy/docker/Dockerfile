# FacilityOS — production container (self-host SQLite or hosted PostgreSQL)
# Build: docker build -f deploy/docker/Dockerfile -t facilityos:latest .

FROM node:22-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY vite.config.js postcss.config.js tailwind.config.js index.html ./
COPY src ./src
COPY public ./public
COPY server ./server
COPY shared ./shared
COPY electron ./electron
COPY cloud ./cloud

RUN npm run build \
    && npm prune --omit=dev \
    && npm rebuild better-sqlite3

FROM node:22-bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    tini curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r facilityos && useradd -r -g facilityos -d /var/lib/facilityos facilityos

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/cloud ./cloud
COPY --from=builder /app/electron ./electron
COPY --from=builder /app/package.json ./package.json

COPY deploy/docker/entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh \
    && chmod +x /entrypoint.sh \
    && mkdir -p /var/lib/facilityos/data /var/lib/facilityos/uploads /var/lib/facilityos/licence \
    && chown -R facilityos:facilityos /var/lib/facilityos /app

ENV NODE_ENV=production \
    FACILITYOS_DEPLOYMENT=selfhost \
    FACILITYOS_HOST=0.0.0.0 \
    FACILITYOS_PORT=3847 \
    FACILITYOS_DATA_DIR=/var/lib/facilityos/data \
    FACILITYOS_DB_PATH=/var/lib/facilityos/data/facilityos.db

EXPOSE 3847

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${FACILITYOS_PORT:-3847}/api/health" || exit 1

USER facilityos

ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
