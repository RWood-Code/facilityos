const fs = require('fs');
const path = require('path');

let dataDir = path.join(__dirname, '..', 'data');

function setDataDir(dir) {
  if (dir) dataDir = dir;
}

function getDataDir() {
  return dataDir;
}

function getRegistryFile() {
  return path.join(dataDir, 'issued.json');
}

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const file = getRegistryFile();
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({ records: [] }, null, 2), 'utf8');
  }
}

function readRegistry() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(getRegistryFile(), 'utf8'));
  } catch {
    return { records: [] };
  }
}

function writeRegistry(data) {
  ensureStore();
  fs.writeFileSync(getRegistryFile(), JSON.stringify(data, null, 2), 'utf8');
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function listIssued() {
  const { records } = readRegistry();
  return records.sort((a, b) => (b.issued_at || '').localeCompare(a.issued_at || ''));
}

function addIssued(pkg, notes) {
  const store = readRegistry();
  const record = {
    id: genId(),
    issued_at: new Date().toISOString(),
    organisation: pkg.organisation,
    site_code: pkg.site_code || null,
    licence_key: pkg.licence_key,
    plan: pkg.plan,
    expires_at: pkg.expires_at,
    max_terminals: pkg.max_terminals,
    moduleList: pkg.moduleList,
    modules: pkg.modules,
    notes: notes || null,
    package: pkg,
  };
  store.records.unshift(record);
  writeRegistry(store);
  return record;
}

function removeIssued(id) {
  const store = readRegistry();
  const before = store.records.length;
  store.records = store.records.filter((r) => r.id !== id);
  writeRegistry(store);
  return { removed: before - store.records.length };
}

module.exports = {
  setDataDir,
  getDataDir,
  listIssued,
  addIssued,
  removeIssued,
  get REGISTRY_FILE() { return getRegistryFile(); },
};
