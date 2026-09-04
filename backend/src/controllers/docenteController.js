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
  CalificacionFormativaDocente,
  PortafolioMateriaEvidencia,
  ActaCalificacion,
  PeriodoAcademico,
  RecursoAcademico,
  Aviso,
} = require('../../models');
const { Op } = require('sequelize');
const { registrarEventoAuditoria } = require('../services/auditService');

function sanitizeText(value) {
  return String(value || '').trim();
}

function normalizeGrupo(value) {
  return String(value || '').trim().toUpperCase();
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

function normalizarEstatusAsistencia(value) {
  const raw = sanitizeText(value).toLowerCase();
  if (!raw) return '';
  if (raw === 'falta') return 'ausente';
  return raw;
}

function serializarEstadoAsistencia(estatus) {
  if (estatus === 'ausente') return 'Falta';
  if (estatus === 'presente') return 'Presente';
  if (estatus === 'retardo') return 'Retardo';
  if (estatus === 'justificado') return 'Justificado';
  return null;
}

function fechaIsoYYYYMMDD(value) {
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return null;
  return fecha.toISOString().slice(0, 10);
}

function normalizaFechaAsistencia(value) {
  const parsed = normalizaFecha(value, null);
  if (!parsed) return null;
  return fechaIsoYYYYMMDD(parsed);
}

function construirPayloadAsistencias(body) {
  if (Array.isArray(body)) {
    return body;
  }

  if (Array.isArray(body?.registros)) {
    return body.registros;
  }

  if (Array.isArray(body?.asistencias)) {
    return body.asistencias.map((item) => ({
      ...item,
      materia_id: body?.materia_id ?? body?.id_materia,
      grupo_id: body?.grupo_id ?? body?.id_grupo,
      fecha: body?.fecha ?? body?.fecha_clase,
    }));
  }

  return [body];
}

function buildAsistenciaKey(row) {
  return `${row.id_materia}::${row.id_alumno}::${row.fecha_iso}`;
}

async function prepararAsistenciaParaUpsert({ row, req, contexto }) {
  const materiaId = Number(row?.materia_id ?? row?.id_materia);
  const alumnoId = Number(row?.alumno_id ?? row?.id_alumno);
  const grupoRow = normalizeGrupo(row?.grupo_id ?? row?.id_grupo);
  const fechaIso = normalizaFechaAsistencia(row?.fecha ?? row?.fecha_clase);
  const estatus = normalizarEstatusAsistencia(row?.estado ?? row?.estatus ?? row?.estatus_asistencia);
  const observaciones = sanitizeText(row?.observaciones);

  if (!Number.isInteger(materiaId) || !Number.isInteger(alumnoId) || !fechaIso || !estatus) {
    return {
      error: {
        status: 400,
        message: 'alumno_id, materia_id, fecha y estado son obligatorios.',
      },
    };
  }

  const estatusValidos = new Set(['presente', 'ausente', 'retardo', 'justificado']);
  if (!estatusValidos.has(estatus)) {
    return {
      error: {
        status: 400,
        message: 'estado invalido. Usa Presente, Falta, Retardo o Justificado.',
      },
    };
  }

  const inscripcion = await AlumnoGrupo.findOne({ where: { id_alumno: alumnoId, id_materia: materiaId } });
  if (!inscripcion) {
    return {
      error: {
        status: 400,
        message: 'El alumno no pertenece a esa materia/grupo.',
      },
    };
  }

  if (grupoRow && normalizeGrupo(inscripcion.grupo) !== grupoRow) {
    return {
      error: {
        status: 400,
        message: 'grupo_id no coincide con la inscripcion del alumno.',
      },
    };
  }

  if (!docenteAsignadoMateriaGrupo(contexto.asignacionesSet, materiaId, inscripcion.grupo)) {
    return {
      error: {
        status: 403,
        message: 'No tienes asignacion para ese grupo/materia.',
      },
    };
  }

  return {
    row: {
      id_docente: req.user.id_usuario,
      id_materia: materiaId,
      id_alumno: alumnoId,
      fecha_clase: `${fechaIso} 00:00:00`,
      estatus_asistencia: estatus,
      aprovechamiento: 'medio',
      observaciones: observaciones || null,
      fecha_creacion: new Date(),
      fecha_iso: fechaIso,
    },
  };
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

function buildAssignmentSet(asignaciones) {
  return new Set(
    (asignaciones || []).map((item) => `${Number(item.id_materia)}::${normalizeGrupo(item.grupo)}`),
  );
}

async function obtenerContextoDocente(idDocente) {
  const asignaciones = await AsignacionGrupo.findAll({
    where: { id_docente: idDocente },
    include: [{ model: Materia, as: 'materia' }],
    order: [['id_asignacion', 'DESC']],
  });

  const materiasIds = [...new Set(asignaciones.map((item) => Number(item.id_materia)).filter(Number.isInteger))];
  return {
    asignaciones,
    materiasIds,
    asignacionesSet: buildAssignmentSet(asignaciones),
  };
}

function docenteAsignadoMateriaGrupo(asignacionesSet, idMateria, grupoId) {
  if (!grupoId) return false;
  return asignacionesSet.has(`${Number(idMateria)}::${normalizeGrupo(grupoId)}`);
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

async function misMaterias(req, res) {
  const [contexto, periodoActivo] = await Promise.all([
    obtenerContextoDocente(req.user.id_usuario),
    PeriodoAcademico.findOne({ where: { estatus: 'activo' }, order: [['fecha_inicio', 'DESC']] }),
  ]);

  const items = contexto.asignaciones.map((item) => ({
    id_asignacion: item.id_asignacion,
    docente_id: item.id_docente,
    materia_id: item.id_materia,
    grupo_id: normalizeGrupo(item.grupo),
    horas_semanales: Number(item.horas_semanales || 0),
    materia: {
      id_materia: item.materia?.id_materia,
      nombre_materia: item.materia?.nombre_materia,
      codigo_materia: item.materia?.codigo_materia,
      programa_academico_id: item.materia?.programa_academico_id || null,
      periodo_numero: item.materia?.periodo_numero || item.materia?.bimestre_pertenece || null,
      carrera: item.materia?.carrera || null,
      imagen_portada_url: item.materia?.imagen_portada_url || null,
      recursos_sep: item.materia?.recursos_sep || null,
    },
  }));

  return res.json({
    items,
    periodo_activo: periodoActivo
      ? {
        id_periodo: periodoActivo.id_periodo,
        nombre: periodoActivo.nombre,
        fecha_limite_calificaciones: periodoActivo.fecha_limite_calificaciones,
      }
      : null,
  });
}

async function materiasTareas(req, res) {
  const materiaId = Number(req.params.materiaId);
  if (!Number.isInteger(materiaId)) {
    return res.status(400).json({ message: 'materiaId invalido.' });
  }

  const contexto = await obtenerContextoDocente(req.user.id_usuario);
  const gruposMateria = contexto.asignaciones
    .filter((item) => Number(item.id_materia) === materiaId)
    .map((item) => normalizeGrupo(item.grupo));

  if (gruposMateria.length === 0) {
    return res.status(403).json({ message: 'No tienes asignacion para esta materia.' });
  }

  const rows = await Tarea.findAll({
    where: {
      id_materia: materiaId,
      [Op.or]: [
        { grupo_id: { [Op.in]: gruposMateria } },
        { grupo_id: null },
      ],
    },
    order: [['fecha_limite', 'ASC'], ['id_tarea', 'DESC']],
  });

  const items = await Promise.all(rows.map(async (tarea) => {
    const pendientes = await EntregaTarea.count({
      where: {
        id_tarea: tarea.id_tarea,
        estatus: { [Op.in]: ['entregada', 'fuera_de_tiempo', 'pendiente'] },
      },
    });

    return {
      id_tarea: tarea.id_tarea,
      id_materia: tarea.id_materia,
      grupo_id: tarea.grupo_id,
      titulo: tarea.titulo,
      descripcion: tarea.descripcion,
      fecha_limite: tarea.fecha_limite,
      puntaje_maximo: Number(tarea.puntaje_maximo || 10),
      archivo_adjunto_url: tarea.archivo_adjunto_url,
      entregas_pendientes: pendientes,
    };
  }));

  return res.json({ items });
}

async function crearTareaMateria(req, res) {
  const materiaId = Number(req.params.materiaId);
  const titulo = sanitizeText(req.body.titulo);
  const descripcion = sanitizeText(req.body.descripcion);
  const fechaLimite = normalizaFecha(req.body.fecha_limite, null);
  const puntajeMaximo = Number(req.body.puntaje_maximo);
  const archivoAdjunto = sanitizeText(req.body.archivo_adjunto_url);
  const grupoId = normalizeGrupo(req.body.grupo_id);

  if (!Number.isInteger(materiaId)) {
    return res.status(400).json({ message: 'materiaId invalido.' });
  }
  if (!titulo || !descripcion || !fechaLimite || Number.isNaN(puntajeMaximo) || puntajeMaximo < 1 || !grupoId) {
    return res.status(400).json({ message: 'titulo, descripcion, fecha_limite futura, puntaje_maximo >= 1 y grupo_id son obligatorios.' });
  }
  if (fechaLimite.getTime() <= Date.now()) {
    return res.status(400).json({ message: 'fecha_limite debe ser posterior al momento actual.' });
  }

  const contexto = await obtenerContextoDocente(req.user.id_usuario);
  if (!docenteAsignadoMateriaGrupo(contexto.asignacionesSet, materiaId, grupoId)) {
    return res.status(403).json({ message: 'No tienes asignacion para ese grupo/materia.' });
  }

  const created = await Tarea.create({
    id_materia: materiaId,
    grupo_id: grupoId,
    titulo,
    descripcion,
    fecha_limite: fechaLimite,
    puntaje_maximo: puntajeMaximo,
    archivo_adjunto_url: archivoAdjunto || null,
  });

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'crear_tarea_docente_grupo',
    modulo: 'docentes',
    entidad: 'tareas',
    idEntidad: created.id_tarea,
    detalle: { materia_id: materiaId, grupo_id: grupoId, puntaje_maximo: puntajeMaximo },
  });

  return res.status(201).json(created);
}

async function tareaEntregas(req, res) {
  const tareaId = Number(req.params.tareaId);
  if (!Number.isInteger(tareaId)) {
    return res.status(400).json({ message: 'tareaId invalido.' });
  }

  const tarea = await Tarea.findByPk(tareaId);
  if (!tarea) {
    return res.status(404).json({ message: 'Tarea no encontrada.' });
  }

  const contexto = await obtenerContextoDocente(req.user.id_usuario);
  if (!docenteAsignadoMateriaGrupo(contexto.asignacionesSet, tarea.id_materia, tarea.grupo_id)) {
    return res.status(403).json({ message: 'No tienes acceso a esta tarea.' });
  }

  const items = await EntregaTarea.findAll({
    where: { id_tarea: tareaId },
    include: [{
      model: AlumnoPerfil,
      as: 'alumno',
      include: [{ model: Usuario, as: 'usuario', attributes: ['id_usuario', 'nombre_completo', 'folio_matricula'] }],
    }],
    order: [['fecha_entrega', 'DESC']],
  });

  return res.json({
    tarea: {
      id_tarea: tarea.id_tarea,
      titulo: tarea.titulo,
      grupo_id: tarea.grupo_id,
      puntaje_maximo: Number(tarea.puntaje_maximo || 10),
    },
    items,
  });
}

async function calificarEntregaMateria(req, res) {
  const entregaId = Number(req.params.entregaId);
  const calificacion = Number(req.body.calificacion);
  const retroalimentacion = sanitizeText(req.body.retroalimentacion) || null;

  if (!Number.isInteger(entregaId)) {
    return res.status(400).json({ message: 'entregaId invalido.' });
  }
  if (Number.isNaN(calificacion) || calificacion < 0 || calificacion > 10) {
    return res.status(400).json({ message: 'calificacion debe estar en rango 0..10.' });
  }

  const entrega = await EntregaTarea.findByPk(entregaId, {
    include: [{ model: Tarea, as: 'tarea', attributes: ['id_tarea', 'id_materia', 'grupo_id'] }],
  });
  if (!entrega) {
    return res.status(404).json({ message: 'Entrega no encontrada.' });
  }

  const contexto = await obtenerContextoDocente(req.user.id_usuario);
  if (!docenteAsignadoMateriaGrupo(contexto.asignacionesSet, entrega.tarea?.id_materia, entrega.tarea?.grupo_id)) {
    return res.status(403).json({ message: 'No tienes acceso a esta entrega.' });
  }

  entrega.calificacion = calificacion;
  entrega.retroalimentacion = retroalimentacion;
  entrega.estatus = 'calificada';
  await entrega.save();

  return res.json(entrega);
}

async function publicarMaterialMateria(req, res) {
  const materiaId = Number(req.params.materiaId);
  const titulo = sanitizeText(req.body.titulo);
  const descripcion = sanitizeText(req.body.descripcion);
  const tipo = sanitizeText(req.body.tipo_recurso || req.body.tipo_archivo).toLowerCase();
  const recursoUrl = sanitizeText(req.body.recurso_url || req.body.archivo_url);
  const grupoId = normalizeGrupo(req.body.grupo_id);

  if (!Number.isInteger(materiaId) || !titulo || !recursoUrl || !grupoId) {
    return res.status(400).json({ message: 'materiaId, titulo, recurso_url y grupo_id son obligatorios.' });
  }

  const tiposValidos = new Set(['diapositivas', 'libro', 'resumen', 'pdf', 'enlace', 'guia', 'guía']);
  const tipoArchivo = tiposValidos.has(tipo) ? (tipo === 'guia' || tipo === 'guía' ? 'pdf' : tipo) : null;
  if (!tipoArchivo) {
    return res.status(400).json({ message: 'tipo_recurso invalido. Usa diapositivas, libro, resumen, pdf o enlace.' });
  }

  const contexto = await obtenerContextoDocente(req.user.id_usuario);
  if (!docenteAsignadoMateriaGrupo(contexto.asignacionesSet, materiaId, grupoId)) {
    return res.status(403).json({ message: 'No tienes asignacion para ese grupo/materia.' });
  }

  const material = await MaterialClase.create({
    id_materia: materiaId,
    tema_semana: `${titulo}${descripcion ? ` - ${descripcion}` : ''}`.slice(0, 100),
    tipo_archivo: tipoArchivo,
    archivo_url: recursoUrl,
  });

  return res.status(201).json({
    ...material.toJSON(),
    grupo_id: grupoId,
    titulo,
    descripcion: descripcion || null,
  });
}

async function listarSesionesEnVivo(req, res) {
  const materiaId = Number(req.params.materiaId);
  if (!Number.isInteger(materiaId)) {
    return res.status(400).json({ message: 'materiaId invalido.' });
  }

  const contexto = await obtenerContextoDocente(req.user.id_usuario);
  const gruposMateria = contexto.asignaciones
    .filter((item) => Number(item.id_materia) === materiaId)
    .map((item) => normalizeGrupo(item.grupo));
  if (gruposMateria.length === 0) {
    return res.status(403).json({ message: 'No tienes asignacion para esta materia.' });
  }

  const items = await SalaVideoDocente.findAll({
    where: {
      id_docente: req.user.id_usuario,
      id_materia: materiaId,
      [Op.or]: [{ grupo_id: { [Op.in]: gruposMateria } }, { grupo_id: null }],
    },
    order: [['fecha_programada', 'ASC']],
  });

  return res.json({ items });
}

async function programarSesionEnVivo(req, res) {
  const materiaId = Number(req.params.materiaId);
  const titulo = sanitizeText(req.body.titulo);
  const fechaHora = normalizaFecha(req.body.fecha_hora || req.body.fecha_programada, null);
  const enlace = sanitizeText(req.body.enlace_reunion || req.body.enlace);
  const plataforma = sanitizeText(req.body.plataforma) || 'Google Meet';
  const grupoId = normalizeGrupo(req.body.grupo_id);

  if (!Number.isInteger(materiaId) || !titulo || !fechaHora || !grupoId) {
    return res.status(400).json({ message: 'materiaId, titulo, fecha_hora y grupo_id son obligatorios.' });
  }

  const contexto = await obtenerContextoDocente(req.user.id_usuario);
  if (!docenteAsignadoMateriaGrupo(contexto.asignacionesSet, materiaId, grupoId)) {
    return res.status(403).json({ message: 'No tienes asignacion para ese grupo/materia.' });
  }

  const item = await SalaVideoDocente.create({
    id_docente: req.user.id_usuario,
    id_materia: materiaId,
    grupo_id: grupoId,
    titulo,
    plataforma,
    fecha_programada: fechaHora,
    enlace: enlace || crearEnlaceSala(plataforma, titulo),
    fecha_creacion: new Date(),
  });

  return res.status(201).json(item);
}

async function alumnosPorGrupoMateria(req, res) {
  const materiaId = Number(req.params.materiaId);
  const grupoId = normalizeGrupo(req.params.grupoId);
  if (!Number.isInteger(materiaId) || !grupoId) {
    return res.status(400).json({ message: 'materiaId/grupoId invalidos.' });
  }

  const contexto = await obtenerContextoDocente(req.user.id_usuario);
  if (!docenteAsignadoMateriaGrupo(contexto.asignacionesSet, materiaId, grupoId)) {
    return res.status(403).json({ message: 'No tienes asignacion para ese grupo/materia.' });
  }

  const items = await AlumnoGrupo.findAll({
    where: { id_materia: materiaId, grupo: grupoId },
    include: [{
      model: AlumnoPerfil,
      as: 'alumno',
      include: [{ model: Usuario, as: 'usuario', attributes: ['id_usuario', 'folio_matricula', 'nombre_completo', 'correo'] }],
    }],
    order: [['id_alumno_grupo', 'DESC']],
  });

  const alumnosIds = items.map((item) => Number(item.id_alumno)).filter(Number.isInteger);
  const evidencias = alumnosIds.length > 0
    ? await PortafolioMateriaEvidencia.findAll({
      where: {
        materia_id: materiaId,
        alumno_id: { [Op.in]: alumnosIds },
      },
      order: [['created_at', 'DESC'], ['id_evidencia_materia', 'DESC']],
    })
    : [];

  const evidenciaPorAlumno = new Map();
  evidencias.forEach((item) => {
    const alumnoId = Number(item.alumno_id);
    if (!Number.isInteger(alumnoId) || evidenciaPorAlumno.has(alumnoId)) return;
    evidenciaPorAlumno.set(alumnoId, item);
  });

  const responseItems = items.map((row) => {
    const evidencia = evidenciaPorAlumno.get(Number(row.id_alumno)) || null;
    return {
      ...row.toJSON(),
      portafolio_evidencia: evidencia
        ? {
          drive_url: evidencia.drive_url,
          estado: evidencia.estado,
          fecha_actualizacion: evidencia.fecha_actualizacion,
        }
        : null,
    };
  });

  return res.json({ items: responseItems });
}

async function listarAsistenciaGrupoFecha(req, res) {
  const materiaId = Number(req.params.materiaId);
  const grupoId = normalizeGrupo(req.params.grupoId);
  const fechaQuery = String(req.query.fecha || '').trim();

  if (!Number.isInteger(materiaId) || !grupoId) {
    return res.status(400).json({ message: 'materiaId/grupoId invalidos.' });
  }
  if (!fechaQuery) {
    return res.status(400).json({ message: 'fecha es obligatoria.' });
  }

  const fechaBase = new Date(`${fechaQuery}T00:00:00`);
  if (Number.isNaN(fechaBase.getTime())) {
    return res.status(400).json({ message: 'fecha invalida. Usa YYYY-MM-DD.' });
  }

  const contexto = await obtenerContextoDocente(req.user.id_usuario);
  if (!docenteAsignadoMateriaGrupo(contexto.asignacionesSet, materiaId, grupoId)) {
    return res.status(403).json({ message: 'No tienes asignacion para ese grupo/materia.' });
  }

  const items = await AlumnoGrupo.findAll({
    where: { id_materia: materiaId, grupo: grupoId },
    include: [{
      model: AlumnoPerfil,
      as: 'alumno',
      include: [{ model: Usuario, as: 'usuario', attributes: ['id_usuario', 'folio_matricula', 'nombre_completo', 'correo'] }],
    }],
    order: [['id_alumno_grupo', 'DESC']],
  });

  const fechaInicio = new Date(fechaBase);
  fechaInicio.setHours(0, 0, 0, 0);
  const fechaFin = new Date(fechaBase);
  fechaFin.setHours(23, 59, 59, 999);

  const registros = await AsistenciaDocente.findAll({
    where: {
      id_materia: materiaId,
      fecha_clase: { [Op.gte]: fechaInicio, [Op.lte]: fechaFin },
    },
    raw: true,
  });

  const registrosMap = new Map(registros.map((row) => [Number(row.id_alumno), serializarEstadoAsistencia(row.estatus_asistencia)]));

  const responseItems = items.map((row) => ({
    id_alumno: Number(row.id_alumno),
    nombre_completo: row.alumno?.usuario?.nombre_completo || `Alumno ${row.id_alumno}`,
    folio_matricula: row.alumno?.usuario?.folio_matricula || '',
    correo: row.alumno?.usuario?.correo || '',
    estado: registrosMap.get(Number(row.id_alumno)) || null,
  }));

  return res.json({ items: responseItems, fecha: fechaQuery });
}

async function historialAsistenciaGrupo(req, res) {
  const materiaId = Number(req.params.materiaId);
  const grupoId = normalizeGrupo(req.params.grupoId);

  if (!Number.isInteger(materiaId) || !grupoId) {
    return res.status(400).json({ message: 'materiaId/grupoId invalidos.' });
  }

  const contexto = await obtenerContextoDocente(req.user.id_usuario);
  if (!docenteAsignadoMateriaGrupo(contexto.asignacionesSet, materiaId, grupoId)) {
    return res.status(403).json({ message: 'No tienes asignacion para ese grupo/materia.' });
  }

  const inscripciones = await AlumnoGrupo.findAll({
    where: { id_materia: materiaId, grupo: grupoId },
    attributes: ['id_alumno'],
    raw: true,
  });

  const alumnosIds = inscripciones
    .map((item) => Number(item.id_alumno))
    .filter(Number.isInteger);

  if (alumnosIds.length === 0) {
    return res.json({ fechas: [] });
  }

  const registros = await AsistenciaDocente.findAll({
    where: {
      id_materia: materiaId,
      id_alumno: { [Op.in]: alumnosIds },
    },
    attributes: [[AsistenciaDocente.sequelize.fn('DATE', AsistenciaDocente.sequelize.col('fecha_clase')), 'fecha']],
    group: [AsistenciaDocente.sequelize.fn('DATE', AsistenciaDocente.sequelize.col('fecha_clase'))],
    order: [[AsistenciaDocente.sequelize.literal('fecha'), 'DESC']],
    raw: true,
  });

  const fechasUnicas = registros
    .map((item) => fechaIsoYYYYMMDD(item.fecha))
    .filter(Boolean);

  return res.json({ fechas: fechasUnicas });
}

async function registrarAsistenciaGrupo(req, res) {
  const payload = construirPayloadAsistencias(req.body);

  if (payload.length === 0) {
    return res.status(400).json({ message: 'Debes enviar al menos un registro de asistencia.' });
  }

  const contexto = await obtenerContextoDocente(req.user.id_usuario);
  const esLote = Array.isArray(req.body) || Array.isArray(req.body.registros) || payload.length > 1;
  const rowsParaUpsert = [];

  for (let idx = 0; idx < payload.length; idx += 1) {
    const row = payload[idx];
    const result = await prepararAsistenciaParaUpsert({ row, req, contexto });

    if (result.error) {
      return res.status(result.error.status).json({
        message: result.error.message,
        index: idx,
      });
    }

    rowsParaUpsert.push(result.row);
  }

  const keySet = new Set(rowsParaUpsert.map((item) => buildAsistenciaKey(item)));
  const whereOr = rowsParaUpsert.map((item) => ({
    id_materia: item.id_materia,
    id_alumno: item.id_alumno,
    fecha_clase: item.fecha_clase,
  }));

  const existentes = whereOr.length > 0
    ? await AsistenciaDocente.findAll({
      where: { [Op.or]: whereOr },
      attributes: ['id_materia', 'id_alumno', 'fecha_clase'],
      raw: true,
    })
    : [];

  const existentesSet = new Set(
    existentes.map((item) => buildAsistenciaKey({
      id_materia: Number(item.id_materia),
      id_alumno: Number(item.id_alumno),
      fecha_iso: fechaIsoYYYYMMDD(item.fecha_clase),
    })),
  );

  await AsistenciaDocente.bulkCreate(rowsParaUpsert.map((item) => {
    const copy = { ...item };
    delete copy.fecha_iso;
    return copy;
  }), {
    updateOnDuplicate: ['id_docente', 'estatus_asistencia', 'aprovechamiento', 'observaciones'],
  });

  const resultados = whereOr.length > 0
    ? await AsistenciaDocente.findAll({
      where: { [Op.or]: whereOr },
      order: [['id_registro', 'DESC']],
    })
    : [];

  const creados = rowsParaUpsert.filter((item) => !existentesSet.has(buildAsistenciaKey(item))).length;
  const actualizados = keySet.size - creados;

  if (!esLote) {
    return res.status(creados > 0 ? 201 : 200).json(resultados[0]);
  }

  return res.status(200).json({
    items: resultados,
    resumen: {
      total: resultados.length,
      creados,
      actualizados,
    },
  });
}

async function guardarAsistenciaGrupoMasiva(req, res) {
  return registrarAsistenciaGrupo(req, res);
}

async function capturarCalificacionesFormativa(req, res) {
  const materiaId = Number(req.body.materia_id);
  const grupoId = normalizeGrupo(req.body.grupo_id);
  const formativaNumero = Number(req.body.formativa_numero || 1);
  const calificaciones = Array.isArray(req.body.calificaciones)
    ? req.body.calificaciones
    : [{ alumno_id: req.body.alumno_id, calificacion: req.body.calificacion, retroalimentacion: req.body.retroalimentacion }];

  if (!Number.isInteger(materiaId) || !grupoId || !Number.isInteger(formativaNumero) || formativaNumero < 1) {
    return res.status(400).json({ message: 'materia_id, grupo_id y formativa_numero son obligatorios.' });
  }

  const contexto = await obtenerContextoDocente(req.user.id_usuario);
  if (!docenteAsignadoMateriaGrupo(contexto.asignacionesSet, materiaId, grupoId)) {
    return res.status(403).json({ message: 'No tienes asignacion para ese grupo/materia.' });
  }

  const periodo = await PeriodoAcademico.findOne({ where: { estatus: 'activo' }, order: [['id_periodo', 'DESC']] });
  if (periodo?.fecha_limite_calificaciones && new Date() > new Date(periodo.fecha_limite_calificaciones)) {
    return res.status(423).json({ message: 'La fecha limite para capturar calificaciones formativas ha vencido.' });
  }

  const upserts = [];
  for (const row of calificaciones) {
    const alumnoId = Number(row?.alumno_id);
    const calificacion = Number(row?.calificacion);
    const entregoPortafolio = Boolean(row?.entrego_portafolio ?? req.body.entrego_portafolio);
    if (!Number.isInteger(alumnoId) || Number.isNaN(calificacion) || calificacion < 0 || calificacion > 10) {
      return res.status(400).json({ message: 'Cada calificacion debe incluir alumno_id y calificacion en rango 0..10.' });
    }

    const inscripcion = await AlumnoGrupo.findOne({ where: { id_alumno: alumnoId, id_materia: materiaId, grupo: grupoId } });
    if (!inscripcion) {
      return res.status(400).json({ message: `Alumno ${alumnoId} no pertenece al grupo ${grupoId} de la materia.` });
    }

    // eslint-disable-next-line no-await-in-loop
    const [item] = await CalificacionFormativaDocente.findOrCreate({
      where: {
        id_alumno: alumnoId,
        id_materia: materiaId,
        grupo_id: grupoId,
        formativa_numero: formativaNumero,
      },
      defaults: {
        id_docente: req.user.id_usuario,
        calificacion,
        retroalimentacion: sanitizeText(row?.retroalimentacion) || null,
        fecha_captura: new Date(),
      },
    });

    if (!item.isNewRecord) {
      item.id_docente = req.user.id_usuario;
      item.calificacion = calificacion;
      item.retroalimentacion = sanitizeText(row?.retroalimentacion) || null;
      item.fecha_captura = new Date();
      // eslint-disable-next-line no-await-in-loop
      await item.save();
    }

    upserts.push(item);

    if (entregoPortafolio) {
      // Marcar evidencia como validada para la materia cuando el docente confirma el portafolio.
      // eslint-disable-next-line no-await-in-loop
      const evidencia = await PortafolioMateriaEvidencia.findOne({
        where: {
          alumno_id: alumnoId,
          materia_id: materiaId,
        },
        order: [['created_at', 'DESC'], ['id_evidencia_materia', 'DESC']],
      });

      if (evidencia && evidencia.estado !== 'validado') {
        evidencia.estado = 'validado';
        evidencia.fecha_actualizacion = new Date();
        // eslint-disable-next-line no-await-in-loop
        await evidencia.save();
      }
    }
  }

  return res.json({
    formativa_numero: formativaNumero,
    materia_id: materiaId,
    grupo_id: grupoId,
    total_registros: upserts.length,
  });
}

async function enviarActaCoordinacion(req, res) {
  const materiaId = Number(req.body.materia_id);
  const grupoId = normalizeGrupo(req.body.grupo_id);
  if (!Number.isInteger(materiaId) || !grupoId) {
    return res.status(400).json({ message: 'materia_id y grupo_id son obligatorios.' });
  }

  const contexto = await obtenerContextoDocente(req.user.id_usuario);
  if (!docenteAsignadoMateriaGrupo(contexto.asignacionesSet, materiaId, grupoId)) {
    return res.status(403).json({ message: 'No tienes asignacion para ese grupo/materia.' });
  }

  const materia = await Materia.findByPk(materiaId, { attributes: ['id_materia', 'carrera', 'nombre_materia'] });
  if (!materia) {
    return res.status(404).json({ message: 'Materia no encontrada.' });
  }

  const periodo = await PeriodoAcademico.findOne({ where: { estatus: 'activo' }, order: [['id_periodo', 'DESC']] });
  if (!periodo) {
    return res.status(400).json({ message: 'No hay periodo academico activo para generar acta.' });
  }

  const alumnosGrupo = await AlumnoGrupo.findAll({ where: { id_materia: materiaId, grupo: grupoId }, attributes: ['id_alumno'], raw: true });
  const alumnosIds = alumnosGrupo.map((item) => Number(item.id_alumno)).filter(Number.isInteger);

  const formativas = alumnosIds.length > 0
    ? await CalificacionFormativaDocente.findAll({ where: { id_materia: materiaId, grupo_id: grupoId, id_alumno: { [Op.in]: alumnosIds } }, raw: true })
    : [];

  const scoreByAlumno = new Map();
  formativas.forEach((row) => {
    const idAlumno = Number(row.id_alumno);
    const current = scoreByAlumno.get(idAlumno) || { sum: 0, total: 0 };
    current.sum += Number(row.calificacion || 0);
    current.total += 1;
    scoreByAlumno.set(idAlumno, current);
  });

  const totalAlumnos = alumnosIds.length;
  const totalReprobados = alumnosIds.reduce((acc, idAlumno) => {
    const score = scoreByAlumno.get(idAlumno);
    if (!score || score.total === 0) return acc;
    const promedio = score.sum / score.total;
    return promedio < 6 ? acc + 1 : acc;
  }, 0);

  const portafolioValidaciones = Array.isArray(req.body.portafolio_validaciones)
    ? req.body.portafolio_validaciones
      .map((item) => ({
        alumno_id: Number(item?.alumno_id),
        entrego_portafolio: Boolean(item?.entrego_portafolio),
      }))
      .filter((item) => Number.isInteger(item.alumno_id))
    : [];

  const observaciones = {
    origen: 'docente',
    materia_id: materiaId,
    materia: materia.nombre_materia,
    grupo_id: grupoId,
    formativa_numero: Number(req.body.formativa_numero || 1),
    portafolio_validaciones: portafolioValidaciones,
    enviado_por_docente: req.user.id_usuario,
    fecha_envio: new Date().toISOString(),
  };

  const [acta] = await ActaCalificacion.findOrCreate({
    where: {
      id_periodo: periodo.id_periodo,
      carrera: materia.carrera || 'Sin carrera',
      estatus: 'borrador',
    },
    defaults: {
      id_periodo: periodo.id_periodo,
      carrera: materia.carrera || 'Sin carrera',
      estatus: 'borrador',
      total_alumnos: totalAlumnos,
      total_reprobados: totalReprobados,
      observaciones: JSON.stringify(observaciones),
      fecha_creacion: new Date(),
    },
  });

  if (!acta.isNewRecord) {
    acta.total_alumnos = totalAlumnos;
    acta.total_reprobados = totalReprobados;
    acta.observaciones = JSON.stringify(observaciones);
    await acta.save();
  }

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'docente_completo_carga_calificaciones',
    modulo: 'docentes',
    entidad: 'actas_calificaciones',
    idEntidad: acta.id_acta,
    detalle: {
      materia_id: materiaId,
      materia: materia.nombre_materia,
      grupo_id: grupoId,
      total_alumnos: totalAlumnos,
      total_reprobados: totalReprobados,
    },
  });

  return res.status(201).json({
    id_acta: acta.id_acta,
    id_periodo: acta.id_periodo,
    carrera: acta.carrera,
    estatus: acta.estatus,
    total_alumnos: acta.total_alumnos,
    total_reprobados: acta.total_reprobados,
  });
}

