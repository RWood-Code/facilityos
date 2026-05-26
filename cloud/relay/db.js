const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildManagerSnapshot, isNonCompliant } = require('../../shared/cloud/managerSnapshot');
const { hashPassword, verifyPassword } = require('./auth');

const DEFAULT_STORE = path.join(__dirname, '../../data/relay-store.json');

function generateId() {
  return crypto.randomBytes(12).toString('hex');
}

function generateAgentKey() {
  return crypto.randomBytes(24).toString('hex');
}

function emptyStore() {
  return { sites: {}, claims: {}, events: [], users: {}, push_subscriptions: [] };
}

class RelayDatabase {
  constructor(storePath = process.env.FACILITYOS_RELAY_STORE || DEFAULT_STORE) {
    this.storePath = storePath;
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.store = this._load();
  }

  _load() {
    if (!fs.existsSync(this.storePath)) {
      const empty = emptyStore();
      fs.writeFileSync(this.storePath, JSON.stringify(empty, null, 2));
      return empty;
    }
    const data = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'));
    if (!data.users) data.users = {};
    if (!data.push_subscriptions) data.push_subscriptions = [];
    return data;
  }

  _save() {
    fs.writeFileSync(this.storePath, JSON.stringify(this.store, null, 2));
  }

  claimPairing({ code, facilityName }) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized || normalized.length < 4) throw new Error('invalid_pairing_code');
    if (this.store.claims[normalized]) throw new Error('pairing_code_used');

    const siteId = generateId();
    const agentKey = generateAgentKey();
    const name = facilityName || 'FacilityOS Site';
    const now = new Date().toISOString();

    this.store.sites[siteId] = {
      id: siteId,
      name,
      agent_key: agentKey,
      created_at: now,
      last_seen_at: null,
      last_sync_at: null,
    };
    this.store.claims[normalized] = { code: normalized, site_id: siteId, claimed_at: now };
    this._save();

    return { site_id: siteId, agent_key: agentKey, facility_name: name };
  }

  getSiteById(siteId) {
    return this.store.sites[siteId] || null;
  }

  getSiteByAgentKey(agentKey) {
    return Object.values(this.store.sites).find((s) => s.agent_key === agentKey) || null;
  }

  ingestEvents(siteId, events = []) {
    const accepted = [];
    const pushAlerts = [];
    const seen = new Set(
      this.store.events
        .filter((e) => e.site_id === siteId)
        .map((e) => `${e.entity_type}:${e.entity_id}:${e.updated_at}`)
    );

    for (const ev of events || []) {
      const dedupeKey = `${ev.entity_type}:${ev.entity_id}:${ev.updated_at}`;
      if (seen.has(dedupeKey)) {
        if (ev.outbox_id) accepted.push(ev.outbox_id);
        continue;
      }
      seen.add(dedupeKey);
      const id = generateId();
      const payload = ev.payload || {};
      this.store.events.push({
        id,
        site_id: siteId,
        outbox_id: ev.outbox_id || null,
        entity_type: ev.entity_type,
        entity_id: ev.entity_id,
        op: ev.op || 'update',
        payload,
        updated_at: ev.updated_at || new Date().toISOString(),
        received_at: new Date().toISOString(),
      });
      accepted.push(ev.outbox_id || id);

      if (
        ev.entity_type === 'water_test'
        && (ev.op || 'create') === 'create'
        && isNonCompliant(payload.is_compliant)
        && (payload.test_type || 'routine') === 'routine'
      ) {
        pushAlerts.push({
          title: 'Non-Compliant Pool Test',
          body: `${payload.pool_name || 'A pool'} failed compliance (${payload.test_date || 'today'}).`,
          pool_id: payload.pool_id,
        });
      }
    }

    const now = new Date().toISOString();
    if (this.store.sites[siteId]) {
      this.store.sites[siteId].last_sync_at = now;
      this.store.sites[siteId].last_seen_at = now;
    }
    this._save();
    return { accepted, total: events.length, push_alerts: pushAlerts };
  }

  heartbeat(siteId, pendingEvents = 0) {
    if (this.store.sites[siteId]) {
      this.store.sites[siteId].last_seen_at = new Date().toISOString();
      this._save();
    }
    return { ok: true, pending_events: pendingEvents };
  }

  getSiteSnapshot(siteId, limit = 100) {
    const site = this.getSiteById(siteId);
    if (!site) return null;
    const events = this.store.events
      .filter((e) => e.site_id === siteId)
      .sort((a, b) => (b.received_at || '').localeCompare(a.received_at || ''))
      .slice(0, limit);
    return {
      site: {
        id: site.id,
        name: site.name,
        last_seen_at: site.last_seen_at,
        last_sync_at: site.last_sync_at,
      },
      events,
    };
  }

  listSites() {
    return Object.values(this.store.sites).map(({ agent_key, ...rest }) => rest);
  }

  createUser({ siteId, email, password, role = 'manager', name }) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized || !password || password.length < 8) throw new Error('invalid_user_credentials');
    if (!this.store.sites[siteId]) throw new Error('site_not_found');
    const existing = Object.values(this.store.users).find((u) => u.email === normalized && u.site_id === siteId);
    if (existing) throw new Error('user_exists');

    const id = generateId();
    const now = new Date().toISOString();
    this.store.users[id] = {
      id,
      site_id: siteId,
      email: normalized,
      password_hash: hashPassword(password),
      role,
      name: name || normalized.split('@')[0],
      created_at: now,
    };
    this._save();
    return { id, email: normalized, role, site_id: siteId };
  }

  authenticateUser({ siteId, email, password }) {
    const normalized = String(email || '').trim().toLowerCase();
    const user = Object.values(this.store.users).find((u) => u.email === normalized && u.site_id === siteId);
    if (!user || !verifyPassword(password, user.password_hash)) throw new Error('invalid_credentials');
    const site = this.getSiteById(siteId);
    if (!site) throw new Error('site_not_found');
    return {
      user: { id: user.id, email: user.email, role: user.role, name: user.name, site_id: siteId },
      site: { id: site.id, name: site.name, last_seen_at: site.last_seen_at },
    };
  }

  getUserById(userId) {
    return this.store.users[userId] || null;
  }

  listUsersForSite(siteId) {
    return Object.values(this.store.users)
      .filter((u) => u.site_id === siteId)
      .map(({ password_hash, ...rest }) => rest);
  }

  addPushSubscription({ siteId, userId, subscription }) {
    if (!subscription?.endpoint) throw new Error('invalid_subscription');
    const id = generateId();
    this.store.push_subscriptions.push({
      id,
      site_id: siteId,
      user_id: userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys || {},
      created_at: new Date().toISOString(),
    });
    this._save();
    return { id };
  }

  listPushSubscriptions(siteId) {
    return (this.store.push_subscriptions || []).filter((s) => s.site_id === siteId);
  }

  getManagerDashboard(siteId, limit = 500) {
    const site = this.getSiteById(siteId);
    if (!site) return null;
    const events = this.store.events
      .filter((e) => e.site_id === siteId)
      .sort((a, b) => (b.received_at || '').localeCompare(a.received_at || ''))
      .slice(0, limit);
    return buildManagerSnapshot(events, { siteName: site.name });
  }
}

module.exports = { RelayDatabase, generateId, generateAgentKey };
