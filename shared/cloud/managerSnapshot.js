/**
 * Build a read-only manager dashboard snapshot from relay event log.
 */
function parsePayload(payload) {
  if (!payload) return {};
  if (typeof payload === 'string') {
    try { return JSON.parse(payload); } catch { return {}; }
  }
  return payload;
}

function isNonCompliant(value) {
  return value === 0 || value === false || value === '0';
}

function buildManagerSnapshot(events = [], { siteName } = {}) {
  const waterTests = events
    .filter((e) => e.entity_type === 'water_test')
    .map((e) => ({ ...e, payload: parsePayload(e.payload) }));

  const latestByPool = new Map();
  for (const ev of waterTests) {
    const poolId = ev.payload.pool_id || ev.entity_id;
    const key = poolId;
    const existing = latestByPool.get(key);
    const dt = `${ev.payload.test_date || ''} ${ev.payload.test_time || ''}`.trim();
    const existingDt = existing ? `${existing.payload.test_date || ''} ${existing.payload.test_time || ''}`.trim() : '';
    if (!existing || dt >= existingDt) latestByPool.set(key, ev);
  }

  const pools = [...latestByPool.values()].map((ev) => ({
    pool_id: ev.payload.pool_id || ev.entity_id,
    pool_name: ev.payload.pool_name || `Pool ${ev.payload.pool_id || ev.entity_id}`,
    test_date: ev.payload.test_date,
    test_time: ev.payload.test_time,
    is_compliant: ev.payload.is_compliant,
    entity_id: ev.entity_id,
  }));

  const nonCompliant = pools.filter((p) => isNonCompliant(p.is_compliant));
  const compliant = pools.filter((p) => p.is_compliant === 1 || p.is_compliant === true);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentTests = waterTests.filter((ev) => {
    const d = ev.payload.test_date;
    if (!d) return false;
    try { return new Date(d) >= thirtyDaysAgo; } catch { return false; }
  });
  const recentCompliant = recentTests.filter((ev) => !isNonCompliant(ev.payload.is_compliant));
  const complianceRate = recentTests.length
    ? Math.round((recentCompliant.length / recentTests.length) * 100)
    : null;

  const alerts = nonCompliant.map((p) => ({
    type: 'pool_non_compliance',
    title: 'Non-Compliant Pool',
    message: `${p.pool_name} failed the latest routine test (${p.test_date || 'unknown date'}).`,
    pool_id: p.pool_id,
    severity: 'error',
  }));

  return {
    site_name: siteName || 'FacilityOS Site',
    generated_at: new Date().toISOString(),
    stats: {
      pool_count: pools.length,
      non_compliant_count: nonCompliant.length,
      compliant_count: compliant.length,
      compliance_rate_30d: complianceRate,
      tests_synced: waterTests.length,
    },
    pools,
    alerts,
    recent_events: events.slice(0, 20).map((e) => ({
      entity_type: e.entity_type,
      entity_id: e.entity_id,
      op: e.op,
      received_at: e.received_at,
      payload: parsePayload(e.payload),
    })),
  };
}

module.exports = { buildManagerSnapshot, parsePayload, isNonCompliant };
