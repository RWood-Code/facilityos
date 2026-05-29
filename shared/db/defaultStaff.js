const { hashPinIfNeeded } = require('./pinAuth');

/** Built-in gate user — PIN 9663, display name Wood Master */
const DEFAULT_GATE_STAFF = {
  id: 'staff-wood-master',
  facility_id: 'fac1',
  first_name: 'Wood',
  last_name: 'Master',
  role: 'manager',
  pin: '9663',
};

async function ensureDefaultGateStaff(api) {
  const { get, run } = api;
  const pin = await hashPinIfNeeded(DEFAULT_GATE_STAFF.pin);
  const existing = await get(`SELECT id FROM staff WHERE id=?`, [DEFAULT_GATE_STAFF.id]);
  if (existing) {
    await run(
      `UPDATE staff SET first_name=?, last_name=?, role=?, status='active', pin=? WHERE id=?`,
      [DEFAULT_GATE_STAFF.first_name, DEFAULT_GATE_STAFF.last_name, DEFAULT_GATE_STAFF.role, pin, DEFAULT_GATE_STAFF.id],
    );
    return { created: false, id: DEFAULT_GATE_STAFF.id };
  }
  await run(
    `INSERT INTO staff (id,facility_id,first_name,last_name,role,status,pin) VALUES (?,?,?,?,?,?,?)`,
    [
      DEFAULT_GATE_STAFF.id,
      DEFAULT_GATE_STAFF.facility_id,
      DEFAULT_GATE_STAFF.first_name,
      DEFAULT_GATE_STAFF.last_name,
      DEFAULT_GATE_STAFF.role,
      'active',
      pin,
    ],
  );
  return { created: true, id: DEFAULT_GATE_STAFF.id };
}

module.exports = {
  DEFAULT_GATE_STAFF,
  ensureDefaultGateStaff,
};
