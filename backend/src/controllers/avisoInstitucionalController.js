const { Op } = require('sequelize');
const { AvisoInstitucional, AlumnoGrupo, AsignacionGrupo } = require('../../models');

const DESTINATARIOS_VALIDOS = new Set(['alumnos', 'docentes', 'general']);
const TIPOS_ADJUNTO_VALIDOS = new Set(['ninguno', 'archivo_local', 'enlace_drive']);

function normalizeText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function normalizeEnum(value) {
  return String(value || '').trim().toLowerCase();
}

function toIntOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : NaN;
}

function normalizeGrupo(value) {
  const text = String(value || '').trim().toUpperCase();
  return text || null;
}

function serializeAviso(item) {
  return {
    id: item.id_aviso_institucional,
    titulo: item.titulo,
    mensaje: item.mensaje,
    destinatario: item.destinatario,
    tipo_adjunto: item.tipo_adjunto,
    url_adjunto: item.url_adjunto,
    carrera_id: item.carrera_id,
    cuatrimestre_id: item.cuatrimestre_id,
    grupo_id: item.grupo_id,
    activo: Boolean(item.activo),
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

async function crearAviso(req, res) {
  const titulo = normalizeText(req.body.titulo);
  const mensaje = normalizeText(req.body.mensaje);
  const destinatario = normalizeEnum(req.body.destinatario || 'general');
  const tipoAdjunto = normalizeEnum(req.body.tipo_adjunto || 'ninguno');
  const carreraId = normalizeText(req.body.carrera_id);
  const cuatrimestreId = toIntOrNull(req.body.cuatrimestre_id);
  const grupoId = normalizeGrupo(req.body.grupo_id);

  if (!titulo || !mensaje) {
    return res.status(400).json({ message: 'titulo y mensaje son obligatorios.' });
  }

  if (!DESTINATARIOS_VALIDOS.has(destinatario)) {
    return res.status(400).json({ message: 'destinatario invalido. Usa alumnos, docentes o general.' });
  }

  if (!TIPOS_ADJUNTO_VALIDOS.has(tipoAdjunto)) {
    return res.status(400).json({ message: 'tipo_adjunto invalido. Usa ninguno, archivo_local o enlace_drive.' });
  }

  if (Number.isNaN(cuatrimestreId)) {
    return res.status(400).json({ message: 'cuatrimestre_id invalido.' });
  }

  let urlAdjunto = null;
  if (tipoAdjunto === 'archivo_local') {
    if (!req.file) {
      return res.status(400).json({ message: 'Debes adjuntar un archivo cuando tipo_adjunto es archivo_local.' });
    }
    urlAdjunto = `/uploads/portafolio/${req.file.filename}`;
  }

  if (tipoAdjunto === 'enlace_drive') {
    urlAdjunto = normalizeText(req.body.url_adjunto);
    if (!urlAdjunto) {
      return res.status(400).json({ message: 'Debes proporcionar url_adjunto cuando tipo_adjunto es enlace_drive.' });
    }

    try {
      // eslint-disable-next-line no-new
      new URL(urlAdjunto);
    } catch (_error) {
      return res.status(400).json({ message: 'url_adjunto debe ser una URL valida.' });
    }
  }

  const now = new Date();
  const created = await AvisoInstitucional.create({
    titulo,
    mensaje,
    destinatario,
    tipo_adjunto: tipoAdjunto,
    url_adjunto: urlAdjunto,
    carrera_id: carreraId,
    cuatrimestre_id: cuatrimestreId,
    grupo_id: grupoId,
    activo: true,
    created_at: now,
    updated_at: now,
  });

  return res.status(201).json(serializeAviso(created));
}

async function listarAvisosCoordinacion(_req, res) {
  const items = await AvisoInstitucional.findAll({
    order: [['created_at', 'DESC'], ['id_aviso_institucional', 'DESC']],
    limit: 300,
  });

  return res.json({ items: items.map(serializeAviso) });
}

async function eliminarAvisoCoordinacion(req, res) {
  const avisoId = Number(req.params.avisoId);
  if (!Number.isInteger(avisoId)) {
    return res.status(400).json({ message: 'avisoId invalido.' });
  }

  const aviso = await AvisoInstitucional.findByPk(avisoId);
  if (!aviso) {
    return res.status(404).json({ message: 'Aviso no encontrado.' });
  }

  aviso.activo = false;
  aviso.updated_at = new Date();
  await aviso.save();

  return res.json({ id: aviso.id_aviso_institucional, activo: aviso.activo });
}

async function listarAvisosPublicosPorRol(req, res) {
  const rol = normalizeEnum(req.params.rol);
  const carreraId = normalizeText(req.query.carrera_id);
  const cuatrimestreId = toIntOrNull(req.query.cuatrimestre_id);

  if (!['alumno', 'alumnos', 'docente', 'docentes', 'general'].includes(rol)) {
    return res.status(400).json({ message: 'rol invalido. Usa alumno, docente o general.' });
  }

  if (Number.isNaN(cuatrimestreId)) {
    return res.status(400).json({ message: 'cuatrimestre_id invalido.' });
  }

  const destinatarios = rol.startsWith('alumno')
    ? ['alumnos', 'general']
    : rol.startsWith('docente')
      ? ['docentes', 'general']
      : ['general', 'alumnos', 'docentes'];

  let gruposPermitidos = [];
  if (rol.startsWith('alumno')) {
    const idAlumno = Number(req.user?.id_usuario);
    if (!Number.isInteger(idAlumno)) {
      return res.status(401).json({ message: 'Sesion invalida.' });
    }

    const grupos = await AlumnoGrupo.findAll({
      where: { id_alumno: idAlumno },
      attributes: ['grupo'],
      raw: true,
    });

    gruposPermitidos = [...new Set(grupos.map((item) => normalizeGrupo(item.grupo)).filter(Boolean))];
  }

  if (rol.startsWith('docente')) {
    const idDocente = Number(req.user?.id_usuario);
    if (!Number.isInteger(idDocente)) {
      return res.status(401).json({ message: 'Sesion invalida.' });
    }

    const grupos = await AsignacionGrupo.findAll({
      where: { id_docente: idDocente },
      attributes: ['grupo'],
      raw: true,
    });

    gruposPermitidos = [...new Set(grupos.map((item) => normalizeGrupo(item.grupo)).filter(Boolean))];
  }

  const where = {
    activo: true,
    destinatario: { [Op.in]: destinatarios },
    [Op.and]: [
      {
        [Op.or]: [
          { carrera_id: null },
          ...(carreraId ? [{ carrera_id: carreraId }] : []),
        ],
      },
      {
        [Op.or]: [
          { cuatrimestre_id: null },
          ...(cuatrimestreId !== null ? [{ cuatrimestre_id: cuatrimestreId }] : []),
        ],
      },
      {
        [Op.or]: [
          { grupo_id: null },
          ...(gruposPermitidos.length > 0 ? [{ grupo_id: { [Op.in]: gruposPermitidos } }] : []),
        ],
      },
    ],
  };

  const items = await AvisoInstitucional.findAll({
    where,
    order: [['created_at', 'DESC'], ['id_aviso_institucional', 'DESC']],
    limit: 200,
  });

  return res.json({ items: items.map(serializeAviso) });
}

module.exports = {
  crearAviso,
  listarAvisosCoordinacion,
  eliminarAvisoCoordinacion,
  listarAvisosPublicosPorRol,
};
