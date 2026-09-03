const { Op, Sequelize } = require('sequelize');
const {
  DocentePerfil,
  Usuario,
  AsignacionGrupo,
  Materia,
  Horario,
  ActaCalificacion,
  EvaluacionExtraordinaria,
  ProgramaExterno,
  AlumnoPerfil,
  AlumnoGrupo,
  MeritoAcademico,
  ProgramaAcademico,
  PeriodoAcademico,
  EntregaTarea,
  PortafolioEvidencia,
  CalificacionFormativaDocente,
  TramiteSolicitud,
  RecursoAcademico,
  Aviso,
} = require('../../models');
const { registrarEventoAuditoria } = require('../services/auditService');

const ESTADOS_ACADEMICOS_VALIDOS = new Set(['activo', 'suspendido']);

const DOCUMENTOS_REQUERIDOS = [
  { clave: 'curp', nombre: 'CURP', detalle: 'Identificacion oficial' },
  { clave: 'acta_nacimiento', nombre: 'Acta de nacimiento', detalle: 'Documentacion de registro' },
  { clave: 'certificado_bachillerato', nombre: 'Certificado de bachillerato', detalle: 'Boleta de preparatoria' },
  { clave: 'foto_oficial', nombre: 'Foto oficial', detalle: 'Formato escolar vigente' },
];

const DIAS_VALIDOS = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];
const ESTATUS_PROGRAMA_VALIDOS = new Set(['en_revision', 'horas_cubiertas', 'liberado', 'rechazado']);
const TIPOS_NIVEL_VALIDOS = new Set(['preparatoria', 'licenciatura', 'ingenieria', 'maestria']);
const MODALIDADES_PERIODO_VALIDAS = new Set(['cuatrimestral']);
const ESTATUS_PROGRAMA_ACADEMICO_VALIDOS = new Set(['activo', 'inactivo']);
const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;

function toInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : NaN;
}

function toPositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : NaN;
}

