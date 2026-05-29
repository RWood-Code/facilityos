const fs = require('fs');
const path = require('path');
const { openDatabase } = require('../shared/db/adapters');
const { getDeploymentConfig } = require('../shared/db/deployment');
const { executeQuery } = require('../shared/db/handlers');
const { writeAudit } = require('../shared/db/audit');
const { setLicenceDataDir } = require('../shared/db/licencePaths');
const { backupsDirFor } = require('../shared/db/adapters/sqlite');

function isAsyncDriver(dialect) {
  return dialect === 'postgres';
}

class FacilityDatabase {
  /**
   * @param {object} conn — result from openDatabase()
   */
  constructor(conn) {
    this.conn = conn;
    this.dialect = conn.dialect;
    this.deployment = conn.deployment || getDeploymentConfig();
    this.dbPath = conn.dbPath || null;
    this.dataDir = conn.dataDir || (conn.dbPath ? path.dirname(conn.dbPath) : null);
    this.backupsDir = this.dataDir ? backupsDirFor(this.dataDir) : null;
    this.schemaVersion = conn.schemaVersion;
    this.api = conn.api;

    if (this.backupsDir && !fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }
  }

  static async open(options = {}) {
    const conn = await openDatabase(options);
    return new FacilityDatabase(conn);
  }

  /** @deprecated use FacilityDatabase.open() */
  static syncOpenSqlite(dbPath) {
    const { openSqliteDatabase } = require('../shared/db/adapters/sqlite');
    const conn = openSqliteDatabase(dbPath);
    return new FacilityDatabase({ ...conn, deployment: getDeploymentConfig() });
  }

  async query(channel, args) {
    return executeQuery(this.api, channel, args);
  }

  getSchemaVersion() {
    return this.schemaVersion;
  }

  async integrityCheck() {
    if (typeof this.conn.integrityCheck === 'function') {
      const result = this.conn.integrityCheck();
      return result instanceof Promise ? result : result;
    }
    return { ok: false, messages: ['integrity check not available'] };
  }

  listBackups() {
    if (!this.backupsDir || !fs.existsSync(this.backupsDir)) return [];
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

  async backup(destPath, meta = {}) {
    if (this.dialect === 'postgres') {
      throw new Error('SQLite-style file backup is not available on hosted postgres — use platform backup tools');
    }

    const Database = require('better-sqlite3');
    const target = destPath || path.join(
      this.backupsDir,
      `facilityos-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.db`
    );

    const db = this.conn.native;
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.backup(target);

    await writeAudit(this.api, {
      action: 'backup.create',
      entity_type: 'database',
      entity_id: path.basename(target),
      actor: meta.actor || null,
      terminal_id: meta.terminalId || null,
      details: { path: target, sizeBytes: fs.statSync(target).size },
    });

    await this.pruneBackupsAsync(meta.retentionCount);
    return { path: target, filename: path.basename(target), sizeBytes: fs.statSync(target).size };
  }

  pruneBackups(retentionCount) {
    const count = retentionCount ?? 14;
    const backups = this.listBackups();
    if (backups.length <= count) return { pruned: 0 };
    const toRemove = backups.slice(count);
    toRemove.forEach((b) => {
      fs.unlinkSync(b.path);
      ['-wal', '-shm'].forEach((suffix) => {
        const sidecar = `${b.path}${suffix}`;
        if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
      });
    });
    return { pruned: toRemove.length };
  }

  async pruneBackupsAsync(retentionCount) {
    const count = retentionCount ?? await this._retentionFromSettingsAsync();
    const backups = this.listBackups();
    if (backups.length <= count) return { pruned: 0 };
    const toRemove = backups.slice(count);
    toRemove.forEach((b) => {
      fs.unlinkSync(b.path);
      ['-wal', '-shm'].forEach((suffix) => {
        const sidecar = `${b.path}${suffix}`;
        if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
      });
    });
    return { pruned: toRemove.length };
  }

  _retentionFromSettings() {
    try {
      const row = isAsyncDriver(this.dialect)
        ? null
        : this.api.get(`SELECT value FROM setting WHERE key='backup_retention_count'`);
      if (isAsyncDriver(this.dialect)) return 14;
      return parseInt(row?.value || '14', 10) || 14;
    } catch {
      return 14;
    }
  }

  async _autoBackupEnabledAsync() {
    try {
      const row = await this.api.get(`SELECT value FROM setting WHERE key='backup_auto_enabled'`);
      return row?.value !== '0';
    } catch {
      return true;
    }
  }

  _autoBackupEnabled() {
    if (this.dialect === 'sqlite') return this._autoBackupEnabledSync();
    return true;
  }

  async _backupIntervalHours() {
    try {
      const row = await this.api.get(`SELECT value FROM setting WHERE key='backup_interval_hours'`);
      return parseInt(row?.value || '24', 10) || 24;
    } catch {
      return 24;
    }
  }

  async _retentionFromSettingsAsync() {
    try {
      const row = await this.api.get(`SELECT value FROM setting WHERE key='backup_retention_count'`);
      return parseInt(row?.value || '14', 10) || 14;
    } catch {
      return 14;
    }
  }

  _autoBackupEnabledSync() {
    try {
      const row = this.conn.native.prepare(`SELECT value FROM setting WHERE key='backup_auto_enabled'`).get();
      return row?.value !== '0';
    } catch {
      return true;
    }
  }

  async restore(backupFilename, meta = {}) {
    if (this.dialect === 'postgres') {
      throw new Error('SQLite-style restore is not available on hosted postgres');
    }

    const Database = require('better-sqlite3');
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
    await this.backup(preRestore, { ...meta, retentionCount: (await this._retentionFromSettingsAsync()) + 1 });

    this.conn.native.close();
    fs.copyFileSync(backupPath, this.dbPath);
    ['-wal', '-shm'].forEach((suffix) => {
      const sidecar = `${this.dbPath}${suffix}`;
      if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
    });

    const { openSqliteDatabase } = require('../shared/db/adapters/sqlite');
    const reopened = openSqliteDatabase(this.dbPath);
    this.conn = reopened;
    this.api = reopened.api;
    this.schemaVersion = reopened.schemaVersion;

    await writeAudit(this.api, {
      action: 'backup.restore',
      entity_type: 'database',
      entity_id: path.basename(backupPath),
      actor: meta.actor || null,
      terminal_id: meta.terminalId || null,
      details: { restoredFrom: backupPath, preRestoreBackup: preRestore },
    });

    return { restoredFrom: backupPath, preRestoreBackup: preRestore };
  }

  async close() {
    if (typeof this.conn.close === 'function') {
      const result = this.conn.close();
      if (result instanceof Promise) await result;
    }
  }
}

module.exports = { FacilityDatabase, backupsDirFor, isAsyncDriver };
