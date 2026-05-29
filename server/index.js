#!/usr/bin/env node
/**
 * FacilityOS data server — Express API + SQLite or PostgreSQL.
 * Run standalone, in Docker, on Azure App Service, or spawned by Electron.
 */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { FacilityDatabase } = require('./db');
const { getDeploymentConfig } = require('../shared/db/deployment');
const { isChannelAllowed } = require('../shared/db/entitlements');
const { verifyRemoteAccess, readRemoteSettings } = require('../shared/db/remoteAccess');
const { createApiAuthMiddleware, registerAuthRoutes, isSessionBypass } = require('./auth/routes');
const { getStorageAdapter } = require('./storage');
const { requireRestoreRole } = require('./security');
const { pinLoginRateLimit, checkRateLimit } = require('./auth/rateLimit');
const { assertAllowedUpload, contentTypeForFilename } = require('./storage/validate');
const { getDistPath } = require('../electron/paths');
const { setLicenceDataDir } = require('../shared/db/licencePaths');
const { migratePlaintextPins } = require('../shared/db/pinAuth');
const { ensureDefaultGateStaff } = require('../shared/db/defaultStaff');

const PORT = Number(process.env.FACILITYOS_PORT || 3847);
const HOST = process.env.FACILITYOS_HOST || '0.0.0.0';
const DATA_DIR = process.env.FACILITYOS_DATA_DIR || path.join(
  process.env.PROGRAMDATA || process.env.APPDATA || os.homedir(),
  'FacilityOS',
  'data'
);
const DB_PATH = process.env.FACILITYOS_DB_PATH || path.join(DATA_DIR, 'facilityos.db');
const UPLOADS_DIR = path.join(path.dirname(DATA_DIR), 'uploads');

let database;
let deploymentConfig;
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
  if (!database) throw new Error('Database not initialized — call bootstrapDatabase() first');
  return database;
}

async function bootstrapDatabase() {
  if (database) return database;
  deploymentConfig = getDeploymentConfig();
  const openOptions = deploymentConfig.dbDriver === 'postgres'
    ? {}
    : { dbPath: DB_PATH };
  database = await FacilityDatabase.open(openOptions);
  await migratePlaintextPins(database.api);
  await ensureDefaultGateStaff(database.api);
  return database;
}

