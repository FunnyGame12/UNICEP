const {
  AsignacionGrupo,
  Materia,
  Tarea,
  EntregaTarea,
  MaterialClase,
  PortafolioEvidencia,
  AnuncioDocente,
  SalaVideoDocente,
  AsistenciaDocente,
  AlumnoGrupo,
  AlumnoPerfil,
  Usuario,
  TramiteSolicitud,
} = require('../../models');
const { Op } = require('sequelize');
const { registrarEventoAuditoria } = require('../services/auditService');

function sanitizeText(value) {
  return String(value || '').trim();
}

function normalizaFecha(value, fallback = new Date()) {
  if (!value) {
    return fallback;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function crearEnlaceSala(plataforma, titulo) {
  const base = sanitizeText(plataforma).toLowerCase().includes('zoom')
    ? 'https://zoom.us/j'
    : 'https://meet.google.com';

  const slug = `${sanitizeText(titulo).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 18)}-${Math.random().toString(36).slice(2, 8)}`;
  return `${base}/${slug}`;
}

async function obtenerMateriasDocente(idDocente) {
  const asignaciones = await AsignacionGrupo.findAll({
    where: { id_docente: idDocente },
    attributes: ['id_materia', 'grupo'],
    raw: true,
  });

  const materiasIds = [...new Set(asignaciones.map((item) => Number(item.id_materia)).filter(Number.isInteger))];
  return { asignaciones, materiasIds };
}

async function docenteTieneMateria(idDocente, idMateria) {
  const asignacion = await AsignacionGrupo.findOne({
    where: {
      id_docente: idDocente,
      id_materia: idMateria,
    },
  });

  return Boolean(asignacion);
}

async function grupos(req, res) {
  const items = await AsignacionGrupo.findAll({
    where: { id_docente: req.user.id_usuario },
    include: [{ model: Materia, as: 'materia' }],
    order: [['id_asignacion', 'DESC']],
  });

  return res.json({ items });
}

async function dashboard(req, res) {
  const { materiasIds } = await obtenerMateriasDocente(req.user.id_usuario);

  const [totalTareas, entregasPorRevisar, anuncios, salasVideo] = await Promise.all([
    materiasIds.length > 0
      ? Tarea.count({ where: { id_materia: { [Op.in]: materiasIds } } })
      : 0,
    materiasIds.length > 0
      ? EntregaTarea.count({
        include: [{
          model: Tarea,
          as: 'tarea',
          required: true,
          where: { id_materia: { [Op.in]: materiasIds } },
        }],
        where: { estatus: { [Op.in]: ['entregada', 'fuera_de_tiempo', 'pendiente'] } },
      })
      : 0,
    AnuncioDocente.findAll({
      where: { id_docente: req.user.id_usuario },
      include: [{ model: Materia, as: 'materia' }],
      order: [['fecha_publicacion', 'DESC']],
      limit: 10,
    }),
    SalaVideoDocente.findAll({
      where: { id_docente: req.user.id_usuario },
      order: [['fecha_programada', 'DESC']],
      limit: 10,
    }),
  ]);

  return res.json({
    resumen: {
      grupos: materiasIds.length,
      materias: materiasIds.length,
      tareas: totalTareas,
      entregas_por_revisar: entregasPorRevisar,
    },
    anuncios,
    salas_video: salasVideo,
  });
}

async function tareas(req, res) {
  const { materiasIds } = await obtenerMateriasDocente(req.user.id_usuario);
  if (materiasIds.length === 0) {
    return res.json({ items: [] });
  }

  const items = await Tarea.findAll({
    where: { id_materia: { [Op.in]: materiasIds } },
    include: [{ model: Materia, as: 'materia' }],
    order: [['id_tarea', 'DESC']],
  });

  return res.json({ items });
}

async function crearTarea(req, res) {
  const idMateria = Number(req.params.id_materia);
  const titulo = sanitizeText(req.body.titulo);
  const descripcion = sanitizeText(req.body.descripcion);
  const fechaLimite = normalizaFecha(req.body.fecha_limite);
  const archivoAdjuntoUrl = sanitizeText(req.body.archivo_adjunto_url);

  if (!Number.isInteger(idMateria)) {
    return res.status(400).json({ message: 'id_materia invalido.' });
  }

  if (!titulo || !descripcion || !fechaLimite) {
    return res.status(400).json({ message: 'titulo, descripcion y fecha_limite son obligatorios.' });
  }

  const tieneMateria = await docenteTieneMateria(req.user.id_usuario, idMateria);
  if (!tieneMateria) {
    return res.status(403).json({ message: 'No puedes crear tareas en una materia no asignada.' });
  }

  const nuevaTarea = await Tarea.create({
    id_materia: idMateria,
    titulo,
    descripcion,
    fecha_limite: fechaLimite,
    archivo_adjunto_url: archivoAdjuntoUrl || null,
  });

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'crear_tarea_docente',
    modulo: 'docentes',
    entidad: 'tareas',
    idEntidad: nuevaTarea.id_tarea,
    detalle: {
      id_materia: idMateria,
      titulo,
    },
  });

  return res.status(201).json(nuevaTarea);
}