async function justificantesRecibidos(req, res) {
  return justificantesPreaprobados(req, res);
}

async function listarAvisosGrupales(req, res) {
  const contexto = await obtenerContextoDocente(req.user.id_usuario);
  const materiasIds = contexto.materiasIds;
  if (materiasIds.length === 0) return res.json({ items: [] });

  const items = await AnuncioDocente.findAll({
    where: {
      id_docente: req.user.id_usuario,
      [Op.or]: [
        { id_materia: null },
        { id_materia: { [Op.in]: materiasIds } },
      ],
    },
    include: [{ model: Materia, as: 'materia' }],
    order: [['fecha_publicacion', 'DESC']],
    limit: 50,
  });

  return res.json({ items });
}

async function publicarAvisoGrupal(req, res) {
  const titulo = sanitizeText(req.body.titulo);
  const descripcion = sanitizeText(req.body.descripcion);
  const materiaId = req.body.materia_id == null ? null : Number(req.body.materia_id);
  const grupoId = normalizeGrupo(req.body.grupo_id);

  if (!titulo || !descripcion) {
    return res.status(400).json({ message: 'titulo y descripcion son obligatorios.' });
  }

  if (materiaId !== null && !Number.isInteger(materiaId)) {
    return res.status(400).json({ message: 'materia_id invalido.' });
  }

  let carreraId = null;
  if (materiaId !== null) {
    const contexto = await obtenerContextoDocente(req.user.id_usuario);
    if (!docenteAsignadoMateriaGrupo(contexto.asignacionesSet, materiaId, grupoId)) {
      return res.status(403).json({ message: 'No tienes asignacion para ese grupo/materia.' });
    }

    const materia = await Materia.findByPk(materiaId, { attributes: ['id_materia', 'carrera'] });
    if (materia) {
      carreraId = materia.carrera || null;
    }
  }

  const item = await AnuncioDocente.create({
    id_docente: req.user.id_usuario,
    id_materia: materiaId,
    titulo,
    descripcion: grupoId ? `[${grupoId}] ${descripcion}` : descripcion,
    fecha_publicacion: new Date(),
  });

  await Aviso.create({
    titulo,
    mensaje: descripcion,
    remitente_tipo: 'docente',
    carrera_id: carreraId,
    grupo_id: grupoId || null,
    docente_id: req.user.id_usuario,
    created_at: new Date(),
  });

  return res.status(201).json(item);
}

