const fs = require('fs');
const path = require('path');
const os = require('os');

const LICENCE_FILENAME = 'facilityos.lic';

let configuredDataDir = null;

function setLicenceDataDir(dataDir) {
  configuredDataDir = dataDir || null;
}

function resolveDataDir() {
  if (configuredDataDir) return configuredDataDir;
  return process.env.FACILITYOS_DATA_DIR || path.join(
    process.env.PROGRAMDATA || process.env.APPDATA || os.homedir(),
    'FacilityOS',
    'data',
  );
}

function getLicenceDir(dataDir = resolveDataDir()) {
  return path.join(path.dirname(dataDir), 'licence');
}

function getLicenceFilePath(dataDir = resolveDataDir()) {
  return path.join(getLicenceDir(dataDir), LICENCE_FILENAME);
}

function ensureLicenceDir(dataDir = resolveDataDir()) {
  const dir = getLicenceDir(dataDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readLicenceFile(dataDir = resolveDataDir()) {
  const filePath = getLicenceFilePath(dataDir);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function writeLicenceFile(contents, dataDir = resolveDataDir()) {
  ensureLicenceDir(dataDir);
  const filePath = getLicenceFilePath(dataDir);
  fs.writeFileSync(filePath, contents, 'utf8');
  return filePath;
}

function getLicenceFileInfo(dataDir = resolveDataDir()) {
  const filePath = getLicenceFilePath(dataDir);
  const directory = getLicenceDir(dataDir);
  if (!fs.existsSync(filePath)) {
    return { path: filePath, directory, exists: false, filename: LICENCE_FILENAME };
  }
  const stat = fs.statSync(filePath);
  return {
    path: filePath,
    directory,
    exists: true,
    filename: LICENCE_FILENAME,
    size: stat.size,
    modified_at: stat.mtime.toISOString(),
  };
}

module.exports = {
  LICENCE_FILENAME,
  setLicenceDataDir,
  resolveDataDir,
  getLicenceDir,
  getLicenceFilePath,
  ensureLicenceDir,
  readLicenceFile,
  writeLicenceFile,
  getLicenceFileInfo,
};
