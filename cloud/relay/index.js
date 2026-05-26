#!/usr/bin/env node
/**
 * FacilityOS Cloud Relay — Phase 2 API (auth + read-only manager dashboard + push scaffold)
 * Default: http://0.0.0.0:4850
 */
const express = require('express');
const cors = require('cors');
const { RelayDatabase } = require('./db');
const { SYNC_PROTOCOL_VERSION } = require('../../shared/cloud/syncProtocol');
const { signToken, verifyToken, extractBearerToken } = require('./auth');
const { notifySiteSubscribers } = require('./push');

const PORT = Number(process.env.FACILITYOS_RELAY_PORT || 4850);
const HOST = process.env.FACILITYOS_RELAY_HOST || '0.0.0.0';

let db;

function getDb() {
  if (!db) db = new RelayDatabase();
  return db;
}

function extractAgentKey(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return (req.headers['x-facilityos-agent-key'] || '').trim() || null;
}

function requireSiteAuth(req, res, next) {
  const key = extractAgentKey(req);
  if (!key) return res.status(401).json({ ok: false, error: 'agent_key_required' });
  const site = getDb().getSiteByAgentKey(key);
  if (!site || site.id !== req.params.siteId) {
    return res.status(403).json({ ok: false, error: 'invalid_agent_key' });
  }
  req.relaySite = site;
  return next();
}

function requireUserAuth(req, res, next) {
  const token = extractBearerToken(req);
  const payload = verifyToken(token);
  if (!payload?.sub || !payload?.site_id) {
    return res.status(401).json({ ok: false, error: 'session_required' });
  }
  if (payload.site_id !== req.params.siteId) {
    return res.status(403).json({ ok: false, error: 'site_mismatch' });
  }
  const user = getDb().getUserById(payload.sub);
  if (!user) return res.status(401).json({ ok: false, error: 'user_not_found' });
  req.relayUser = { id: user.id, email: user.email, role: user.role, site_id: user.site_id };
  return next();
}

async function dispatchPushAlerts(siteId, alerts = []) {
  for (const alert of alerts) {
    await notifySiteSubscribers(getDb(), siteId, {
      title: alert.title,
      body: alert.body,
      data: { pool_id: alert.pool_id, type: 'pool_non_compliance' },
    });
  }
}

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '8mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'FacilityOS Cloud Relay',
      version: '1.1.0-phase2',
      protocol_version: SYNC_PROTOCOL_VERSION,
      sites: getDb().listSites().length,
      features: ['pairing', 'sync', 'user_login', 'manager_dashboard', 'push_scaffold'],
    });
  });

  app.get('/api/sites', (_req, res) => {
    res.json({ ok: true, data: getDb().listSites() });
  });

  app.post('/api/pair/claim', (req, res) => {
    const { code, facility_name } = req.body || {};
    try {
      const data = getDb().claimPairing({ code, facilityName: facility_name });
      res.json({ ok: true, data });
    } catch (e) {
      const status = e.message === 'pairing_code_used' ? 409 : 400;
      res.status(status).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/sites/:siteId/sync/push', requireSiteAuth, async (req, res) => {
    const { events } = req.body || {};
    try {
      const result = getDb().ingestEvents(req.params.siteId, events || []);
      if (result.push_alerts?.length) {
        dispatchPushAlerts(req.params.siteId, result.push_alerts).catch((e) => {
          console.error('[relay] push dispatch:', e.message);
        });
      }
      const { push_alerts, ...rest } = result;
      res.json({ ok: true, ...rest });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/sites/:siteId/heartbeat', requireSiteAuth, (req, res) => {
    const { pending_events } = req.body || {};
    const data = getDb().heartbeat(req.params.siteId, pending_events || 0);
    res.json({ ok: true, data });
  });

  app.get('/api/sites/:siteId/snapshot', (req, res) => {
    const snapshot = getDb().getSiteSnapshot(req.params.siteId, Number(req.query.limit) || 100);
    if (!snapshot) return res.status(404).json({ ok: false, error: 'site_not_found' });
    res.json({ ok: true, data: snapshot });
  });

  app.post('/api/sites/:siteId/users', requireSiteAuth, (req, res) => {
    const { email, password, role, name } = req.body || {};
    try {
      const data = getDb().createUser({
        siteId: req.params.siteId,
        email,
        password,
        role: role || 'manager',
        name,
      });
      res.json({ ok: true, data });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/sites/:siteId/users', requireSiteAuth, (req, res) => {
    res.json({ ok: true, data: getDb().listUsersForSite(req.params.siteId) });
  });

  app.post('/api/sites/:siteId/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    try {
      const result = getDb().authenticateUser({
        siteId: req.params.siteId,
        email,
        password,
      });
      const token = signToken({ sub: result.user.id, site_id: req.params.siteId, role: result.user.role });
      res.json({
        ok: true,
        data: {
          token,
          user: result.user,
          site: result.site,
        },
      });
    } catch (e) {
      res.status(401).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/sites/:siteId/manager-dashboard', requireUserAuth, (req, res) => {
    const dashboard = getDb().getManagerDashboard(req.params.siteId, Number(req.query.limit) || 500);
    if (!dashboard) return res.status(404).json({ ok: false, error: 'site_not_found' });
    res.json({ ok: true, data: dashboard });
  });

  app.post('/api/sites/:siteId/push/subscribe', requireUserAuth, (req, res) => {
    const { subscription } = req.body || {};
    try {
      const data = getDb().addPushSubscription({
        siteId: req.params.siteId,
        userId: req.relayUser.id,
        subscription,
      });
      res.json({ ok: true, data });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/push/vapid-public-key', (_req, res) => {
    res.json({
      ok: true,
      publicKey: process.env.FACILITYOS_VAPID_PUBLIC || null,
      configured: Boolean(process.env.FACILITYOS_VAPID_PUBLIC),
    });
  });

  return app;
}

function startRelay(options = {}) {
  const app = createApp();
  const port = options.port || PORT;
  const host = options.host || HOST;
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      getDb();
      console.log(`FacilityOS Cloud Relay on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
      resolve({ app, server, port, host });
    });
    server.on('error', reject);
  });
}

if (require.main === module) {
  startRelay().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { startRelay, createApp, getDb };
