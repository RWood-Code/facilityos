const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { prepareSql } = require('./sql');
const { runMigrations } = require('../migrate');

const SCHEMA_PATH = path.join(__dirname, '../schema.sql');
const SCHEMA_EXT_PATH = path.join(__dirname, '../schema-extensions.sql');

function backupsDirFor(dataDir) {
  return path.join(dataDir, 'backups');
}

function createDbApi(db, dialect = 'sqlite') {
  return {
    dialect,
    run(sql, params = []) {
      const stmt = prepareSql(sql, dialect);
      db.prepare(stmt).run(...params);
      return Promise.resolve();
    },
    get(sql, params = []) {
      const stmt = prepareSql(sql, dialect);
      return Promise.resolve(db.prepare(stmt).get(...params) || null);
    },
    all(sql, params = []) {
      const stmt = prepareSql(sql, dialect);
      return Promise.resolve(db.prepare(stmt).all(...params));
    },
    exec(sql) {
      db.exec(sql);
      return Promise.resolve();
    },
  };
}

function openSqliteDatabase(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf-8'));
  if (fs.existsSync(SCHEMA_EXT_PATH)) {
    db.exec(fs.readFileSync(SCHEMA_EXT_PATH, 'utf-8'));
  }

  const migrationResult = runMigrations(db);
  const api = createDbApi(db, 'sqlite');

  return {
    native: db,
    dialect: 'sqlite',
    dbPath,
    dataDir: dir,
    schemaVersion: migrationResult.current,
    api,
    close() {
      db.close();
    },
    integrityCheck() {
      const rows = db.pragma('integrity_check');
      const messages = rows.map((r) => r.integrity_check);
      const ok = messages.length === 1 && messages[0] === 'ok';
      return { ok, messages };
    },
  };
}

module.exports = {
  createDbApi,
  openSqliteDatabase,
  backupsDirFor,
  SCHEMA_PATH,
  SCHEMA_EXT_PATH,
};
