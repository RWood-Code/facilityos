function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const JSON_COLS = {
  iltp_document: ['attachments'],
  poolsafe_audit: ['attachments'],
  poolsafe_document: ['attachments'],
  staff_training_record: ['attachments'],
};

function parseJsonRow(row, table) {
  if (!row) return row;
  const out = { ...row };
  (JSON_COLS[table] || []).forEach((col) => {
    if (out[col] && typeof out[col] === 'string') {
      try { out[col] = JSON.parse(out[col]); } catch { out[col] = []; }
    }
  });
  if (out.is_current != null) out.is_current = !!out.is_current;
  if (out.is_read != null) out.is_read = !!out.is_read;
  return out;
}

function prepJsonFields(table, data) {
  const d = { ...data };
  (JSON_COLS[table] || []).forEach((col) => {
    if (d[col] != null && typeof d[col] !== 'string') d[col] = JSON.stringify(d[col]);
  });
  if (d.is_current != null) d.is_current = d.is_current ? 1 : 0;
  if (d.is_read != null) d.is_read = d.is_read ? 1 : 0;
  return d;
}

function registerCrud(h, prefix, table, { orderBy = 'created_at DESC', jsonTable = table, facilityFilter = true, hasUpdatedAt = true } = {}) {
  h(`${prefix}:list`, async ({ all }, { facility_id, staff_id, limit, unread_only } = {}) => {
    let sql = `SELECT * FROM ${table} WHERE 1=1`;
    const params = [];
    if (facilityFilter && facility_id) { sql += ` AND facility_id=?`; params.push(facility_id); }
    if (staff_id && table === 'staff_training_record') { sql += ` AND staff_id=?`; params.push(staff_id); }
    if (unread_only && table === 'notification') { sql += ` AND is_read=0`; }
    sql += ` ORDER BY ${orderBy}`;
    if (limit) { sql += ` LIMIT ?`; params.push(limit); }
    return await all(sql, params).map((r) => parseJsonRow(r, jsonTable));
  });

  h(`${prefix}:get`, async ({ get }, id) => parseJsonRow(await get(`SELECT * FROM ${table} WHERE id=?`, [id]), jsonTable));

  h(`${prefix}:create`, async ({ run }, data) => {
    const id = genId();
    const base = facilityFilter ? { facility_id: 'fac1', ...data } : { ...data };
    const d = prepJsonFields(jsonTable, base);
    const cols = ['id', ...Object.keys(d)];
    const placeholders = cols.map(() => '?').join(',');
    await run(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`, [id, ...Object.values(d)]);
    return { id };
  });

  h(`${prefix}:update`, async ({ run }, { id, ...data }) => {
    const d = prepJsonFields(jsonTable, data);
    if (hasUpdatedAt) {
      d.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
    const sets = Object.keys(d).map((k) => `${k}=?`).join(',');
    await run(`UPDATE ${table} SET ${sets} WHERE id=?`, [...Object.values(d), id]);
    return { id };
  });

  h(`${prefix}:delete`, async ({ run }, id) => {
    await run(`DELETE FROM ${table} WHERE id=?`, [id]);
    return { id };
  });
}

function registerV15Handlers(h) {
  registerCrud(h, 'notifications', 'notification', { orderBy: 'created_at DESC', facilityFilter: false, hasUpdatedAt: false });
  registerCrud(h, 'budget', 'maintenance_budget', { orderBy: 'year DESC, period_label' });
  registerCrud(h, 'iltp', 'iltp_document', { orderBy: 'upload_date DESC' });
  registerCrud(h, 'poolsafe_audits', 'poolsafe_audit', { orderBy: 'audit_date DESC' });
  registerCrud(h, 'poolsafe_docs', 'poolsafe_document', { orderBy: 'upload_date DESC' });
  registerCrud(h, 'training_records', 'staff_training_record', { orderBy: 'completed_date DESC', facilityFilter: false });

  h('notifications:unread_count', async ({ get }) => ({
    count: (await get(`SELECT COUNT(*) as n FROM notification WHERE is_read=0`))?.n || 0,
  }));

  h('notifications:mark_read', async ({ run }, { ids, all: markAll } = {}) => {
    if (markAll) {
      await run(`UPDATE notification SET is_read=1`);
      return { ok: true };
    }
    for (const id of (ids || [])) {
      await run(`UPDATE notification SET is_read=1 WHERE id=?`, [id]);
    }
    return { ok: true, count: (ids || []).length };
  });

  h('budget:summary', async ({ all, get }, { year } = {}) => {
    const y = year || new Date().getFullYear();
    const budgets = await all(`SELECT * FROM maintenance_budget WHERE year=? OR year IS NULL ORDER BY period_label`, [y]);
    const spentRow = await get(`
      SELECT COALESCE(SUM(COALESCE(parts_cost,0) + COALESCE(labor_cost,0)), 0) as total
      FROM work_order
      WHERE status='completed' AND strftime('%Y', completed_date)=?
    `, [String(y)]);
    const spent = spentRow?.total || 0;
    const totalBudget = budgets.reduce((s, b) => s + (b.budget_amount || 0), 0);
    return { year: y, budgets, totalBudget, spent, remaining: totalBudget - spent };
  });

  h('poolsafe_docs:supersede', async ({ run }, { id, supersedes_id }) => {
    if (supersedes_id) await run(`UPDATE poolsafe_document SET is_current=0 WHERE id=?`, [supersedes_id]);
    await run(`UPDATE poolsafe_document SET is_current=1, supersedes_id=? WHERE id=?`, [supersedes_id || null, id]);
    return { id };
  });
}

module.exports = { registerV15Handlers, genId };
