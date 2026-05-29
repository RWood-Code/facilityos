#!/usr/bin/env node
/**
 * Local session-auth smoke (no Docker) — same auth flow as hosted, SQLite backend.
 * Starts a temp server, runs checks, shuts down.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3850 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}`;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fos-smoke-session-'));

function assert(c, msg) {
  if (!c) throw new Error(msg);
}

async function json(urlPath, opts = {}) {
  const res = await fetch(`${BASE}${urlPath}`, opts);
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function waitForHealth() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      const b = await r.json();
      if (b.ok) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server did not start');
}

async function main() {
  console.log('Session-auth local smoke (SQLite, no Docker)\n');

  const env = {
    ...process.env,
    FACILITYOS_PORT: String(PORT),
    FACILITYOS_DEPLOYMENT: 'selfhost',
    FACILITYOS_AUTH_MODE: 'session',
    FACILITYOS_DATA_DIR: tmpDir,
    FACILITYOS_DB_PATH: path.join(tmpDir, 'smoke.db'),
    FACILITYOS_SESSION_SECRET: 'local-session-smoke',
    FACILITYOS_PUBLIC_URL: BASE,
  };

  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: path.join(__dirname, '..'),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let logs = '';
  child.stdout.on('data', (d) => { logs += d; });
  child.stderr.on('data', (d) => { logs += d; });

  try {
    await waitForHealth();
    console.log(`Server up on ${BASE}\n`);

    // Selfhost + session: localhost bypass is intentional (same as LAN on desktop)
    const open = await json('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'pools:list' }),
    });
    assert(open.body.ok, 'localhost allowed without session on selfhost');
    console.log('✓ localhost bypass (selfhost session mode)');

    const pin = await json('/api/auth/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' }),
    });
    assert(pin.body.ok && pin.body.data?.token, 'PIN login');
    const token = pin.body.data.token;
    console.log(`✓ PIN login (${pin.body.data.staff?.name})`);

    const pools = await json('/api/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel: 'pools:list' }),
    });
    assert(pools.body.ok && pools.body.data?.length >= 1, 'pools with session');
    console.log(`✓ pools:list (${pools.body.data.length} pools)`);

    const tiny = Buffer.from('session-smoke').toString('base64');
    const up = await json('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ filename: 's.txt', data: tiny }),
    });
    assert(up.body.ok, 'upload');
    console.log('✓ upload with session');

    console.log('\n✅ Session-auth local smoke passed.');
    console.log('\nFor full Postgres hosted stack: start Docker Desktop, then run:');
    console.log('  npm run smoke:docker:hosted');
  } finally {
    child.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

main().catch((e) => {
  console.error('\n❌', e.message);
  process.exit(1);
});
