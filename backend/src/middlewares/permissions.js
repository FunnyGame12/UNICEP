const { hasAnyPermission } = require('../services/rbacService');

function requirePermission(requiredPermissions = []) {
  const normalized = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];

  return (req, res, next) => {
    if (normalized.length === 0) {
      return next();
    }

    if (!hasAnyPermission(req.user, normalized)) {
      return res.status(403).json({
        message: 'No autorizado para este recurso por permisos RBAC.',
        permisos_requeridos: normalized,
      });
    }

    return next();
  };
}

module.exports = {
  requirePermission,
};
