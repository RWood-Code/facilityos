#!/usr/bin/env node
/**
 * Live HTTP smoke test — run while server is up on SMOKE_BASE_URL (default http://127.0.0.1:3849)
 */
const BASE = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3849').replace(/\/$/, '');

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function json(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, headers: res.headers };
}

async function main() {
  console.log(`Smoke test → ${BASE}\n`);

  // 1. Health (legacy self-host — full payload from localhost)
  const health = await json('/api/health');
  assert(health.status === 200 && health.body.ok, 'health 200');
  assert(health.body.version?.includes('1.7.1'), `version ${health.body.version}`);
  assert(health.body.deployment?.authMode === 'legacy', 'legacy auth mode');
  assert(health.body.deployment?.mode === 'selfhost', 'selfhost mode');
  console.log('✓ GET /api/health');

  // 2. Core query — pools
  const pools = await json('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: 'pools:list' }),
  });
  assert(pools.status === 200 && pools.body.ok, 'pools:list 200');
  assert(Array.isArray(pools.body.data) && pools.body.data.length >= 1, 'pools returned');
  console.log(`✓ POST /api/query pools:list (${pools.body.data.length} pools)`);

  // 3. Licence status
  const lic = await json('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: 'licence:status' }),
  });
  assert(lic.body.ok, 'licence:status ok');
  console.log(`✓ licence:status (valid=${lic.body.data?.valid})`);

  // 4. PIN login
  const pin = await json('/api/auth/pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '1234', terminalId: 'smoke-test' }),
  });
  assert(pin.status === 200 && pin.body.ok && pin.body.data?.token, 'PIN login ok');
  const token = pin.body.data.token;
  console.log(`✓ POST /api/auth/pin (${pin.body.data.staff?.name})`);

  // 5. Session query
  const authed = await json('/api/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channel: 'staff:list', terminalId: 'smoke-test' }),
  });
  assert(authed.body.ok && Array.isArray(authed.body.data), 'staff:list with session');
  console.log(`✓ POST /api/query staff:list (${authed.body.data.length} staff)`);

  // 6. Upload + download
  const tiny = Buffer.from('smoke-test-file').toString('base64');
  const up = await json('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: 'smoke.txt', data: tiny, subfolder: 'iltp' }),
  });
  assert(up.body.ok && up.body.data?.stored_path, 'upload ok');
  const dl = await fetch(`${BASE}/api/uploads/${up.body.data.stored_path}`);
  assert(dl.status === 200, 'download 200');
  const text = await dl.text();
  assert(text === 'smoke-test-file', 'download content matches');
  console.log('✓ POST /api/upload + GET download');

  // 7. Blocked upload type
  const bad = await json('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: 'evil.html', data: tiny }),
  });
  assert(bad.status === 415 || bad.body.error, 'html upload blocked');
  console.log('✓ upload rejects .html');

  // 8. Backup list
  const backups = await json('/api/backups');
  assert(backups.body.ok && Array.isArray(backups.body.data), 'backups list');
  console.log(`✓ GET /api/backups (${backups.body.data.length} files)`);

  // 9. Web UI static (if built)
  const ui = await fetch(`${BASE}/`);
  if (ui.status === 200) {
    const html = await ui.text();
    assert(html.includes('<!DOCTYPE html') || html.includes('<html'), 'index.html served');
    console.log('✓ GET / (web UI)');
  } else {
    console.log('⊘ GET / (no dist build — run npm run build for UI)');
  }

  console.log('\n✅ All smoke checks passed.');
}

main().catch((e) => {
  console.error('\n❌ Smoke test failed:', e.message);
  process.exit(1);
});