function normalizeText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function normalizeEnum(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeGrupo(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeCurp(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeDay(day) {
  const raw = String(day || '').trim().toLowerCase();
  const map = {
    lun: 'LUN', lunes: 'LUN',
    mar: 'MAR', martes: 'MAR',
    mie: 'MIE', miercoles: 'MIE', miércoles: 'MIE',
    jue: 'JUE', jueves: 'JUE',
    vie: 'VIE', viernes: 'VIE',
    sab: 'SAB', sabado: 'SAB', sábado: 'SAB',
    dom: 'DOM', domingo: 'DOM',
  };
  return map[raw] || null;
}

function parseDiasSemana(value) {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map(normalizeDay)
    .filter(Boolean);
  return [...new Set(normalized)];
}

function parseTimeToMinutes(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return NaN;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return NaN;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;
  return hours * 60 + minutes;
}

function timesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function parseCoordMeta(descripcion) {
  if (!descripcion || typeof descripcion !== 'string') return null;
  const marker = 'COORD_META:';
  if (!descripcion.startsWith(marker)) return null;

  const rawJson = descripcion.slice(marker.length);
  try {
    return JSON.parse(rawJson);
  } catch (_error) {
    return null;
  }
}

function toCoordMetaText(meta) {
  return `COORD_META:${JSON.stringify(meta)}`;
}

function scheduleRowToSlice(row) {
  const meta = parseCoordMeta(row.descripcion);
  const dias = Array.isArray(meta?.dias_semana) ? meta.dias_semana.filter((d) => DIAS_VALIDOS.includes(d)) : [];
  return {
    id_horario: row.id_horario,
    aula: row.aula,
    modalidad: row.modalidad,
    periodo: row.periodo,
    turno: row.turno,
    hora_inicio: row.hora_inicio,
    hora_fin: row.hora_fin,
    inicio: parseTimeToMinutes(row.hora_inicio),
    fin: parseTimeToMinutes(row.hora_fin),
    dias,
    grupo_id: normalizeGrupo(meta?.grupo_id),
    materia_id: toInt(meta?.materia_id),
    docente_id: toInt(meta?.docente_id),
  };
}

async function docentesAsignaciones(_req, res) {
  const [docentes, asignaciones, materias, gruposRaw, extrasActivos] = await Promise.all([
    DocentePerfil.findAll({
      where: { estatus_laboral: 'activo' },
      include: [{
        model: Usuario,
        as: 'usuario',
        attributes: ['id_usuario', 'nombre_completo', 'correo', 'folio_matricula'],
      }],
      order: [[{ model: Usuario, as: 'usuario' }, 'nombre_completo', 'ASC']],
    }),
    AsignacionGrupo.findAll({
      include: [
        { model: Materia, as: 'materia', attributes: ['id_materia', 'nombre_materia', 'codigo_materia'] },
        {
          model: DocentePerfil,
          as: 'docente',
          attributes: ['id_docente'],
          include: [{ model: Usuario, as: 'usuario', attributes: ['id_usuario', 'nombre_completo'] }],
        },
      ],
      order: [['id_asignacion', 'DESC']],
    }),
    Materia.findAll({
      attributes: ['id_materia', 'nombre_materia', 'codigo_materia', 'bimestre_pertenece', 'programa_academico_id', 'periodo_numero'],
      order: [['nombre_materia', 'ASC']],
    }),
    AlumnoGrupo.findAll({
      attributes: ['id_materia', 'grupo'],
      group: ['id_materia', 'grupo'],
      raw: true,
    }),
    EvaluacionExtraordinaria.count({ where: { estatus: { [Op.in]: ['programado', 'en_proceso'] } } }),
  ]);

  const asignacionesMap = new Map();
  asignaciones.forEach((item) => {
    const docenteId = item.id_docente;
    if (!asignacionesMap.has(docenteId)) {
      asignacionesMap.set(docenteId, { horas_totales: 0, materias: [] });
    }
    const entry = asignacionesMap.get(docenteId);
    const horas = Number(item.horas_semanales || 0);
    entry.horas_totales += Number.isFinite(horas) ? horas : 0;
    entry.materias.push({
      id_asignacion: item.id_asignacion,
      id_materia: item.id_materia,
      materia: item.materia?.nombre_materia || null,
      codigo_materia: item.materia?.codigo_materia || null,
      grupo: item.grupo,
      horas_semanales: Number(item.horas_semanales || 0),
    });
  });

  const gruposConDocente = new Set(asignaciones.map((item) => `${item.id_materia}::${normalizeGrupo(item.grupo)}`));
  const gruposSinDocente = gruposRaw.filter((item) => !gruposConDocente.has(`${item.id_materia}::${normalizeGrupo(item.grupo)}`));

  const items = docentes.map((docente) => {
    const resumen = asignacionesMap.get(docente.id_docente) || { horas_totales: 0, materias: [] };
    return {
      id_docente: docente.id_docente,
      nombre_completo: docente.usuario?.nombre_completo || `Docente ${docente.id_docente}`,
      correo: docente.usuario?.correo || null,
      folio_matricula: docente.usuario?.folio_matricula || null,
      horas_semanales: resumen.horas_totales,
      materias: resumen.materias,
    };
  });

  return res.json({
    items,
    catalogos: {
      materias: materias.map((materia) => ({
        id_materia: materia.id_materia,
        nombre_materia: materia.nombre_materia,
        codigo_materia: materia.codigo_materia,
        bimestre_pertenece: materia.bimestre_pertenece,
        programa_academico_id: materia.programa_academico_id,
        periodo_numero: materia.periodo_numero || materia.bimestre_pertenece,
      })),
      grupos: gruposRaw.map((item) => ({
        materia_id: item.id_materia,
        grupo_id: normalizeGrupo(item.grupo),
        etiqueta: `${normalizeGrupo(item.grupo)} · Materia ${item.id_materia}`,
      })),
    },
    kpis: {
      grupos_sin_docente: gruposSinDocente.length,
      alumnos_en_extraordinario: extrasActivos,
    },
  });
}

async function asignarMateriaDocente(req, res) {
  const docenteId = toInt(req.body.docente_id);
  const materiaId = toInt(req.body.materia_id);
  const grupoId = normalizeGrupo(req.body.grupo_id);
  const horasSemanales = toPositiveNumber(req.body.horas_semanales);

  if (!Number.isInteger(docenteId) || !Number.isInteger(materiaId) || !grupoId || !Number.isFinite(horasSemanales)) {
    return res.status(400).json({ message: 'Payload invalido. Usa { docente_id, materia_id, grupo_id, horas_semanales }.' });
  }

  const [docente, materia] = await Promise.all([
    DocentePerfil.findOne({ where: { id_docente: docenteId, estatus_laboral: 'activo' } }),
    Materia.findByPk(materiaId),
  ]);

  if (!docente) {
    return res.status(404).json({ message: 'Docente activo no encontrado.' });
  }
  if (!materia) {
    return res.status(404).json({ message: 'Materia no encontrada.' });
  }

  const duplicate = await AsignacionGrupo.findOne({ where: { id_materia: materiaId, grupo: grupoId } });
  if (duplicate && duplicate.id_docente !== docenteId) {
    return res.status(409).json({ message: 'El grupo ya tiene un docente asignado para esa materia.' });
  }

  const [targetHorarios, docenteHorariosRows] = await Promise.all([
    Horario.findAll({ where: { descripcion: { [Op.like]: `%\"grupo_id\":\"${grupoId}\"%` } } }),
    Horario.findAll({ where: { descripcion: { [Op.like]: `%\"docente_id\":${docenteId}%` } } }),
  ]);

  const targetSlices = targetHorarios.map(scheduleRowToSlice);
  const docenteSlices = docenteHorariosRows.map(scheduleRowToSlice);

  const hasOverlap = targetSlices.some((target) => {
    if (Number.isNaN(target.inicio) || Number.isNaN(target.fin)) return false;
    return docenteSlices.some((current) => {
      if (Number.isNaN(current.inicio) || Number.isNaN(current.fin)) return false;
      const shareDay = target.dias.some((day) => current.dias.includes(day));
      if (!shareDay) return false;
      return timesOverlap(target.inicio, target.fin, current.inicio, current.fin);
    });
  });

  if (hasOverlap) {
    return res.status(409).json({ message: 'Empalme detectado: el docente tiene un horario que cruza con este grupo.' });
  }

  if (duplicate) {
    duplicate.id_docente = docenteId;
    duplicate.horas_semanales = horasSemanales;
    await duplicate.save();
    return res.json({ id_asignacion: duplicate.id_asignacion, actualizado: true });
  }

  const created = await AsignacionGrupo.create({
    id_docente: docenteId,
    id_materia: materiaId,
    grupo: grupoId,
    horas_semanales: horasSemanales,
  });

  return res.status(201).json({ id_asignacion: created.id_asignacion });
}

async function aulasDisponibilidad(_req, res) {
  const horarios = await Horario.findAll({ order: [['aula', 'ASC'], ['hora_inicio', 'ASC']] });

  const byAula = new Map();
  horarios.forEach((row) => {
    const slice = scheduleRowToSlice(row);
    const aula = normalizeText(slice.aula)
      || (String(slice.modalidad || '').toLowerCase().includes('virtual') ? 'AULA-VIRTUAL' : 'SIN-AULA');

    if (!byAula.has(aula)) {
      byAula.set(aula, {
        aula,
        modalidad: slice.modalidad,
        ocupacion: [],
      });
    }

    byAula.get(aula).ocupacion.push({
      id_horario: slice.id_horario,
      grupo_id: slice.grupo_id,
      docente_id: Number.isInteger(slice.docente_id) ? slice.docente_id : null,
      materia_id: Number.isInteger(slice.materia_id) ? slice.materia_id : null,
      dias_semana: slice.dias,
      hora_inicio: slice.hora_inicio,
      hora_fin: slice.hora_fin,
      periodo: slice.periodo,
      turno: slice.turno,
    });
  });

  return res.json({
    items: [...byAula.values()],
  });
}

async function programarHorarioGrupo(req, res) {
  const grupoId = normalizeGrupo(req.body.grupo_id);
  const materiaId = toInt(req.body.materia_id);
  const docenteId = toInt(req.body.docente_id);
  const aula = normalizeText(req.body.aula);
  const horaInicio = String(req.body.hora_inicio || '').trim();
  const horaFin = String(req.body.hora_fin || '').trim();
  const diasSemana = parseDiasSemana(req.body.dias_semana);
  const modalidad = normalizeText(req.body.modalidad) || 'presencial';
  const periodo = normalizeText(req.body.periodo) || 'vigente';
  const turno = normalizeText(req.body.turno) || 'matutino';

  if (!grupoId || !aula || !Number.isInteger(materiaId) || !Number.isInteger(docenteId)) {
    return res.status(400).json({ message: 'Payload invalido. Incluye grupo_id, materia_id, docente_id y aula.' });
  }
  if (diasSemana.length === 0) {
    return res.status(400).json({ message: 'Selecciona al menos un dia de la semana.' });
  }

  const start = parseTimeToMinutes(horaInicio);
  const end = parseTimeToMinutes(horaFin);
  if (Number.isNaN(start) || Number.isNaN(end) || start >= end) {
    return res.status(400).json({ message: 'Rango horario invalido. Usa HH:mm y hora_inicio < hora_fin.' });
  }

  const [docente, materia] = await Promise.all([
    DocentePerfil.findOne({ where: { id_docente: docenteId, estatus_laboral: 'activo' } }),
    Materia.findByPk(materiaId),
  ]);
  if (!docente) {
    return res.status(404).json({ message: 'Docente activo no encontrado.' });
  }
  if (!materia) {
    return res.status(404).json({ message: 'Materia no encontrada.' });
  }

  const horariosAula = await Horario.findAll({ where: { aula } });
  const conflicto = horariosAula
    .map(scheduleRowToSlice)
    .some((row) => {
      if (Number.isNaN(row.inicio) || Number.isNaN(row.fin)) return false;
      const dayOverlap = diasSemana.some((day) => row.dias.includes(day));
      if (!dayOverlap) return false;
      return timesOverlap(start, end, row.inicio, row.fin);
    });

  if (conflicto) {
    return res.status(409).json({ message: 'La aula seleccionada ya esta ocupada en ese bloque.' });
  }

  const descripcionMeta = {
    grupo_id: grupoId,
    materia_id: materiaId,
    docente_id: docenteId,
    dias_semana: diasSemana,
    programado_por: req.user.id_usuario,
  };

  const created = await Horario.create({
    modalidad,
    periodo,
    turno,
    aula,
    hora_inicio: horaInicio,
    hora_fin: horaFin,
    descripcion: toCoordMetaText(descripcionMeta),
  });

  return res.status(201).json({
    id_horario: created.id_horario,
    aula: created.aula,
    dias_semana: diasSemana,
    hora_inicio: created.hora_inicio,
    hora_fin: created.hora_fin,
  });
}

async function actasPendientes(_req, res) {
  const [actas, alumnosExtra] = await Promise.all([
    ActaCalificacion.findAll({
      where: { estatus: { [Op.in]: ['borrador', 'validada'] } },
      include: [{ model: PeriodoAcademico, as: 'periodo', attributes: ['id_periodo', 'nombre', 'ciclo', 'bimestre'] }],
      order: [['fecha_creacion', 'DESC']],
    }),
    EvaluacionExtraordinaria.count({ where: { estatus: { [Op.in]: ['programado', 'en_proceso'] } } }),
  ]);

  return res.json({
    items: actas,
    kpis: {
      actas_pendientes: actas.length,
      alumnos_en_extraordinario: alumnosExtra,
    },
  });
}

async function validarActa(req, res) {
  const actaId = toInt(req.params.actaId);
  const observaciones = normalizeText(req.body.observaciones);

  if (!Number.isInteger(actaId)) {
    return res.status(400).json({ message: 'actaId invalido.' });
  }

  const acta = await ActaCalificacion.findByPk(actaId);
  if (!acta) {
    return res.status(404).json({ message: 'Acta no encontrada.' });
  }

  acta.estatus = 'cerrada';
  acta.fecha_cierre = new Date();
  acta.observaciones = observaciones
    ? `${observaciones}\n\nCierre oficial por Coordinacion.`
    : 'Cierre oficial por Coordinacion.';

  await acta.save();

  return res.json({
    id_acta: acta.id_acta,
    estatus: acta.estatus,
    fecha_cierre: acta.fecha_cierre,
  });
}

async function getPeriodoActivoId() {
  const active = await PeriodoAcademico.findOne({
    where: { estatus: 'activo' },
    order: [['fecha_inicio', 'DESC']],
  });
  if (active) return active.id_periodo;

  const latest = await PeriodoAcademico.findOne({ order: [['fecha_inicio', 'DESC']] });
  return latest ? latest.id_periodo : null;
}

async function programarExtraordinario(req, res) {
  const alumnoId = toInt(req.body.alumno_id);
  const materiaId = toInt(req.body.materia_id);
  const docenteSinodalId = toInt(req.body.docente_sinodal_id);
  const fechaExamenRaw = String(req.body.fecha_examen || '').trim();
  const costoFolioRef = normalizeText(req.body.costo_folio_ref);

  if (!Number.isInteger(alumnoId) || !Number.isInteger(materiaId) || !Number.isInteger(docenteSinodalId) || !costoFolioRef) {
    return res.status(400).json({ message: 'Payload invalido para extraordinario.' });
  }

  const fechaExamen = new Date(fechaExamenRaw);
  if (Number.isNaN(fechaExamen.getTime())) {
    return res.status(400).json({ message: 'fecha_examen invalida.' });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (fechaExamen <= today) {
    return res.status(400).json({ message: 'La fecha_examen debe ser posterior a la fecha actual.' });
  }

  const [alumno, materia, sinodal, idPeriodo] = await Promise.all([
    AlumnoPerfil.findByPk(alumnoId),
    Materia.findByPk(materiaId),
    DocentePerfil.findOne({ where: { id_docente: docenteSinodalId, estatus_laboral: 'activo' } }),
    getPeriodoActivoId(),
  ]);

  if (!alumno) return res.status(404).json({ message: 'Alumno no encontrado.' });
  if (!materia) return res.status(404).json({ message: 'Materia no encontrada.' });
  if (!sinodal) return res.status(404).json({ message: 'Docente sinodal no encontrado o inactivo.' });
  if (!idPeriodo) return res.status(400).json({ message: 'No hay periodos academicos configurados.' });

  const created = await EvaluacionExtraordinaria.create({
    id_alumno: alumnoId,
    id_materia: materiaId,
    id_periodo: idPeriodo,
    id_docente_sinodal: docenteSinodalId,
    tipo: 'extraordinario',
    estatus: 'programado',
    fecha_programada: fechaExamen,
    costo_folio_ref: costoFolioRef,
    observaciones: normalizeText(req.body.observaciones),
    fecha_creacion: new Date(),
  });

  return res.status(201).json({
    id_evaluacion: created.id_evaluacion,
    id_alumno: created.id_alumno,
    id_materia: created.id_materia,
    fecha_examen: created.fecha_programada,
    costo_folio_ref: created.costo_folio_ref,
  });
}

async function programasExternos(req, res) {
  try {
    const tipo = normalizeText(req.query.tipo);
    const where = {};

    if (tipo && ['servicio_social', 'practicas_profesionales'].includes(tipo)) {
      where.tipo_programa = tipo;
    }

    const items = await ProgramaExterno.findAll({
      where,
      include: [{
        model: AlumnoPerfil,
        as: 'alumno',
        required: false,
        include: [{
          model: Usuario,
          as: 'usuario',
          required: false,
          attributes: ['id_usuario', 'folio_matricula', 'nombre_completo', 'correo'],
        }],
      }],
      order: [['fecha_creacion', 'DESC']],
    });

    return res.status(200).json({ items: Array.isArray(items) ? items : [] });
  } catch (error) {
    console.error('[Error coordinacion/programas-externos]:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener programas externos',
      error: error.message,
    });
  }
}

async function actualizarEstatusProgramaExterno(req, res) {
  const expedienteId = toInt(req.params.expedienteId);
  const estatus = String(req.body.estatus || '').trim().toLowerCase();
  const oficioLiberacion = normalizeText(req.body.oficio_liberacion);
  const horasConcluidas = Number(req.body.horas_concluidas);

  if (!Number.isInteger(expedienteId)) {
    return res.status(400).json({ message: 'expedienteId invalido.' });
  }

  if (!ESTATUS_PROGRAMA_VALIDOS.has(estatus)) {
    return res.status(400).json({ message: 'estatus invalido. Usa: en_revision, horas_cubiertas, liberado o rechazado.' });
  }

  const expediente = await ProgramaExterno.findByPk(expedienteId);
  if (!expediente) {
    return res.status(404).json({ message: 'Expediente no encontrado.' });
  }

  if (estatus === 'liberado') {
    const minimoHoras = expediente.tipo_programa === 'servicio_social' ? 480 : 240;
    if (!Number.isFinite(horasConcluidas) || horasConcluidas < minimoHoras) {
      return res.status(400).json({ message: `horas_concluidas insuficientes para liberar. Minimo requerido: ${minimoHoras}.` });
    }
    if (!oficioLiberacion) {
      return res.status(400).json({ message: 'oficio_liberacion es obligatorio para liberar expediente.' });
    }
  }

  expediente.estatus = estatus;
  if (Number.isFinite(horasConcluidas)) {
    expediente.horas_concluidas = Math.floor(horasConcluidas);
  }
  if (oficioLiberacion) {
    expediente.oficio_liberacion = oficioLiberacion;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'observaciones')) {
    expediente.observaciones = normalizeText(req.body.observaciones);
  }

  await expediente.save();

  return res.json({
    id_programa: expediente.id_programa,
    estatus: expediente.estatus,
    oficio_liberacion: expediente.oficio_liberacion,
    horas_concluidas: expediente.horas_concluidas,
  });
}

async function alumnosProgreso(_req, res) {
  const [alumnos, totalMaterias, materiasPorAlumno, promedioPorAlumno] = await Promise.all([
    AlumnoPerfil.findAll({
      include: [{
        model: Usuario,
        as: 'usuario',
        attributes: ['id_usuario', 'folio_matricula', 'nombre_completo', 'correo', 'curp'],
      }],
      order: [[{ model: Usuario, as: 'usuario' }, 'nombre_completo', 'ASC']],
    }),
    Materia.count(),
    AlumnoGrupo.findAll({
      attributes: [
        'id_alumno',
        [Sequelize.fn('COUNT', Sequelize.fn('DISTINCT', Sequelize.col('id_materia'))), 'materias_cursadas'],
      ],
      group: ['id_alumno'],
      raw: true,
    }),
    EntregaTarea.findAll({
      attributes: [
        'id_alumno',
        [Sequelize.fn('AVG', Sequelize.col('calificacion')), 'promedio_global'],
      ],
      where: { calificacion: { [Op.not]: null } },
      group: ['id_alumno'],
      raw: true,
    }),
  ]);

  const materiasMap = new Map(materiasPorAlumno.map((row) => [Number(row.id_alumno), Number(row.materias_cursadas || 0)]));
  const promedioMap = new Map(promedioPorAlumno.map((row) => [Number(row.id_alumno), Number(row.promedio_global || 0)]));

  const items = alumnos.map((alumno) => {
    const cursadas = materiasMap.get(alumno.id_alumno) || 0;
    const porcentaje = totalMaterias > 0 ? Math.min(100, Number(((cursadas / totalMaterias) * 100).toFixed(2))) : 0;
    const promedio = promedioMap.has(alumno.id_alumno)
      ? Number((promedioMap.get(alumno.id_alumno) || 0).toFixed(2))
      : null;

    return {
      id_alumno: alumno.id_alumno,
      nombre_completo: alumno.usuario?.nombre_completo || `Alumno ${alumno.id_alumno}`,
      folio_matricula: alumno.usuario?.folio_matricula || null,
      curp: alumno.usuario?.curp || null,
      carrera: alumno.carrera,
      porcentaje_avance: porcentaje,
      promedio_global: promedio,
    };
  });

  return res.json({ items });
}

async function portafolioAlumno(req, res) {
  const alumnoId = toInt(req.params.alumnoId);
  if (!Number.isInteger(alumnoId)) {
    return res.status(400).json({ message: 'alumnoId invalido.' });
  }

  const alumno = await AlumnoPerfil.findByPk(alumnoId, {
    include: [{
      model: Usuario,
      as: 'usuario',
      attributes: ['id_usuario', 'folio_matricula', 'nombre_completo', 'correo'],
    }],
  });

  if (!alumno) {
    return res.status(404).json({ message: 'Alumno no encontrado.' });
  }

  const evidencias = await PortafolioEvidencia.findAll({
    where: { id_alumno: alumnoId },
    include: [{ model: Materia, as: 'materia', attributes: ['id_materia', 'nombre_materia'], required: false }],
    order: [['id_evidencia', 'DESC']],
    limit: 300,
  });

  const evidenciaPorDocumento = new Map();
  evidencias.forEach((item) => {
    const tipo = String(item.tipo_documento || '').trim().toLowerCase();
    if (!tipo || evidenciaPorDocumento.has(tipo)) return;
    evidenciaPorDocumento.set(tipo, item);
  });

  const documentos = DOCUMENTOS_REQUERIDOS.map((documento) => {
    const evidencia = evidenciaPorDocumento.get(documento.clave) || null;
    return {
      key: documento.clave,
      label: documento.nombre,
      detalle: documento.detalle,
      estatus: evidencia ? 'entregado' : 'faltante',
      archivo_url: evidencia ? evidencia.archivo_url : null,
      nombre_archivo: evidencia ? evidencia.nombre_archivo : null,
      fecha_entrega: evidencia ? evidencia.fecha_creacion : null,
    };
  });

  return res.json({
    alumno: {
      id_alumno: alumno.id_alumno,
      folio_matricula: alumno.usuario?.folio_matricula || null,
      nombre_completo: alumno.usuario?.nombre_completo || null,
      correo: alumno.usuario?.correo || null,
      drive_folder_url: alumno.drive_folder_url || null,
    },
    documentos,
    items: evidencias.map((item) => ({
      id_evidencia: item.id_evidencia,
      archivo_url: item.archivo_url,
      nombre_archivo: item.nombre_archivo,
      tipo_documento: item.tipo_documento,
      origen: item.origen,
      materia: item.materia?.nombre_materia || null,
      fecha_creacion: item.fecha_creacion,
    })),
  });
}

async function actualizarEstadoAcademicoAlumno(req, res) {
  const alumnoId = toInt(req.params.alumnoId);
  const estadoAcademico = normalizeText(req.body.estado_academico)?.toLowerCase() || null;

  if (!Number.isInteger(alumnoId)) {
    return res.status(400).json({ message: 'alumnoId invalido.' });
  }
  if (!estadoAcademico || !ESTADOS_ACADEMICOS_VALIDOS.has(estadoAcademico)) {
    return res.status(400).json({ message: 'estado_academico invalido. Usa activo o suspendido.' });
  }

  const alumno = await AlumnoPerfil.findByPk(alumnoId);
  if (!alumno) {
    return res.status(404).json({ message: 'Alumno no encontrado.' });
  }

  const estadoAnterior = alumno.estado_academico;
  alumno.estado_academico = estadoAcademico;
  await alumno.save();

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'actualizar_estado_academico_alumno',
    modulo: 'coordinacion_academica',
    entidad: 'alumnos_perfil',
    idEntidad: alumnoId,
    detalle: { estado_anterior: estadoAnterior, estado_nuevo: estadoAcademico },
  });

  return res.json({ id_alumno: alumno.id_alumno, estado_academico: alumno.estado_academico });
}

