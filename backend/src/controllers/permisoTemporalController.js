const { PermisoTemporal } = require('../../models');
const { getPermisoTemporalActivo } = require('../services/permisoTemporalService');
const { ROLES } = require('../constants/rbac');

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

async function verificarPermisoTemporal(req, res) {
  const modulo = normalizeText(req.params.modulo);
  const rolSesion = normalizeText(req.user?.rol);
  const rolParam = normalizeText(req.query.rol);
  const rol = rolParam && rolSesion === ROLES.DIRECTOR ? rolParam : rolSesion;

  if (!modulo) {
    return res.status(400).json({ message: 'modulo es obligatorio.' });
  }

  if (!rol) {
    return res.status(401).json({ message: 'Sesion invalida para verificar permisos.' });
  }

  const permiso = await getPermisoTemporalActivo(modulo, rol);
  if (!permiso) {
    return res.json({ activo: false, expira_en: null });
  }

  return res.json({
    activo: true,
    expira_en: permiso.fecha_expiracion,
  });
}

async function otorgarPermisoTemporal(req, res) {
  const modulo = normalizeText(req.body.modulo);
  const rol = normalizeText(req.body.rol);
  const horasVigencia = Number(req.body.horasVigencia);

  if (!modulo) {
    return res.status(400).json({ message: 'modulo es obligatorio.' });
  }

  if (!rol) {
    return res.status(400).json({ message: 'rol es obligatorio.' });
  }

  if (!Number.isFinite(horasVigencia) || horasVigencia <= 0) {
    return res.status(400).json({ message: 'horasVigencia debe ser mayor a 0.' });
  }

  const fechaExpiracion = new Date(Date.now() + (horasVigencia * 60 * 60 * 1000));

  await PermisoTemporal.upsert({
    modulo_destino: modulo,
    rol_autorizado: rol,
    fecha_expiracion: fechaExpiracion,
  });

  const registro = await PermisoTemporal.findOne({
    where: {
      modulo_destino: modulo,
      rol_autorizado: rol,
    },
    attributes: ['id_permiso', 'modulo_destino', 'rol_autorizado', 'fecha_expiracion'],
  });

  return res.status(201).json({
    id_permiso: registro?.id_permiso || null,
    modulo: modulo,
    rol: rol,
    activo: fechaExpiracion > new Date(),
    expira_en: registro?.fecha_expiracion || fechaExpiracion,
  });
}

module.exports = {
  verificarPermisoTemporal,
  otorgarPermisoTemporal,
};