async function publicarRecursoAcademico(req, res) {
  const titulo = sanitizeText(req.body.titulo);
  const materiaId = Number(req.body.materia_id);
  const grupoId = req.body.grupo_id ? normalizeGrupo(req.body.grupo_id) : null;
  const tipoRecurso = sanitizeText(req.body.tipo_recurso).toLowerCase();
  const remitenteNombre = sanitizeText(req.body.remitente_nombre) || req.user.nombre_completo;

  if (!titulo || !Number.isInteger(materiaId)) {
    return res.status(400).json({ message: 'titulo y materia_id son obligatorios.' });
  }
  if (!['archivo_local', 'enlace_drive'].includes(tipoRecurso)) {
    return res.status(400).json({ message: 'tipo_recurso invalido. Usa archivo_local o enlace_drive.' });
  }

  const contexto = await obtenerContextoDocente(req.user.id_usuario);
  if (!contexto.materiasIds.includes(materiaId)) {
    return res.status(403).json({ message: 'No tienes asignacion para esa materia.' });
  }
  if (grupoId && !docenteAsignadoMateriaGrupo(contexto.asignacionesSet, materiaId, grupoId)) {
    return res.status(403).json({ message: 'No tienes asignacion para ese grupo/materia.' });
  }

  const urlRecurso = req.file
    ? `/uploads/portafolio/${req.file.filename}`
    : sanitizeText(req.body.url_recurso);

  if (!urlRecurso) {
    return res.status(400).json({ message: 'Adjunta un archivo o proporciona url_recurso.' });
  }
  if (tipoRecurso === 'enlace_drive') {
    try {
      // eslint-disable-next-line no-new
      new URL(urlRecurso);
    } catch (_error) {
      return res.status(400).json({ message: 'url_recurso debe ser una URL valida.' });
    }
  }

  const recurso = await RecursoAcademico.create({
    titulo,
    tipo_recurso: tipoRecurso,
    url_recurso: urlRecurso,
    remitente_tipo: 'docente',
    remitente_nombre: remitenteNombre,
    id_docente: req.user.id_usuario,
    id_materia: materiaId,
    grupo_id: grupoId,
    activo: true,
    created_at: new Date(),
  });

  return res.status(201).json(recurso);
}