async function actualizarCurpAlumno(req, res) {
  const alumnoId = toInt(req.params.alumnoId);
  const curp = normalizeCurp(req.body.curp);

  if (!Number.isInteger(alumnoId)) {
    return res.status(400).json({ message: 'alumnoId invalido.' });
  }

  if (!CURP_REGEX.test(curp)) {
    return res.status(400).json({ message: 'CURP invalida. Debe contener 18 caracteres con formato oficial.' });
  }

  const [alumno, usuarioDuplicado] = await Promise.all([
    AlumnoPerfil.findByPk(alumnoId, {
      include: [{
        model: Usuario,
        as: 'usuario',
        attributes: ['id_usuario', 'curp', 'nombre_completo', 'folio_matricula'],
      }],
    }),
    Usuario.findOne({
      where: {
        curp,
        id_usuario: { [Op.ne]: alumnoId },
      },
      attributes: ['id_usuario'],
    }),
  ]);

  if (!alumno || !alumno.usuario) {
    return res.status(404).json({ message: 'Alumno no encontrado.' });
  }

  if (usuarioDuplicado) {
    return res.status(409).json({ message: 'La CURP ya esta asignada a otro usuario.' });
  }

  const curpAnterior = alumno.usuario.curp || null;
  alumno.usuario.curp = curp;
  await alumno.usuario.save();

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'actualizar_curp_alumno',
    modulo: 'coordinacion_academica',
    entidad: 'usuarios',
    idEntidad: alumno.usuario.id_usuario,
    detalle: {
      id_alumno: alumnoId,
      curp_anterior: curpAnterior,
      curp_nueva: curp,
    },
  });

  return res.json({
    id_alumno: alumnoId,
    id_usuario: alumno.usuario.id_usuario,
    nombre_completo: alumno.usuario.nombre_completo,
    folio_matricula: alumno.usuario.folio_matricula,
    curp: alumno.usuario.curp,
  });
}