async function entregas(req, res) {
  const { materiasIds } = await obtenerMateriasDocente(req.user.id_usuario);
  if (materiasIds.length === 0) {
    return res.json({ items: [] });
  }

  const items = await EntregaTarea.findAll({
    include: [
      {
        model: Tarea,
        as: 'tarea',
        required: true,
        where: { id_materia: { [Op.in]: materiasIds } },
        include: [{ model: Materia, as: 'materia' }],
      },
      {
        model: AlumnoPerfil,
        as: 'alumno',
        include: [{ model: Usuario, as: 'usuario', attributes: ['id_usuario', 'nombre_completo', 'correo'] }],
      },
    ],
    order: [['id_entrega', 'DESC']],
  });

  return res.json({ items });
}

async function calificarEntrega(req, res) {
  const { id } = req.params;
  const { calificacion, retroalimentacion } = req.body;

  const calificacionNumerica = Number(calificacion);
  if (Number.isNaN(calificacionNumerica) || calificacionNumerica < 0 || calificacionNumerica > 10) {
    return res.status(400).json({ message: 'La calificacion debe estar entre 0 y 10.' });
  }

  const entrega = await EntregaTarea.findByPk(id, {
    include: [{
      model: Tarea,
      as: 'tarea',
      attributes: ['id_tarea', 'id_materia'],
    }],
  });

  if (!entrega) {
    return res.status(404).json({ message: 'Entrega no encontrada.' });
  }

  const tieneMateria = await docenteTieneMateria(
    req.user.id_usuario,
    entrega.tarea.id_materia,
  );

  if (!tieneMateria) {
    return res.status(403).json({ message: 'No puedes calificar entregas de materias no asignadas.' });
  }

  entrega.calificacion = calificacionNumerica;
  entrega.retroalimentacion = retroalimentacion || null;
  entrega.estatus = 'calificada';
  await entrega.save();

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'calificar_entrega_tarea',
    modulo: 'docentes',
    entidad: 'entregas_tareas',
    idEntidad: entrega.id_entrega,
    detalle: {
      id_tarea: entrega.tarea.id_tarea,
      id_materia: entrega.tarea.id_materia,
      calificacion: calificacionNumerica,
    },
  });

  return res.json(entrega);
}

async function materiales(req, res) {
  const { materiasIds } = await obtenerMateriasDocente(req.user.id_usuario);
  if (materiasIds.length === 0) {
    return res.json({ items: [] });
  }

  const items = await MaterialClase.findAll({
    where: { id_materia: { [Op.in]: materiasIds } },
    include: [{ model: Materia, as: 'materia' }],
    order: [['id_material', 'DESC']],
  });

  return res.json({ items });
}

async function subirMaterial(req, res) {
  const idMateria = Number(req.params.id_materia);
  const temaSemana = sanitizeText(req.body.tema_semana);
  const tipoArchivo = sanitizeText(req.body.tipo_archivo).toLowerCase();
  const archivoUrl = sanitizeText(req.body.archivo_url);

  const tiposValidos = new Set(['diapositivas', 'libro', 'resumen', 'pdf', 'enlace']);

  if (!Number.isInteger(idMateria)) {
    return res.status(400).json({ message: 'id_materia invalido.' });
  }

  if (!temaSemana || !archivoUrl || !tiposValidos.has(tipoArchivo)) {
    return res.status(400).json({ message: 'tema_semana, tipo_archivo valido y archivo_url son obligatorios.' });
  }

  const tieneMateria = await docenteTieneMateria(req.user.id_usuario, idMateria);
  if (!tieneMateria) {
    return res.status(403).json({ message: 'No puedes publicar materiales en una materia no asignada.' });
  }

  const material = await MaterialClase.create({
    id_materia: idMateria,
    tema_semana: temaSemana,
    tipo_archivo: tipoArchivo,
    archivo_url: archivoUrl,
  });

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'publicar_material_docente',
    modulo: 'docentes',
    entidad: 'materiales_clase',
    idEntidad: material.id_material,
    detalle: {
      id_materia: idMateria,
      tema_semana: temaSemana,
    },
  });

  return res.status(201).json(material);
}

