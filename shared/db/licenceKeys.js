const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/** Public key embedded in the customer app — safe to ship. */
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAhn1+CGtqKYQpwBrkWDZEnTxV4L3MZY3Lb74/0e7jn0k=
-----END PUBLIC KEY-----`;

/**
 * Default development signing key for the Licence Issuer.
 * Production: set FACILITYOS_LICENCE_PRIVATE_KEY or place signing-key.pem in licence-issuer/data/.
 */
const DEV_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIMrAymXpV/RgOrII7SYWMvpTquTiJsZX3UDAMcSUeE0/
-----END PRIVATE KEY-----`;

let cachedPublicKey;
let cachedPrivateKey;

function getPublicKey() {
  if (!cachedPublicKey) {
    cachedPublicKey = crypto.createPublicKey(PUBLIC_KEY_PEM);
  }
  return cachedPublicKey;
}

function readPrivateKeyPemFromEnvOrFile() {
  const env = process.env.FACILITYOS_LICENCE_PRIVATE_KEY;
  if (env) {
    return env.includes('BEGIN') ? env : Buffer.from(env, 'base64').toString('utf8');
  }

  const candidates = [
    path.join(process.cwd(), 'licence-issuer', 'data', 'signing-key.pem'),
    path.join(__dirname, '..', '..', 'licence-issuer', 'data', 'signing-key.pem'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      return fs.readFileSync(file, 'utf8');
    }
  }

  return DEV_PRIVATE_KEY_PEM;
}

function getPrivateKey() {
  if (!cachedPrivateKey) {
    cachedPrivateKey = crypto.createPrivateKey(readPrivateKeyPemFromEnvOrFile());
  }
  return cachedPrivateKey;
}

module.exports = {
  PUBLIC_KEY_PEM,
  getPublicKey,
  getPrivateKey,
};
