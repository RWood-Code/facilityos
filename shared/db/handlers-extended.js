const { writeAudit } = require('./audit');
const {
  resolveModuleAccess,
  syncSettingsFromModules,
  PLAN_ENTITLEMENTS,
  PLAN_LABELS,
  ALL_MODULE_KEYS,
} = require('./entitlements');
const {
  MODULE_LABELS,
  modulesFromPlan,
  generateLicenceKey,
} = require('./licenceGenerator');
const { shiftHours, resolvePaySnapshot, computeAmount } = require('./rosterPay');

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const ROSTER_SHIFT_FIELDS = new Set([
  'facility_id', 'location_id', 'role_id', 'shift_date', 'start_time', 'end_time',
  'break_minutes', 'notes', 'status', 'is_open', 'pay_component_id', 'headcount',
]);

function patchRosterShift(d) {
  const patch = {};
  for (const [k, v] of Object.entries(d)) {
    if (!ROSTER_SHIFT_FIELDS.has(k)) continue;
    if (k === 'is_open') patch[k] = v ? 1 : 0;
    else if (k === 'headcount') patch[k] = Math.max(1, parseInt(v, 10) || 1);
    else patch[k] = v;
  }
  return patch;
}

function syncShiftOpenState(run, get, shift_id) {
  const shift = get(`SELECT headcount FROM roster_shift WHERE id=?`, [shift_id]);
  const headcount = Math.max(1, shift?.headcount || 1);
  const active = get(`SELECT COUNT(*) as n FROM roster_assignment WHERE shift_id=? AND status!='cancelled'`, [shift_id])?.n || 0;
  run(`UPDATE roster_shift SET is_open=? WHERE id=?`, [active < headcount ? 1 : 0, shift_id]);
}

function planFromLicenceKey(licenceKey) {
  const key = String(licenceKey || '').toUpperCase();
  if (key.includes('-PRO-')) return 'professional';
  if (key.includes('-ENT-')) return 'enterprise';
  if (key.includes('-STD-')) return 'standard';
  if (key.includes('-TRIAL-')) return 'trial';
  return 'standard';
}

function applyVerifiedLicence(db, verified, { source = 'manual' } = {}) {
  const { run, get } = db;
  const {
    licence_key,
    expires_at,
    organisation,
    plan,
    max_terminals,
    features,
    modules,
  } = verified;

  const selectedPlan = plan || planFromLicenceKey(licence_key);
  const existing = get(`SELECT id FROM licence WHERE licence_key=?`, [licence_key]);
  let featuresJson = features ? (typeof features === 'string' ? features : JSON.stringify(features)) : null;
  if (!featuresJson && modules && typeof modules === 'object') {
    const { featuresFromModules } = require('./licenceGenerator');
    const f = featuresFromModules(selectedPlan, modules);
    featuresJson = f ? JSON.stringify(f) : null;
  }
  const { normalizeModuleSelection } = require('./licenceGenerator');
  const effectiveModules = modules && typeof modules === 'object'
    ? normalizeModuleSelection(selectedPlan, modules)
    : resolveModuleAccess(selectedPlan, featuresJson);

  if (existing) {
    run(`UPDATE licence SET expires_at=?, organisation=?, plan=?, max_terminals=?, features=COALESCE(?, features), is_active=1, last_validated=datetime('now') WHERE licence_key=?`,
      [expires_at, organisation || null, selectedPlan, max_terminals || 10, featuresJson, licence_key]);
  } else {
    run(`INSERT INTO licence (id,licence_key,organisation,plan,expires_at,max_terminals,features,is_active,last_validated) VALUES (?,?,?,?,?,?,?,1,datetime('now'))`,
      [genId(), licence_key, organisation || null, selectedPlan, expires_at, max_terminals || 10, featuresJson]);
  }
  syncSettingsFromModules(run, effectiveModules);
  writeAudit({ run, get, all: () => [] }, {
    action: 'licence.activate',
    entity_type: 'licence',
    entity_id: licence_key,
    details: { expires_at, organisation, plan: selectedPlan, modules: effectiveModules, source },
  });
  return { ok: true, modules: effectiveModules, licence_key, expires_at };
}

