const { genId } = require('../db/audit');

function isCloudEnabled(get) {
  return (get(`SELECT value FROM setting WHERE key='cloud_enabled'`) || {}).value === '1';
}

function enqueueOutbox(run, { entity_type, entity_id, op = 'create', payload }) {
  if (!entity_type || !entity_id) return null;
  const id = genId();
  const payloadJson = payload != null
    ? (typeof payload === 'string' ? payload : JSON.stringify(payload))
    : null;
  run(
    `INSERT INTO cloud_sync_outbox (id, entity_type, entity_id, op, payload, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [id, entity_type, entity_id, op, payloadJson]
  );
  return id;
}

function enqueueIfCloudEnabled(ctx, event) {
  const { run, get } = ctx;
  if (!isCloudEnabled(get)) return null;
  return enqueueOutbox(run, event);
}

module.exports = {
  isCloudEnabled,
  enqueueOutbox,
  enqueueIfCloudEnabled,
};