async function obtenerPeriodoActivo(_req, res) {
  const periodo = await PeriodoAcademico.findOne({
    where: { estatus: 'activo' },
    order: [['fecha_inicio', 'DESC']],
  });

  if (!periodo) {
    return res.json({ periodo: null });
  }

  return res.json({
    periodo: {
      id_periodo: periodo.id_periodo,
      nombre: periodo.nombre,
      ciclo: periodo.ciclo,
      bimestre: periodo.bimestre,
      fecha_limite_calificaciones: periodo.fecha_limite_calificaciones,
    },
  });
}

async function actualizarFechaLimiteCalificaciones(req, res) {
  const fechaLimiteRaw = req.body.fecha_limite_calificaciones;

  const periodo = await PeriodoAcademico.findOne({
    where: { estatus: 'activo' },
    order: [['fecha_inicio', 'DESC']],
  });
  if (!periodo) {
    return res.status(404).json({ message: 'No hay periodo academico activo.' });
  }

  let fechaLimite = null;
  if (fechaLimiteRaw) {
    fechaLimite = new Date(fechaLimiteRaw);
    if (Number.isNaN(fechaLimite.getTime())) {
      return res.status(400).json({ message: 'fecha_limite_calificaciones invalida.' });
    }
  }

  periodo.fecha_limite_calificaciones = fechaLimite;
  await periodo.save();

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'actualizar_fecha_limite_calificaciones',
    modulo: 'coordinacion_academica',
    entidad: 'periodos_academicos',
    idEntidad: periodo.id_periodo,
    detalle: { fecha_limite_calificaciones: fechaLimite },
  });

  return res.json({ id_periodo: periodo.id_periodo, fecha_limite_calificaciones: periodo.fecha_limite_calificaciones });
}

