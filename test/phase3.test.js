#!/usr/bin/env node
/**
 * Phase 3 — storage adapter + session auth (self-host legacy path unchanged).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStaffSession, verifySessionToken } = require('../server/auth/session');
const { createLocalStorageAdapter } = require('../server/storage/local');
const { hashPin, verifyPin, isBcryptHash } = require('../shared/db/pinAuth');
const { assertAllowedUpload } = require('../server/storage/validate');
const { resolveAuthMode, getDeploymentConfig } = require('../shared/db/deployment');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function withEnv(overrides, fn) {
  const saved = {};
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key];
    if (overrides[key] === undefined) delete process.env[key];
    else process.env[key] = overrides[key];
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

async function testSessionTokens() {
  process.env.FACILITYOS_SESSION_SECRET = 'test-secret-phase3';
  const staff = { id: 's1', first_name: 'Test', last_name: 'User', role: 'operator' };
  const session = createStaffSession(staff, { terminalId: 't1' });
  assert(session.token, 'session token created');
  assert(session.staff.id === 's1', 'staff id in response');

  const payload = verifySessionToken(session.token);
  assert(payload && payload.sub === 's1', 'token verifies');
  assert(payload.name === 'Test User', 'name in payload');
  assert(verifySessionToken('bad.token') === null, 'invalid token rejected');
  console.log('✓ session token create/verify');
}

async function testLocalStorage() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fos-upload-'));
  const storage = createLocalStorageAdapter(tmpDir);
  const data = Buffer.from('hello phase3').toString('base64');
  const saved = await storage.save({ filename: 'note.txt', data, subfolder: 'iltp' });
  assert(saved.stored_path.startsWith('iltp/'), 'stored under folder');
  assert(saved.url.includes(saved.stored_path), 'url matches path');

  const opened = await storage.open(saved.stored_path);
  assert(opened && opened.stream, 'file opens');
  const chunks = [];
  await new Promise((resolve, reject) => {
    opened.stream.on('data', (c) => chunks.push(c));
    opened.stream.on('end', resolve);
    opened.stream.on('error', reject);
  });
  assert(Buffer.concat(chunks).toString('utf8') === 'hello phase3', 'round-trip content');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('✓ local storage save/open');
}

function testAuthModeDefaults() {
  withEnv({ FACILITYOS_DEPLOYMENT: undefined, FACILITYOS_AUTH_MODE: undefined }, () => {
    assert(resolveAuthMode('selfhost') === 'legacy', 'selfhost defaults legacy');
  });
  withEnv({ FACILITYOS_DEPLOYMENT: 'hosted', FACILITYOS_AUTH_MODE: undefined }, () => {
    assert(resolveAuthMode('hosted') === 'session', 'hosted defaults session');
  });
  withEnv({ FACILITYOS_DEPLOYMENT: 'selfhost', FACILITYOS_AUTH_MODE: 'session' }, () => {
    const cfg = getDeploymentConfig();
    assert(cfg.authMode === 'session', 'explicit session override');
  });
  console.log('✓ auth mode defaults (legacy self-host preserved)');
}

async function testPinHashing() {
  const hashed = await hashPin('1234');
  assert(isBcryptHash(hashed), 'pin hashed with bcrypt');
  assert(await verifyPin('1234', hashed), 'bcrypt pin verifies');
  assert(!(await verifyPin('9999', hashed)), 'wrong pin rejected');
  assert(await verifyPin('1234', '1234'), 'legacy plaintext still works during migration');
  console.log('✓ PIN bcrypt hash/verify');
}

function testUploadAllowlist() {
  assertAllowedUpload('report.pdf');
  let blocked = false;
  try { assertAllowedUpload('evil.html'); } catch (e) { blocked = e.status === 415; }
  assert(blocked, 'html upload blocked');
  console.log('✓ upload extension allowlist');
}

async function testHostedSessionAuth() {
  const { isSessionBypass } = require('../server/auth/routes');
  const hostedCfg = { isHosted: true, deployment: 'hosted' };
  const selfCfg = { isHosted: false, deployment: 'selfhost' };
  assert(!isSessionBypass({ ip: '10.0.0.1', socket: {} }, hostedCfg), 'hosted blocks RFC1918 bypass');
  assert(isSessionBypass({ ip: '127.0.0.1', socket: {} }, hostedCfg), 'hosted allows localhost');
  assert(isSessionBypass({ ip: '10.0.0.1', socket: {} }, selfCfg), 'selfhost still allows LAN');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fos-hosted-'));
  const port = 38900 + Math.floor(Math.random() * 500);
  process.env.FACILITYOS_DEPLOYMENT = 'selfhost';
  process.env.FACILITYOS_AUTH_MODE = 'session';
  process.env.FACILITYOS_DATA_DIR = tmpDir;
  process.env.FACILITYOS_DB_PATH = path.join(tmpDir, 'test.db');
  process.env.FACILITYOS_PORT = String(port);
  process.env.FACILITYOS_SESSION_SECRET = 'hosted-session-test';

  delete require.cache[require.resolve('../server/index.js')];
  const { startServer } = require('../server/index.js');
  let handle;
  try {
    handle = await startServer({ port, host: '127.0.0.1' });
    const base = `http://127.0.0.1:${port}`;

    const pinRes = await fetch(`${base}/api/auth/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' }),
    }).then((r) => r.json());
    assert(pinRes.ok, 'PIN login works after bcrypt migration');

    const ok = await fetch(`${base}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pinRes.data.token}`,
      },
      body: JSON.stringify({ channel: 'pools:list' }),
    }).then((r) => r.json());
    assert(ok.ok && Array.isArray(ok.data), 'session token grants API access');

    console.log('✓ hosted session auth + bypass rules');
  } finally {
    if (handle?.server) {
      await new Promise((r) => handle.server.close(r));
      try {
        const { getDatabase } = require('../server/index.js');
        await getDatabase().close();
      } catch { /* ignore */ }
    }
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

