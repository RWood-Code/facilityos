#!/bin/sh
set -e

if [ "$FACILITYOS_DEPLOYMENT" = "hosted" ] || [ "$FACILITYOS_DB_DRIVER" = "postgres" ]; then
  echo "[entrypoint] Waiting for PostgreSQL..."
  node -e "
    const url = process.env.FACILITYOS_DATABASE_URL || process.env.DATABASE_URL;
    if (!url) { console.error('FACILITYOS_DATABASE_URL required for hosted mode'); process.exit(1); }
    const { Client } = require('pg');
    const max = 30;
    (async () => {
      for (let i = 1; i <= max; i++) {
        const c = new Client({ connectionString: url, ssl: process.env.FACILITYOS_PG_SSL === '1' ? { rejectUnauthorized: false } : undefined });
        try {
          await c.connect();
          await c.query('SELECT 1');
          await c.end();
          console.log('[entrypoint] PostgreSQL ready');
          process.exit(0);
        } catch (e) {
          if (i === max) { console.error('[entrypoint] PostgreSQL not ready:', e.message); process.exit(1); }
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    })();
  "
fi

exec node server/index.js
