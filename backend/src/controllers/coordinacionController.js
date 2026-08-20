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
  PeriodoAcademico,
  EntregaTarea,
} = require('../../models');

const DIAS_VALIDOS = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];
const ESTATUS_PROGRAMA_VALIDOS = new Set(['en_revision', 'horas_cubiertas', 'liberado', 'rechazado']);

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

function normalizeGrupo(value) {
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
      attributes: ['id_materia', 'nombre_materia', 'codigo_materia', 'bimestre_pertenece'],
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
      include: [{
        model: Usuario,
        as: 'usuario',
        attributes: ['id_usuario', 'folio_matricula', 'nombre_completo', 'correo'],
      }],
    }],
    order: [['fecha_creacion', 'DESC']],
  });

  return res.json({ items });
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
        attributes: ['id_usuario', 'folio_matricula', 'nombre_completo', 'correo'],
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
      carrera: alumno.carrera,
      porcentaje_avance: porcentaje,
      promedio_global: promedio,
    };
  });

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
  alumnosProgreso,
  asignarMerito,
};