async function testServerIntegration() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fos-srv-'));
  const port = 38400 + Math.floor(Math.random() * 500);
  process.env.FACILITYOS_DEPLOYMENT = 'selfhost';
  process.env.FACILITYOS_AUTH_MODE = 'legacy';
  process.env.FACILITYOS_DATA_DIR = tmpDir;
  process.env.FACILITYOS_DB_PATH = path.join(tmpDir, 'test.db');
  process.env.FACILITYOS_PORT = String(port);
  process.env.FACILITYOS_SESSION_SECRET = 'integration-test';

  delete require.cache[require.resolve('../server/index.js')];
  const { startServer } = require('../server/index.js');
  let handle;
  try {
    handle = await startServer({ port, host: '127.0.0.1' });
    const base = `http://127.0.0.1:${port}`;

    const health = await fetch(`${base}/api/health`).then((r) => r.json());
    assert(health.ok && health.deployment.authMode === 'legacy', 'legacy health');

    const pinRes = await fetch(`${base}/api/auth/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' }),
    }).then((r) => r.json());
    assert(pinRes.ok || pinRes.error === 'invalid_pin', 'auth/pin endpoint reachable');

    const tiny = Buffer.from('x').toString('base64');
    const up = await fetch(`${base}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 't.txt', data: tiny }),
    }).then((r) => r.json());
    assert(up.ok && up.data.stored_path, 'upload on legacy LAN');

    console.log('✓ server integration (legacy self-host path)');
  } finally {
    if (handle?.server) {
      await new Promise((r) => handle.server.close(r));
      try {
        const { getDatabase } = require('../server/index.js');
        await getDatabase().close();
      } catch { /* ignore */ }
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* Windows may hold sqlite lock briefly */
    }
  }
}

async function main() {
  await testSessionTokens();
  await testPinHashing();
  testUploadAllowlist();
  await testLocalStorage();
  testAuthModeDefaults();
  await testServerIntegration();
  await testHostedSessionAuth();
  console.log('\nAll Phase 3 tests passed.');
}

main().catch((e) => {
  console.error('Phase 3 tests failed:', e.message);
  process.exit(1);
});
