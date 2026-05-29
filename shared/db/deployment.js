/**
 * FacilityOS deployment profile — self-host vs hosted (Azure/AWS).
 * @see DEPLOYMENT.md
 */

const VALID_DEPLOYMENTS = new Set(['selfhost', 'hosted']);
const VALID_DRIVERS = new Set(['sqlite', 'postgres']);
const VALID_AUTH_MODES = new Set(['legacy', 'session']);

function resolveDbDriver(deployment) {
  const explicit = (process.env.FACILITYOS_DB_DRIVER || '').trim().toLowerCase();
  if (explicit && VALID_DRIVERS.has(explicit)) return explicit;
  if (deployment === 'hosted') return 'postgres';
  return 'sqlite';
}

function resolveAuthMode(deployment) {
  const explicit = (process.env.FACILITYOS_AUTH_MODE || '').trim().toLowerCase();
  if (explicit && VALID_AUTH_MODES.has(explicit)) return explicit;
  return deployment === 'hosted' ? 'session' : 'legacy';
}

function getDeploymentConfig() {
  const raw = (process.env.FACILITYOS_DEPLOYMENT || 'selfhost').trim().toLowerCase();
  const deployment = VALID_DEPLOYMENTS.has(raw) ? raw : 'selfhost';
  const dbDriver = resolveDbDriver(deployment);

  if (deployment === 'hosted' && dbDriver !== 'postgres') {
    throw new Error('FACILITYOS_DEPLOYMENT=hosted requires FACILITYOS_DB_DRIVER=postgres');
  }

  const storageBackend = (process.env.FACILITYOS_STORAGE || (deployment === 'hosted' ? 'blob' : 'local')).trim().toLowerCase();

  return {
    deployment,
    dbDriver,
    authMode: resolveAuthMode(deployment),
    isSelfHost: deployment === 'selfhost',
    isHosted: deployment === 'hosted',
    publicUrl: (process.env.FACILITYOS_PUBLIC_URL || '').trim().replace(/\/$/, '') || null,
    storageBackend,
  };
}

module.exports = {
  VALID_DEPLOYMENTS,
  VALID_DRIVERS,
  VALID_AUTH_MODES,
  getDeploymentConfig,
  resolveDbDriver,
  resolveAuthMode,
};
