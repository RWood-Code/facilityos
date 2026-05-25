const { pushEventsToRelay, sendAgentHeartbeat } = require('./relayClient');

function parseOutboxRow(row) {
  let payload = {};
  try {
    payload = row.payload ? JSON.parse(row.payload) : {};
  } catch {
    payload = { raw: row.payload };
  }
  return {
    outbox_id: row.id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    op: row.op || 'update',
    payload,
    updated_at: row.updated_at,
  };
}

async function syncPendingOutbox({ relayUrl, siteId, agentKey, pendingRows, markSynced, markError }) {
  if (!siteId || !agentKey) {
    return { ok: false, error: 'not_paired', pushed: 0 };
  }
  if (!pendingRows?.length) {
    await sendAgentHeartbeat({ relayUrl, siteId, agentKey, pendingCount: 0 }).catch(() => {});
    return { ok: true, pushed: 0, pending: 0 };
  }

  const events = pendingRows.map(parseOutboxRow);
  try {
    const result = await pushEventsToRelay({ relayUrl, siteId, agentKey, events });
    const accepted = result.accepted || events.map((e) => e.outbox_id);
    markSynced(accepted);
    await sendAgentHeartbeat({
      relayUrl,
      siteId,
      agentKey,
      pendingCount: Math.max(0, pendingRows.length - accepted.length),
    }).catch(() => {});
    return { ok: true, pushed: accepted.length, accepted };
  } catch (e) {
    if (markError) markError(pendingRows.map((r) => r.id), e.message);
    return { ok: false, error: e.message, pushed: 0 };
  }
}

module.exports = {
  parseOutboxRow,
  syncPendingOutbox,
};