async function listarCalificacionesFormativasOverride(req, res) {
  const materiaId = toInt(req.query.materia_id);
  const grupoId = normalizeText(req.query.grupo_id);

  if (!Number.isInteger(materiaId) || !grupoId) {
    return res.status(400).json({ message: 'materia_id y grupo_id son obligatorios.' });
  }

  const alumnosGrupo = await AlumnoGrupo.findAll({
    where: { id_materia: materiaId, grupo: grupoId },
    include: [{
      model: AlumnoPerfil,
      as: 'alumno',
      include: [{ model: Usuario, as: 'usuario', attributes: ['id_usuario', 'folio_matricula', 'nombre_completo'] }],
    }],
    order: [['id_alumno_grupo', 'ASC']],
  });

  const alumnosIds = alumnosGrupo.map((item) => Number(item.id_alumno));
  const calificaciones = alumnosIds.length > 0
    ? await CalificacionFormativaDocente.findAll({
      where: { id_materia: materiaId, grupo_id: grupoId, id_alumno: { [Op.in]: alumnosIds } },
    })
    : [];

  const calificacionesPorAlumno = new Map();
  calificaciones.forEach((item) => {
    const key = Number(item.id_alumno);
    if (!calificacionesPorAlumno.has(key)) calificacionesPorAlumno.set(key, {});
    calificacionesPorAlumno.get(key)[`formativa_${item.formativa_numero}`] = {
      id_calificacion: item.id_calificacion,
      calificacion: Number(item.calificacion),
    };
  });

  const items = alumnosGrupo.map((item) => {
    const registros = calificacionesPorAlumno.get(Number(item.id_alumno)) || {};
    return {
      id_alumno: item.id_alumno,
      nombre_completo: item.alumno?.usuario?.nombre_completo || `Alumno ${item.id_alumno}`,
      folio_matricula: item.alumno?.usuario?.folio_matricula || null,
      formativa_1: registros.formativa_1 || null,
      formativa_2: registros.formativa_2 || null,
    };
  });

  return res.json({ items });
}

async function actualizarCalificacionFormativaOverride(req, res) {
  const alumnoId = toInt(req.body.alumno_id);
  const materiaId = toInt(req.body.materia_id);
  const grupoId = normalizeText(req.body.grupo_id);
  const formativaNumero = toInt(req.body.formativa_numero);
  const calificacion = Number(req.body.calificacion);
  const motivo = normalizeText(req.body.motivo);

  if (!Number.isInteger(alumnoId) || !Number.isInteger(materiaId) || !grupoId
    || ![1, 2].includes(formativaNumero) || !Number.isFinite(calificacion) || calificacion < 0 || calificacion > 10) {
    return res.status(400).json({ message: 'alumno_id, materia_id, grupo_id, formativa_numero (1 o 2) y calificacion (0..10) son obligatorios.' });
  }

  const inscripcion = await AlumnoGrupo.findOne({ where: { id_alumno: alumnoId, id_materia: materiaId, grupo: grupoId } });
  if (!inscripcion) {
    return res.status(400).json({ message: 'El alumno no pertenece a ese grupo/materia.' });
  }

  const [item] = await CalificacionFormativaDocente.findOrCreate({
    where: { id_alumno: alumnoId, id_materia: materiaId, grupo_id: grupoId, formativa_numero: formativaNumero },
    defaults: {
      id_docente: req.user.id_usuario,
      calificacion,
      retroalimentacion: motivo,
      fecha_captura: new Date(),
    },
  });

  if (!item.isNewRecord) {
    item.calificacion = calificacion;
    item.retroalimentacion = motivo || item.retroalimentacion;
    item.fecha_captura = new Date();
    await item.save();
  }

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'override_calificacion_formativa_coordinacion',
    modulo: 'coordinacion_academica',
    entidad: 'calificaciones_formativas_docente',
    idEntidad: item.id_calificacion,
    detalle: { alumno_id: alumnoId, materia_id: materiaId, grupo_id: grupoId, formativa_numero: formativaNumero, calificacion, motivo },
  });

  return res.json({
    id_calificacion: item.id_calificacion,
    alumno_id: alumnoId,
    formativa_numero: formativaNumero,
    calificacion: item.calificacion,
  });
}

