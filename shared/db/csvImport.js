const { CSV_MODULES } = require('../csvTemplates');
const { hashPinIfNeeded } = require('./pinAuth');

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function parseBool(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(s)) return 1;
  if (['0', 'false', 'no', 'n'].includes(s)) return 0;
  return null;
}

function parseNum(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function resolvePoolByName(get, name) {
  if (!name) return null;
  const row = await get(`SELECT id FROM pool WHERE is_active=1 AND lower(trim(name))=lower(trim(?))`, [name]);
  return row?.id || null;
}

async function resolveAssetByName(get, name) {
  if (!name) return null;
  const row = await get(`SELECT id FROM asset WHERE status!='retired' AND lower(trim(name))=lower(trim(?))`, [name]);
  return row?.id || null;
}

async function importPools({ run }, rows) {
  let imported = 0;
  let skipped = 0;
  for (const r of rows || []) {
    if (!r.name?.trim()) { skipped++; continue; }
    await run(
      `INSERT INTO pool (id,facility_id,name,type,location,volume_litres,max_patrons,sort_order,temp_min,temp_max) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        genId(), 'fac1', r.name.trim(), r.type || 'pool', r.location || null,
        parseNum(r.volume_litres), parseNum(r.max_patrons), parseNum(r.sort_order) ?? 99,
        parseNum(r.temp_min), parseNum(r.temp_max),
      ],
    );
    imported++;
  }
  return { imported, skipped };
}

async function importStaff({ run }, rows) {
  let imported = 0;
  let skipped = 0;
  for (const r of rows || []) {
    if (!r.first_name?.trim() || !r.last_name?.trim()) { skipped++; continue; }
    const pin = r.pin ? await hashPinIfNeeded(String(r.pin).trim()) : null;
    await run(
      `INSERT INTO staff (id,facility_id,first_name,last_name,email,phone,role,status,pin,employee_number,nzrrp_number,nzrrp_expiry) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        genId(), 'fac1', r.first_name.trim(), r.last_name.trim(),
        r.email || null, r.phone || null, r.role || 'lifeguard', r.status || 'active',
        pin, r.employee_number || null, r.nzrrp_number || null, r.nzrrp_expiry || null,
      ],
    );
    imported++;
  }
  return { imported, skipped };
}

async function importAssets({ run }, rows) {
  let imported = 0;
  let skipped = 0;
  for (const r of rows || []) {
    if (!r.name?.trim() || !r.location?.trim()) { skipped++; continue; }
    await run(
      `INSERT INTO asset (id,facility_id,name,asset_type,category,location,manufacturer,model_number,serial_number,purchase_date,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        genId(), 'fac1', r.name.trim(), r.asset_type || 'other', r.category || null, r.location.trim(),
        r.manufacturer || null, r.model_number || null, r.serial_number || null,
        r.purchase_date || null, r.status || 'operational', r.notes || null,
      ],
    );
    imported++;
  }
  return { imported, skipped };
}

async function importWorkorders({ run, get }, rows) {
  let imported = 0;
  let skipped = 0;
  for (const r of rows || []) {
    if (!r.title?.trim() || !r.location?.trim()) { skipped++; continue; }
    const asset_id = r.asset_name ? await resolveAssetByName(get, r.asset_name) : null;
    await run(
      `INSERT INTO work_order (id,title,description,asset_id,location,priority,status,assigned_to,due_date) VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        genId(), r.title.trim(), r.description || null, asset_id, r.location.trim(),
        r.priority || 'medium', r.status || 'open', r.assigned_to || null, r.due_date || null,
      ],
    );
    imported++;
  }
  return { imported, skipped };
}

async function importSchedules({ run, get }, rows) {
  let imported = 0;
  let skipped = 0;
  for (const r of rows || []) {
    if (!r.task_name?.trim()) { skipped++; continue; }
    const asset_id = r.asset_name ? await resolveAssetByName(get, r.asset_name) : null;
    await run(
      `INSERT INTO maintenance_schedule (id,asset_id,task_name,description,frequency,assigned_to,estimated_hours,category,next_due,is_active) VALUES (?,?,?,?,?,?,?,?,?,1)`,
      [
        genId(), asset_id, r.task_name.trim(), r.description || null, r.frequency || 'monthly',
        r.assigned_to || null, parseNum(r.estimated_hours), r.category || null, r.next_due || null,
      ],
    );
    imported++;
  }
  return { imported, skipped };
}

async function importTests({ run, get }, rows) {
  let imported = 0;
  let skipped = 0;
  for (const r of rows || []) {
    const pool_id = await resolvePoolByName(get, r.pool_name);
    if (!pool_id || !r.test_date) { skipped++; continue; }
    const compliant = parseBool(r.is_compliant);
    await run(
      `INSERT INTO test_result (id,pool_id,test_type,test_date,test_time,tested_by,ph,free_chlorine,total_available_chlorine,combined_chlorine,temperature,is_compliant,notes,retest_required) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
      [
        genId(), pool_id, 'routine', r.test_date, r.test_time || null, r.tested_by || null,
        parseNum(r.ph), parseNum(r.free_chlorine), parseNum(r.total_available_chlorine),
        parseNum(r.combined_chlorine), parseNum(r.temperature),
        compliant == null ? null : compliant, r.notes || null,
      ],
    );
    imported++;
  }
  return { imported, skipped };
}

async function importClosures({ run, get }, rows) {
  let imported = 0;
  let skipped = 0;
  for (const r of rows || []) {
    const pool_id = await resolvePoolByName(get, r.pool_name);
    if (!pool_id || !r.reason) { skipped++; continue; }
    await run(
      `INSERT INTO pool_closure (id,pool_id,reason,closed_at,closed_by,notes) VALUES (?,?,?,?,?,?)`,
      [genId(), pool_id, r.reason, r.closed_at || new Date().toISOString(), r.closed_by || null, r.notes || null],
    );
    imported++;
  }
  return { imported, skipped };
}

async function importSteamchecks({ run, get }, rows) {
  let imported = 0;
  let skipped = 0;
  for (const r of rows || []) {
    const pool_id = await resolvePoolByName(get, r.pool_name);
    if (!pool_id || !r.check_date) { skipped++; continue; }
    const isClean = parseBool(r.is_clean);
    const towels = parseBool(r.towels_stocked);
    await run(
      `INSERT INTO steam_room_check (id,pool_id,check_date,check_time,checked_by,temperature,humidity,patron_count,is_clean,towels_stocked,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        genId(), pool_id, r.check_date, r.check_time || null, r.checked_by || null,
        parseNum(r.temperature), parseNum(r.humidity), parseNum(r.patron_count),
        isClean == null ? 1 : isClean, towels == null ? 1 : towels, r.notes || null,
      ],
    );
    imported++;
  }
  return { imported, skipped };
}

const IMPORT_FNS = {
  pools: importPools,
  staff: importStaff,
  assets: importAssets,
  workorders: importWorkorders,
  schedules: importSchedules,
  tests: importTests,
  closures: importClosures,
  steamchecks: importSteamchecks,
};

async function importCsvModule(db, { module, rows }, licenceModules) {
  const mod = CSV_MODULES[module];
  if (!mod) throw new Error(`Unknown import module: ${module}`);
  if (licenceModules && mod.licenceKey && licenceModules[mod.licenceKey] === false) {
    throw new Error(`Module not licensed: ${mod.label}`);
  }
  const fn = IMPORT_FNS[module];
  if (!fn) throw new Error(`Import not implemented for: ${module}`);
  return fn(db, rows || []);
}

module.exports = {
  importCsvModule,
  IMPORT_FNS,
};
