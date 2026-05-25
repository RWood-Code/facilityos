const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const os = require('os');

const DEFAULT_PORT = 3847;

function configPath() {
  return path.join(app.getPath('userData'), 'terminal-config.json');
}

function defaultConfig() {
  return {
    role: 'server',
    serverUrl: `http://127.0.0.1:${DEFAULT_PORT}`,
    serverPort: DEFAULT_PORT,
    terminalId: `T-${os.hostname().slice(0, 8)}`,
    facilityName: 'EA Networks Centre',
  };
}

function loadConfig() {
  const defaults = defaultConfig();
  try {
    if (fs.existsSync(configPath())) {
      return { ...defaults, ...JSON.parse(fs.readFileSync(configPath(), 'utf8')) };
    }
  } catch (e) {
    console.warn('Config load failed, using defaults', e.message);
  }
  return defaults;
}

function saveConfig(partial) {
  const next = { ...loadConfig(), ...partial };
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(next, null, 2));
  return next;
}

module.exports = { loadConfig, saveConfig, configPath, DEFAULT_PORT };
