const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { prepareSql } = require('./sql');
const { runPostgresMigrations } = require('../migrate');

const SCHEMA_PATH = path.join(__dirname, '../schema.postgres.sql');

function resolvePgSsl() {
  if (process.env.FACILITYOS_PG_SSL !== '1') return undefined;

  const caPath = process.env.FACILITYOS_PG_CA_PATH
    || process.env.PGSSLROOTCERT
    || path.join(__dirname, '../../../deploy/certs/DigiCertGlobalRootG2.crt.pem');

  if (fs.existsSync(caPath)) {
    return { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
  }

  console.warn('[postgres] FACILITYOS_PG_SSL=1 but CA file missing at', caPath, '— set FACILITYOS_PG_CA_PATH');
  return { rejectUnauthorized: false };
}
function createDbApi(pool, dialect = 'postgres') {
  return {
    dialect,
    async run(sql, params = []) {
      const stmt = prepareSql(sql, dialect);
      await pool.query(stmt, params);
    },
    async get(sql, params = []) {
      const stmt = prepareSql(sql, dialect);
      const result = await pool.query(stmt, params);
      return result.rows[0] || null;
    },
    async all(sql, params = []) {
      const stmt = prepareSql(sql, dialect);
      const result = await pool.query(stmt, params);
      return result.rows;
    },
    async exec(sql) {
      await pool.query(sql);
    },
  };
}

async function ensurePostgresSchema(pool) {
  if (!fs.existsSync(SCHEMA_PATH)) {
    throw new Error(`PostgreSQL schema missing: ${SCHEMA_PATH}`);
  }
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  await pool.query(sql);
}

async function getPostgresSchemaVersion(pool) {
  const result = await pool.query('SELECT COALESCE(MAX(version), 0) AS v FROM schema_version');
  return result.rows[0]?.v || 0;
}

async function openPostgresDatabase(connectionString) {
  if (!connectionString) {
    throw new Error('FACILITYOS_DATABASE_URL (or DATABASE_URL) is required for postgres driver');
  }

  const pool = new Pool({
    connectionString,
    ssl: resolvePgSsl(),
    max: Number(process.env.FACILITYOS_PG_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.FACILITYOS_PG_IDLE_MS || 30000),
    connectionTimeoutMillis: Number(process.env.FACILITYOS_PG_CONNECT_MS || 5000),
  });

  await pool.query('SELECT 1');
  await ensurePostgresSchema(pool);
  const migrationResult = await runPostgresMigrations(pool);
  const api = createDbApi(pool, 'postgres');

  const schemaVersion = migrationResult.current || (await getPostgresSchemaVersion(pool));
  return {
    native: pool,
    dialect: 'postgres',
    connectionString: connectionString.replace(/:[^:@/]+@/, ':***@'),
    schemaVersion,
    api,
    async close() {
      await pool.end();
    },
    async integrityCheck() {
      const checks = await pool.query(`
        SELECT c.relname AS table_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY c.relname
      `);
      return {
        ok: checks.rows.length > 0,
        messages: [`${checks.rows.length} tables in public schema`],
        tables: checks.rows.map((r) => r.table_name),
      };
    },
  };
}

module.exports = {
  createDbApi,
  openPostgresDatabase,
  ensurePostgresSchema,
  SCHEMA_PATH,
};