async function portafolios(req, res) {
  const { materiasIds } = await obtenerMateriasDocente(req.user.id_usuario);
  if (materiasIds.length === 0) {
    return res.json({ items: [] });
  }

  const items = await PortafolioEvidencia.findAll({
    where: { id_materia: { [Op.in]: materiasIds } },
    include: [
      { model: Materia, as: 'materia' },
      {
        model: AlumnoPerfil,
        as: 'alumno',
        include: [{ model: Usuario, as: 'usuario', attributes: ['id_usuario', 'nombre_completo', 'correo'] }],
      },
    ],
    order: [['id_evidencia', 'DESC']],
  });

  return res.json({ items });
}

async function calificacionesFinales(req, res) {
  const { materiasIds } = await obtenerMateriasDocente(req.user.id_usuario);
  if (materiasIds.length === 0) {
    return res.json({ items: [] });
  }

  const [entregasCalificadas, materias] = await Promise.all([
    EntregaTarea.findAll({
      where: { estatus: 'calificada' },
      include: [
        {
          model: Tarea,
          as: 'tarea',
          required: true,
          where: { id_materia: { [Op.in]: materiasIds } },
          attributes: ['id_tarea', 'id_materia'],
        },
        {
          model: AlumnoPerfil,
          as: 'alumno',
          include: [{ model: Usuario, as: 'usuario', attributes: ['id_usuario', 'nombre_completo', 'folio_matricula'] }],
        },
      ],
      attributes: ['id_entrega', 'id_alumno', 'calificacion'],
    }),
    Materia.findAll({
      where: { id_materia: { [Op.in]: materiasIds } },
      attributes: ['id_materia', 'nombre_materia'],
      raw: true,
    }),
  ]);

  const materiaById = new Map(materias.map((m) => [Number(m.id_materia), m.nombre_materia]));
  const aggregate = new Map();

  for (const entrega of entregasCalificadas) {
    const idAlumno = Number(entrega.id_alumno);
    const idMateria = Number(entrega.tarea.id_materia);
    const key = `${idAlumno}:${idMateria}`;
    const current = aggregate.get(key) || {
      alumno: entrega.alumno?.usuario?.nombre_completo || `Alumno ${idAlumno}`,
      folio: entrega.alumno?.usuario?.folio_matricula || '',
      materia: materiaById.get(idMateria) || `Materia ${idMateria}`,
      suma: 0,
      total: 0,
    };

    current.suma += Number(entrega.calificacion || 0);
    current.total += 1;
    aggregate.set(key, current);
  }

  const items = Array.from(aggregate.values()).map((item) => {
    const promedio = item.total > 0 ? item.suma / item.total : 0;
    return {
      alumno: item.alumno,
      folio: item.folio,
      materia: item.materia,
      promedio: Number(promedio.toFixed(2)),
      estatus: promedio >= 6 ? 'aprobado' : 'reprobado',
    };
  });

  return res.json({ items });
}

async function anuncios(req, res) {
  const items = await AnuncioDocente.findAll({
    where: { id_docente: req.user.id_usuario },
    include: [{ model: Materia, as: 'materia' }],
    order: [['fecha_publicacion', 'DESC']],
  });

  return res.json({ items });
}