async function meritosRecientes(_req, res) {
  const rows = await MeritoAcademico.findAll({
    include: [{
      model: AlumnoPerfil,
      as: 'alumno',
      attributes: ['id_alumno', 'carrera'],
      include: [{
        model: Usuario,
        as: 'usuario',
        attributes: ['id_usuario', 'folio_matricula', 'nombre_completo'],
      }],
    }],
    order: [['fecha', 'DESC'], ['id_merito', 'DESC']],
    limit: 20,
  });

  const items = rows.map((item) => ({
    id_merito: item.id_merito,
    id_alumno: item.id_alumno,
    tipo_merito: item.tipo_merito,
    nombre: item.nombre,
    fecha: item.fecha,
    archivo_url: item.archivo_url,
    alumno: {
      id_alumno: item.alumno?.id_alumno || item.id_alumno,
      nombre_completo: item.alumno?.usuario?.nombre_completo || `Alumno ${item.id_alumno}`,
      folio_matricula: item.alumno?.usuario?.folio_matricula || null,
      carrera: item.alumno?.carrera || null,
    },
  }));

  return res.json({ items });
}

const TIPOS_MERITO_VALIDOS = new Set([
  'diploma',
  'constancia',
  'reconocimiento',
  'curso_adicional',
  'taller',
  'mencion_honorifica',
  'insignia',
  'cuadro_honor',
]);

async function asignarMerito(req, res) {
  const alumnoId = toInt(req.body.alumno_id);
  const tipoMerito = String(req.body.tipo_merito || '').trim().toLowerCase();
  const nombre = normalizeText(req.body.nombre);
  const fecha = String(req.body.fecha || '').trim() || new Date().toISOString().slice(0, 10);
  const archivoUrl = normalizeText(req.body.archivo_url) || 'sin_archivo';

  if (!Number.isInteger(alumnoId) || !TIPOS_MERITO_VALIDOS.has(tipoMerito) || !nombre) {
    return res.status(400).json({ message: 'Payload invalido para merito academico.' });
  }

  const alumno = await AlumnoPerfil.findByPk(alumnoId);
  if (!alumno) {
    return res.status(404).json({ message: 'Alumno no encontrado.' });
  }

  const created = await MeritoAcademico.create({
    id_alumno: alumnoId,
    tipo_merito: tipoMerito,
    nombre,
    fecha,
    archivo_url: archivoUrl,
  });

  return res.status(201).json({
    id_merito: created.id_merito,
    id_alumno: created.id_alumno,
    tipo_merito: created.tipo_merito,
    nombre: created.nombre,
  });
}

function serializeProgramaAcademico(programa, materias = []) {
  const periodos = [...new Set(
    materias
      .map((item) => Number(item.periodo_numero || item.bimestre_pertenece))
      .filter((value) => Number.isInteger(value) && value > 0),
  )].sort((a, b) => a - b);

  return {
    id: programa.id,
    tipo_nivel: programa.tipo_nivel,
    nombre: programa.nombre,
    modalidad_periodo: programa.modalidad_periodo,
    total_periodos: programa.total_periodos,
    estatus: programa.estatus,
    total_materias: materias.length,
    periodos_con_materias: periodos,
  };
}

function serializeMateria(item) {
  return {
    id: item.id_materia,
    id_materia: item.id_materia,
    programa_academico_id: item.programa_academico_id,
    periodo_numero: item.periodo_numero || item.bimestre_pertenece,
    codigo_materia: item.codigo_materia,
    nombre_materia: item.nombre_materia,
    creditos: item.creditos,
    horas_semanales: item.horas_semanales,
    imagen_portada_url: item.imagen_portada_url,
    recursos_sep: item.recursos_sep,
  };
}

function getPeriodoLabel(modalidad, numero) {
  return `Cuatrimestre ${numero}`;
}

async function listarProgramasAcademicos(_req, res) {
  try {
    const programas = await ProgramaAcademico.findAll({
      where: { estatus: 'activo' },
      include: [{
        model: Materia,
        as: 'materias_plan',
        attributes: ['id_materia', 'periodo_numero', 'bimestre_pertenece'],
        where: { activa: true },
        required: false,
      }],
      order: [['nombre', 'ASC']],
    });

    const items = programas.map((programa) => serializeProgramaAcademico(programa, programa.materias_plan || []));
    return res.json({ items });
  } catch (error) {
    console.error('[Error coordinacion/programas]:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener programas academicos',
      error: error.message,
    });
  }
}

async function crearProgramaAcademico(req, res) {
  try {
    const tipoNivel = normalizeEnum(req.body.tipo_nivel);
    const nombre = normalizeText(req.body.nombre);
    const modalidadPeriodo = normalizeEnum(req.body.modalidad_periodo);
    const totalPeriodos = toInt(req.body.total_periodos);
    const estatus = normalizeEnum(req.body.estatus || 'activo');

    if (!TIPOS_NIVEL_VALIDOS.has(tipoNivel) || !nombre || !MODALIDADES_PERIODO_VALIDAS.has(modalidadPeriodo)) {
      return res.status(400).json({ message: 'tipo_nivel, nombre y modalidad_periodo son obligatorios.' });
    }
    if (!Number.isInteger(totalPeriodos) || totalPeriodos < 1 || totalPeriodos > 20) {
      return res.status(400).json({ message: 'total_periodos invalido. Usa un entero entre 1 y 20.' });
    }
    if (!ESTATUS_PROGRAMA_ACADEMICO_VALIDOS.has(estatus)) {
      return res.status(400).json({ message: 'estatus invalido. Usa activo o inactivo.' });
    }

    const created = await ProgramaAcademico.create({
      tipo_nivel: tipoNivel,
      nombre,
      modalidad_periodo: modalidadPeriodo,
      total_periodos: totalPeriodos,
      estatus,
      fecha_creacion: new Date(),
    });

    return res.status(201).json(serializeProgramaAcademico(created, []));
  } catch (error) {
    console.error('[Error coordinacion/programas:create]:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al crear programa academico',
      error: error.message,
    });
  }
}

