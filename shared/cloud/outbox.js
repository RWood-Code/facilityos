const { genId } = require('../db/audit');

async function isCloudEnabled(get) {
  const row = await get(`SELECT value FROM setting WHERE key='cloud_enabled'`);
  return (row || {}).value === '1';
}

async function enqueueOutbox(run, { entity_type, entity_id, op = 'create', payload }) {
  if (!entity_type || !entity_id) return null;
  const id = genId();
  const payloadJson = payload != null
    ? (typeof payload === 'string' ? payload : JSON.stringify(payload))
    : null;
  await run(
    `INSERT INTO cloud_sync_outbox (id, entity_type, entity_id, op, payload, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [id, entity_type, entity_id, op, payloadJson]
  );
  return id;
}

async function enqueueIfCloudEnabled(ctx, event) {
  const { run, get } = ctx;
  if (!isCloudEnabled(get)) return null;
  return enqueueOutbox(run, event);
}

module.exports = {
  isCloudEnabled,
  enqueueOutbox,
  enqueueIfCloudEnabled,
};