async function scheduleAutoBackup() {
  if (backupTimer) clearInterval(backupTimer);
  if (deploymentConfig?.dbDriver === 'postgres') {
    console.log('[backup] automatic file backups disabled on hosted postgres');
    return;
  }

  const db = getDatabase();
  if (!(await db._autoBackupEnabledAsync())) {
    console.log('[backup] automatic backups disabled');
    return;
  }

  const hours = await db._backupIntervalHours();
  const intervalMs = Math.max(hours, 1) * 60 * 60 * 1000;

  const run = async () => {
    try {
      const result = await db.backup(undefined, { actor: 'system', terminalId: 'auto' });
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
  const cfg = deploymentConfig || getDeploymentConfig();
  const app = express();
  app.set('trust proxy', cfg.isHosted ? 1 : false);

  if (cfg.isHosted && cfg.publicUrl) {
    app.use(cors({ origin: cfg.publicUrl, credentials: true }));
  } else {
    app.use(cors());
  }

  app.use(express.json({ limit: '4mb' }));

  registerAuthRoutes(app, getDatabase);
  app.use(createApiAuthMiddleware(getDatabase));

  app.get('/api/health', async (req, res) => {
    try {
      const db = getDatabase();
      const distPath = path.join(__dirname, '../dist');
      const cfg = deploymentConfig || getDeploymentConfig();
      const isLocal = isSessionBypass(req, cfg) || (cfg.authMode === 'legacy' && (await verifyRemoteAccess(req, db.api.get.bind(db.api))).reason === 'local');

      if (!isLocal && cfg.isHosted) {
        return res.json({
          ok: true,
          service: 'FacilityOS Data Server',
          version: '1.7.1-security',
          uptimeSec: Math.floor((Date.now() - startTime) / 1000),
        });
      }

      const lanIps = getLanAddresses();
      const port = Number(process.env.FACILITYOS_PORT || PORT);
      const remote = await readRemoteSettings(db.api.get.bind(db.api));
      const auth = await verifyRemoteAccess(req, db.api.get.bind(db.api));

      res.json({
        ok: true,
        service: 'FacilityOS Data Server',
        version: '1.7.1-security',
        schemaVersion: db.getSchemaVersion(),
        uptimeSec: Math.floor((Date.now() - startTime) / 1000),
        deployment: {
          mode: cfg.deployment,
          dbDriver: cfg.dbDriver,
          storage: cfg.storageBackend,
          authMode: cfg.authMode,
          publicUrl: cfg.publicUrl,
        },
        dbPath: cfg.dbDriver === 'sqlite' ? DB_PATH : null,
        dataDir: cfg.dbDriver === 'sqlite' ? DATA_DIR : null,
        hostname: os.hostname(),
        lanIps,
        port,
        webUiAvailable: fs.existsSync(path.join(distPath, 'index.html')),
        auth: {
          mode: cfg.authMode,
          sessionLogin: cfg.authMode === 'session' ? '/api/auth/pin' : null,
        },
        remoteAccess: {
          enabled: remote.enabled,
          tokenRequired: cfg.authMode === 'legacy' && remote.enabled && auth.reason !== 'local',
          lanOnly: cfg.authMode === 'legacy' && !remote.enabled && auth.reason !== 'local',
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
    } catch (e) {
      res.status(503).json({ ok: false, error: e.message });
    }
  });

  const LICENCE_EXEMPT = new Set([
    'licence:status', 'licence:activate', 'licence:plans', 'licence:ensure_trial',
    'licence:plan_modules', 'licence:file_info', 'licence:sync_from_file',
    'licence:set_features', 'licence:sync_modules',
    'settings:get', 'settings:set', 'settings:all', 'health',
    'audit:list', 'modules:list',
    'remote:status', 'remote:enable', 'remote:disable', 'remote:rotate_token',
    'cloud:status', 'cloud:configure', 'cloud:pairing_code', 'cloud:sync_now',
    'cloud:pair', 'cloud:agent_credentials', 'cloud:outbox_pending', 'cloud:outbox_ack',
    'cloud:outbox_error', 'cloud:enqueue_demo', 'cloud:create_mobile_user',
    'email:status', 'email:verify_smtp', 'email:send_test',
    'staff:by_pin',
  ]);

  app.post('/api/query', async (req, res) => {
    const { channel, args, terminalId } = req.body || {};
    if (!channel) {
      return res.status(400).json({ ok: false, error: 'channel required' });
    }
    if (channel === 'staff:by_pin') {
      const limited = checkRateLimit(req);
      if (limited.blocked) return res.status(limited.statusCode).json(limited.body);
    }
    const cfg = deploymentConfig || getDeploymentConfig();
    const { isLocalOrPrivateRequest } = require('../shared/db/remoteAccess');
    if (channel === 'staff:by_pin' && cfg.authMode === 'session' && !isSessionBypass(req, cfg)) {
      return res.status(401).json({ ok: false, error: 'use_auth_pin' });
    }
    const LOCAL_ADMIN_CHANNELS = new Set([
      'remote:enable', 'remote:disable', 'remote:rotate_token',
      'cloud:configure', 'cloud:pairing_code', 'cloud:sync_now', 'cloud:pair', 'cloud:enqueue_demo',
      'cloud:create_mobile_user',
      'email:verify_smtp', 'email:send_test',
    ]);
    if (LOCAL_ADMIN_CHANNELS.has(channel) && !isLocalOrPrivateRequest(req)) {
      return res.status(403).json({ ok: false, error: 'local_admin_required' });
    }
    if (terminalId) {
      activeTerminals.set(terminalId, { lastSeen: Date.now(), channel });
    }
    try {
      if (!LICENCE_EXEMPT.has(channel)) {
        const lic = await getDatabase().query('licence:status');
        if (!lic.valid) {
          return res.status(402).json({ ok: false, error: 'licence_expired', data: lic });
        }
        if (lic.modules && !isChannelAllowed(channel, lic.modules)) {
          return res.status(403).json({ ok: false, error: 'module_not_licensed', data: lic });
        }
      }
      const data = await getDatabase().query(channel, args);
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

  app.post('/api/backup', async (req, res) => {
    try {
      const { terminalId, actor } = req.body || {};
      const data = await getDatabase().backup(undefined, { terminalId, actor });
      res.json({ ok: true, data });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/backup/restore', async (req, res) => {
    if (!requireRestoreRole(req, res)) return;
    const { filename, terminalId, actor } = req.body || {};
    if (!filename) {
      return res.status(400).json({ ok: false, error: 'filename required' });
    }
    try {
      const data = await getDatabase().restore(filename, { terminalId, actor });
      res.json({ ok: true, data });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/upload', express.json({ limit: '20mb' }), async (req, res) => {
    try {
      const { filename, data, subfolder = 'iltp' } = req.body || {};
      if (!filename || !data) {
        return res.status(400).json({ ok: false, error: 'filename and data required' });
      }
      assertAllowedUpload(filename);
      const storage = getStorageAdapter({ uploadsDir: UPLOADS_DIR, deploymentConfig });
      const saved = await storage.save({ filename, data, subfolder });
      res.json({ ok: true, data: saved });
    } catch (e) {
      res.status(e.status || 500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/uploads/:folder/:file', async (req, res) => {
    try {
      const storedPath = `${path.basename(req.params.folder)}/${path.basename(req.params.file)}`;
      const storage = getStorageAdapter({ uploadsDir: UPLOADS_DIR, deploymentConfig });
      const file = await storage.open(storedPath);
      if (!file) return res.status(404).json({ ok: false, error: 'not found' });
      const contentType = file.contentType || contentTypeForFilename(req.params.file);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(req.params.file)}"`);
      if (file.size) res.setHeader('Content-Length', String(file.size));
      file.stream.pipe(res);
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/integrity', async (_req, res) => {
    try {
      const data = await getDatabase().integrityCheck();
      res.json({ ok: true, data });
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

async function startServer(options = {}) {
  const port = options.port || PORT;
  const host = options.host || HOST;
  setLicenceDataDir(DATA_DIR);
  deploymentConfig = getDeploymentConfig();
  await bootstrapDatabase();

  const app = createApp();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, async () => {
      try {
        const sync = await getDatabase().query('licence:sync_from_file');
        if (sync?.synced) {
          console.log(`[licence] Loaded ${sync.licence_key} from licence file (expires ${sync.expires_at})`);
        }
      } catch (e) {
        console.warn('[licence] Could not load licence file:', e.message);
      }
      await scheduleAutoBackup();
      const cfg = deploymentConfig;
      console.log(`FacilityOS server listening on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
      getStorageAdapter({ uploadsDir: UPLOADS_DIR, deploymentConfig: cfg });
      console.log(`Deployment: ${cfg.deployment} (${cfg.dbDriver}, auth=${cfg.authMode}, storage=${cfg.storageBackend})`);
      if (cfg.dbDriver === 'sqlite') console.log(`Database: ${DB_PATH}`);
      else console.log(`Database: PostgreSQL (${process.env.FACILITYOS_DATABASE_URL ? 'configured' : 'DATABASE_URL'})`);
      resolve({ app, server, port, host, dbPath: DB_PATH, deployment: cfg });
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

module.exports = {
  startServer,
  createApp,
  getDatabase,
  bootstrapDatabase,
  DB_PATH,
  DATA_DIR,
  UPLOADS_DIR,
};