async function actualizarProgramaAcademico(req, res) {
  try {
    const id = toInt(req.params.id);
    const nombre = normalizeText(req.body.nombre);
    const modalidadPeriodo = req.body.modalidad_periodo !== undefined ? normalizeEnum(req.body.modalidad_periodo) : null;
    const totalPeriodos = req.body.total_periodos !== undefined ? toInt(req.body.total_periodos) : null;

    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'id invalido.' });
    }

    const programa = await ProgramaAcademico.findByPk(id);
    if (!programa) {
      return res.status(404).json({ message: 'Programa academico no encontrado.' });
    }

    if (!nombre && modalidadPeriodo === null && totalPeriodos === null) {
      return res.status(400).json({ message: 'Proporciona al menos un campo editable.' });
    }

    if (modalidadPeriodo !== null && !MODALIDADES_PERIODO_VALIDAS.has(modalidadPeriodo)) {
      return res.status(400).json({ message: 'modalidad_periodo invalida.' });
    }

    if (totalPeriodos !== null && (!Number.isInteger(totalPeriodos) || totalPeriodos < 1 || totalPeriodos > 20)) {
      return res.status(400).json({ message: 'total_periodos invalido. Usa un entero entre 1 y 20.' });
    }

    if (nombre) programa.nombre = nombre;
    if (modalidadPeriodo !== null) programa.modalidad_periodo = modalidadPeriodo;
    if (totalPeriodos !== null) programa.total_periodos = totalPeriodos;
    await programa.save();

    const materias = await Materia.findAll({ where: { programa_academico_id: programa.id, activa: true } });
    return res.json(serializeProgramaAcademico(programa, materias));
  } catch (error) {
    console.error('[Error coordinacion/programas:update]:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al actualizar programa academico',
      error: error.message,
    });
  }
}

async function eliminarProgramaAcademico(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'id invalido.' });
    }

    const programa = await ProgramaAcademico.findByPk(id);
    if (!programa) {
      return res.status(404).json({ message: 'Programa academico no encontrado.' });
    }

    programa.estatus = 'inactivo';
    await programa.save();

    return res.json({ id: programa.id, estatus: programa.estatus });
  } catch (error) {
    console.error('[Error coordinacion/programas:delete]:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al desactivar programa academico',
      error: error.message,
    });
  }
}

async function materiasPorPrograma(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'id invalido.' });
    }

    const programa = await ProgramaAcademico.findByPk(id);
    if (!programa || programa.estatus !== 'activo') {
      return res.status(404).json({ message: 'Programa academico no encontrado o inactivo.' });
    }

    const materias = await Materia.findAll({
      where: {
        programa_academico_id: id,
        activa: true,
      },
      order: [['periodo_numero', 'ASC'], ['nombre_materia', 'ASC']],
    });

    const byPeriodo = new Map();
    for (let i = 1; i <= programa.total_periodos; i += 1) {
      byPeriodo.set(i, []);
    }

    materias.forEach((materia) => {
      const numero = Number(materia.periodo_numero || materia.bimestre_pertenece);
      if (!Number.isInteger(numero) || numero < 1) return;
      if (!byPeriodo.has(numero)) byPeriodo.set(numero, []);
      byPeriodo.get(numero).push(serializeMateria(materia));
    });

    const periodos = [...byPeriodo.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([numero, items]) => ({
        numero,
        label: getPeriodoLabel(programa.modalidad_periodo, numero),
        materias: items,
      }));

    return res.json({
      programa: serializeProgramaAcademico(programa, materias),
      periodos,
    });
  } catch (error) {
    console.error('[Error coordinacion/programas/:id/materias]:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener materias por programa',
      error: error.message,
    });
  }
}

async function crearMateriaPrograma(req, res) {
  try {
    const programaAcademicoId = toInt(req.body.programa_academico_id);
    const periodoNumero = toInt(req.body.periodo_numero);
    const codigoMateria = normalizeText(req.body.codigo_materia);
    const nombreMateria = normalizeText(req.body.nombre_materia);
    const creditos = req.body.creditos !== undefined ? toInt(req.body.creditos) : null;
    const horasSemanales = req.body.horas_semanales !== undefined ? toInt(req.body.horas_semanales) : null;
    const imagenPortadaUrl = req.body.imagen_portada_url !== undefined ? normalizeText(req.body.imagen_portada_url) : null;
    const recursosSep = req.body.recursos_sep !== undefined ? normalizeText(req.body.recursos_sep) : null;

    if (!Number.isInteger(programaAcademicoId) || !Number.isInteger(periodoNumero) || !codigoMateria || !nombreMateria) {
      return res.status(400).json({ message: 'programa_academico_id, periodo_numero, codigo_materia y nombre_materia son obligatorios.' });
    }

    const programa = await ProgramaAcademico.findByPk(programaAcademicoId);
    if (!programa || programa.estatus !== 'activo') {
      return res.status(404).json({ message: 'Programa academico no encontrado o inactivo.' });
    }

    if (periodoNumero < 1 || periodoNumero > programa.total_periodos) {
      return res.status(400).json({ message: `periodo_numero fuera de rango. Debe ser 1..${programa.total_periodos}.` });
    }

    const created = await Materia.create({
      programa_academico_id: programaAcademicoId,
      periodo_numero: periodoNumero,
      bimestre_pertenece: periodoNumero,
      codigo_materia: codigoMateria,
      nombre_materia: nombreMateria,
      creditos: Number.isInteger(creditos) ? creditos : null,
      horas_semanales: Number.isInteger(horasSemanales) ? horasSemanales : null,
      imagen_portada_url: imagenPortadaUrl,
      recursos_sep: recursosSep,
      carrera: programa.nombre,
      activa: true,
    });

    return res.status(201).json(serializeMateria(created));
  } catch (error) {
    console.error('[Error coordinacion/materias:create]:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al crear materia',
      error: error.message,
    });
  }
}

async function actualizarMateriaPrograma(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'id invalido.' });
    }

    const materia = await Materia.findByPk(id);
    if (!materia) {
      return res.status(404).json({ message: 'Materia no encontrada.' });
    }

    const nombreMateria = req.body.nombre_materia !== undefined ? normalizeText(req.body.nombre_materia) : null;
    const codigoMateria = req.body.codigo_materia !== undefined ? normalizeText(req.body.codigo_materia) : null;
    const periodoNumero = req.body.periodo_numero !== undefined ? toInt(req.body.periodo_numero) : null;
    const creditos = req.body.creditos !== undefined ? toInt(req.body.creditos) : null;
    const horasSemanales = req.body.horas_semanales !== undefined ? toInt(req.body.horas_semanales) : null;
    const imagenPortadaUrl = req.body.imagen_portada_url !== undefined ? normalizeText(req.body.imagen_portada_url) : null;
    const recursosSep = req.body.recursos_sep !== undefined ? normalizeText(req.body.recursos_sep) : null;

    if (
      nombreMateria === null
      && codigoMateria === null
      && periodoNumero === null
      && creditos === null
      && horasSemanales === null
      && imagenPortadaUrl === null
      && recursosSep === null
    ) {
      return res.status(400).json({ message: 'Proporciona al menos un campo editable.' });
    }

    const programa = await ProgramaAcademico.findByPk(materia.programa_academico_id);
    if (periodoNumero !== null) {
      if (!Number.isInteger(periodoNumero) || periodoNumero < 1) {
        return res.status(400).json({ message: 'periodo_numero invalido.' });
      }
      if (programa && periodoNumero > programa.total_periodos) {
        return res.status(400).json({ message: `periodo_numero fuera de rango. Debe ser 1..${programa.total_periodos}.` });
      }
      materia.periodo_numero = periodoNumero;
      materia.bimestre_pertenece = periodoNumero;
    }

    if (nombreMateria !== null) materia.nombre_materia = nombreMateria;
    if (codigoMateria !== null) materia.codigo_materia = codigoMateria;
    if (creditos !== null) materia.creditos = Number.isInteger(creditos) ? creditos : null;
    if (horasSemanales !== null) materia.horas_semanales = Number.isInteger(horasSemanales) ? horasSemanales : null;
    if (imagenPortadaUrl !== null) materia.imagen_portada_url = imagenPortadaUrl;
    if (recursosSep !== null) materia.recursos_sep = recursosSep;

    await materia.save();

    return res.json(serializeMateria(materia));
  } catch (error) {
    console.error('[Error coordinacion/materias:update]:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al actualizar materia',
      error: error.message,
    });
  }
}

