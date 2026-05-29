function shiftHours(start, end, breakMin = 0) {
  const [sh, sm] = (start || '0:0').split(':').map(Number);
  const [eh, em] = (end || '0:0').split(':').map(Number);
  let startM = sh * 60 + sm;
  let endM = eh * 60 + em;
  if (endM <= startM) endM += 24 * 60;
  return Math.max(0, (endM - startM - breakMin) / 60);
}

async function resolvePaySnapshot(get, { shift, staff_id, pay_component_id }) {
  const shiftRow = shift || null;
  let pcId = pay_component_id || shiftRow?.pay_component_id || null;
  let staff = null;
  let role = null;

  if (staff_id) {
    staff = await get(`SELECT * FROM staff WHERE id=?`, [staff_id]);
  }
  if (shiftRow?.role_id) {
    role = await get(`SELECT * FROM roster_role WHERE id=?`, [shiftRow.role_id]);
  }

  if (!pcId && staff?.default_pay_component_id) pcId = staff.default_pay_component_id;
  if (!pcId && role?.default_pay_component_id) pcId = role.default_pay_component_id;
  if (!pcId) {
    const ord = await get(`SELECT id FROM pay_component WHERE code='ORD' AND is_active=1 LIMIT 1`);
    pcId = ord?.id || 'pc_ord';
  }

  const pc = await get(`SELECT * FROM pay_component WHERE id=?`, [pcId]);
  if (!pc) return { pay_component_id: pcId, pay_rate: 0, pay_type: 'hourly', multiplier: 1 };

  let rate = staff?.base_hourly_rate;
  if (rate == null || rate === 0) rate = pc.default_rate || 0;

  return {
    pay_component_id: pc.id,
    pay_code: pc.code,
    pay_name: pc.name,
    export_code: pc.export_code || pc.code,
    pay_rate: rate,
    pay_type: 'hourly',
    multiplier: pc.rate_multiplier || 1,
    category: pc.category,
  };
}

function computeAmount(hours, rate, multiplier = 1) {
  return Math.round(hours * rate * multiplier * 100) / 100;
}

module.exports = { shiftHours, resolvePaySnapshot, computeAmount };
