const { AuditoriaEvento } = require('../../models');

async function registrarEventoAuditoria({
  idUsuario,
  rolActor,
  accion,
  modulo,
  entidad,
  idEntidad = null,
  detalle = null,
}) {
  return AuditoriaEvento.create({
    id_usuario: idUsuario,
    rol_actor: rolActor,
    accion,
    modulo,
    entidad,
    id_entidad: idEntidad ? String(idEntidad) : null,
    detalle,
    fecha_evento: new Date(),
  });
}

module.exports = {
  registrarEventoAuditoria,
};
