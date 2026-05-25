#!/usr/bin/env node
/**
 * FacilityOS Cloud Sync Agent — polls local data server, pushes outbox to relay.
 */
const { syncPendingOutbox } = require('../../shared/cloud/syncRunner');

const SERVER_URL = (process.env.FACILITYOS_SERVER_URL || 'http://127.0.0.1:3847').replace(/\/$/, '');
const POLL_MS = Number(process.env.FACILITYOS_AGENT_POLL_MS || 30000);
const TERMINAL_ID = process.env.FACILITYOS_AGENT_TERMINAL || 'cloud-agent';

async function localQuery(channel, args = {}) {
  const res = await fetch(`${SERVER_URL}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, args, terminalId: TERMINAL_ID }),
  });
  const result = await res.json();
  if (!result.ok) throw new Error(result.error || `Local API ${res.status}`);
  return result.data;
}

async function runSyncCycle() {
  let creds;
  try {
    creds = await localQuery('cloud:agent_credentials');
  } catch (e) {
    console.warn('[agent] credentials unavailable:', e.message);
    return;
  }

  if (!creds?.enabled || !creds?.site_id || !creds?.agent_key) {
    console.log('[agent] cloud not paired/enabled — waiting');
    return;
  }

  const pending = await localQuery('cloud:outbox_pending', { limit: 50 });
  const result = await syncPendingOutbox({
    relayUrl: creds.relay_url,
    siteId: creds.site_id,
    agentKey: creds.agent_key,
    pendingRows: pending || [],
    markSynced: async (ids) => {
      await localQuery('cloud:outbox_ack', { ids });
    },
    markError: async (ids, message) => {
      await localQuery('cloud:outbox_error', { ids, message });
    },
  });

  if (result.pushed > 0) {
    console.log(`[agent] pushed ${result.pushed} event(s) to relay`);
  } else if (result.ok) {
    console.log('[agent] heartbeat ok, nothing pending');
  } else {
    console.warn('[agent] sync failed:', result.error);
  }
}

async function main() {
  console.log(`FacilityOS Cloud Agent → server ${SERVER_URL}, poll ${POLL_MS}ms`);
  await runSyncCycle();
  setInterval(runSyncCycle, POLL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