function registerExtendedHandlers(h) {
  h('closures:reopen', ({ run }, { id, reopened_by }) => {
    run(`UPDATE pool_closure SET reopened_at=datetime('now'), reopened_by=? WHERE id=?`, [reopened_by || null, id]);
    return { id };
  });

  h('licence:status', ({ get }) => {
    const lic = get(`SELECT * FROM licence WHERE is_active=1 ORDER BY expires_at DESC LIMIT 1`);
    if (!lic) {
      return {
        valid: false,
        reason: 'no_licence',
        daysRemaining: 0,
        msRemaining: 0,
        isTrial: false,
        modules: resolveModuleAccess('trial', null),
      };
    }
    const expires = new Date(lic.expires_at);
    const now = new Date();
    const msRemaining = expires.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msRemaining / 86400000);
    const isTrial = lic.plan === 'trial';
    const grace = isTrial
      ? 0
      : parseInt((get(`SELECT value FROM setting WHERE key='licence_grace_days'`) || {}).value || '7', 10);
    const valid = daysRemaining >= -grace;
    const modules = resolveModuleAccess(lic.plan, lic.features);
    return {
      valid,
      daysRemaining,
      msRemaining,
      graceDays: grace,
      isTrial,
      plan: lic.plan,
      planLabel: PLAN_LABELS[lic.plan] || lic.plan,
      organisation: lic.organisation,
      licence_key: lic.licence_key,
      expires_at: lic.expires_at,
      max_terminals: lic.max_terminals,
      modules,
      moduleList: ALL_MODULE_KEYS.filter((k) => modules[k]),
      reason: valid ? null : 'expired',
      inGrace: !isTrial && daysRemaining < 0 && daysRemaining >= -grace,
    };
  });

  h('licence:ensure_trial', ({ run, get }) => {
    const existing = get(`SELECT id FROM licence WHERE is_active=1 LIMIT 1`);
    if (existing) return { created: false };
    const { generateLicenceKey } = require('./licenceGenerator');
    const licence_key = generateLicenceKey({ organisation: 'Evaluation', plan: 'trial' });
    const modules = resolveModuleAccess('trial', null);
    run(
      `INSERT INTO licence (id,licence_key,organisation,plan,expires_at,max_terminals,is_active,last_validated)
       VALUES (?,?,?,?,datetime('now','+7 days'),?,1,datetime('now'))`,
      [genId(), licence_key, 'Evaluation', 'trial', 5],
    );
    syncSettingsFromModules(run, modules);
    return { created: true, licence_key, expires_at: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) };
  });

  h('licence:plans', () => ({
    plans: Object.entries(PLAN_LABELS).map(([id, label]) => ({ id, label, modules: PLAN_ENTITLEMENTS[id] || [] })),
    moduleLabels: MODULE_LABELS,
    allModules: ALL_MODULE_KEYS,
  }));

  h('licence:generate', () => {
    throw new Error('Licence generation is vendor-only. Contact your FacilityOS supplier.');
  });

  h('licence:renew', () => {
    throw new Error('Licence renewal requires a new key from your vendor.');
  });

  h('licence:plan_modules', (_db, { plan } = {}) => ({
    plan: plan || 'standard',
    modules: modulesFromPlan(plan || 'standard'),
  }));

  h('licence:set_features', ({ run, get }, { features }) => {
    const lic = get(`SELECT * FROM licence WHERE is_active=1 ORDER BY expires_at DESC LIMIT 1`);
    if (!lic) throw new Error('No active licence');
    const featuresJson = JSON.stringify(features || {});
    run(`UPDATE licence SET features=? WHERE id=?`, [featuresJson, lic.id]);
    const modules = resolveModuleAccess(lic.plan, featuresJson);
    syncSettingsFromModules(run, modules);
    writeAudit({ run, get, all: () => [] }, {
      action: 'licence.set_features',
      entity_type: 'licence',
      entity_id: lic.licence_key,
      details: features,
    });
    return { modules };
  });

  h('licence:sync_modules', ({ run, get }) => {
    const lic = get(`SELECT * FROM licence WHERE is_active=1 ORDER BY expires_at DESC LIMIT 1`);
    if (!lic) return { ok: false };
    const modules = resolveModuleAccess(lic.plan, lic.features);
    syncSettingsFromModules(run, modules);
    return { modules };
  });

  h('licence:file_info', () => {
    const { getLicenceFileInfo } = require('./licencePaths');
    return getLicenceFileInfo();
  });

  h('licence:sync_from_file', (db) => {
    const { readLicenceFile } = require('./licencePaths');
    const { parseLicenceDocumentText } = require('./licenceSigning');
    const raw = readLicenceFile();
    if (!raw) return { synced: false, reason: 'no_file' };
    const verified = parseLicenceDocumentText(raw);
    const result = applyVerifiedLicence(db, verified, { source: 'file' });
    return { synced: true, ...result };
  });

  h('licence:activate', (db, args = {}) => {
    const { parseLicenceInput, LICENCE_FORMAT } = require('./licenceSigning');
    const { writeLicenceFile } = require('./licencePaths');

    const raw = args.licence_file || args.activation_code;
    if (!raw) {
      if (args.licence_key || args.expires_at) {
        throw new Error(
          'Manual licence entry is not permitted. Install the facilityos.lic file from your vendor.',
        );
      }
      throw new Error('Licence file is required');
    }

    const verified = parseLicenceInput(raw);

    const trimmed = String(raw).trim();
    if (trimmed.startsWith('{')) {
      try {
        const doc = JSON.parse(trimmed);
        if (doc.format === LICENCE_FORMAT) {
          writeLicenceFile(trimmed.endsWith('\n') ? trimmed : `${trimmed}\n`);
        }
      } catch {
        /* verified already; skip file write if JSON unreadable */
      }
    }

    return applyVerifiedLicence(db, verified, { source: 'activate' });
  });

  h('saved_reports:list', ({ all }) => all(`SELECT * FROM saved_report ORDER BY created_at DESC`));
  h('saved_reports:create', ({ run }, d) => {
    const id = genId();
    run(`INSERT INTO saved_report (id,name,report_type,config) VALUES (?,?,?,?)`,
      [id, d.name, d.report_type, JSON.stringify(d.config || {})]);
    return { id };
  });
  h('saved_reports:delete', ({ run }, id) => { run(`DELETE FROM saved_report WHERE id=?`, [id]); return { id }; });

  const csvEscape = (v) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  h('export:tests', ({ all }, { from_date, pool_id } = {}) => {
    let sql = `SELECT tr.*, p.name as pool_name FROM test_result tr JOIN pool p ON p.id=tr.pool_id WHERE 1=1`;
    const p = [];
    if (pool_id) { sql += ` AND tr.pool_id=?`; p.push(pool_id); }
    if (from_date) { sql += ` AND tr.test_date>=?`; p.push(from_date); }
    sql += ` ORDER BY tr.test_date DESC, tr.test_time DESC`;
    const rows = all(sql, p);
    const headers = ['pool_name', 'test_date', 'test_time', 'tested_by', 'ph', 'free_chlorine', 'total_available_chlorine', 'combined_chlorine', 'temperature', 'is_compliant', 'notes'];
    const lines = [headers.join(',')];
    rows.forEach((r) => lines.push(headers.map((k) => csvEscape(r[k])).join(',')));
    return { csv: lines.join('\n'), filename: `water-tests-${new Date().toISOString().slice(0, 10)}.csv`, count: rows.length };
  });

  h('export:staff', ({ all }) => {
    const rows = all(`SELECT first_name,last_name,email,phone,role,status,nzrrp_number,nzrrp_expiry FROM staff WHERE status='active' ORDER BY last_name`);
    const headers = Object.keys(rows[0] || { first_name: '', last_name: '', email: '', phone: '', role: '', status: '' });
    const lines = [headers.join(',')];
    rows.forEach((r) => lines.push(headers.map((k) => csvEscape(r[k])).join(',')));
    return { csv: lines.join('\n'), filename: 'staff-export.csv', count: rows.length };
  });

  h('export:roster', ({ all }, { week_start, week_end } = {}) => {
    const rows = all(`
      SELECT rs.shift_date, rs.start_time, rs.end_time, rl.name as location, rr.name as role,
        s.first_name||' '||s.last_name as staff_name, rs.status, rs.is_open
      FROM roster_shift rs
      LEFT JOIN roster_location rl ON rl.id=rs.location_id
      LEFT JOIN roster_role rr ON rr.id=rs.role_id
      LEFT JOIN roster_assignment ra ON ra.shift_id=rs.id AND ra.status!='cancelled'
      LEFT JOIN staff s ON s.id=ra.staff_id
      WHERE rs.shift_date>=? AND rs.shift_date<=?
      ORDER BY rs.shift_date, rs.start_time
    `, [week_start, week_end]);
    const headers = ['shift_date', 'start_time', 'end_time', 'location', 'role', 'staff_name', 'status', 'is_open'];
    const lines = [headers.join(',')];
    rows.forEach((r) => lines.push(headers.map((k) => csvEscape(r[k])).join(',')));
    return { csv: lines.join('\n'), filename: `roster-${week_start}.csv`, count: rows.length };
  });

  h('export:payroll', ({ all }, { week_start, week_end, source } = {}) => {
    const useApproved = source === 'approved';
    let rows;
    if (useApproved) {
      rows = all(`
        SELECT te.work_date as shift_date, rs.start_time, rs.end_time, rs.break_minutes,
          rl.name as location, rr.name as role,
          s.employee_number, s.first_name||' '||s.last_name as staff_name,
          pc.export_code as pay_component_code, pc.name as pay_component_name,
          pc.rate_multiplier, te.hours, ra.pay_rate, ra.pay_type,
          rs.status as roster_status, te.status as timesheet_status
        FROM timesheet_entry te
        JOIN staff s ON s.id=te.staff_id
        LEFT JOIN roster_shift rs ON rs.id=te.shift_id
        LEFT JOIN roster_location rl ON rl.id=rs.location_id
        LEFT JOIN roster_role rr ON rr.id=rs.role_id
        LEFT JOIN roster_assignment ra ON ra.shift_id=te.shift_id AND ra.staff_id=te.staff_id AND ra.status!='cancelled'
        LEFT JOIN pay_component pc ON pc.id=COALESCE(te.pay_component_id, ra.pay_component_id, rs.pay_component_id)
        WHERE te.work_date>=? AND te.work_date<=? AND te.status='approved'
        ORDER BY te.work_date, rs.start_time, staff_name
      `, [week_start, week_end]);
    } else {
      rows = all(`
        SELECT rs.shift_date, rs.start_time, rs.end_time, rs.break_minutes,
          rl.name as location, rr.name as role,
          s.employee_number, s.first_name||' '||s.last_name as staff_name,
          pc.export_code as pay_component_code, pc.name as pay_component_name,
          pc.rate_multiplier, ra.pay_rate, ra.pay_type, rs.status as roster_status,
          COALESCE(te.status, 'scheduled') as timesheet_status
        FROM roster_shift rs
        LEFT JOIN roster_location rl ON rl.id=rs.location_id
        LEFT JOIN roster_role rr ON rr.id=rs.role_id
        LEFT JOIN roster_assignment ra ON ra.shift_id=rs.id AND ra.status!='cancelled'
        LEFT JOIN staff s ON s.id=ra.staff_id
        LEFT JOIN pay_component pc ON pc.id=COALESCE(ra.pay_component_id, rs.pay_component_id)
        LEFT JOIN timesheet_entry te ON te.shift_id=rs.id AND te.staff_id=ra.staff_id
        WHERE rs.shift_date>=? AND rs.shift_date<=? AND ra.id IS NOT NULL
        ORDER BY rs.shift_date, rs.start_time, staff_name
      `, [week_start, week_end]);
    }
    const headers = [
      'employee_number', 'staff_name', 'work_date', 'pay_component_code', 'pay_component_name',
      'hours', 'rate', 'amount', 'location', 'role', 'shift_start', 'shift_end',
      'roster_status', 'timesheet_status',
    ];
    const lines = [headers.join(',')];
    rows.forEach((r) => {
      const hours = useApproved ? (r.hours || 0) : shiftHours(r.start_time, r.end_time, r.break_minutes || 0);
      const rate = r.pay_rate || 0;
      const mult = r.rate_multiplier || 1;
      const enriched = {
        employee_number: r.employee_number || '',
        staff_name: r.staff_name || '',
        work_date: r.shift_date,
        pay_component_code: r.pay_component_code || '',
        pay_component_name: r.pay_component_name || '',
        hours: hours.toFixed(2),
        rate: rate.toFixed(2),
        amount: computeAmount(hours, rate, mult).toFixed(2),
        location: r.location || '',
        role: r.role || '',
        shift_start: r.start_time || '',
        shift_end: r.end_time || '',
        roster_status: r.roster_status || '',
        timesheet_status: r.timesheet_status || '',
      };
      lines.push(headers.map((k) => csvEscape(enriched[k])).join(','));
    });
    return { csv: lines.join('\n'), filename: `payroll-${week_start}-to-${week_end}.csv`, count: rows.length };
  });

  h('export:payroll_preview', ({ all }, { week_start, week_end, source } = {}) => {
    const useApproved = source === 'approved';
    const sql = useApproved
      ? `SELECT COUNT(*) as n FROM timesheet_entry WHERE work_date>=? AND work_date<=? AND status='approved'`
      : `SELECT COUNT(*) as n FROM roster_assignment ra JOIN roster_shift rs ON rs.id=ra.shift_id WHERE rs.shift_date>=? AND rs.shift_date<=? AND ra.status!='cancelled'`;
    const row = all(sql, [week_start, week_end])[0];
    return { count: row?.n || 0, source: useApproved ? 'approved' : 'scheduled' };
  });

  h('import:staff', ({ run, get }, { rows }) => {
    let imported = 0;
    (rows || []).forEach((r) => {
      if (!r.first_name || !r.last_name) return;
      const id = genId();
      run(`INSERT INTO staff (id,facility_id,first_name,last_name,email,phone,role,status) VALUES (?,?,?,?,?,?,?,?)`,
        [id, 'fac1', r.first_name, r.last_name, r.email || null, r.phone || null, r.role || 'lifeguard', r.status || 'active']);
      imported++;
    });
    return { imported };
  });

  // ── Pay components ──
  h('roster:pay_components', ({ all }, { include_inactive } = {}) => {
    let sql = `SELECT * FROM pay_component WHERE 1=1`;
    if (!include_inactive) sql += ` AND is_active=1`;
    return all(sql + ` ORDER BY sort_order, code`);
  });

  h('roster:pay_component_save', ({ run, get }, d) => {
    const id = d.id || genId();
    const existing = get(`SELECT id FROM pay_component WHERE id=?`, [id]);
    if (existing) {
      run(`UPDATE pay_component SET code=?, name=?, category=?, default_rate=?, rate_multiplier=?, export_code=?, is_active=?, sort_order=? WHERE id=?`,
        [d.code, d.name, d.category || 'earning', d.default_rate || 0, d.rate_multiplier ?? 1,
          d.export_code || d.code, d.is_active != null ? (d.is_active ? 1 : 0) : 1, d.sort_order || 0, id]);
    } else {
      run(`INSERT INTO pay_component (id,code,name,category,default_rate,rate_multiplier,export_code,is_active,sort_order) VALUES (?,?,?,?,?,?,?,?,?)`,
        [id, d.code, d.name, d.category || 'earning', d.default_rate || 0, d.rate_multiplier ?? 1,
          d.export_code || d.code, d.is_active != null ? (d.is_active ? 1 : 0) : 1, d.sort_order || 0]);
    }
    return { id };
  });

  h('roster:resolve_pay', ({ get }, { shift_id, staff_id, pay_component_id } = {}) => {
    const shift = shift_id ? get(`SELECT * FROM roster_shift WHERE id=?`, [shift_id]) : null;
    const snap = resolvePaySnapshot(get, { shift, staff_id, pay_component_id: pay_component_id || shift?.pay_component_id });
    const hours = shift ? shiftHours(shift.start_time, shift.end_time, shift.break_minutes || 0) : 0;
    return { ...snap, hours, amount: computeAmount(hours, snap.pay_rate, snap.multiplier) };
  });

  // ── Roster locations & roles ──
  h('roster:locations', ({ all }, { facility_id } = {}) => {
    let sql = `SELECT * FROM roster_location WHERE is_active=1`;
    const p = [];
    if (facility_id) { sql += ` AND facility_id=?`; p.push(facility_id); }
    return all(sql + ` ORDER BY sort_order,name`, p);
  });
  h('roster:roles', ({ all }, { facility_id } = {}) => {
    let sql = `SELECT * FROM roster_role WHERE is_active=1`;
    const p = [];
    if (facility_id) { sql += ` AND facility_id=?`; p.push(facility_id); }
    return all(sql + ` ORDER BY name`, p);
  });

  h('roster:shifts', ({ all }, { week_start, week_end, facility_id } = {}) => all(`
    SELECT rs.*, rl.name as location_name, rr.name as role_name, rr.color as role_color,
      pc.code as pay_code, pc.name as pay_component_name, pc.export_code
    FROM roster_shift rs
    LEFT JOIN roster_location rl ON rl.id=rs.location_id
    LEFT JOIN roster_role rr ON rr.id=rs.role_id
    LEFT JOIN pay_component pc ON pc.id=rs.pay_component_id
    WHERE rs.shift_date>=? AND rs.shift_date<=?
    ${facility_id ? 'AND rs.facility_id=?' : ''}
    ORDER BY rs.shift_date, rs.start_time
  `, facility_id ? [week_start, week_end, facility_id] : [week_start, week_end]));

  h('roster:assignments', ({ all }, { week_start, week_end } = {}) => all(`
    SELECT ra.*, rs.shift_date, rs.start_time, rs.end_time, rs.location_id, rs.role_id, rs.is_open,
      rs.break_minutes, rs.pay_component_id as shift_pay_component_id,
      s.first_name, s.last_name, s.role as staff_role, s.employee_number, s.nzrrp_expiry,
      pc.code as pay_code, pc.export_code
    FROM roster_assignment ra
    JOIN roster_shift rs ON rs.id=ra.shift_id
    JOIN staff s ON s.id=ra.staff_id
    LEFT JOIN pay_component pc ON pc.id=COALESCE(ra.pay_component_id, rs.pay_component_id)
    WHERE rs.shift_date>=? AND rs.shift_date<=? AND ra.status!='cancelled'
  `, [week_start, week_end]));

  h('roster:week_summary', ({ all, get }, { week_start, week_end } = {}) => {
    const shifts = all(`SELECT * FROM roster_shift WHERE shift_date>=? AND shift_date<=?`, [week_start, week_end]);
    const assignments = all(`
      SELECT ra.*, rs.start_time, rs.end_time, rs.break_minutes, rs.status as shift_status,
        pc.rate_multiplier
      FROM roster_assignment ra
      JOIN roster_shift rs ON rs.id=ra.shift_id
      LEFT JOIN pay_component pc ON pc.id=COALESCE(ra.pay_component_id, rs.pay_component_id)
      WHERE rs.shift_date>=? AND rs.shift_date<=? AND ra.status!='cancelled'
    `, [week_start, week_end]);
    const openCount = shifts.filter((s) => s.is_open === 1).length;
    const published = shifts.filter((s) => s.status === 'published').length;
    let totalHours = 0;
    let labourCost = 0;
    assignments.forEach((a) => {
      const h = shiftHours(a.start_time, a.end_time, a.break_minutes || 0);
      totalHours += h;
      labourCost += computeAmount(h, a.pay_rate || 0, a.rate_multiplier || 1);
    });
    const pendingLeave = get(`SELECT COUNT(*) as n FROM roster_leave WHERE status='pending'`)?.n || 0;
    return {
      total_shifts: shifts.length,
      open_shifts: openCount,
      published_pct: shifts.length ? Math.round((published / shifts.length) * 100) : 0,
      scheduled_hours: Math.round(totalHours * 100) / 100,
      labour_cost: Math.round(labourCost * 100) / 100,
      pending_leave: pendingLeave,
    };
  });

  h('roster:shift_create', ({ run, get }, d) => {
    if (!d.pay_component_id) {
      const role = d.role_id ? get(`SELECT default_pay_component_id FROM roster_role WHERE id=?`, [d.role_id]) : null;
      d.pay_component_id = role?.default_pay_component_id || get(`SELECT id FROM pay_component WHERE code='ORD' LIMIT 1`)?.id;
    }
    const id = genId();
    run(`INSERT INTO roster_shift (id,facility_id,location_id,role_id,shift_date,start_time,end_time,break_minutes,notes,status,is_open,pay_component_id,headcount)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, d.facility_id || 'fac1', d.location_id, d.role_id, d.shift_date, d.start_time, d.end_time,
        d.break_minutes || 0, d.notes || null, d.status || 'draft', d.is_open ? 1 : 0,
        d.pay_component_id, d.headcount || 1]);
    return { id };
  });

  h('roster:shift_update', ({ run, get }, { id, ...d }) => {
    const patch = patchRosterShift(d);
    if (!id || !Object.keys(patch).length) return { id };
    const sets = Object.keys(patch).map((k) => `${k}=?`).join(',');
    run(`UPDATE roster_shift SET ${sets} WHERE id=?`, [...Object.values(patch), id]);
    syncShiftOpenState(run, get, id);
    return { id };
  });

  h('roster:shift_delete', ({ run }, id) => {
    run(`DELETE FROM roster_assignment WHERE shift_id=?`, [id]);
    run(`DELETE FROM roster_shift WHERE id=?`, [id]);
    return { id };
  });

  h('roster:assign', ({ run, get, all }, { shift_id, staff_id, pay_rate, pay_component_id, replace = false }) => {
    const shift = get(`SELECT * FROM roster_shift WHERE id=?`, [shift_id]);
    if (!shift) return { error: 'Shift not found' };
    const headcount = Math.max(1, shift.headcount || 1);
    const active = all(`SELECT id, staff_id FROM roster_assignment WHERE shift_id=? AND status!='cancelled'`, [shift_id]);
    const existing = active.find((a) => a.staff_id === staff_id);
    if (existing) return { id: existing.id };

    if (replace) {
      active.forEach((a) => run(`UPDATE roster_assignment SET status='cancelled' WHERE id=?`, [a.id]));
    } else if (active.length >= headcount) {
      return { error: 'shift_full', message: `Shift is full (${headcount} staff)` };
    }

    const snap = resolvePaySnapshot(get, { shift, staff_id, pay_component_id: pay_component_id || shift.pay_component_id });
    const id = genId();
    run(`INSERT INTO roster_assignment (id,shift_id,staff_id,status,pay_rate,pay_type,pay_component_id) VALUES (?,?,?,'assigned',?,?,?)`,
      [id, shift_id, staff_id, pay_rate != null ? pay_rate : snap.pay_rate, snap.pay_type, snap.pay_component_id]);
    syncShiftOpenState(run, get, shift_id);
    return { id, ...snap };
  });

  h('roster:unassign', ({ run, get }, { assignment_id, shift_id }) => {
    let sid = shift_id;
    if (assignment_id) {
      const row = get(`SELECT shift_id FROM roster_assignment WHERE id=?`, [assignment_id]);
      sid = sid || row?.shift_id;
      run(`UPDATE roster_assignment SET status='cancelled' WHERE id=?`, [assignment_id]);
    }
    if (sid) syncShiftOpenState(run, get, sid);
    return { ok: true };
  });

  h('roster:publish_week', ({ run, all }, { week_start, week_end, generate_timesheets } = {}) => {
    run(`UPDATE roster_shift SET status='published' WHERE shift_date>=? AND shift_date<=? AND status='draft'`, [week_start, week_end]);
    if (generate_timesheets !== false) {
      const assignments = all(`
        SELECT ra.id, ra.shift_id, ra.staff_id, ra.pay_component_id,
          rs.shift_date, rs.start_time, rs.end_time, rs.break_minutes, rs.pay_component_id as shift_pc
        FROM roster_assignment ra
        JOIN roster_shift rs ON rs.id=ra.shift_id
        WHERE rs.shift_date>=? AND rs.shift_date<=? AND ra.status!='cancelled' AND rs.status='published'
      `, [week_start, week_end]);
      assignments.forEach((a) => {
        const existing = all(`SELECT id FROM timesheet_entry WHERE shift_id=? AND staff_id=?`, [a.shift_id, a.staff_id])[0];
        if (existing) return;
        const hours = shiftHours(a.start_time, a.end_time, a.break_minutes || 0);
        const tid = genId();
        run(`INSERT INTO timesheet_entry (id,staff_id,shift_id,work_date,hours,status,pay_component_id) VALUES (?,?,?,?,?,?,?)`,
          [tid, a.staff_id, a.shift_id, a.shift_date, hours, 'draft', a.pay_component_id || a.shift_pc || null]);
      });
    }
    return { ok: true };
  });

  h('roster:bulk_assign', ({ run, get, all }, { shift_ids, staff_id }) => {
    const results = [];
    (shift_ids || []).forEach((shift_id) => {
      const shift = get(`SELECT * FROM roster_shift WHERE id=?`, [shift_id]);
      if (!shift) return;
      const dup = get(`SELECT id FROM roster_assignment WHERE shift_id=? AND staff_id=? AND status!='cancelled'`, [shift_id, staff_id]);
      if (dup) return;
      const snap = resolvePaySnapshot(get, { shift, staff_id, pay_component_id: shift.pay_component_id });
      const id = genId();
      run(`INSERT INTO roster_assignment (id,shift_id,staff_id,status,pay_rate,pay_type,pay_component_id) VALUES (?,?,?,'assigned',?,?,?)`,
        [id, shift_id, staff_id, snap.pay_rate, snap.pay_type, snap.pay_component_id]);
      syncShiftOpenState(run, get, shift_id);
      results.push(id);
    });
    return { assigned: results.length };
  });

  h('roster:copy_week', ({ run, all }, { week_start, week_end }) => {
    const shifts = all(`SELECT * FROM roster_shift WHERE shift_date>=? AND shift_date<=?`, [week_start, week_end]);
    if (!shifts.length) return { copied: 0, message: 'No shifts to copy' };
    const dayMs = 7 * 86400000;
    let count = 0;
    shifts.forEach((s) => {
      const newDate = new Date(s.shift_date);
      newDate.setDate(newDate.getDate() + 7);
      const shift_date = newDate.toISOString().slice(0, 10);
      const id = genId();
      run(`INSERT INTO roster_shift (id,facility_id,location_id,role_id,shift_date,start_time,end_time,break_minutes,notes,status,is_open,pay_component_id,headcount)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, s.facility_id, s.location_id, s.role_id, shift_date, s.start_time, s.end_time,
          s.break_minutes || 0, s.notes, 'draft', 1, s.pay_component_id, s.headcount || 1]);
      count++;
    });
    return { copied: count };
  });

  h('roster:clear_week', ({ run, all }, { week_start, week_end }) => {
    const shifts = all(`SELECT id FROM roster_shift WHERE shift_date>=? AND shift_date<=?`, [week_start, week_end]);
    shifts.forEach((s) => {
      run(`DELETE FROM roster_assignment WHERE shift_id=?`, [s.id]);
      run(`DELETE FROM timesheet_entry WHERE shift_id=?`, [s.id]);
      run(`DELETE FROM roster_shift WHERE id=?`, [s.id]);
    });
    return { deleted: shifts.length };
  });

  h('roster:open_shifts', ({ all }, { week_start, week_end } = {}) => all(`
    SELECT rs.*, rl.name as location_name, rr.name as role_name
    FROM roster_shift rs
    LEFT JOIN roster_location rl ON rl.id=rs.location_id
    LEFT JOIN roster_role rr ON rr.id=rs.role_id
    WHERE rs.shift_date>=? AND rs.shift_date<=? AND (rs.is_open=1 OR rs.id NOT IN (
      SELECT shift_id FROM roster_assignment WHERE status!='cancelled'))
    ORDER BY rs.shift_date, rs.start_time
  `, [week_start, week_end]));

  h('roster:unavailability', ({ all }, { staff_id } = {}) => {
    let sql = `SELECT ru.*, s.first_name, s.last_name FROM roster_unavailability ru JOIN staff s ON s.id=ru.staff_id WHERE 1=1`;
    const p = [];
    if (staff_id) { sql += ` AND ru.staff_id=?`; p.push(staff_id); }
    return all(sql + ` ORDER BY ru.start_date DESC`, p);
  });

  h('roster:unavailability_create', ({ run }, d) => {
    const id = genId();
    run(`INSERT INTO roster_unavailability (id,staff_id,start_date,end_date,reason,all_day,start_time,end_time) VALUES (?,?,?,?,?,?,?,?)`,
      [id, d.staff_id, d.start_date, d.end_date, d.reason || null, d.all_day ? 1 : 0, d.start_time || null, d.end_time || null]);
    return { id };
  });

  h('roster:leave_list', ({ all }, { status } = {}) => {
    let sql = `SELECT rl.*, s.first_name, s.last_name FROM roster_leave rl JOIN staff s ON s.id=rl.staff_id WHERE 1=1`;
    const p = [];
    if (status) { sql += ` AND rl.status=?`; p.push(status); }
    return all(sql + ` ORDER BY rl.created_at DESC`, p);
  });

  h('roster:leave_create', ({ run }, d) => {
    const id = genId();
    run(`INSERT INTO roster_leave (id,staff_id,leave_type,start_date,end_date,hours,status,notes) VALUES (?,?,?,?,?,?,?,?)`,
      [id, d.staff_id, d.leave_type || 'annual', d.start_date, d.end_date, d.hours || null, 'pending', d.notes || null]);
    return { id };
  });

  h('roster:leave_review', ({ run }, { id, status, reviewed_by }) => {
    run(`UPDATE roster_leave SET status=?, reviewed_by=? WHERE id=?`, [status, reviewed_by || null, id]);
    return { id };
  });

  h('roster:offer_create', ({ run }, d) => {
    const id = genId();
    run(`INSERT INTO roster_shift_offer (id,shift_id,from_staff_id,to_staff_id,status,message) VALUES (?,?,?,?,?,?)`,
      [id, d.shift_id, d.from_staff_id, d.to_staff_id, 'pending', d.message || null]);
    return { id };
  });

  h('roster:offers', ({ all }, { status } = {}) => {
    let sql = `
      SELECT o.*, rs.shift_date, rs.start_time, rs.end_time,
        fs.first_name as from_first, fs.last_name as from_last,
        ts.first_name as to_first, ts.last_name as to_last
      FROM roster_shift_offer o
      JOIN roster_shift rs ON rs.id=o.shift_id
      LEFT JOIN staff fs ON fs.id=o.from_staff_id
      LEFT JOIN staff ts ON ts.id=o.to_staff_id WHERE 1=1`;
    const p = [];
    if (status) { sql += ` AND o.status=?`; p.push(status); }
    return all(sql + ` ORDER BY o.created_at DESC`, p);
  });

  h('roster:offer_respond', ({ run, get }, { id, accept }) => {
    const offer = get(`SELECT * FROM roster_shift_offer WHERE id=?`, [id]);
    if (!offer) return { error: 'Not found' };
    run(`UPDATE roster_shift_offer SET status=? WHERE id=?`, [accept ? 'accepted' : 'declined', id]);
    if (accept) {
      run(`UPDATE roster_assignment SET status='cancelled' WHERE shift_id=? AND staff_id=?`, [offer.shift_id, offer.from_staff_id]);
      const shift = get(`SELECT * FROM roster_shift WHERE id=?`, [offer.shift_id]);
      const snap = resolvePaySnapshot(get, { shift, staff_id: offer.to_staff_id, pay_component_id: shift?.pay_component_id });
      const aid = genId();
      run(`INSERT INTO roster_assignment (id,shift_id,staff_id,status,pay_rate,pay_type,pay_component_id) VALUES (?,?,?,'assigned',?,?,?)`,
        [aid, offer.shift_id, offer.to_staff_id, snap.pay_rate, snap.pay_type, snap.pay_component_id]);
    }
    return { ok: true };
  });

  h('roster:match_staff', ({ all, get }, { shift_id }) => {
    const shift = get(`
      SELECT rs.*, rr.staff_role FROM roster_shift rs
      LEFT JOIN roster_role rr ON rr.id=rs.role_id WHERE rs.id=?`, [shift_id]);
    if (!shift) return [];
    const staff = all(`SELECT * FROM staff WHERE status='active' AND facility_id=?`, [shift.facility_id || 'fac1']);
    const unavailable = all(`
      SELECT staff_id FROM roster_unavailability
      WHERE start_date<=? AND end_date>=?`, [shift.shift_date, shift.shift_date]);
    const unavailIds = new Set(unavailable.map((u) => u.staff_id));
    const onLeave = all(`
      SELECT staff_id FROM roster_leave WHERE status='approved'
      AND start_date<=? AND end_date>=?`, [shift.shift_date, shift.shift_date]);
    onLeave.forEach((l) => unavailIds.add(l.staff_id));
    return staff
      .filter((s) => !unavailIds.has(s.id))
      .map((s) => ({
        ...s,
        matchScore: shift.staff_role && s.role === shift.staff_role ? 100 : s.role === 'supervisor' ? 80 : 50,
      }))
      .sort((a, b) => b.matchScore - a.matchScore);
  });

  h('roster:timesheets', ({ all }, { week_start, week_end } = {}) => all(`
    SELECT te.*, s.first_name, s.last_name, s.employee_number,
      rs.start_time, rs.end_time, pc.code as pay_code
    FROM timesheet_entry te
    JOIN staff s ON s.id=te.staff_id
    LEFT JOIN roster_shift rs ON rs.id=te.shift_id
    LEFT JOIN pay_component pc ON pc.id=te.pay_component_id
    WHERE te.work_date>=? AND te.work_date<=?
    ORDER BY te.work_date DESC
  `, [week_start, week_end]));

  h('roster:timesheet_create', ({ run }, d) => {
    const id = genId();
    run(`INSERT INTO timesheet_entry (id,staff_id,shift_id,work_date,hours,status,notes,pay_component_id) VALUES (?,?,?,?,?,?,?,?)`,
      [id, d.staff_id, d.shift_id || null, d.work_date, d.hours, d.status || 'draft', d.notes || null, d.pay_component_id || null]);
    return { id };
  });

  h('roster:timesheet_update', ({ run }, { id, ...d }) => {
    const sets = Object.keys(d).map((k) => `${k}=?`).join(',');
    run(`UPDATE timesheet_entry SET ${sets} WHERE id=?`, [...Object.values(d), id]);
    return { id };
  });

  h('roster:timesheet_approve', ({ run, get }, { id, approved_by, hours }) => {
    if (hours != null) run(`UPDATE timesheet_entry SET hours=?, status='approved', approved_by=? WHERE id=?`, [hours, approved_by || null, id]);
    else run(`UPDATE timesheet_entry SET status='approved', approved_by=? WHERE id=?`, [approved_by || null, id]);
    return { id };
  });

  h('roster:generate_timesheets', ({ run, all }, { week_start, week_end } = {}) => {
    const assignments = all(`
      SELECT ra.shift_id, ra.staff_id, ra.pay_component_id,
        rs.shift_date, rs.start_time, rs.end_time, rs.break_minutes, rs.pay_component_id as shift_pc
      FROM roster_assignment ra
      JOIN roster_shift rs ON rs.id=ra.shift_id
      WHERE rs.shift_date>=? AND rs.shift_date<=? AND ra.status!='cancelled'
    `, [week_start, week_end]);
    let created = 0;
    assignments.forEach((a) => {
      const existing = all(`SELECT id FROM timesheet_entry WHERE shift_id=? AND staff_id=?`, [a.shift_id, a.staff_id])[0];
      if (existing) return;
      const hours = shiftHours(a.start_time, a.end_time, a.break_minutes || 0);
      const tid = genId();
      run(`INSERT INTO timesheet_entry (id,staff_id,shift_id,work_date,hours,status,pay_component_id) VALUES (?,?,?,?,?,?,?)`,
        [tid, a.staff_id, a.shift_id, a.shift_date, hours, 'draft', a.pay_component_id || a.shift_pc || null]);
      created++;
    });
    return { created };
  });

  h('roster:staff_conflicts', ({ all }, { staff_id, shift_date, start_time, end_time, exclude_shift_id } = {}) => {
    const conflicts = [];
    const overlapping = all(`
      SELECT rs.*, rl.name as location_name FROM roster_shift rs
      JOIN roster_assignment ra ON ra.shift_id=rs.id AND ra.status!='cancelled'
      LEFT JOIN roster_location rl ON rl.id=rs.location_id
      WHERE ra.staff_id=? AND rs.shift_date=? AND rs.id!=?
    `, [staff_id, shift_date, exclude_shift_id || '']);
    overlapping.forEach((s) => conflicts.push({ type: 'overlap', message: `Overlapping shift at ${s.location_name}`, shift_id: s.id }));
    const onLeave = all(`
      SELECT * FROM roster_leave WHERE staff_id=? AND status='approved'
      AND start_date<=? AND end_date>=?
    `, [staff_id, shift_date, shift_date]);
    if (onLeave.length) conflicts.push({ type: 'leave', message: 'Approved leave on this date' });
    const staff = get(`SELECT nzrrp_expiry FROM staff WHERE id=?`, [staff_id]);
    if (staff?.nzrrp_expiry && staff.nzrrp_expiry < shift_date) {
      conflicts.push({ type: 'qualification', message: 'NZRRP expired' });
    }
    return conflicts;
  });

  h('roster:seed_week', ({ run, all, get }, { week_start }) => {
    const existing = all(`SELECT id FROM roster_shift WHERE shift_date>=? AND shift_date<date(?, '+7 days')`, [week_start, week_start]);
    if (existing.length > 0) return { seeded: 0, message: 'Week already has shifts' };
    const locations = all(`SELECT id FROM roster_location WHERE is_active=1`);
    const roles = all(`SELECT id, default_pay_component_id FROM roster_role WHERE is_active=1`);
    const defaultPc = get(`SELECT id FROM pay_component WHERE code='ORD' LIMIT 1`)?.id;
    const days = [0, 1, 2, 3, 4, 5, 6];
    let count = 0;
    days.forEach((d) => {
      const date = new Date(week_start);
      date.setDate(date.getDate() + d);
      const shift_date = date.toISOString().slice(0, 10);
      [['06:00', '14:00'], ['14:00', '22:00']].forEach(([start, end], i) => {
        const loc = locations[i % locations.length];
        const role = roles[i % roles.length];
        if (!loc || !role) return;
        const id = genId();
        run(`INSERT INTO roster_shift (id,facility_id,location_id,role_id,shift_date,start_time,end_time,status,is_open,pay_component_id,headcount)
          VALUES (?,?,?,?,?,?,?,'draft',1,?,1)`, [id, 'fac1', loc.id, role.id, shift_date, start, end, role.default_pay_component_id || defaultPc]);
        count++;
      });
    });
    return { seeded: count };
  });

  h('audit:list', ({ all }, { limit, entity_type } = {}) => {
    let sql = `SELECT * FROM audit_log WHERE 1=1`;
    const p = [];
    if (entity_type) { sql += ` AND entity_type=?`; p.push(entity_type); }
    sql += ` ORDER BY created_at DESC LIMIT ?`;
    p.push(limit || 100);
    return all(sql, p);
  });

  h('remote:status', ({ get }) => {
    const { readRemoteSettings } = require('./remoteAccess');
    const { enabled, token } = readRemoteSettings(get);
    return {
      enabled,
      hasToken: !!token,
      tokenPreview: token ? token.slice(-6) : null,
    };
  });

  h('remote:enable', ({ run, get }) => {
    const { generateRemoteToken } = require('./remoteAccess');
    const token = generateRemoteToken();
    run(`INSERT OR REPLACE INTO setting (key, value) VALUES ('remote_access_enabled', '1')`);
    run(`INSERT OR REPLACE INTO setting (key, value) VALUES ('remote_access_token', ?)`, [token]);
    writeAudit({ run, get, all: () => [] }, {
      action: 'remote.enable',
      entity_type: 'setting',
      entity_id: 'remote_access',
    });
    return { enabled: true, token };
  });

  h('remote:disable', ({ run, get }) => {
    run(`INSERT OR REPLACE INTO setting (key, value) VALUES ('remote_access_enabled', '0')`);
    writeAudit({ run, get, all: () => [] }, {
      action: 'remote.disable',
      entity_type: 'setting',
      entity_id: 'remote_access',
    });
    return { enabled: false };
  });

  h('remote:rotate_token', ({ run, get }) => {
    const { generateRemoteToken } = require('./remoteAccess');
    const token = generateRemoteToken();
    run(`INSERT OR REPLACE INTO setting (key, value) VALUES ('remote_access_token', ?)`, [token]);
    writeAudit({ run, get, all: () => [] }, {
      action: 'remote.rotate_token',
      entity_type: 'setting',
      entity_id: 'remote_access',
    });
    return { token };
  });

  h('cloud:status', ({ get, all }) => {
    const g = (key) => (get(`SELECT value FROM setting WHERE key=?`, [key]) || {}).value || '';
    const pending = all(`SELECT COUNT(*) AS n FROM cloud_sync_outbox WHERE synced_at IS NULL`)[0]?.n || 0;
    const siteId = g('cloud_site_id');
    return {
      enabled: g('cloud_enabled') === '1',
      paired: !!siteId,
      site_id: siteId || null,
      relay_url: g('cloud_relay_url') || 'https://relay.facilityos.nz',
      last_sync_at: g('cloud_last_sync_at') || null,
      pairing_code: g('cloud_pairing_code') || null,
      pending_events: pending,
      agent_available: false,
      protocol_version: require('../cloud/syncProtocol').SYNC_PROTOCOL_VERSION,
    };
  });

  h('cloud:configure', ({ run }, { relay_url, enabled } = {}) => {
    if (relay_url) run(`INSERT OR REPLACE INTO setting (key, value) VALUES ('cloud_relay_url', ?)`, [relay_url]);
    if (enabled != null) run(`INSERT OR REPLACE INTO setting (key, value) VALUES ('cloud_enabled', ?)`, [enabled ? '1' : '0']);
    return { ok: true };
  });

  h('cloud:pairing_code', ({ run }) => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    run(`INSERT OR REPLACE INTO setting (key, value) VALUES ('cloud_pairing_code', ?)`, [code]);
    return { code, expires_minutes: 30 };
  });

  h('cloud:sync_now', ({ run, get, all }) => {
    const g = (key) => (get(`SELECT value FROM setting WHERE key=?`, [key]) || {}).value || '';
    const pending = all(`
      SELECT * FROM cloud_sync_outbox WHERE synced_at IS NULL ORDER BY updated_at ASC LIMIT 50
    `);
    const { syncPendingOutbox } = require('../cloud/syncRunner');

    return syncPendingOutbox({
      relayUrl: g('cloud_relay_url') || 'http://127.0.0.1:4850',
      siteId: g('cloud_site_id'),
      agentKey: g('cloud_agent_key'),
      pendingRows: pending,
      markSynced: (ids) => {
        ids.forEach((id) => {
          run(`UPDATE cloud_sync_outbox SET synced_at=datetime('now'), sync_error=NULL WHERE id=?`, [id]);
        });
        run(`INSERT OR REPLACE INTO setting (key, value) VALUES ('cloud_last_sync_at', datetime('now'))`);
      },
      markError: (ids, message) => {
        ids.forEach((id) => {
          run(`UPDATE cloud_sync_outbox SET sync_error=? WHERE id=?`, [message, id]);
        });
      },
    }).then((result) => ({ ...result, pending_events: pending.length }));
  });

  h('cloud:pair', ({ run, get, all }, { facility_name } = {}) => {
    const g = (key) => (get(`SELECT value FROM setting WHERE key=?`, [key]) || {}).value || '';
    const code = g('cloud_pairing_code');
    if (!code) throw new Error('generate_pairing_code_first');
    const relayUrl = g('cloud_relay_url') || 'http://127.0.0.1:4850';
    const { pairWithRelay } = require('../cloud/relayClient');
    return pairWithRelay({
      relayUrl,
      code,
      facilityName: facility_name || g('facility_name') || 'FacilityOS Site',
    }).then((response) => {
      const { site_id, agent_key } = response.data || {};
      if (!site_id || !agent_key) throw new Error('pair_failed');
      run(`INSERT OR REPLACE INTO setting (key, value) VALUES ('cloud_site_id', ?)`, [site_id]);
      run(`INSERT OR REPLACE INTO setting (key, value) VALUES ('cloud_agent_key', ?)`, [agent_key]);
      run(`INSERT OR REPLACE INTO setting (key, value) VALUES ('cloud_enabled', '1')`);
      run(`INSERT OR REPLACE INTO setting (key, value) VALUES ('cloud_pairing_code', '')`);
      writeAudit({ run, get, all: () => [] }, {
        action: 'cloud.pair',
        entity_type: 'cloud',
        entity_id: site_id,
      });
      return { site_id, agent_key, relay_url: relayUrl };
    });
  });

  h('cloud:agent_credentials', ({ get }) => {
    const g = (key) => (get(`SELECT value FROM setting WHERE key=?`, [key]) || {}).value || '';
    return {
      enabled: g('cloud_enabled') === '1',
      site_id: g('cloud_site_id') || null,
      agent_key: g('cloud_agent_key') || null,
      relay_url: g('cloud_relay_url') || 'http://127.0.0.1:4850',
    };
  });

  h('cloud:outbox_pending', ({ all }, { limit } = {}) => all(`
    SELECT * FROM cloud_sync_outbox WHERE synced_at IS NULL
    ORDER BY updated_at ASC LIMIT ?
  `, [limit || 50]));

  h('cloud:outbox_ack', ({ run }, { ids } = {}) => {
    (ids || []).forEach((id) => {
      run(`UPDATE cloud_sync_outbox SET synced_at=datetime('now'), sync_error=NULL WHERE id=?`, [id]);
    });
    run(`INSERT OR REPLACE INTO setting (key, value) VALUES ('cloud_last_sync_at', datetime('now'))`);
    return { acked: (ids || []).length };
  });

  h('cloud:outbox_error', ({ run }, { ids, message } = {}) => {
    (ids || []).forEach((id) => {
      run(`UPDATE cloud_sync_outbox SET sync_error=? WHERE id=?`, [message || 'sync_failed', id]);
    });
    return { ok: true };
  });

  h('cloud:enqueue_demo', ({ run, get }) => {
    const { enqueueOutbox } = require('../cloud/outbox');
    const id = enqueueOutbox(run, {
      entity_type: 'audit_event',
      entity_id: `demo-${Date.now()}`,
      op: 'create',
      payload: { message: 'FacilityOS Cloud demo event', at: new Date().toISOString() },
    });
    return { id };
  });

  const { registerV15Handlers } = require('./handlers-v15');
  registerV15Handlers(h);
}

module.exports = { registerExtendedHandlers };
