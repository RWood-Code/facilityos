const crypto = require('crypto');

function generateRemoteToken() {
  return crypto.randomBytes(24).toString('hex');
}

function normalizeIp(raw) {
  if (!raw) return '';
  let ip = String(raw).trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip;
}

function isPrivateIpv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
}

function isLocalOrPrivateRequest(req) {
  const ip = normalizeIp(req.ip || req.socket?.remoteAddress);
  if (!ip || ip === '127.0.0.1' || ip === '::1') return true;
  return isPrivateIpv4(ip);
}

function extractAccessToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return (req.headers['x-facilityos-token'] || '').trim() || null;
}

function readRemoteSettings(get) {
  const enabled = (get(`SELECT value FROM setting WHERE key='remote_access_enabled'`) || {}).value === '1';
  const token = (get(`SELECT value FROM setting WHERE key='remote_access_token'`) || {}).value || '';
  return { enabled, token };
}

function verifyRemoteAccess(req, get) {
  const { enabled, token } = readRemoteSettings(get);
  if (isLocalOrPrivateRequest(req)) return { allowed: true, reason: 'local' };
  if (!enabled) return { allowed: false, reason: 'lan_only' };
  const provided = extractAccessToken(req);
  if (provided && token && provided === token) return { allowed: true, reason: 'token' };
  return { allowed: false, reason: 'remote_auth_required' };
}

module.exports = {
  generateRemoteToken,
  normalizeIp,
  isLocalOrPrivateRequest,
  extractAccessToken,
  readRemoteSettings,
  verifyRemoteAccess,
};
