const { execFileSync } = require('child_process');
const { app } = require('electron');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

function tryRuntimeExec(exec, extraEnv = {}) {
  try {
    execFileSync(exec, ['-e', "require('better-sqlite3')"], {
      cwd: projectRoot,
      stdio: 'pipe',
      windowsHide: true,
      env: { ...process.env, ...extraEnv },
    });
    return true;
  } catch {
    return false;
  }
}

/** Find a Node binary that can load better-sqlite3 (dev only). */
function resolveDevNodeExec() {
  const candidates = [process.env.FACILITYOS_NODE, process.env.npm_node_execpath, process.env.NODE].filter(Boolean);

  if (process.platform === 'win32') {
    try {
      const found = execFileSync('where.exe', ['node'], { encoding: 'utf8', windowsHide: true })
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      candidates.push(...found);
    } catch {
      /* where.exe unavailable */
    }
  }

  candidates.push('node');

  const seen = new Set();
  for (const exec of candidates) {
    if (seen.has(exec)) continue;
    seen.add(exec);
    if (tryRuntimeExec(exec)) return exec;
  }

  throw new Error(
    'better-sqlite3 native module mismatch. From the project folder run: npm run rebuild:electron (for npm run dev) or npm run rebuild:node (for node server/index.js).'
  );
}

/** Packaged: Electron's Node. Dev: Electron-as-Node first (matches electron-rebuilt native modules). */
function getServerRuntime() {
  const electronEnv = { ELECTRON_RUN_AS_NODE: '1' };
  if (app.isPackaged || tryRuntimeExec(process.execPath, electronEnv)) {
    return { exec: process.execPath, extraEnv: electronEnv };
  }
  return { exec: resolveDevNodeExec(), extraEnv: {} };
}

/** Lightweight scripts (cloud agent) — Electron Node when packaged or when it loads native modules. */
function getScriptRuntime() {
  const electronEnv = { ELECTRON_RUN_AS_NODE: '1' };
  if (app.isPackaged || tryRuntimeExec(process.execPath, electronEnv)) {
    return { exec: process.execPath, extraEnv: electronEnv };
  }
  return { exec: resolveDevNodeExec(), extraEnv: {} };
}

function getInstallVariant() {
  try {
    return require('../package.json').facilityosVariant || 'server';
  } catch {
    return 'server';
  }
}

module.exports = {
  getServerRuntime,
  getScriptRuntime,
  getInstallVariant,
};
