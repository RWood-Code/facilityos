const { getDeploymentConfig, resolveAuthMode } = require('../../shared/db/deployment');
const { isLocalOrPrivateRequest, verifyRemoteAccess, normalizeIp } = require('../../shared/db/remoteAccess');
const { verifySessionToken, extractBearerToken } = require('./session');
const { pinLoginRateLimit } = require('./rateLimit');
const { isSessionPublicQuery } = require('./publicChannels');

const PUBLIC_API_PATHS = new Set([
  '/api/health',
]);

function isPublicApiPath(req) {
  if (PUBLIC_API_PATHS.has(req.path)) return true;
  if (req.path.startsWith('/api/auth/')) return true;
  return false;
}

/** Hosted: only loopback bypasses session auth — not RFC1918 (prevents XFF spoofing). */
function isSessionBypass(req, cfg) {
  if (!cfg.isHosted) return isLocalOrPrivateRequest(req);
  const ip = normalizeIp(req.ip || req.socket?.remoteAddress);
  return ip === '127.0.0.1' || ip === '::1';
}

/**
 * Unified API auth — preserves legacy self-host behaviour by default.
 */
function createApiAuthMiddleware(getDatabase) {
  return async function apiAuth(req, res, next) {
    if (!req.path.startsWith('/api')) return next();
    if (isPublicApiPath(req)) return next();

    try {
      const cfg = getDeploymentConfig();
      const mode = resolveAuthMode(cfg.deployment);
      const db = getDatabase();
      const get = db.api.get.bind(db.api);

      if (mode === 'legacy') {
        const auth = await verifyRemoteAccess(req, get);
        if (!auth.allowed) {
          return res.status(401).json({ ok: false, error: auth.reason || 'remote_auth_required' });
        }
        return next();
      }

      // session mode (hosted)
      if (isSessionBypass(req, cfg)) {
        return next();
      }

      // Licence gate / bootstrap — must work before any staff login
      if (isSessionPublicQuery(req)) {
        return next();
      }

      const bearer = extractBearerToken(req);
      const session = verifySessionToken(bearer);
      if (session) {
        req.staffSession = session;
        return next();
      }

      const remote = await verifyRemoteAccess(req, get);
      if (remote.allowed && remote.reason === 'token') {
        return next();
      }

      return res.status(401).json({ ok: false, error: 'session_required' });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  };
}

function registerAuthRoutes(app, getDatabase) {
  app.post('/api/auth/pin', pinLoginRateLimit, async (req, res) => {
    const { pin, terminalId } = req.body || {};
    if (!pin) return res.status(400).json({ ok: false, error: 'pin_required' });

    try {
      const staff = await getDatabase().query('staff:by_pin', String(pin).trim());
      if (!staff) return res.status(401).json({ ok: false, error: 'invalid_pin' });

      const { createStaffSession } = require('./session');
      const session = createStaffSession(staff, { terminalId });
      res.json({ ok: true, data: session });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/auth/me', (req, res) => {
    const session = verifySessionToken(extractBearerToken(req));
    if (!session) return res.status(401).json({ ok: false, error: 'session_required' });
    res.json({
      ok: true,
      data: {
        id: session.sub,
        name: session.name,
        role: session.role,
        expiresAt: new Date(session.exp).toISOString(),
      },
    });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.json({ ok: true });
  });
}

module.exports = {
  createApiAuthMiddleware,
  registerAuthRoutes,
  isPublicApiPath,
  isSessionBypass,
};
