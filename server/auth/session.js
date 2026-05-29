const crypto = require('crypto');

const DEFAULT_TTL_HOURS = 12;

function resolveSessionSecret() {
  const secret = process.env.FACILITYOS_SESSION_SECRET || process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.FACILITYOS_DEPLOYMENT === 'hosted') {
    console.warn('[auth] FACILITYOS_SESSION_SECRET not set — using ephemeral dev secret (sessions reset on restart)');
  }
  return 'facilityos-dev-session-secret-change-in-production';
}

function getSessionTtlMs() {
  const hours = Number(process.env.FACILITYOS_SESSION_TTL_HOURS || DEFAULT_TTL_HOURS);
  return Math.max(1, hours) * 60 * 60 * 1000;
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signSessionPayload(payload, secret) {
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const secret = resolveSessionSecret();
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.sub || !payload?.exp) return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function createStaffSession(staff, { terminalId } = {}) {
  const now = Date.now();
  const payload = {
    sub: staff.id,
    name: `${staff.first_name} ${staff.last_name}`.trim(),
    role: staff.role,
    terminalId: terminalId || null,
    iat: now,
    exp: now + getSessionTtlMs(),
  };
  return {
    token: signSessionPayload(payload, resolveSessionSecret()),
    expiresAt: new Date(payload.exp).toISOString(),
    staff: {
      id: staff.id,
      name: payload.name,
      role: staff.role,
    },
  };
}

function extractBearerToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return (req.headers['x-facilityos-session'] || '').trim() || null;
}

module.exports = {
  resolveSessionSecret,
  getSessionTtlMs,
  createStaffSession,
  verifySessionToken,
  extractBearerToken,
};
