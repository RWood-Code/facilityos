#!/usr/bin/env node
/**
 * FacilityOS data server — shared SQLite for all terminals on the LAN.
 * Run standalone or spawned by the Electron "server" terminal.
 */
const express = require('express');
const cors = require('cors');
const os = require('os');
const path = require('path');
const { FacilityDatabase } = require('./db');

const PORT = Number(process.env.FACILITYOS_PORT || 3847);
const HOST = process.env.FACILITYOS_HOST || '0.0.0.0';
const DATA_DIR = process.env.FACILITYOS_DATA_DIR || path.join(
  process.env.PROGRAMDATA || process.env.APPDATA || os.homedir(),
  'FacilityOS',
  'data'
);
const DB_PATH = process.env.FACILITYOS_DB_PATH || path.join(DATA_DIR, 'facilityos.db');

let database;
let backupTimer;
const startTime = Date.now();
const activeTerminals = new Map();

function getDatabase() {
  if (!database) database = new FacilityDatabase(DB_PATH);
  return database;
}

function scheduleAutoBackup() {
  if (backupTimer) clearInterval(backupTimer);

  const db = getDatabase();
  if (!db._autoBackupEnabled()) {
    console.log('[backup] automatic backups disabled');
    return;
  }

  const hours = db._backupIntervalHours();
  const intervalMs = Math.max(hours, 1) * 60 * 60 * 1000;

  const run = () => {
    try {
      const result = db.backup(undefined, { actor: 'system', terminalId: 'auto' });
      console.log('[backup] automatic backup saved:', result.path);
    } catch (e) {
      console.error('[backup] automatic backup failed:', e.message);
    }
  };

  backupTimer = setInterval(run, intervalMs);
  if (typeof backupTimer.unref === 'function') backupTimer.unref();
  console.log(`[backup] automatic backups every ${hours}h`);
}

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (req, res) => {
    const db = getDatabase();
    res.json({
      ok: true,
      service: 'FacilityOS Data Server',
      version: '1.1.0',
      schemaVersion: db.getSchemaVersion(),
      uptimeSec: Math.floor((Date.now() - startTime) / 1000),
      dbPath: DB_PATH,
      dataDir: DATA_DIR,
      hostname: os.hostname(),
    });
  });

  const LICENCE_EXEMPT = new Set([
    'licence:status', 'licence:activate', 'licence:renew',
    'settings:get', 'settings:set', 'settings:all', 'health',
    'audit:list',
  ]);

  app.post('/api/query', (req, res) => {
    const { channel, args, terminalId } = req.body || {};
    if (!channel) {
      return res.status(400).json({ ok: false, error: 'channel required' });
    }
    if (terminalId) {
      activeTerminals.set(terminalId, { lastSeen: Date.now(), channel });
    }
    try {
      if (!LICENCE_EXEMPT.has(channel)) {
        const lic = getDatabase().query('licence:status');
        if (!lic.valid) {
          return res.status(402).json({ ok: false, error: 'licence_expired', data: lic });
        }
      }
      const data = getDatabase().query(channel, args);
      res.json({ ok: true, data });
    } catch (e) {
      console.error('[query]', channel, e.message);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/terminals', (_req, res) => {
    const now = Date.now();
    const list = [...activeTerminals.entries()]
      .filter(([, v]) => now - v.lastSeen < 120000)
      .map(([id, v]) => ({ id, lastSeen: v.lastSeen }));
    res.json({ ok: true, data: list });
  });

  app.get('/api/backups', (_req, res) => {
    try {
      res.json({ ok: true, data: getDatabase().listBackups() });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/backup', (req, res) => {
    try {
      const { terminalId, actor } = req.body || {};
      const data = getDatabase().backup(undefined, { terminalId, actor });
      res.json({ ok: true, data });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/backup/restore', (req, res) => {
    const { filename, terminalId, actor } = req.body || {};
    if (!filename) {
      return res.status(400).json({ ok: false, error: 'filename required' });
    }
    try {
      const data = getDatabase().restore(filename, { terminalId, actor });
      res.json({ ok: true, data });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/integrity', (_req, res) => {
    try {
      res.json({ ok: true, data: getDatabase().integrityCheck() });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  return app;
}

function startServer(options = {}) {
  const port = options.port || PORT;
  const host = options.host || HOST;
  const app = createApp();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      getDatabase();
      scheduleAutoBackup();
      console.log(`FacilityOS server listening on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
      console.log(`Database: ${DB_PATH}`);
      resolve({ app, server, port, host, dbPath: DB_PATH });
    });
    server.on('error', reject);
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { startServer, createApp, getDatabase, DB_PATH, DATA_DIR };