async function publicarAnuncio(req, res) {
  const titulo = sanitizeText(req.body.titulo);
  const descripcion = sanitizeText(req.body.descripcion);
  const idMateria = req.body.id_materia ? Number(req.body.id_materia) : null;

  if (!titulo || !descripcion) {
    return res.status(400).json({ message: 'titulo y descripcion son obligatorios.' });
  }

  if (idMateria && !Number.isInteger(idMateria)) {
    return res.status(400).json({ message: 'id_materia invalido.' });
  }

  if (idMateria) {
    const tieneMateria = await docenteTieneMateria(req.user.id_usuario, idMateria);
    if (!tieneMateria) {
      return res.status(403).json({ message: 'No puedes publicar anuncios para una materia no asignada.' });
    }
  }

  const item = await AnuncioDocente.create({
    id_docente: req.user.id_usuario,
    id_materia: idMateria,
    titulo,
    descripcion,
    fecha_publicacion: new Date(),
  });

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'publicar_anuncio_docente',
    modulo: 'docentes',
    entidad: 'anuncios',
    idEntidad: item.id_anuncio,
    detalle: {
      id_materia: idMateria,
      titulo,
    },
  });

  return res.status(201).json(item);
}

async function salasVideo(req, res) {
  const items = await SalaVideoDocente.findAll({
    where: { id_docente: req.user.id_usuario },
    order: [['fecha_programada', 'DESC']],
  });

  return res.json({ items });
}

async function crearSalaVideo(req, res) {
  const titulo = sanitizeText(req.body.titulo);
  const plataforma = sanitizeText(req.body.plataforma) || 'Google Meet';
  const fechaProgramada = normalizaFecha(req.body.fecha_programada);
  const enlaceIngresado = sanitizeText(req.body.enlace);

  if (!titulo || !fechaProgramada) {
    return res.status(400).json({ message: 'titulo y fecha_programada son obligatorios.' });
  }

  const item = await SalaVideoDocente.create({
    id_docente: req.user.id_usuario,
    titulo,
    plataforma,
    fecha_programada: fechaProgramada,
    enlace: enlaceIngresado || crearEnlaceSala(plataforma, titulo),
    fecha_creacion: new Date(),
  });

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'crear_sala_video_docente',
    modulo: 'docentes',
    entidad: 'salas_video',
    idEntidad: item.id_sala,
    detalle: {
      plataforma,
      fecha_programada: item.fecha_programada,
    },
  });

  return res.status(201).json(item);
}

async function listarAsistencias(req, res) {
  const { materiasIds } = await obtenerMateriasDocente(req.user.id_usuario);
  if (materiasIds.length === 0) {
    return res.json({ items: [] });
  }

  const items = await AsistenciaDocente.findAll({
    where: {
      id_docente: req.user.id_usuario,
      id_materia: { [Op.in]: materiasIds },
    },
    include: [
      { model: Materia, as: 'materia' },
      {
        model: AlumnoPerfil,
        as: 'alumno',
        include: [{ model: Usuario, as: 'usuario', attributes: ['id_usuario', 'nombre_completo', 'correo'] }],
      },
    ],
    order: [['fecha_clase', 'DESC']],
  });

  return res.json({ items });
}

async function registrarAsistencia(req, res) {
  const idMateria = Number(req.body.id_materia);
  const idAlumno = req.body.id_alumno == null ? null : Number(req.body.id_alumno);
  const fechaClase = normalizaFecha(req.body.fecha_clase) || new Date();
  const estatusAsistencia = sanitizeText(req.body.estatus_asistencia).toLowerCase() || 'presente';
  const aprovechamiento = sanitizeText(req.body.aprovechamiento).toLowerCase() || 'medio';
  const observaciones = sanitizeText(req.body.observaciones);

  const estatusValidos = new Set(['presente', 'ausente', 'retardo', 'justificado']);
  const aprovechamientoValido = new Set(['alto', 'medio', 'bajo']);

  if (!Number.isInteger(idMateria)) {
    return res.status(400).json({ message: 'id_materia es obligatorio y debe ser numerico.' });
  }

  if (!estatusValidos.has(estatusAsistencia) || !aprovechamientoValido.has(aprovechamiento)) {
    return res.status(400).json({ message: 'estatus_asistencia o aprovechamiento invalido.' });
  }

  const tieneMateria = await docenteTieneMateria(req.user.id_usuario, idMateria);
  if (!tieneMateria) {
    return res.status(403).json({ message: 'No puedes registrar asistencia en una materia no asignada.' });
  }

  const item = await AsistenciaDocente.create({
    id_docente: req.user.id_usuario,
    id_materia: idMateria,
    id_alumno: Number.isInteger(idAlumno) ? idAlumno : null,
    fecha_clase: fechaClase,
    estatus_asistencia: estatusAsistencia,
    aprovechamiento,
    observaciones: observaciones || null,
    fecha_creacion: new Date(),
  });

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'registrar_asistencia_docente',
    modulo: 'docentes',
    entidad: 'asistencias',
    idEntidad: item.id_registro,
    detalle: {
      id_materia: idMateria,
      id_alumno: item.id_alumno,
      estatus_asistencia: item.estatus_asistencia,
      aprovechamiento: item.aprovechamiento,
    },
  });

  return res.status(201).json(item);
}

