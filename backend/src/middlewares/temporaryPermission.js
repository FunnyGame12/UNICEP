const { ROLES } = require('../constants/rbac');
const { getPermisoTemporalActivo } = require('../services/permisoTemporalService');

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function requireTemporalAccessForControlEscolar(modulo) {
  const moduloDestino = normalizeText(modulo);

  return async (req, res, next) => {
    const rol = normalizeText(req.user?.rol);

    if (rol !== ROLES.CONTROL_ESCOLAR) {
      return next();
    }

    const permiso = await getPermisoTemporalActivo(moduloDestino, rol);
    if (!permiso) {
      return res.status(403).json({
        message: 'No tienes acceso temporal para este módulo. Solicita habilitación al Director.',
        modulo: moduloDestino,
        rol,
        activo: false,
      });
    }

    req.permisoTemporal = permiso;
    return next();
  };
}

module.exports = {
  requireTemporalAccessForControlEscolar,
};
