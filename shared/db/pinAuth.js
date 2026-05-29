const bcrypt = require('bcrypt');

const BCRYPT_COST = Number(process.env.FACILITYOS_PIN_BCRYPT_COST || 12);
const BCRYPT_PREFIX = '$2';

function isBcryptHash(value) {
  return typeof value === 'string' && value.startsWith(BCRYPT_PREFIX);
}

async function hashPin(pin) {
  if (pin == null || pin === '') return null;
  return bcrypt.hash(String(pin), BCRYPT_COST);
}

async function verifyPin(plainPin, stored) {
  if (!stored || plainPin == null) return false;
  const pin = String(plainPin);
  if (isBcryptHash(stored)) {
    return bcrypt.compare(pin, stored);
  }
  // Legacy plaintext — timing-safe compare
  const a = Buffer.from(pin);
  const b = Buffer.from(String(stored));
  if (a.length !== b.length) return false;
  return require('crypto').timingSafeEqual(a, b);
}

async function hashPinIfNeeded(pin) {
  if (pin == null || pin === '') return null;
  if (isBcryptHash(pin)) return pin;
  return hashPin(pin);
}

/** Upgrade plaintext PINs in existing databases (runs once per row). */
async function migratePlaintextPins(api) {
  const rows = await api.all(`SELECT id, pin FROM staff WHERE pin IS NOT NULL AND pin != ''`);
  let migrated = 0;
  for (const row of rows) {
    if (isBcryptHash(row.pin)) continue;
    const hashed = await hashPin(row.pin);
    await api.run(`UPDATE staff SET pin=? WHERE id=?`, [hashed, row.id]);
    migrated++;
  }
  if (migrated > 0) {
    console.log(`[auth] Migrated ${migrated} staff PIN(s) to bcrypt`);
  }
  return migrated;
}

async function findStaffByPin(api, pin) {
  const rows = await api.all(
    `SELECT * FROM staff WHERE status='active' AND pin IS NOT NULL AND pin != ''`
  );
  for (const row of rows) {
    if (await verifyPin(pin, row.pin)) {
      return row;
    }
  }
  return null;
}

module.exports = {
  BCRYPT_COST,
  isBcryptHash,
  hashPin,
  verifyPin,
  hashPinIfNeeded,
  migratePlaintextPins,
  findStaffByPin,
};
