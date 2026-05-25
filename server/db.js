const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { executeQuery } = require('../shared/db/handlers');
const { runMigrations, getCurrentVersion } = require('../shared/db/migrate');
const { writeAudit } = require('../shared/db/audit');

const SCHEMA_PATH = path.join(__dirname, '../shared/db/schema.sql');
const SCHEMA_EXT_PATH = path.join(__dirname, '../shared/db/schema-extensions.sql');

function createDbApi(db) {
  return {
    run(sql, params = []) {
      db.prepare(sql).run(...params);
    },
    get(sql, params = []) {
      return db.prepare(sql).get(...params) || null;
    },
    all(sql, params = []) {
      return db.prepare(sql).all(...params);
    },
  };
}

function backupsDirFor(dataDir) {
  return path.join(dataDir, 'backups');
}

class FacilityDatabase {
  constructor(dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.dbPath = dbPath;
    this.dataDir = dir;
    this.backupsDir = backupsDirFor(dir);
    if (!fs.existsSync(this.backupsDir)) fs.mkdirSync(this.backupsDir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');

    this.db.exec(fs.readFileSync(SCHEMA_PATH, 'utf-8'));
    if (fs.existsSync(SCHEMA_EXT_PATH)) {
      this.db.exec(fs.readFileSync(SCHEMA_EXT_PATH, 'utf-8'));
    }

    const migrationResult = runMigrations(this.db);
    this.schemaVersion = migrationResult.current;

    this.api = createDbApi(this.db);
  }

  query(channel, args) {
    return executeQuery(this.api, channel, args);
  }

  getSchemaVersion() {
    return this.schemaVersion ?? getCurrentVersion(this.db);
  }

  integrityCheck() {
    const rows = this.db.pragma('integrity_check');
    const messages = rows.map((r) => r.integrity_check);
    const ok = messages.length === 1 && messages[0] === 'ok';
    return { ok, messages };
  }

  listBackups() {
    if (!fs.existsSync(this.backupsDir)) return [];
    return fs
      .readdirSync(this.backupsDir)
      .filter((f) => f.endsWith('.db') && !f.endsWith('.db-wal') && !f.endsWith('.db-shm'))
      .map((filename) => {
        const fullPath = path.join(this.backupsDir, filename);
        const stat = fs.statSync(fullPath);
        return {
          filename,
          path: fullPath,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  backup(destPath, meta = {}) {
    const target = destPath || path.join(
      this.backupsDir,
      `facilityos-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.db`
    );
    this.db.pragma('wal_checkpoint(TRUNCATE)');
    this.db.backup(target);

    writeAudit(this.api, {
      action: 'backup.create',
      entity_type: 'database',
      entity_id: path.basename(target),
      actor: meta.actor || null,
      terminal_id: meta.terminalId || null,
      details: { path: target, sizeBytes: fs.statSync(target).size },
    });

    this.pruneBackups(meta.retentionCount);
    return { path: target, filename: path.basename(target), sizeBytes: fs.statSync(target).size };
  }

  pruneBackups(retentionCount) {
    const count = retentionCount ?? this._retentionFromSettings();
    const backups = this.listBackups();
    if (backups.length <= count) return { pruned: 0 };
    const toRemove = backups.slice(count);
    toRemove.forEach((b) => {
      fs.unlinkSync(b.path);
      const wal = `${b.path}-wal`;
      const shm = `${b.path}-shm`;
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
      if (fs.existsSync(shm)) fs.unlinkSync(shm);
    });
    return { pruned: toRemove.length };
  }

  _retentionFromSettings() {
    try {
      const row = this.api.get(`SELECT value FROM setting WHERE key='backup_retention_count'`);
      return parseInt(row?.value || '14', 10) || 14;
    } catch {
      return 14;
    }
  }

  _autoBackupEnabled() {
    try {
      const row = this.api.get(`SELECT value FROM setting WHERE key='backup_auto_enabled'`);
      return row?.value !== '0';
    } catch {
      return true;
    }
  }

  _backupIntervalHours() {
    try {
      const row = this.api.get(`SELECT value FROM setting WHERE key='backup_interval_hours'`);
      return parseInt(row?.value || '24', 10) || 24;
    } catch {
      return 24;
    }
  }

  restore(backupFilename, meta = {}) {
    const backupPath = path.join(this.backupsDir, path.basename(backupFilename));
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupFilename}`);
    }

    const check = new Database(backupPath, { readonly: true });
    const integrity = check.pragma('integrity_check');
    check.close();
    const ok = integrity.length === 1 && integrity[0].integrity_check === 'ok';
    if (!ok) {
      throw new Error(`Backup file failed integrity check: ${integrity.map((r) => r.integrity_check).join(', ')}`);
    }

    const preRestore = path.join(this.backupsDir, `pre-restore-${Date.now()}.db`);
    this.backup(preRestore, { ...meta, retentionCount: this._retentionFromSettings() + 1 });

    this.db.close();
    fs.copyFileSync(backupPath, this.dbPath);
    ['-wal', '-shm'].forEach((suffix) => {
      const sidecar = `${this.dbPath}${suffix}`;
      if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
    });

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
    this.schemaVersion = getCurrentVersion(this.db);
    this.api = createDbApi(this.db);

    writeAudit(this.api, {
      action: 'backup.restore',
      entity_type: 'database',
      entity_id: path.basename(backupPath),
      actor: meta.actor || null,
      terminal_id: meta.terminalId || null,
      details: { restoredFrom: backupPath, preRestoreBackup: preRestore },
    });

    return { restoredFrom: backupPath, preRestoreBackup: preRestore };
  }

  close() {
    this.db.close();
  }
}

module.exports = { FacilityDatabase, createDbApi, backupsDirFor };
