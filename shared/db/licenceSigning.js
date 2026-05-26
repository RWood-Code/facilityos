const crypto = require('crypto');
const { getPublicKey, getPrivateKey } = require('./licenceKeys');

const LICENCE_SIGNING_VERSION = 2;
const LICENCE_FORMAT = 'facilityos-licence';
const LICENCE_ALGORITHM = 'ed25519';

const LICENCE_KEY_RE = /^FACILITYOS-(TRIAL|STD|PRO|ENT)-[A-Z0-9]{1,8}-\d{4}-[A-Z0-9]{4}$/;

function getSigningSecret() {
  return process.env.FACILITYOS_LICENCE_SECRET || 'facilityos-v1-licence-signing-do-not-share';
}

function validateLicenceKeyFormat(licenceKey) {
  const key = String(licenceKey || '').trim().toUpperCase();
  if (!LICENCE_KEY_RE.test(key)) {
    throw new Error('Licence key format is invalid');
  }
  return key;
}

function buildLicencePayload(input) {
  const body = {
    licence_key: validateLicenceKeyFormat(input.licence_key),
    plan: input.plan || 'standard',
    organisation: input.organisation || null,
    expires_at: String(input.expires_at || '').slice(0, 10),
    max_terminals: Math.max(1, parseInt(input.max_terminals, 10) || 10),
    modules: input.modules || null,
    features: input.features || null,
  };

  if (!body.expires_at || Number.isNaN(new Date(body.expires_at).getTime())) {
    throw new Error('Invalid expiry date');
  }

  return body;
}

function payloadSigningBytes(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8');
}

function signLicenceDocument(payloadInput, { pretty = true, issued_at } = {}) {
  const payload = buildLicencePayload(payloadInput);
  const signature = crypto.sign(null, payloadSigningBytes(payload), getPrivateKey()).toString('base64url');
  const document = {
    format: LICENCE_FORMAT,
    version: LICENCE_SIGNING_VERSION,
    algorithm: LICENCE_ALGORITHM,
    issued_at: issued_at || new Date().toISOString(),
    payload,
    signature,
  };
  const licence_file = pretty
    ? `${JSON.stringify(document, null, 2)}\n`
    : JSON.stringify(document);
  return { document, payload, signature, licence_file };
}

function verifyLicenceDocument(document) {
  if (!document || typeof document !== 'object') {
    throw new Error('Licence file is invalid');
  }
  if (document.format !== LICENCE_FORMAT) {
    throw new Error('Unrecognised licence file format');
  }
  if (document.version !== LICENCE_SIGNING_VERSION) {
    throw new Error('Unsupported licence file version');
  }
  if (document.algorithm !== LICENCE_ALGORITHM) {
    throw new Error('Unsupported licence signature algorithm');
  }
  if (!document.payload || !document.signature) {
    throw new Error('Licence file is incomplete');
  }

  const payload = buildLicencePayload(document.payload);
  const ok = crypto.verify(
    null,
    payloadSigningBytes(payload),
    getPublicKey(),
    Buffer.from(document.signature, 'base64url'),
  );
  if (!ok) {
    throw new Error('Licence signature is invalid — file may be forged or corrupted');
  }

  return {
    ...payload,
    issued_at: document.issued_at || null,
  };
}

function parseLicenceDocumentText(text) {
  let document;
  try {
    document = JSON.parse(String(text || '').trim());
  } catch {
    throw new Error('Could not read licence file — expected JSON from your vendor');
  }
  return verifyLicenceDocument(document);
}

/** Legacy HMAC activation codes (v1) — kept for transition. */
function verifyActivationCode(code) {
  if (!code || typeof code !== 'string') {
    throw new Error('Activation code is required');
  }

  const trimmed = code.trim();
  const dot = trimmed.indexOf('.');
  if (dot <= 0) {
    throw new Error('Invalid activation code — ask your vendor for a facilityos.lic file');
  }

  const json = Buffer.from(trimmed.slice(0, dot), 'base64url').toString('utf8');
  const sig = trimmed.slice(dot + 1);
  const expected = crypto.createHmac('sha256', getSigningSecret()).update(json).digest('base64url');

  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('Activation code is invalid or has been altered');
  }

  const body = JSON.parse(json);
  if (body.v !== 1) {
    throw new Error('Unsupported activation code version');
  }

  return buildLicencePayload(body);
}

function signActivationPayload(payload) {
  const body = { v: 1, ...buildLicencePayload(payload) };
  const json = JSON.stringify(body);
  const encoded = Buffer.from(json, 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSigningSecret()).update(json).digest('base64url');
  return `${encoded}.${sig}`;
}

/** Accept .lic JSON, legacy package JSON, legacy HMAC code, or minified licence document. */
function parseLicenceInput(raw) {
  const text = String(raw || '').trim();
  if (!text) throw new Error('Licence file is required');

  if (text.startsWith('{')) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Could not read licence file JSON');
    }

    if (parsed.format === LICENCE_FORMAT) {
      return verifyLicenceDocument(parsed);
    }
    if (parsed.activation_code) {
      return parseLicenceInput(parsed.activation_code);
    }
    if (parsed.licence_file) {
      return parseLicenceInput(parsed.licence_file);
    }
    if (parsed.payload && parsed.signature) {
      return verifyLicenceDocument(parsed);
    }
    throw new Error('Licence file is missing a valid signature block');
  }

  return verifyActivationCode(text);
}

module.exports = {
  LICENCE_FORMAT,
  LICENCE_KEY_RE,
  buildLicencePayload,
  signLicenceDocument,
  verifyLicenceDocument,
  parseLicenceDocumentText,
  signActivationPayload,
  verifyActivationCode,
  parseLicenceInput,
  parseActivationInput: parseLicenceInput,
  validateLicenceKeyFormat,
};
