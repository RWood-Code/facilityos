const { getDeploymentConfig } = require('../deployment');
const { openSqliteDatabase } = require('./sqlite');
const { openPostgresDatabase } = require('./postgres');

/**
 * Open the configured database backend.
 * @param {{ dbPath?: string, connectionString?: string }} options
 */
async function openDatabase(options = {}) {
  const config = getDeploymentConfig();
  const driver = config.dbDriver;

  if (driver === 'postgres') {
    const connectionString = options.connectionString
      || process.env.FACILITYOS_DATABASE_URL
      || process.env.DATABASE_URL;
    const conn = await openPostgresDatabase(connectionString);
    return { ...conn, deployment: config };
  }

  const dbPath = options.dbPath || process.env.FACILITYOS_DB_PATH;
  if (!dbPath) {
    throw new Error('dbPath required for sqlite driver');
  }
  const conn = openSqliteDatabase(dbPath);
  return { ...conn, deployment: config };
}

module.exports = {
  openDatabase,
  openSqliteDatabase,
  openPostgresDatabase,
};
