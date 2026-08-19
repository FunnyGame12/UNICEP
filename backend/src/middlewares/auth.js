const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { resolveUserAuthorization } = require('../services/rbacService');

function auth(requiredRoles = []) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ message: 'Token requerido.' });
    }

    try {
      const payload = jwt.verify(token, env.jwtSecret);
      const authorization = await resolveUserAuthorization(payload.id_usuario);
      const user = {
        ...payload,
        rol: authorization?.rol || payload.rol,
        subrol: authorization?.subrol || payload.subrol || null,
        permisos: authorization?.permisos || payload.permisos || [],
      };

      req.user = user;

      if (
        requiredRoles.length > 0
        && !requiredRoles.includes(user.rol)
      ) {
        return res.status(403).json({ message: 'No autorizado para este recurso.' });
      }

      return next();
    } catch (_error) {
      return res.status(401).json({ message: 'Token invalido o expirado.' });
    }
  };
}

function authorizeRoles(...roles) {
  const normalizedRoles = Array.isArray(roles[0]) ? roles[0] : roles;

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Token requerido.' });
    }

    if (normalizedRoles.length > 0 && !normalizedRoles.includes(req.user.rol)) {
      return res.status(403).json({ message: 'No autorizado para este recurso.' });
    }

    return next();
  };
}

module.exports = auth;
module.exports.authorizeRoles = authorizeRoles;
