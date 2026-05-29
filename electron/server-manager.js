const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const { getServerRuntime } = require('./runtime');

let serverProcess = null;
let startedPort = null;

async function waitForHealth(url, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    const health = await fetchHealth(url);
    if (health?.ok) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function fetchHealth(url) {
  try {
    const res = await fetch(`${String(url).replace(/\/$/, '')}/api/health`);
    if (!res.ok) return null;
    return res.json();
  } catch (_) {
    return null;
  }
}

/** True when the process on this port is our SQLite self-host server (not Docker hosted / dev postgres). */
function isEmbeddedSelfHostHealth(health) {
  if (!health?.ok) return false;
  const { mode, dbDriver } = health.deployment || {};
  if (mode === 'selfhost' && dbDriver === 'sqlite') return true;
  // Pre-1.6 health payloads without deployment block
  return !mode && Boolean(health.dbPath);
}

async function startEmbeddedServer(port) {
  if (serverProcess && startedPort === port) {
    const url = `http://127.0.0.1:${port}`;
    if (await waitForHealth(url, 3)) return url;
  }

  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }

  const script = path.join(__dirname, '../server/index.js');
  const dataDir = path.join(
    process.env.PROGRAMDATA || process.env.APPDATA || os.homedir(),
    'FacilityOS',
    'data'
  );

  const runtime = getServerRuntime();
  serverProcess = spawn(runtime.exec, [script], {
    env: {
      ...process.env,
      ...runtime.extraEnv,
      // Always self-host SQLite for the Server installer — ignore dev/Docker env on the PC
      FACILITYOS_DEPLOYMENT: 'selfhost',
      FACILITYOS_AUTH_MODE: 'legacy',
      FACILITYOS_DB_DRIVER: 'sqlite',
      FACILITYOS_STORAGE: 'local',
      FACILITYOS_PORT: String(port),
      FACILITYOS_HOST: '0.0.0.0',
      FACILITYOS_DATA_DIR: dataDir,
    },
    stdio: 'pipe',
    windowsHide: true,
  });

  serverProcess.stdout?.on('data', (d) => console.log('[server]', d.toString().trim()));
  serverProcess.stderr?.on('data', (d) => console.error('[server]', d.toString().trim()));
  serverProcess.on('exit', (code) => {
    console.log('[server] exited', code);
    serverProcess = null;
    startedPort = null;
  });

  startedPort = port;
  const url = `http://127.0.0.1:${port}`;
  const ok = await waitForHealth(url);
  if (!ok) throw new Error('FacilityOS data server did not start');
  return url;
}

function stopEmbeddedServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
    startedPort = null;
  }
}

module.exports = {
  startEmbeddedServer,
  stopEmbeddedServer,
  waitForHealth,
  fetchHealth,
  isEmbeddedSelfHostHealth,
};
