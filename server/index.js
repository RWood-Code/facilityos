#!/usr/bin/env node
/**
 * FacilityOS data server — shared SQLite for all terminals on the LAN.
 * Run standalone or spawned by the Electron "server" terminal.
 */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { FacilityDatabase } = require('./db');
const { isChannelAllowed } = require('../shared/db/entitlements');
const { verifyRemoteAccess, readRemoteSettings } = require('../shared/db/remoteAccess');
const { getDistPath } = require('../electron/paths');

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

function getLanAddresses() {
  const addrs = [];
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets || []) {
      if (net.family === 'IPv4' && !net.internal) addrs.push(net.address);
    }
  }
  return addrs;
}

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
  app.set('trust proxy', true);
  app.use(cors());
  app.use(express.json({ limit: '4mb' }));

  function remoteAuth(req, res, next) {
    if (req.method === 'GET' && req.path === '/api/health') return next();
    if (!req.path.startsWith('/api')) return next();
    try {
      const db = getDatabase();
      const auth = verifyRemoteAccess(req, db.api.get.bind(db.api));
      if (auth.allowed) return next();
      return res.status(401).json({ ok: false, error: auth.reason || 'remote_auth_required' });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  app.use(remoteAuth);

  app.get('/api/health', (req, res) => {
    const db = getDatabase();
    const distPath = path.join(__dirname, '../dist');
    const lanIps = getLanAddresses();
    const port = Number(process.env.FACILITYOS_PORT || PORT);
    const remote = readRemoteSettings(db.api.get.bind(db.api));
    const auth = verifyRemoteAccess(req, db.api.get.bind(db.api));
    res.json({
      ok: true,
      service: 'FacilityOS Data Server',
      version: '1.1.0',
      schemaVersion: db.getSchemaVersion(),
      uptimeSec: Math.floor((Date.now() - startTime) / 1000),
      dbPath: DB_PATH,
      dataDir: DATA_DIR,
      hostname: os.hostname(),
      lanIps,
      port,
      webUiAvailable: fs.existsSync(path.join(distPath, 'index.html')),
      remoteAccess: {
        enabled: remote.enabled,
        tokenRequired: remote.enabled && auth.reason !== 'local',
        lanOnly: !remote.enabled && auth.reason !== 'local',
      },
      mobileUrls: lanIps.length
        ? lanIps.map((ip) => ({
            ip,
            home: `http://${ip}:${port}/`,
            steamTablet: `http://${ip}:${port}/#steam-tablet`,
            manager: `http://${ip}:${port}/#manager`,
          }))
        : [],
    });
  });

  const LICENCE_EXEMPT = new Set([
    'licence:status', 'licence:activate', 'licence:plans', 'licence:ensure_trial',
    'licence:plan_modules',
    'licence:set_features', 'licence:sync_modules',
    'settings:get', 'settings:set', 'settings:all', 'health',
    'audit:list', 'modules:list',
    'remote:status', 'remote:enable', 'remote:disable', 'remote:rotate_token',
    'cloud:status', 'cloud:configure', 'cloud:pairing_code', 'cloud:sync_now',
    'cloud:pair', 'cloud:agent_credentials', 'cloud:outbox_pending', 'cloud:outbox_ack',
    'cloud:outbox_error', 'cloud:enqueue_demo',
    'staff:by_pin',
  ]);

  app.post('/api/query', (req, res) => {
    const { channel, args, terminalId } = req.body || {};
    if (!channel) {
      return res.status(400).json({ ok: false, error: 'channel required' });
    }
    const { isLocalOrPrivateRequest } = require('../shared/db/remoteAccess');
    const LOCAL_ADMIN_CHANNELS = new Set([
      'remote:enable', 'remote:disable', 'remote:rotate_token',
      'cloud:configure', 'cloud:pairing_code', 'cloud:sync_now', 'cloud:pair', 'cloud:enqueue_demo',
    ]);
    if (LOCAL_ADMIN_CHANNELS.has(channel) && !isLocalOrPrivateRequest(req)) {
      return res.status(403).json({ ok: false, error: 'local_admin_required' });
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
        if (lic.modules && !isChannelAllowed(channel, lic.modules)) {
          return res.status(403).json({ ok: false, error: 'module_not_licensed', data: lic });
        }
      }
      const data = getDatabase().query(channel, args);
      Promise.resolve(data)
        .then((resolved) => res.json({ ok: true, data: resolved }))
        .catch((e) => {
          console.error('[query]', channel, e.message);
          res.status(500).json({ ok: false, error: e.message });
        });
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

  const distPath = getDistPath();
  if (fs.existsSync(path.join(distPath, 'index.html'))) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

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
