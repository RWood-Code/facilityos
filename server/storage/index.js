const { getDeploymentConfig } = require('../../shared/db/deployment');
const { createLocalStorageAdapter } = require('./local');
const { createBlobStorageAdapter } = require('./blob');

let cachedAdapter = null;

function resolveStorageBackend(cfg) {
  const explicit = (process.env.FACILITYOS_STORAGE || '').trim().toLowerCase();
  if (explicit === 'local' || explicit === 'blob') return explicit;
  return cfg.isHosted ? 'blob' : 'local';
}

function createStorageAdapter({ uploadsDir, deploymentConfig } = {}) {
  const cfg = deploymentConfig || getDeploymentConfig();
  const backend = resolveStorageBackend(cfg);

  if (backend === 'blob') {
    try {
      return createBlobStorageAdapter({
        connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING
          || process.env.FACILITYOS_AZURE_STORAGE_CONNECTION_STRING,
        containerName: process.env.AZURE_STORAGE_CONTAINER
          || process.env.FACILITYOS_AZURE_STORAGE_CONTAINER
          || 'uploads',
      });
    } catch (e) {
      console.warn('[storage] Blob adapter unavailable, falling back to local:', e.message);
      return createLocalStorageAdapter(uploadsDir);
    }
  }

  return createLocalStorageAdapter(uploadsDir);
}

function getStorageAdapter({ uploadsDir, deploymentConfig, forceNew = false } = {}) {
  if (!forceNew && cachedAdapter) return cachedAdapter;
  cachedAdapter = createStorageAdapter({ uploadsDir, deploymentConfig });
  console.log(`[storage] Using ${cachedAdapter.backend} storage backend`);
  return cachedAdapter;
}

module.exports = {
  getStorageAdapter,
  createStorageAdapter,
  resolveStorageBackend,
};