async function eliminarRecursoAcademico(req, res) {
  const recursoId = Number(req.params.recursoId);
  if (!Number.isInteger(recursoId)) {
    return res.status(400).json({ message: 'recursoId invalido.' });
  }

  const recurso = await RecursoAcademico.findByPk(recursoId);
  if (!recurso) {
    return res.status(404).json({ message: 'Recurso no encontrado.' });
  }
  if (recurso.remitente_tipo !== 'docente' || Number(recurso.id_docente) !== Number(req.user.id_usuario)) {
    return res.status(403).json({ message: 'No puedes eliminar este recurso.' });
  }

  recurso.activo = false;
  await recurso.save();

  return res.json({ id_recurso: recurso.id_recurso, activo: recurso.activo });
}

async function misRecursosAcademicos(req, res) {
  const items = await RecursoAcademico.findAll({
    where: { id_docente: req.user.id_usuario, activo: true },
    include: [{ model: Materia, as: 'materia', attributes: ['id_materia', 'nombre_materia'] }],
    order: [['created_at', 'DESC']],
    limit: 200,
  });

  return res.json({ items });
}

async function recursosCoordinacion(req, res) {
  const materiaId = Number(req.query.materia_id);
  const grupoId = normalizeGrupo(req.query.grupo_id);

  if (!Number.isInteger(materiaId) || !grupoId) {
    return res.status(400).json({ message: 'materia_id y grupo_id son obligatorios.' });
  }

  const contexto = await obtenerContextoDocente(req.user.id_usuario);
  if (!docenteAsignadoMateriaGrupo(contexto.asignacionesSet, materiaId, grupoId)) {
    return res.status(403).json({ message: 'No tienes asignacion para ese grupo/materia.' });
  }

  const materia = await Materia.findByPk(materiaId, { attributes: ['id_materia', 'carrera'] });
  const carreraId = materia?.carrera || null;

  const where = {
    activo: true,
    remitente_tipo: 'coordinacion',
    [Op.and]: [
      {
        [Op.or]: [
          { id_materia: null },
          { id_materia: materiaId },
        ],
      },
      {
        [Op.or]: [
          { grupo_id: null },
          { grupo_id: grupoId },
        ],
      },
      {
        [Op.or]: [
          { carrera_id: null },
          ...(carreraId ? [{ carrera_id: carreraId }] : []),
        ],
      },
    ],
  };

  const items = await RecursoAcademico.findAll({
    where,
    include: [{ model: Materia, as: 'materia', attributes: ['id_materia', 'nombre_materia'], required: false }],
    order: [['created_at', 'DESC'], ['id_recurso', 'DESC']],
    limit: 200,
  });

  return res.json({
    items: items.map((item) => ({
      id: item.id_recurso,
      titulo: item.titulo,
      url_archivo: item.url_recurso,
      tipo_recurso: item.tipo_recurso,
      materia_nombre: item.materia?.nombre_materia || null,
      created_at: item.created_at,
    })),
  });
}

module.exports = {
  misMaterias,
  alumnosPorGrupoMateria,
  historialAsistenciaGrupo,
  listarAsistenciaGrupoFecha,
  registrarAsistenciaGrupo,
  guardarAsistenciaGrupoMasiva,
  capturarCalificacionesFormativa,
  enviarActaCoordinacion,
  justificantesRecibidos,
  listarAvisosGrupales,
  publicarAvisoGrupal,
  publicarRecursoAcademico,
  eliminarRecursoAcademico,
  misRecursosAcademicos,
  recursosCoordinacion,
  dashboard,
  grupos,
  calificacionesFinales,
  listarAsistencias,
  registrarAsistencia,
  aprovechamiento,
  justificantesPreaprobados,
};
