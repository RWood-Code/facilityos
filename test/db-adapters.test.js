#!/usr/bin/env node
/**
 * Phase 1 adapter tests — SQLite always; PostgreSQL when FACILITYOS_DATABASE_URL is set
 * or --postgres flag with a running local Postgres.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openSqliteDatabase } = require('../shared/db/adapters/sqlite');
const { executeQuery } = require('../shared/db/handlers');
const { getDeploymentConfig } = require('../shared/db/deployment');

const runPostgres = process.argv.includes('--postgres') || !!process.env.FACILITYOS_DATABASE_URL;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runCoreChannelTests(label, api) {
  const pools = await executeQuery(api, 'pools:list', {});
  assert(Array.isArray(pools) && pools.length >= 1, `${label}: pools:list`);
  assert(pools[0].name, `${label}: pool has name`);

  const settings = await executeQuery(api, 'settings:all', {});
  assert(settings.facility_name, `${label}: settings:all`);

  const licence = await executeQuery(api, 'licence:status', {});
  assert(licence && typeof licence.valid === 'boolean', `${label}: licence:status`);

  const testId = (await executeQuery(api, 'tests:create', {
    pool_id: pools[0].id,
    test_date: new Date().toISOString().slice(0, 10),
    test_time: '10:00',
    tested_by: 'Phase1 Test',
    ph: 7.4,
    free_chlorine: 2.0,
    is_compliant: 1,
    test_type: 'routine',
  })).id;
  assert(testId, `${label}: tests:create`);

  await executeQuery(api, 'settings:set', { key: 'phase1_test', value: 'ok' });
  const val = await executeQuery(api, 'settings:get', 'phase1_test');
  assert(val === 'ok', `${label}: settings:set/get upsert`);
}

async function testSqlite() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'facilityos-test-'));
  const dbPath = path.join(tmpDir, 'test.db');
  const conn = openSqliteDatabase(dbPath);
  try {
    await runCoreChannelTests('sqlite', conn.api);
    console.log('✓ sqlite adapter + core channels');
  } finally {
    conn.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function testPostgres() {
  if (!runPostgres) {
    console.log('⊘ postgres tests skipped (set FACILITYOS_DATABASE_URL or pass --postgres)');
    return;
  }
  process.env.FACILITYOS_DEPLOYMENT = 'hosted';
  process.env.FACILITYOS_DB_DRIVER = 'postgres';
  const dbName = `facilityos_test_${Date.now()}`;
  const baseUrl = process.env.FACILITYOS_DATABASE_URL || process.env.DATABASE_URL;
  const adminUrl = process.env.FACILITYOS_DATABASE_ADMIN_URL || baseUrl;

  const { Client } = require('pg');
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();

  const testUrl = adminUrl.replace(/\/[^/]+$/, `/${dbName}`);
  process.env.FACILITYOS_DATABASE_URL = testUrl;

  const { openPostgresDatabase } = require('../shared/db/adapters/postgres');
  const conn = await openPostgresDatabase(testUrl);
  try {
    await runCoreChannelTests('postgres', conn.api);
    console.log('✓ postgres adapter + core channels');
  } finally {
    await conn.close();
    const drop = new Client({ connectionString: adminUrl });
    await drop.connect();
    await drop.query(`DROP DATABASE ${dbName}`);
    await drop.end();
  }
}

async function testDeploymentConfig() {
  process.env.FACILITYOS_DEPLOYMENT = 'selfhost';
  delete process.env.FACILITYOS_DB_DRIVER;
  const self = getDeploymentConfig();
  assert(self.deployment === 'selfhost' && self.dbDriver === 'sqlite', 'selfhost defaults to sqlite');

  process.env.FACILITYOS_DEPLOYMENT = 'hosted';
  const hosted = getDeploymentConfig();
  assert(hosted.deployment === 'hosted' && hosted.dbDriver === 'postgres', 'hosted defaults to postgres');
  console.log('✓ deployment config');
}

(async () => {
  await testDeploymentConfig();
  await testSqlite();
  await testPostgres();
  console.log('\nAll Phase 1 DB tests passed.');
})().catch((err) => {
  console.error('\nPhase 1 DB tests FAILED:', err.message);
  process.exit(1);
});
