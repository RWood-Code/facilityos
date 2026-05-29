const RESTORE_ROLES = new Set(['supervisor', 'manager', 'admin_staff', 'admin']);
function requireRestoreRole(req, res) {
  const role = req.staffSession?.role;
  if (role && RESTORE_ROLES.has(role)) return true;
  if (!req.staffSession && req.path.startsWith('/api/backup')) {
    // Legacy self-host LAN — allow without session (local admin at console)
    const { isLocalOrPrivateRequest } = require('../../shared/db/remoteAccess');
    const { getDeploymentConfig } = require('../../shared/db/deployment');
    const cfg = getDeploymentConfig();
    if (!cfg.isHosted && isLocalOrPrivateRequest(req)) return true;
  }
  res.status(403).json({ ok: false, error: 'restore_requires_supervisor_role' });
  return false;
}

module.exports = {
  RESTORE_ROLES,
  requireRestoreRole,
};
