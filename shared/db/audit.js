function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Write an immutable audit record. Pass dbApi from createDbApi(db).
 */
function writeAudit(dbApi, { action, entity_type, entity_id, actor, terminal_id, details }) {
  if (!dbApi?.run) return;
  const detailsJson = details != null
    ? (typeof details === 'string' ? details : JSON.stringify(details))
    : null;
  dbApi.run(
    `INSERT INTO audit_log (id, action, entity_type, entity_id, actor, terminal_id, details)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [genId(), action, entity_type || null, entity_id || null, actor || null, terminal_id || null, detailsJson]
  );
}

module.exports = { writeAudit, genId };
