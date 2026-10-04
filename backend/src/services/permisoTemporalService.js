const { Op } = require('sequelize');
const { PermisoTemporal } = require('../../models');

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

async function getPermisoTemporalActivo(modulo, rol) {
  const moduloDestino = normalizeText(modulo);
  const rolAutorizado = normalizeText(rol);

  if (!moduloDestino || !rolAutorizado) return null;

  return PermisoTemporal.findOne({
    where: {
      modulo_destino: moduloDestino,
      rol_autorizado: rolAutorizado,
      fecha_expiracion: { [Op.gt]: new Date() },
    },
    attributes: ['id_permiso', 'modulo_destino', 'rol_autorizado', 'fecha_expiracion'],
  });
}

module.exports = {
  getPermisoTemporalActivo,
};
