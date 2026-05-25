const { SYNC_PROTOCOL_VERSION } = require('./syncProtocol');

async function relayFetch(relayUrl, path, { method = 'GET', body, agentKey } = {}) {
  const base = (relayUrl || '').replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json' };
  if (agentKey) headers.Authorization = `Bearer ${agentKey}`;

  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Relay HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function pairWithRelay({ relayUrl, code, facilityName }) {
  return relayFetch(relayUrl, '/api/pair/claim', {
    method: 'POST',
    body: {
      code,
      facility_name: facilityName,
      protocol_version: SYNC_PROTOCOL_VERSION,
    },
  });
}

async function pushEventsToRelay({ relayUrl, siteId, agentKey, events }) {
  if (!events?.length) return { accepted: [], skipped: true };
  return relayFetch(relayUrl, `/api/sites/${siteId}/sync/push`, {
    method: 'POST',
    agentKey,
    body: { events, protocol_version: SYNC_PROTOCOL_VERSION },
  });
}

async function sendAgentHeartbeat({ relayUrl, siteId, agentKey, pendingCount }) {
  return relayFetch(relayUrl, `/api/sites/${siteId}/heartbeat`, {
    method: 'POST',
    agentKey,
    body: { pending_events: pendingCount || 0, protocol_version: SYNC_PROTOCOL_VERSION },
  });
}

module.exports = {
  relayFetch,
  pairWithRelay,
  pushEventsToRelay,
  sendAgentHeartbeat,
};
