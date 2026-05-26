#!/usr/bin/env node
/**
 * Generate a new Ed25519 keypair for FacilityOS licence signing.
 *
 * Usage:
 *   node scripts/generate-licence-keys.js
 *   node scripts/generate-licence-keys.js --out-dir ./licence-issuer/data
 *
 * Production:
 *   - Keep private key secure (FACILITYOS_LICENCE_PRIVATE_KEY or signing-key.pem)
 *   - Embed PUBLIC_KEY_PEM in shared/db/licenceKeys.js in the customer app build
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { outDir: path.join(__dirname, '..', 'licence-issuer', 'data') };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--out-dir') args.outDir = argv[++i];
  }
  return args;
}

const { outDir } = parseArgs(process.argv);
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const privatePath = path.join(outDir, 'signing-key.pem');
const publicPath = path.join(outDir, 'signing-public.pem');

fs.writeFileSync(privatePath, privatePem, 'utf8');
fs.writeFileSync(publicPath, publicPem, 'utf8');

console.log('\nFacilityOS licence signing keys generated\n');
console.log(`Private key: ${privatePath}`);
console.log(`Public key:  ${publicPath}`);
console.log('\nNext steps:');
console.log('1. Copy the PUBLIC key into shared/db/licenceKeys.js (PUBLIC_KEY_PEM)');
console.log('2. Keep the private key off customer machines — Issuer reads signing-key.pem or FACILITYOS_LICENCE_PRIVATE_KEY');
console.log('3. Rebuild FacilityOS Server/Terminal and Licence Issuer\n');
console.log('--- PUBLIC_KEY_PEM ---');
console.log(publicPem);
