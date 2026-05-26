const { writeAudit } = require('./audit');

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Register all FacilityOS data channels on a db API: { run, get, all }.
 * Used by the network server (better-sqlite3) and optional local sql.js fallback.
 */
function registerHandlers(h) {
  h('facilities:list', ({ all }) => all(`SELECT * FROM facility WHERE is_active=1 ORDER BY name`));

  h('pools:list', ({ all }, { facility_id } = {}) => {
    if (facility_id) return all(`SELECT * FROM pool WHERE is_active=1 AND facility_id=? ORDER BY sort_order,name`, [facility_id]);
    return all(`SELECT * FROM pool WHERE is_active=1 ORDER BY sort_order,name`);
  });
  h('pools:get', ({ get }, id) => get(`SELECT * FROM pool WHERE id=? AND is_active=1`, [id]));
  h('pools:create', ({ run }, d) => {
    const id = genId();
    const custom_limits = d.custom_limits != null
      ? (typeof d.custom_limits === 'string' ? d.custom_limits : JSON.stringify(d.custom_limits))
      : null;
    run(`INSERT INTO pool (id,facility_id,name,type,location,volume_litres,max_patrons,sort_order,custom_limits,temp_min,temp_max) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [id, d.facility_id || 'fac1', d.name, d.type || 'pool', d.location || null, d.volume_litres || null, d.max_patrons || null, d.sort_order || 99, custom_limits, d.temp_min ?? null, d.temp_max ?? null]);
    return { id };
  });
  h('pools:update', ({ run }, { id, ...d }) => {
    if (d.custom_limits != null && typeof d.custom_limits !== 'string') {
      d.custom_limits = JSON.stringify(d.custom_limits);
    }
    const sets = Object.keys(d).map(k => `${k}=?`).join(',');
    run(`UPDATE pool SET ${sets} WHERE id=?`, [...Object.values(d), id]);
    return { id };
  });
  h('pools:delete', ({ run }, id) => { run(`UPDATE pool SET is_active=0 WHERE id=?`, [id]); return { id }; });

  h('tests:list', ({ all }, { pool_id, limit, from_date } = {}) => {
    let sql = `SELECT * FROM test_result WHERE 1=1`;
    const p = [];
    if (pool_id) { sql += ` AND pool_id=?`; p.push(pool_id); }
    if (from_date) { sql += ` AND test_date>=?`; p.push(from_date); }
    sql += ` ORDER BY test_date DESC, test_time DESC LIMIT ?`;
    p.push(limit || 200);
    return all(sql, p);
  });
  h('tests:latest_per_pool', ({ all }) => all(`
      SELECT tr.* FROM test_result tr
      INNER JOIN (
        SELECT pool_id, MAX(test_date||' '||COALESCE(test_time,'00:00')) as max_dt
        FROM test_result GROUP BY pool_id
      ) latest ON tr.pool_id=latest.pool_id
        AND (tr.test_date||' '||COALESCE(tr.test_time,'00:00'))=latest.max_dt
    `));
  h('tests:create', ({ run, get }, d) => {
    const id = genId();
    run(`INSERT INTO test_result
      (id,pool_id,test_type,test_date,test_time,tested_by,ph,free_chlorine,total_available_chlorine,combined_chlorine,temperature,total_alkalinity,total_hardness,tds,turbidity,cyanuric_acid,is_compliant,action_taken,notes,retest_required)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, d.pool_id, d.test_type || 'routine', d.test_date, d.test_time || null, d.tested_by || null,
        d.ph ?? null, d.free_chlorine ?? null, d.total_available_chlorine ?? null, d.combined_chlorine ?? null,
        d.temperature ?? null, d.total_alkalinity ?? null, d.total_hardness ?? null, d.tds ?? null,
        d.turbidity ?? null, d.cyanuric_acid ?? null,
        d.is_compliant == null ? null : (d.is_compliant ? 1 : 0),
        d.action_taken || null, d.notes || null, d.retest_required ? 1 : 0]);
    if ((d.is_compliant === 0 || d.is_compliant === false) && (d.test_type || 'routine') === 'routine') {
      try {
        const pool = get(`SELECT name FROM pool WHERE id=?`, [d.pool_id]);
        run(`INSERT INTO notification (id,type,title,message,related_id,link_module) VALUES (?,?,?,?,?,?)`,
          [genId(), 'pool_non_compliance', 'Non-Compliant Pool Test',
            `Pool "${pool?.name || 'Unknown'}" failed compliance testing. Immediate action required.`,
            d.pool_id, 'poolhistory']);
      } catch { /* notification table may not exist pre-migration */ }
    }
    writeAudit({ run, get, all: () => [] }, {
      action: 'test.create',
      entity_type: 'test_result',
      entity_id: id,
      actor: d.tested_by || null,
      details: { pool_id: d.pool_id, test_date: d.test_date, is_compliant: d.is_compliant },
    });
    const { enqueueIfCloudEnabled } = require('../cloud/outbox');
    enqueueIfCloudEnabled({ run, get }, {
      entity_type: 'water_test',
      entity_id: id,
      op: 'create',
      payload: { pool_id: d.pool_id, test_date: d.test_date, is_compliant: d.is_compliant },
    });
    return { id };
  });

  h('closures:list', ({ all }, { pool_id } = {}) => {
    if (pool_id) return all(`SELECT * FROM pool_closure WHERE pool_id=? ORDER BY closed_at DESC`, [pool_id]);
    return all(`SELECT * FROM pool_closure ORDER BY closed_at DESC`);
  });
  h('closures:create', ({ run }, d) => {
    const id = genId();
    run(`INSERT INTO pool_closure (id,pool_id,reason,closed_at,closed_by,notes) VALUES (?,?,?,?,?,?)`,
      [id, d.pool_id, d.reason, d.closed_at || new Date().toISOString(), d.closed_by || null, d.notes || null]);
    return { id };
  });

  h('staff:list', ({ all }, { facility_id, status } = {}) => {
    let sql = `SELECT * FROM staff WHERE 1=1`;
    const p = [];
    if (facility_id) { sql += ` AND facility_id=?`; p.push(facility_id); }
    if (status) { sql += ` AND status=?`; p.push(status); }
    sql += ` ORDER BY last_name,first_name`;
    return all(sql, p);
  });
  h('staff:get', ({ get }, id) => get(`SELECT * FROM staff WHERE id=?`, [id]));
  h('staff:by_pin', ({ get }, pin) => get(`SELECT * FROM staff WHERE pin=? AND status='active'`, [pin]));
  h('staff:create', ({ run }, d) => {
    const id = genId();
    run(`INSERT INTO staff (id,facility_id,first_name,last_name,email,phone,role,status,pin,nzrrp_number,nzrrp_expiry,notes,employee_number,default_pay_component_id,base_hourly_rate,employment_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, d.facility_id || 'fac1', d.first_name, d.last_name, d.email || null, d.phone || null, d.role || 'lifeguard', d.status || 'active', d.pin || null, d.nzrrp_number || null, d.nzrrp_expiry || null, d.notes || null, d.employee_number || null, d.default_pay_component_id || null, d.base_hourly_rate ?? null, d.employment_type || 'casual']);
    return { id };
  });
  h('staff:update', ({ run }, { id, ...d }) => {
    const sets = Object.keys(d).map(k => `${k}=?`).join(',');
    run(`UPDATE staff SET ${sets},updated_at=datetime('now') WHERE id=?`, [...Object.values(d), id]);
    return { id };
  });
  h('staff:delete', ({ run }, id) => { run(`UPDATE staff SET status='inactive' WHERE id=?`, [id]); return { id }; });

  h('qualifications:list', ({ all }, { staff_id } = {}) => {
    if (staff_id) return all(`SELECT * FROM qualification WHERE staff_id=? ORDER BY expiry_date ASC`, [staff_id]);
    return all(`SELECT * FROM qualification ORDER BY expiry_date ASC`);
  });
  h('qualifications:create', ({ run }, d) => {
    const id = genId();
    run(`INSERT INTO qualification (id,staff_id,qualification,issuer,issued_date,expiry_date,cert_number,notes) VALUES (?,?,?,?,?,?,?,?)`,
      [id, d.staff_id, d.qualification, d.issuer || null, d.issued_date || null, d.expiry_date || null, d.cert_number || null, d.notes || null]);
    return { id };
  });
  h('qualifications:update', ({ run }, { id, ...d }) => {
    const sets = Object.keys(d).map(k => `${k}=?`).join(',');
    run(`UPDATE qualification SET ${sets} WHERE id=?`, [...Object.values(d), id]);
    return { id };
  });
  h('qualifications:delete', ({ run }, id) => { run(`DELETE FROM qualification WHERE id=?`, [id]); return { id }; });

  h('assets:list', ({ all }, { facility_id, status, asset_type } = {}) => {
    let sql = `SELECT * FROM asset WHERE status != 'retired'`;
    const p = [];
    if (facility_id) { sql += ` AND facility_id=?`; p.push(facility_id); }
    if (status) { sql += ` AND status=?`; p.push(status); }
    if (asset_type) { sql += ` AND asset_type=?`; p.push(asset_type); }
    sql += ` ORDER BY location,name`;
    return all(sql, p);
  });
  h('assets:get', ({ get }, id) => get(`SELECT * FROM asset WHERE id=?`, [id]));
  h('assets:create', ({ run }, d) => {
    const id = genId();
    run(`INSERT INTO asset (id,facility_id,name,asset_type,category,location,manufacturer,model_number,serial_number,purchase_date,purchase_cost,warranty_expiry,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, d.facility_id || 'fac1', d.name, d.asset_type || 'other', d.category || null, d.location, d.manufacturer || null, d.model_number || null, d.serial_number || null, d.purchase_date || null, d.purchase_cost || null, d.warranty_expiry || null, d.status || 'operational', d.notes || null]);
    return { id };
  });
  h('assets:update', ({ run }, { id, ...d }) => {
    const sets = Object.keys(d).map(k => `${k}=?`).join(',');
    run(`UPDATE asset SET ${sets},updated_at=datetime('now') WHERE id=?`, [...Object.values(d), id]);
    return { id };
  });
  h('assets:retire', ({ run }, id) => { run(`UPDATE asset SET status='retired' WHERE id=?`, [id]); return { id }; });

  h('workorders:list', ({ all }, { status, priority } = {}) => {
    let sql = `SELECT wo.*, a.name as asset_name FROM work_order wo LEFT JOIN asset a ON a.id=wo.asset_id WHERE 1=1`;
    const p = [];
    if (status && status !== 'all') { sql += ` AND wo.status=?`; p.push(status); }
    if (priority) { sql += ` AND wo.priority=?`; p.push(priority); }
    sql += ` ORDER BY CASE wo.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, wo.created_at DESC`;
    return all(sql, p);
  });
  h('workorders:create', ({ run }, d) => {
    const id = genId();
    run(`INSERT INTO work_order (id,title,description,asset_id,location,priority,status,assigned_to,due_date,estimated_hours,parts_cost,labor_cost) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, d.title, d.description || null, d.asset_id || null, d.location, d.priority || 'medium', d.status || 'open', d.assigned_to || null, d.due_date || null, d.estimated_hours || null, d.parts_cost || null, d.labor_cost || null]);
    return { id };
  });
  h('workorders:update', ({ run }, { id, ...d }) => {
    const sets = Object.keys(d).map(k => `${k}=?`).join(',');
    run(`UPDATE work_order SET ${sets},updated_at=datetime('now') WHERE id=?`, [...Object.values(d), id]);
    return { id };
  });
  h('workorders:delete', ({ run }, id) => { run(`DELETE FROM work_order WHERE id=?`, [id]); return { id }; });

  h('schedules:list', ({ all }, { is_active } = {}) => {
    let sql = `SELECT ms.*, a.name as asset_name FROM maintenance_schedule ms LEFT JOIN asset a ON a.id=ms.asset_id WHERE 1=1`;
    const p = [];
    if (is_active !== undefined) { sql += ` AND ms.is_active=?`; p.push(is_active ? 1 : 0); }
    sql += ` ORDER BY ms.next_due ASC`;
    return all(sql, p);
  });
  h('schedules:create', ({ run }, d) => {
    const id = genId();
    run(`INSERT INTO maintenance_schedule (id,asset_id,task_name,description,frequency,assigned_to,estimated_hours,category,next_due,is_active) VALUES (?,?,?,?,?,?,?,?,?,1)`,
      [id, d.asset_id || null, d.task_name, d.description || null, d.frequency || 'monthly', d.assigned_to || null, d.estimated_hours || null, d.category || null, d.next_due || null]);
    return { id };
  });
  h('schedules:update', ({ run }, { id, ...d }) => {
    const sets = Object.keys(d).map(k => `${k}=?`).join(',');
    run(`UPDATE maintenance_schedule SET ${sets} WHERE id=?`, [...Object.values(d), id]);
    return { id };
  });
  h('schedules:complete', ({ get, run }, { id, completed_date }) => {
    const sched = get(`SELECT * FROM maintenance_schedule WHERE id=?`, [id]);
    if (!sched) return { error: 'Not found' };
    const days = { daily: 1, weekly: 7, monthly: 30, quarterly: 91, semi_annual: 182, annual: 365 }[sched.frequency] || 30;
    const next = new Date(); next.setDate(next.getDate() + days);
    run(`UPDATE maintenance_schedule SET last_completed=?,next_due=? WHERE id=?`,
      [completed_date || new Date().toISOString().slice(0, 10), next.toISOString().slice(0, 10), id]);
    return { id };
  });

  h('steamchecks:list', ({ all }, { pool_id, limit } = {}) => {
    let sql = `SELECT * FROM steam_room_check WHERE 1=1`;
    const p = [];
    if (pool_id) { sql += ` AND pool_id=?`; p.push(pool_id); }
    sql += ` ORDER BY check_date DESC, check_time DESC LIMIT ?`;
    p.push(limit || 100);
    return all(sql, p);
  });
  h('steamchecks:create', ({ run, get }, d) => {
    const id = genId();
    run(`INSERT INTO steam_room_check (id,pool_id,check_date,check_time,checked_by,temperature,humidity,patron_count,is_clean,towels_stocked,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [id, d.pool_id, d.check_date, d.check_time || null, d.checked_by || null, d.temperature ?? null, d.humidity ?? null, d.patron_count ?? null, d.is_clean ? 1 : 0, d.towels_stocked ? 1 : 0, d.notes || null]);
    const { enqueueIfCloudEnabled } = require('../cloud/outbox');
    enqueueIfCloudEnabled({ run, get }, {
      entity_type: 'steam_check',
      entity_id: id,
      op: 'create',
      payload: { pool_id: d.pool_id, check_date: d.check_date },
    });
    return { id };
  });

  h('reports:compliance_summary', ({ all }, { days } = {}) => {
    const ago = new Date(); ago.setDate(ago.getDate() - (days || 30));
    const from = ago.toISOString().slice(0, 10);
    return all(`
      SELECT p.id, p.name, p.type,
        COUNT(tr.id) as test_count,
        SUM(CASE WHEN tr.is_compliant=1 THEN 1 ELSE 0 END) as compliant_count,
        SUM(CASE WHEN tr.is_compliant=0 THEN 1 ELSE 0 END) as non_compliant_count,
        ROUND(AVG(tr.free_chlorine), 2) as avg_fac,
        ROUND(AVG(tr.ph), 2) as avg_ph,
        MAX(tr.test_date) as last_tested
      FROM pool p
      LEFT JOIN test_result tr ON tr.pool_id=p.id AND tr.test_date>=? AND tr.test_type='routine'
      WHERE p.is_active=1
      GROUP BY p.id ORDER BY p.sort_order
    `, [from]);
  });
  h('reports:workorder_summary', ({ get }) => ({
    open: (get(`SELECT COUNT(*) as n FROM work_order WHERE status='open'`) || { n: 0 }).n,
    in_progress: (get(`SELECT COUNT(*) as n FROM work_order WHERE status='in_progress'`) || { n: 0 }).n,
    on_hold: (get(`SELECT COUNT(*) as n FROM work_order WHERE status='on_hold'`) || { n: 0 }).n,
    completed: (get(`SELECT COUNT(*) as n FROM work_order WHERE status='completed'`) || { n: 0 }).n,
    urgent: (get(`SELECT COUNT(*) as n FROM work_order WHERE status NOT IN ('completed','cancelled') AND priority='urgent'`) || { n: 0 }).n,
  }));
  h('reports:overdue_schedules', ({ all }) =>
    all(`SELECT ms.*, a.name as asset_name FROM maintenance_schedule ms LEFT JOIN asset a ON a.id=ms.asset_id WHERE ms.is_active=1 AND ms.next_due <= date('now') ORDER BY ms.next_due`)
  );

  h('settings:get', ({ get }, key) => (get(`SELECT value FROM setting WHERE key=?`, [key]) || {}).value);
  h('settings:set', ({ run }, { key, value, actor, terminal_id }) => {
    run(`INSERT OR REPLACE INTO setting (key,value) VALUES (?,?)`, [key, String(value)]);
    writeAudit({ run, get: () => null, all: () => [] }, {
      action: 'settings.set',
      entity_type: 'setting',
      entity_id: key,
      actor: actor || null,
      terminal_id: terminal_id || null,
      details: { value: String(value) },
    });
    return { ok: true };
  });
  h('settings:all', ({ all }) => {
    const rows = all(`SELECT * FROM setting`);
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  });

  h('modules:list', ({ all }) => all(`SELECT * FROM module_registry ORDER BY sort_order`));
  h('modules:set_enabled', ({ run }, { module_key, enabled }) => {
    run(`UPDATE module_registry SET enabled=? WHERE module_key=?`, [enabled ? 1 : 0, module_key]);
    const keys = { rostering: 'show_rostering', dosing: 'show_dosing', steam: 'show_steam', closures: 'show_closures' };
    const settingKey = keys[module_key];
    if (settingKey) run(`INSERT OR REPLACE INTO setting (key,value) VALUES (?,?)`, [settingKey, enabled ? '1' : '0']);
    return { ok: true };
  });

  const { registerExtendedHandlers } = require('./handlers-extended');
  registerExtendedHandlers(h);
}

function buildHandlerMap() {
  const map = {};
  const h = (channel, fn) => { map[channel] = fn; };
  registerHandlers(h);
  return map;
}

const HANDLER_MAP = buildHandlerMap();

function executeQuery(dbApi, channel, args) {
  const fn = HANDLER_MAP[channel];
  if (!fn) throw new Error(`Unknown channel: ${channel}`);
  return fn(dbApi, args);
}

module.exports = { registerHandlers, executeQuery, HANDLER_MAP, genId };
