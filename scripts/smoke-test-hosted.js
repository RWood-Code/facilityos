#!/usr/bin/env node
/**
 * Hosted stack smoke test — session auth + Postgres deployment profile.
 * Usage: SMOKE_BASE_URL=http://localhost:3847 node scripts/smoke-test-hosted.js
 */
const BASE = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3847').replace(/\/$/, '');

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function json(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  console.log(`Hosted smoke test → ${BASE}\n`);

  // 1. Public health — minimal payload (no auth)
  const health = await json('/api/health', {
    headers: { 'X-Forwarded-For': '203.0.113.50' },
  });
  assert(health.status === 200 && health.body.ok, 'health 200');
  assert(health.body.version?.startsWith('1.7'), `version ${health.body.version}`);
  assert(!health.body.dbPath, 'public health hides dbPath');
  assert(!health.body.hostname, 'public health hides hostname');
  console.log('✓ GET /api/health (minimal public payload)');

  // 2. Unauthenticated API blocked
  const denied = await json('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.50' },
    body: JSON.stringify({ channel: 'pools:list' }),
  });
  assert(denied.status === 401, 'unauthenticated query returns 401');
  console.log('✓ POST /api/query without session → 401');

  const licStatus = await json('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.50' },
    body: JSON.stringify({ channel: 'licence:status' }),
  });
  assert(licStatus.status === 200 && licStatus.body.ok, 'licence:status without session');
  console.log('✓ licence:status allowed before login');

  // 3. staff:by_pin blocked remotely in session mode
  const pinChannel = await json('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.50' },
    body: JSON.stringify({ channel: 'staff:by_pin', args: '1234' }),
  });
  assert(pinChannel.status === 401, 'staff:by_pin remote blocked');
  console.log('✓ staff:by_pin blocked without session');

  // 4. PIN login
  const pin = await json('/api/auth/pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '1234', terminalId: 'hosted-smoke' }),
  });
  assert(pin.status === 200 && pin.body.ok && pin.body.data?.token, 'PIN login ok');
  const token = pin.body.data.token;
  console.log(`✓ POST /api/auth/pin (${pin.body.data.staff?.name})`);

  // 5. Authenticated pools query
  const pools = await json('/api/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Forwarded-For': '203.0.113.50',
    },
    body: JSON.stringify({ channel: 'pools:list' }),
  });
  assert(pools.status === 200 && pools.body.ok, 'pools:list with session');
  assert(Array.isArray(pools.body.data) && pools.body.data.length >= 1, 'pools returned');
  console.log(`✓ POST /api/query pools:list (${pools.body.data.length} pools)`);

  // 6. Upload with session
  const tiny = Buffer.from('hosted-smoke-file').toString('base64');
  const up = await json('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ filename: 'hosted-smoke.txt', data: tiny, subfolder: 'iltp' }),
  });
  assert(up.body.ok && up.body.data?.stored_path, 'upload ok');
  const dl = await fetch(`${BASE}/api/uploads/${up.body.data.stored_path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(dl.status === 200, 'download 200');
  assert((await dl.text()) === 'hosted-smoke-file', 'download content');
  console.log('✓ upload + download with session');

  // 7. Web UI
  const ui = await fetch(`${BASE}/`);
  assert(ui.status === 200, 'web UI 200');
  console.log('✓ GET / (web UI)');

  console.log('\n✅ Hosted smoke checks passed.');
}

main().catch((e) => {
  console.error('\n❌ Hosted smoke test failed:', e.message);
  process.exit(1);
});