async function eliminarMateriaPrograma(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'id invalido.' });
    }

    const materia = await Materia.findByPk(id);
    if (!materia) {
      return res.status(404).json({ message: 'Materia no encontrada.' });
    }

    await materia.destroy();
    return res.json({ id_materia: id, eliminado: true });
  } catch (error) {
    console.error('[Error coordinacion/materias:delete]:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al eliminar materia',
      error: error.message,
    });
  }
}

async function finalizarTramite(req, res) {
  const idTramite = toInt(req.params.tramiteId);
  if (!Number.isInteger(idTramite)) {
    return res.status(400).json({ message: 'tramiteId invalido.' });
  }

  const tramite = await TramiteSolicitud.findByPk(idTramite);
  if (!tramite) {
    return res.status(404).json({ message: 'Tramite no encontrado.' });
  }

  if (tramite.estatus !== 'en_proceso') {
    return res.status(409).json({ message: 'Solo se pueden finalizar tramites en estatus en_proceso.' });
  }

  const documentoUrl = req.file
    ? `/uploads/portafolio/${req.file.filename}`
    : normalizeText(req.body.documento_resultado_url || req.body.documento_respuesta_url || req.body.archivo_url);

  if (!documentoUrl) {
    return res.status(400).json({ message: 'Debes adjuntar el documento oficial del tramite.' });
  }

  tramite.estatus = 'finalizado';
  tramite.documento_resultado_url = documentoUrl;
  tramite.documento_respuesta_url = documentoUrl;
  tramite.fecha_resolucion = new Date();
  tramite.resuelto_por = req.user.id_usuario;
  tramite.motivo_rechazo = null;
  tramite.respuesta = normalizeText(req.body.notas) || 'Tramite finalizado por Coordinacion Academica.';
  await tramite.save();

  return res.json({
    id_tramite: tramite.id_tramite,
    estado: tramite.estatus,
    documento_resultado_url: tramite.documento_resultado_url,
    fecha_resolucion: tramite.fecha_resolucion,
  });
}

async function publicarRecursoAcademico(req, res) {
  const titulo = normalizeText(req.body.titulo);
  const tipoRecurso = normalizeEnum(req.body.tipo_recurso);
  const materiaId = req.body.materia_id == null || req.body.materia_id === '' ? null : toInt(req.body.materia_id);
  const carreraId = normalizeText(req.body.carrera_id);
  const grupoId = req.body.grupo_id ? normalizeGrupo(req.body.grupo_id) : null;
  const remitenteNombre = normalizeText(req.body.remitente_nombre) || 'Coordinación Académica';

  if (!titulo) {
    return res.status(400).json({ message: 'titulo es obligatorio.' });
  }
  if (!['archivo_local', 'enlace_drive'].includes(tipoRecurso)) {
    return res.status(400).json({ message: 'tipo_recurso invalido. Usa archivo_local o enlace_drive.' });
  }
  if (materiaId !== null && !Number.isInteger(materiaId)) {
    return res.status(400).json({ message: 'materia_id invalido.' });
  }

  if (materiaId !== null) {
    const materia = await Materia.findByPk(materiaId);
    if (!materia) {
      return res.status(404).json({ message: 'materia_id no encontrada.' });
    }
  }

  const urlRecurso = req.file
    ? `/uploads/portafolio/${req.file.filename}`
    : normalizeText(req.body.url_recurso);

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
    remitente_tipo: 'coordinacion',
    remitente_nombre: remitenteNombre,
    id_docente: null,
    id_materia: materiaId,
    carrera_id: carreraId,
    grupo_id: grupoId,
    activo: true,
    created_at: new Date(),
  });

  return res.status(201).json(recurso);
}

async function listarRecursosAcademicos(_req, res) {
  const items = await RecursoAcademico.findAll({
    where: { remitente_tipo: 'coordinacion' },
    include: [{ model: Materia, as: 'materia', attributes: ['id_materia', 'nombre_materia'], required: false }],
    order: [['created_at', 'DESC']],
    limit: 200,
  });

  return res.json({ items });
}

async function publicarAviso(req, res) {
  const titulo = normalizeText(req.body.titulo);
  const mensaje = normalizeText(req.body.mensaje || req.body.descripcion);
  const carreraId = normalizeText(req.body.carrera_id);
  const grupoId = req.body.grupo_id ? normalizeGrupo(req.body.grupo_id) : null;

  if (!titulo || !mensaje) {
    return res.status(400).json({ message: 'titulo y mensaje son obligatorios.' });
  }

  const aviso = await Aviso.create({
    titulo,
    mensaje,
    remitente_tipo: 'coordinacion',
    carrera_id: carreraId,
    grupo_id: grupoId,
    docente_id: null,
    created_at: new Date(),
  });

  return res.status(201).json(aviso);
}

module.exports = {
  docentesAsignaciones,
  asignarMateriaDocente,
  aulasDisponibilidad,
  programarHorarioGrupo,
  actasPendientes,
  validarActa,
  programarExtraordinario,
  programasExternos,
  actualizarEstatusProgramaExterno,
  listarProgramasAcademicos,
  crearProgramaAcademico,
  actualizarProgramaAcademico,
  eliminarProgramaAcademico,
  materiasPorPrograma,
  crearMateriaPrograma,
  actualizarMateriaPrograma,
  eliminarMateriaPrograma,
  finalizarTramite,
  publicarRecursoAcademico,
  listarRecursosAcademicos,
  publicarAviso,
  alumnosProgreso,
  portafolioAlumno,
  actualizarEstadoAcademicoAlumno,
  actualizarCurpAlumno,
  obtenerPeriodoActivo,
  actualizarFechaLimiteCalificaciones,
  listarCalificacionesFormativasOverride,
  actualizarCalificacionFormativaOverride,
  meritosRecientes,
  asignarMerito,
};
