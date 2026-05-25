#!/usr/bin/env node
/**
 * FacilityOS Cloud Relay — Phase 1 minimal API
 * Default: http://0.0.0.0:4850
 */
const express = require('express');
const cors = require('cors');
const { RelayDatabase } = require('./db');
const { SYNC_PROTOCOL_VERSION } = require('../../shared/cloud/syncProtocol');

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

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '8mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'FacilityOS Cloud Relay',
      version: '1.0.0-phase1',
      protocol_version: SYNC_PROTOCOL_VERSION,
      sites: getDb().listSites().length,
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

  app.post('/api/sites/:siteId/sync/push', requireSiteAuth, (req, res) => {
    const { events } = req.body || {};
    try {
      const result = getDb().ingestEvents(req.params.siteId, events || []);
      res.json({ ok: true, ...result });
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