async function aprovechamiento(req, res) {
  const { materiasIds } = await obtenerMateriasDocente(req.user.id_usuario);
  if (materiasIds.length === 0) {
    return res.json({ items: [] });
  }

  const rows = await AsistenciaDocente.findAll({
    attributes: [
      'id_materia',
      [AsistenciaDocente.sequelize.fn('COUNT', AsistenciaDocente.sequelize.col('id_registro')), 'total'],
      [
        AsistenciaDocente.sequelize.fn(
          'SUM',
          AsistenciaDocente.sequelize.literal("CASE WHEN aprovechamiento = 'alto' THEN 1 ELSE 0 END"),
        ),
        'alto',
      ],
      [
        AsistenciaDocente.sequelize.fn(
          'SUM',
          AsistenciaDocente.sequelize.literal("CASE WHEN aprovechamiento = 'medio' THEN 1 ELSE 0 END"),
        ),
        'medio',
      ],
      [
        AsistenciaDocente.sequelize.fn(
          'SUM',
          AsistenciaDocente.sequelize.literal("CASE WHEN aprovechamiento = 'bajo' THEN 1 ELSE 0 END"),
        ),
        'bajo',
      ],
    ],
    where: {
      id_docente: req.user.id_usuario,
      id_materia: { [Op.in]: materiasIds },
    },
    group: ['id_materia'],
    raw: true,
  });

  const items = rows.map((row) => ({
    id_materia: Number(row.id_materia),
    total: Number(row.total || 0),
    alto: Number(row.alto || 0),
    medio: Number(row.medio || 0),
    bajo: Number(row.bajo || 0),
  }));

  return res.json({ items });
}

async function justificantesPreaprobados(req, res) {
  const { asignaciones } = await obtenerMateriasDocente(req.user.id_usuario);
  if (asignaciones.length === 0) {
    return res.json({ items: [] });
  }

  const whereAlumnoGrupo = {
    [Op.or]: asignaciones.map((item) => ({
      id_materia: item.id_materia,
      grupo: item.grupo,
    })),
  };

  const alumnosGrupo = await AlumnoGrupo.findAll({
    where: whereAlumnoGrupo,
    attributes: ['id_alumno'],
    raw: true,
  });
  const alumnosIds = [...new Set(alumnosGrupo.map((item) => Number(item.id_alumno)).filter(Number.isInteger))];

  if (alumnosIds.length === 0) {
    return res.json({ items: [] });
  }

  const items = await TramiteSolicitud.findAll({
    where: {
      id_alumno: { [Op.in]: alumnosIds },
      estatus: 'resuelto',
      [Op.or]: [
        { tipo: { [Op.in]: ['otro', 'constancia', 'credencial'] } },
        { descripcion: { [Op.like]: '%justificante%' } },
        { descripcion: { [Op.like]: '%medic%' } },
        { descripcion: { [Op.like]: '%personal%' } },
      ],
    },
    include: [{
      model: AlumnoPerfil,
      as: 'alumno',
      include: [{ model: Usuario, as: 'usuario', attributes: ['id_usuario', 'nombre_completo', 'correo'] }],
    }],
    order: [['fecha_resolucion', 'DESC'], ['id_tramite', 'DESC']],
  });

  return res.json({ items });
}

module.exports = {
  dashboard,
  grupos,
  tareas,
  crearTarea,
  entregas,
  calificarEntrega,
  materiales,
  subirMaterial,
  portafolios,
  calificacionesFinales,
  anuncios,
  publicarAnuncio,
  salasVideo,
  crearSalaVideo,
  listarAsistencias,
  registrarAsistencia,
  aprovechamiento,
  justificantesPreaprobados,
};
