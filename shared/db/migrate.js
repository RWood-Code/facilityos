const fs = require('fs');
const path = require('path');
const { prepareSql } = require('./adapters/sql');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function ensureVersionTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now')),
      description TEXT
    );
  `);
}

function getCurrentVersion(db) {
  ensureVersionTable(db);
  const row = db.prepare('SELECT MAX(version) AS v FROM schema_version').get();
  return row?.v || 0;
}

function loadMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((filename) => {
      const match = filename.match(/^(\d+)/);
      const version = match ? parseInt(match[1], 10) : 0;
      return {
        version,
        description: filename.replace(/\.sql$/, ''),
        sql: fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8'),
      };
    })
    .filter((m) => m.version > 0);
}

function splitStatements(sql) {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

function runMigrations(db) {
  ensureVersionTable(db);
  const current = getCurrentVersion(db);
  const migrations = loadMigrationFiles();
  let applied = 0;

  for (const migration of migrations) {
    if (migration.version <= current) continue;
    const statements = splitStatements(migration.sql);
    for (const stmt of statements) {
      try {
        db.exec(stmt);
      } catch (e) {
        if (!/duplicate column name/i.test(e.message)) throw e;
      }
    }
    db.prepare('INSERT INTO schema_version (version, description) VALUES (?, ?)').run(
      migration.version,
      migration.description
    );
    applied++;
    console.log(`[migrate] applied v${migration.version}: ${migration.description}`);
  }

  return { current: getCurrentVersion(db), applied };
}

async function ensurePostgresVersionTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW(),
      description TEXT
    )
  `);
}

async function getPostgresCurrentVersion(pool) {
  await ensurePostgresVersionTable(pool);
  const result = await pool.query('SELECT COALESCE(MAX(version), 0) AS v FROM schema_version');
  return result.rows[0]?.v || 0;
}

async function runPostgresMigrations(pool) {
  await ensurePostgresVersionTable(pool);
  const current = await getPostgresCurrentVersion(pool);
  const migrations = loadMigrationFiles();
  let applied = 0;

  for (const migration of migrations) {
    if (migration.version <= current) continue;
    const statements = splitStatements(migration.sql);
    for (const stmt of statements) {
      const pgStmt = prepareSql(stmt, 'postgres');
      try {
        await pool.query(pgStmt);
      } catch (e) {
        if (!/already exists|duplicate column/i.test(e.message)) throw e;
      }
    }
    await pool.query(
      'INSERT INTO schema_version (version, description) VALUES ($1, $2)',
      [migration.version, migration.description]
    );
    applied++;
    console.log(`[migrate:postgres] applied v${migration.version}: ${migration.description}`);
  }

  return { current: await getPostgresCurrentVersion(pool), applied };
}

module.exports = { runMigrations, runPostgresMigrations, getCurrentVersion, loadMigrationFiles };
