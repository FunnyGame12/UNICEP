const { Op } = require('sequelize');
const {
  AlumnoPerfil,
  AlumnoGrupo,
  Usuario,
  EntregaTarea,
  Tarea,
  Materia,
  PagoEstatus,
  MaterialClase,
  MeritoAcademico,
  AsignacionGrupo,
  DocentePerfil,
  Horario,
  TramiteSolicitud,
  SalaVideoDocente,
  AsistenciaDocente,
  ConceptoPago,
  AnuncioDocente,
  CalificacionFormativaDocente,
  NotificacionAlumno,
  PortafolioEvidencia,
  ConfiguracionInstitucional,
  Aviso,
  AlumnoAvisoOculto,
  RecursoAcademico,
  PortafolioMateriaEvidencia,
} = require('../../models');
const { generarWorkbookBoleta } = require('../services/boletaService');
const { registrarEventoAuditoria } = require('../services/auditService');
const { TRAMITES_ESCOLARES, TRAMITES_ESCOLARES_LABELS } = require('../constants/tramites');

const DOCUMENTOS_REQUERIDOS = [
  { clave: 'curp', nombre: 'CURP', detalle: 'Identificacion oficial' },
  { clave: 'acta_nacimiento', nombre: 'Acta de nacimiento', detalle: 'Documentacion de registro' },
  { clave: 'certificado_bachillerato', nombre: 'Certificado de bachillerato', detalle: 'Boleta de preparatoria' },
  { clave: 'foto_oficial', nombre: 'Foto oficial', detalle: 'Formato escolar vigente' },
];

const TIPOS_DOCUMENTO_PERMITIDOS = new Set(DOCUMENTOS_REQUERIDOS.map((item) => item.clave));

function normalizeText(value) {
  return String(value || '').trim();
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function estatusAcademico(calificacion) {
  if (calificacion === null || calificacion === undefined) return 'sin_registrar';
  return Number(calificacion) >= 6 ? 'Aprobado' : 'Reprobado';
}

function esUrlValida(value) {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch (_error) {
    return false;
  }
}

function getAuthenticatedAlumnoId(req) {
  const id = Number(req?.user?.id ?? req?.user?.id_usuario);
  return Number.isInteger(id) ? id : null;
}

async function obtenerEstadoAlumno(idAlumno) {
  const [usuario, perfil] = await Promise.all([
    Usuario.findByPk(idAlumno, {
      attributes: ['id_usuario', 'nombre_completo', 'correo', 'folio_matricula', 'cuenta_activada', 'cuenta_bloqueada'],
    }),
    AlumnoPerfil.findByPk(idAlumno, {
      attributes: ['id_alumno', 'carrera', 'bimestre_actual', 'estado_academico', 'bloqueo_plataforma', 'bloqueo_calificaciones', 'estatus_financiero', 'drive_folder_url'],
    }),
  ]);

  if (!usuario || !perfil) {
    return null;
  }

  return {
    usuario,
    perfil,
    bloqueo_plataforma: Boolean(usuario.cuenta_bloqueada || perfil.bloqueo_plataforma || !usuario.cuenta_activada || perfil.estado_academico === 'suspendido'),
    bloqueo_calificaciones: Boolean(perfil.bloqueo_calificaciones),
  };
}

function buildRestrictedPayload(reason) {
  return {
    message: reason === 'bloqueo_plataforma'
      ? 'Tu acceso academico esta restringido temporalmente. Contacta a Tesoreria para regularizar tu cuenta.'
      : 'Tus calificaciones estan temporalmente ocultas por un tema administrativo.',
    reason,
  };
}

async function validarAccesoAlumno(req, { requiereAcademico = false, requiereCalificaciones = false } = {}) {
  const idAlumno = getAuthenticatedAlumnoId(req);
  if (!idAlumno) {
    return {
      ok: false,
      status: 401,
      payload: { message: 'Sesion invalida para alumno.' },
    };
  }

  const estado = await obtenerEstadoAlumno(idAlumno);
  if (!estado) {
    return {
      ok: false,
      status: 404,
      payload: { message: 'Perfil de alumno no encontrado.' },
    };
  }

  if (requiereAcademico && estado.bloqueo_plataforma) {
    return {
      ok: false,
      status: 423,
      payload: buildRestrictedPayload('bloqueo_plataforma'),
      estado,
    };
  }

  if (requiereCalificaciones && estado.bloqueo_calificaciones) {
    return {
      ok: false,
      status: 403,
      payload: buildRestrictedPayload('bloqueo_calificaciones'),
      estado,
    };
  }

  return {
    ok: true,
    idAlumno,
    estado,
  };
}

async function obtenerContextoAcademicoAlumno(idAlumno) {
  const grupos = await AlumnoGrupo.findAll({
    where: { id_alumno: idAlumno },
    include: [{ model: Materia, as: 'materia' }],
    order: [[{ model: Materia, as: 'materia' }, 'nombre_materia', 'ASC']],
  });

  const materiasIds = [...new Set(grupos.map((item) => Number(item.id_materia)).filter(Number.isInteger))];
  const gruposPorMateria = new Map();
  grupos.forEach((item) => {
    if (!gruposPorMateria.has(item.id_materia)) {
      gruposPorMateria.set(item.id_materia, new Set());
    }
    gruposPorMateria.get(item.id_materia).add(String(item.grupo || '').trim());
  });

  const filtrosAsignaciones = grupos.map((item) => ({
    id_materia: item.id_materia,
    grupo: item.grupo,
  }));

  const asignaciones = filtrosAsignaciones.length > 0
    ? await AsignacionGrupo.findAll({
      where: { [Op.or]: filtrosAsignaciones },
      include: [{
        model: DocentePerfil,
        as: 'docente',
        include: [{ model: Usuario, as: 'usuario', attributes: ['id_usuario', 'nombre_completo', 'correo'] }],
      }],
    })
    : [];

  return {
    grupos,
    materiasIds,
    gruposPorMateria,
    asignaciones,
  };
}

async function estadoAcceso(req, res) {
  const validacion = await validarAccesoAlumno(req);
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const { estado } = validacion;

  return res.json({
    id_alumno: validacion.idAlumno,
    bloqueo_plataforma: estado.bloqueo_plataforma,
    bloqueo_calificaciones: estado.bloqueo_calificaciones,
    estatus_financiero: estado.perfil.estatus_financiero || 'al_dia',
    estado_academico: estado.perfil.estado_academico || 'activo',
    perfil: {
      nombre_completo: estado.usuario.nombre_completo,
      correo: estado.usuario.correo,
      folio_matricula: estado.usuario.folio_matricula,
      carrera: estado.perfil.carrera,
      bimestre_actual: estado.perfil.bimestre_actual,
      drive_folder_url: estado.perfil.drive_folder_url || null,
    },
  });
}

async function horarioAulas(req, res) {
  const validacion = await validarAccesoAlumno(req, { requiereAcademico: true });
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const { grupos, asignaciones, materiasIds, gruposPorMateria } = await obtenerContextoAcademicoAlumno(validacion.idAlumno);
  const horariosOficiales = await Horario.findAll({ order: [['id_horario', 'ASC']] });

  const salas = materiasIds.length > 0
    ? await SalaVideoDocente.findAll({
      where: {
        id_materia: { [Op.in]: materiasIds },
        [Op.or]: [{ grupo_id: null }, { grupo_id: { [Op.in]: [...new Set(grupos.map((g) => String(g.grupo || '').trim()))] } }],
      },
      include: [{ model: Materia, as: 'materia', attributes: ['id_materia', 'nombre_materia', 'codigo_materia'] }],
      order: [['fecha_programada', 'ASC']],
      limit: 100,
    })
    : [];

  const docentesMap = new Map(
    asignaciones.map((item) => [`${item.id_materia}:${String(item.grupo || '').trim()}`, item.docente?.usuario?.nombre_completo || 'Docente']),
  );

  const clasesSemana = grupos.map((grupo) => {
    const materia = grupo.materia;
    const materiaId = Number(grupo.id_materia);
    const grupoId = String(grupo.grupo || '').trim();

    const sala = salas.find((item) => {
      if (Number(item.id_materia) !== materiaId) return false;
      if (!item.grupo_id) return true;
      return grupoId === String(item.grupo_id).trim();
    });

    const horarioBase = horariosOficiales[0] || null;

    return {
      id_materia: materiaId,
      materia: materia?.nombre_materia || 'Materia',
      codigo_materia: materia?.codigo_materia || null,
      grupo: grupoId,
      docente: docentesMap.get(`${materiaId}:${grupoId}`) || 'Por asignar',
      aula_fisica: horarioBase?.aula || null,
      turno: horarioBase?.turno || null,
      periodo: horarioBase?.periodo || null,
      hora_inicio: horarioBase?.hora_inicio || null,
      hora_fin: horarioBase?.hora_fin || null,
      sala_virtual: sala
        ? {
          id_sala: sala.id_sala,
          titulo: sala.titulo,
          plataforma: sala.plataforma,
          enlace: sala.enlace,
          fecha_programada: sala.fecha_programada,
        }
        : null,
    };
  });

  return res.json({
    items: clasesSemana,
    horarios_oficiales: horariosOficiales,
    total_materias: materiasIds.length,
    grupos_activos: [...gruposPorMateria.values()].reduce((acc, set) => acc + set.size, 0),
  });
}

async function tareasPendientes(req, res) {
  const validacion = await validarAccesoAlumno(req, { requiereAcademico: true });
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const { materiasIds, gruposPorMateria } = await obtenerContextoAcademicoAlumno(validacion.idAlumno);
  if (materiasIds.length === 0) {
    return res.json({ items: [] });
  }

  const tareas = await Tarea.findAll({
    where: {
      id_materia: { [Op.in]: materiasIds },
    },
    include: [{ model: Materia, as: 'materia', attributes: ['id_materia', 'nombre_materia', 'codigo_materia'] }],
    order: [['fecha_limite', 'ASC']],
  });

  const tareasFiltradas = tareas.filter((tarea) => {
    if (!tarea.grupo_id) return true;
    const gruposMateria = gruposPorMateria.get(tarea.id_materia);
    return gruposMateria ? gruposMateria.has(String(tarea.grupo_id).trim()) : false;
  });

  const entregas = await EntregaTarea.findAll({
    where: {
      id_alumno: validacion.idAlumno,
      id_tarea: { [Op.in]: tareasFiltradas.map((item) => item.id_tarea) },
    },
  });

  const entregasMap = new Map(entregas.map((item) => [item.id_tarea, item]));

  const nowMs = Date.now();
  const items = tareasFiltradas
    .map((tarea) => {
      const entrega = entregasMap.get(tarea.id_tarea) || null;
      const limite = toDate(tarea.fecha_limite);
      const diffHours = limite ? Math.max(0, Math.floor((limite.getTime() - nowMs) / (1000 * 60 * 60))) : null;

      return {
        id_tarea: tarea.id_tarea,
        id_materia: tarea.id_materia,
        grupo_id: tarea.grupo_id || null,
        titulo: tarea.titulo,
        descripcion: tarea.descripcion,
        fecha_limite: tarea.fecha_limite,
        puntaje_maximo: tarea.puntaje_maximo,
        archivo_adjunto_url: tarea.archivo_adjunto_url,
        materia: tarea.materia,
        entrega,
        vence_en_horas: diffHours,
      };
    })
    .filter((item) => !item.entrega || item.entrega.estatus === 'pendiente')
    .sort((a, b) => new Date(a.fecha_limite) - new Date(b.fecha_limite));

  return res.json({ items });
}

async function materialesClase(req, res) {
  const validacion = await validarAccesoAlumno(req, { requiereAcademico: true });
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const { materiasIds } = await obtenerContextoAcademicoAlumno(validacion.idAlumno);
  if (materiasIds.length === 0) {
    return res.json({ items: [] });
  }

  const items = await MaterialClase.findAll({
    where: { id_materia: { [Op.in]: materiasIds } },
    include: [{ model: Materia, as: 'materia', attributes: ['id_materia', 'nombre_materia', 'codigo_materia'] }],
    order: [['id_materia', 'ASC'], ['tema_semana', 'ASC']],
  });

  return res.json({ items });
}

async function calificaciones(req, res) {
  const validacion = await validarAccesoAlumno(req, { requiereCalificaciones: true });
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const { materiasIds } = await obtenerContextoAcademicoAlumno(validacion.idAlumno);
  if (materiasIds.length === 0) {
    return res.json({ formativas: [], finales: [], resumen: [] });
  }

  const [formativas, entregasCalificadas] = await Promise.all([
    CalificacionFormativaDocente.findAll({
      where: {
        id_alumno: validacion.idAlumno,
        id_materia: { [Op.in]: materiasIds },
      },
      include: [{ model: Materia, as: 'materia', attributes: ['id_materia', 'nombre_materia', 'codigo_materia'] }],
      order: [['formativa_numero', 'ASC'], ['fecha_captura', 'DESC']],
    }),
    EntregaTarea.findAll({
      where: {
        id_alumno: validacion.idAlumno,
        estatus: 'calificada',
      },
      include: [{
        model: Tarea,
        as: 'tarea',
        required: true,
        include: [{
          model: Materia,
          as: 'materia',
          required: true,
          where: { id_materia: { [Op.in]: materiasIds } },
        }],
      }],
      order: [['fecha_entrega', 'DESC']],
    }),
  ]);

  const finalesMap = new Map();
  entregasCalificadas.forEach((item) => {
    const idMateria = Number(item.tarea?.materia?.id_materia);
    if (!Number.isInteger(idMateria)) return;

    const base = finalesMap.get(idMateria) || {
      id_materia: idMateria,
      materia: item.tarea?.materia?.nombre_materia || `Materia ${idMateria}`,
      codigo_materia: item.tarea?.materia?.codigo_materia || null,
      suma: 0,
      total: 0,
    };

    base.suma += Number(item.calificacion || 0);
    base.total += 1;
    finalesMap.set(idMateria, base);
  });

  const finales = [...finalesMap.values()].map((item) => {
    const promedio = item.total > 0 ? Number((item.suma / item.total).toFixed(2)) : null;
    return {
      id_materia: item.id_materia,
      materia: item.materia,
      codigo_materia: item.codigo_materia,
      promedio_final: promedio,
      estatus: estatusAcademico(promedio),
    };
  });

  const formativasSerialized = formativas.map((item) => ({
    id_calificacion: item.id_calificacion,
    id_materia: item.id_materia,
    materia: item.materia,
    formativa_numero: item.formativa_numero,
    calificacion: item.calificacion,
    retroalimentacion: item.retroalimentacion,
    fecha_captura: item.fecha_captura,
    estatus: estatusAcademico(item.calificacion),
  }));

  const resumenMap = new Map();
  formativasSerialized.forEach((item) => {
    const key = Number(item.id_materia);
    const current = resumenMap.get(key) || {
      id_materia: key,
      materia: item.materia?.nombre_materia || `Materia ${key}`,
      formativa_suma: 0,
      formativa_total: 0,
      final_promedio: null,
    };
    current.formativa_suma += Number(item.calificacion || 0);
    current.formativa_total += 1;
    resumenMap.set(key, current);
  });

  finales.forEach((item) => {
    const current = resumenMap.get(item.id_materia) || {
      id_materia: item.id_materia,
      materia: item.materia,
      formativa_suma: 0,
      formativa_total: 0,
      final_promedio: null,
    };
    current.final_promedio = item.promedio_final;
    resumenMap.set(item.id_materia, current);
  });

  const resumen = [...resumenMap.values()].map((item) => {
    const formativaPromedio = item.formativa_total > 0
      ? Number((item.formativa_suma / item.formativa_total).toFixed(2))
      : null;
    const base = item.final_promedio ?? formativaPromedio;

    return {
      id_materia: item.id_materia,
      materia: item.materia,
      formativa_promedio: formativaPromedio,
      final_promedio: item.final_promedio,
      estatus: estatusAcademico(base),
    };
  });

  return res.json({
    formativas: formativasSerialized,
    finales,
    resumen,
  });
}

async function asistencia(req, res) {
  const validacion = await validarAccesoAlumno(req, { requiereAcademico: true });
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const {
    grupos,
    materiasIds,
    gruposPorMateria,
    asignaciones,
  } = await obtenerContextoAcademicoAlumno(validacion.idAlumno);
  if (materiasIds.length === 0) {
    return res.json({ items: [], acumulado: [] });
  }

  const items = await AsistenciaDocente.findAll({
    where: {
      id_alumno: validacion.idAlumno,
      id_materia: { [Op.in]: materiasIds },
    },
    include: [{ model: Materia, as: 'materia', attributes: ['id_materia', 'nombre_materia', 'codigo_materia'] }],
    order: [['fecha_clase', 'DESC']],
  });

  const docentePorMateria = new Map();
  asignaciones.forEach((item) => {
    const idMateria = Number(item.id_materia);
    if (!docentePorMateria.has(idMateria)) {
      docentePorMateria.set(idMateria, item.docente?.usuario?.nombre_completo || 'Por asignar');
    }
  });

  const materiaMeta = new Map();
  grupos.forEach((item) => {
    const idMateria = Number(item.id_materia);
    if (!Number.isInteger(idMateria) || materiaMeta.has(idMateria)) return;
    materiaMeta.set(idMateria, {
      materia: item.materia?.nombre_materia || `Materia ${idMateria}`,
      codigo_materia: item.materia?.codigo_materia || null,
    });
  });

  const filtrosMateriaGrupo = [];
  gruposPorMateria.forEach((gruposSet, materiaId) => {
    gruposSet.forEach((grupo) => {
      filtrosMateriaGrupo.push({ id_materia: Number(materiaId), grupo: String(grupo || '').trim() });
    });
  });

  const companerosGrupo = filtrosMateriaGrupo.length > 0
    ? await AlumnoGrupo.findAll({
      where: { [Op.or]: filtrosMateriaGrupo },
      attributes: ['id_materia', 'id_alumno'],
      raw: true,
    })
    : [];

  const universoAlumnoIds = [...new Set(
    companerosGrupo
      .map((row) => Number(row.id_alumno))
      .filter(Number.isInteger),
  )];

  const clasesUnicasPorMateriaRows = universoAlumnoIds.length > 0
    ? await AsistenciaDocente.findAll({
      where: {
        id_materia: { [Op.in]: materiasIds },
        id_alumno: { [Op.in]: universoAlumnoIds },
      },
      attributes: ['id_materia', 'fecha_clase'],
      group: ['id_materia', 'fecha_clase'],
      raw: true,
    })
    : [];

  const totalClasesPorMateria = new Map();
  clasesUnicasPorMateriaRows.forEach((row) => {
    const idMateria = Number(row.id_materia);
    if (!Number.isInteger(idMateria)) return;
    totalClasesPorMateria.set(idMateria, (totalClasesPorMateria.get(idMateria) || 0) + 1);
  });

  const resumenAlumnoRows = await AsistenciaDocente.findAll({
    where: {
      id_alumno: validacion.idAlumno,
      id_materia: { [Op.in]: materiasIds },
    },
    attributes: [
      'id_materia',
      [AsistenciaDocente.sequelize.fn('SUM', AsistenciaDocente.sequelize.literal("CASE WHEN estatus_asistencia = 'presente' THEN 1 ELSE 0 END")), 'presentes'],
      [AsistenciaDocente.sequelize.fn('SUM', AsistenciaDocente.sequelize.literal("CASE WHEN estatus_asistencia = 'ausente' THEN 1 ELSE 0 END")), 'faltas'],
      [AsistenciaDocente.sequelize.fn('SUM', AsistenciaDocente.sequelize.literal("CASE WHEN estatus_asistencia = 'retardo' THEN 1 ELSE 0 END")), 'retardos'],
      [AsistenciaDocente.sequelize.fn('SUM', AsistenciaDocente.sequelize.literal("CASE WHEN estatus_asistencia = 'justificado' THEN 1 ELSE 0 END")), 'justificados'],
    ],
    group: ['id_materia'],
    raw: true,
  });

  const resumenAlumnoMap = new Map();
  resumenAlumnoRows.forEach((row) => {
    const idMateria = Number(row.id_materia);
    if (!Number.isInteger(idMateria)) return;
    resumenAlumnoMap.set(idMateria, {
      presentes: Number(row.presentes || 0),
      faltas: Number(row.faltas || 0),
      retardos: Number(row.retardos || 0),
      justificados: Number(row.justificados || 0),
    });
  });

  const acumulado = materiasIds.map((idMateria) => {
    const meta = materiaMeta.get(idMateria) || {};
    const stats = resumenAlumnoMap.get(idMateria) || {
      presentes: 0,
      faltas: 0,
      retardos: 0,
      justificados: 0,
    };
    const totalClases = Number(totalClasesPorMateria.get(idMateria) || 0);
    const totalJustificados = Number(stats.justificados || 0);
    const faltasPorJustificante = Math.floor(totalJustificados / 3);
    const asistenciasPorJustificante = totalJustificados - faltasPorJustificante;
    const asistenciasReales = Number(stats.presentes || 0);
    const faltasReales = Number(stats.faltas || 0);
    const asistenciasEfectivas = asistenciasReales + asistenciasPorJustificante;
    const faltasEfectivas = faltasReales + faltasPorJustificante;
    const moduloJustificantes = totalJustificados % 3;

    let mensajeJustificantes = 'Tienes 2 justificantes disponibles antes de penalizacion.';
    if (moduloJustificantes === 1) {
      mensajeJustificantes = 'Te queda 1 justificante disponible antes de que cuente como falta.';
    }
    if (moduloJustificantes === 2) {
      mensajeJustificantes = 'Atencion: tu proximo justificante contara como falta.';
    }

    return {
      id_materia: idMateria,
      materia: meta.materia || `Materia ${idMateria}`,
      codigo_materia: meta.codigo_materia || null,
      docente: docentePorMateria.get(idMateria) || 'Por asignar',
      total: totalClases,
      presentes_reales: asistenciasReales,
      faltas_reales: faltasReales,
      asistencias_efectivas: asistenciasEfectivas,
      faltas_efectivas: faltasEfectivas,
      presentes: asistenciasEfectivas,
      faltas: faltasEfectivas,
      retardos: stats.retardos,
      justificados: totalJustificados,
      modulo_justificantes: moduloJustificantes,
      faltas_por_justificante: faltasPorJustificante,
      asistencias_por_justificante: asistenciasPorJustificante,
      mensaje_justificantes: mensajeJustificantes,
      porcentaje_asistencia: totalClases > 0
        ? Number(((asistenciasEfectivas / totalClases) * 100).toFixed(1))
        : 0,
    };
  });

  return res.json({ items, acumulado });
}

async function subirComprobantePago(req, res) {
  const validacion = await validarAccesoAlumno(req);
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const idConceptoPago = toNumber(req.body.id_concepto_pago);
  const montoPagado = toNumber(req.body.monto_pagado);
  const adjuntoUrl = req.file
    ? `/uploads/portafolio/${req.file.filename}`
    : normalizeText(req.body.adjunto_url || req.body.archivo_url || req.body.comprobante_url);

  if (!Number.isInteger(idConceptoPago)) {
    return res.status(400).json({ message: 'id_concepto_pago es obligatorio.' });
  }

  if (!montoPagado || montoPagado <= 0) {
    return res.status(400).json({ message: 'monto_pagado debe ser mayor a 0.' });
  }

  if (!adjuntoUrl) {
    return res.status(400).json({ message: 'Debes adjuntar el comprobante de pago.' });
  }

  const concepto = await ConceptoPago.findOne({
    where: {
      id_concepto_pago: idConceptoPago,
      activo: true,
    },
  });

  if (!concepto) {
    return res.status(404).json({ message: 'Concepto de pago no encontrado o inactivo.' });
  }

  const pago = await PagoEstatus.findOne({
    where: {
      id_alumno: validacion.idAlumno,
      id_concepto_pago: idConceptoPago,
      estatus: { [Op.in]: ['pendiente', 'vencido', 'en_revision'] },
    },
    order: [['fecha_limite', 'ASC'], ['id_pago', 'ASC']],
  });

  if (!pago) {
    return res.status(404).json({ message: 'No existe un pago pendiente para ese concepto.' });
  }

  pago.comprobante_url = adjuntoUrl;
  pago.estatus = 'en_revision';
  await pago.save();

  const tramite = await TramiteSolicitud.create({
    id_alumno: validacion.idAlumno,
    tipo: 'comprobante_pago',
    tipo_tramite_id: 'comprobante_pago',
    descripcion: `Comprobante ${concepto.nombre} por ${montoPagado.toFixed(2)} MXN`,
    adjunto_url: adjuntoUrl,
    comprobante_pago_url: adjuntoUrl,
    estatus: 'en_revision',
    fecha_solicitud: new Date(),
  });

  await registrarEventoAuditoria({
    idUsuario: validacion.idAlumno,
    rolActor: req.user.rol,
    accion: 'subir_comprobante_pago',
    modulo: 'alumno',
    entidad: 'tramites_solicitudes',
    idEntidad: tramite.id_tramite,
    detalle: {
      id_concepto_pago: concepto.id_concepto_pago,
      concepto: concepto.nombre,
      monto_pagado: montoPagado,
    },
  });

  return res.status(201).json({
    id_pago: pago.id_pago,
    id_tramite: tramite.id_tramite,
    estatus: tramite.estatus,
    fecha_solicitud: tramite.fecha_solicitud,
  });
}

async function solicitarTramite(req, res) {
  const validacion = await validarAccesoAlumno(req);
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const tipo = normalizeText(req.body.tipo).toLowerCase();
  const tiposPermitidos = new Set(TRAMITES_ESCOLARES);
  if (!tiposPermitidos.has(tipo)) {
    return res.status(400).json({ message: `tipo invalido. Usa: ${TRAMITES_ESCOLARES.join(', ')}.` });
  }

  const adjuntoUrl = req.file
    ? `/uploads/portafolio/${req.file.filename}`
    : normalizeText(req.body.comprobante_pago_url || req.body.adjunto_url || req.body.archivo_url);
  if (!adjuntoUrl) {
    return res.status(400).json({ message: 'Debes adjuntar el comprobante requerido para el tramite.' });
  }

  const descripcion = normalizeText(req.body.descripcion) || `Solicitud de ${tipo}.`;
  const tipoTramiteId = normalizeText(req.body.tipo_tramite_id) || tipo;

  const tramite = await TramiteSolicitud.create({
    id_alumno: validacion.idAlumno,
    tipo,
    tipo_tramite_id: tipoTramiteId,
    descripcion,
    adjunto_url: adjuntoUrl,
    comprobante_pago_url: adjuntoUrl,
    estatus: 'en_revision',
    fecha_solicitud: new Date(),
  });

  await registrarEventoAuditoria({
    idUsuario: validacion.idAlumno,
    rolActor: req.user.rol,
    accion: 'solicitar_tramite_alumno',
    modulo: 'alumno',
    entidad: 'tramites_solicitudes',
    idEntidad: tramite.id_tramite,
    detalle: { tipo },
  });

  return res.status(201).json(tramite);
}

async function listarAvisos(req, res) {
  const validacion = await validarAccesoAlumno(req, { requiereAcademico: true });
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const { grupos, asignaciones } = await obtenerContextoAcademicoAlumno(validacion.idAlumno);
  const gruposAlumno = [...new Set(grupos.map((item) => String(item.grupo || '').trim()).filter(Boolean))];
  const docentesAlumno = [...new Set(asignaciones.map((item) => Number(item.id_docente)).filter(Number.isInteger))];
  const carreraAlumno = normalizeText(validacion.estado.perfil.carrera);

  const ocultos = await AlumnoAvisoOculto.findAll({
    where: { alumno_id: validacion.idAlumno },
    attributes: ['aviso_id'],
  });
  const avisosOcultos = ocultos.map((item) => Number(item.aviso_id)).filter(Number.isInteger);

  const limite = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));

  const items = await Aviso.findAll({
    where: {
      created_at: { [Op.gte]: limite },
      ...(avisosOcultos.length > 0 ? { id_aviso: { [Op.notIn]: avisosOcultos } } : {}),
      [Op.and]: [
        {
          [Op.or]: [
            { carrera_id: null },
            ...(carreraAlumno ? [{ carrera_id: carreraAlumno }] : []),
          ],
        },
        {
          [Op.or]: [
            { grupo_id: null },
            ...(gruposAlumno.length > 0 ? [{ grupo_id: { [Op.in]: gruposAlumno } }] : []),
          ],
        },
        {
          [Op.or]: [
            { remitente_tipo: 'coordinacion' },
            { remitente_tipo: 'control_escolar' },
            ...(docentesAlumno.length > 0
              ? [{ [Op.and]: [{ remitente_tipo: 'docente' }, { docente_id: { [Op.in]: docentesAlumno } }] }]
              : []),
          ],
        },
      ],
    },
    order: [['created_at', 'DESC'], ['id_aviso', 'DESC']],
    limit: 100,
  });

  return res.json({ items });
}

async function descartarAviso(req, res) {
  const validacion = await validarAccesoAlumno(req, { requiereAcademico: true });
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const idAviso = toNumber(req.params.id);
  if (!Number.isInteger(idAviso)) {
    return res.status(400).json({ message: 'id de aviso invalido.' });
  }

  const aviso = await Aviso.findByPk(idAviso);
  if (!aviso) {
    return res.status(404).json({ message: 'Aviso no encontrado.' });
  }

  await AlumnoAvisoOculto.findOrCreate({
    where: {
      alumno_id: validacion.idAlumno,
      aviso_id: idAviso,
    },
    defaults: {
      alumno_id: validacion.idAlumno,
      aviso_id: idAviso,
      created_at: new Date(),
    },
  });

  return res.json({ id_aviso: idAviso, oculto: true });
}

async function historialTramites(req, res) {
  const validacion = await validarAccesoAlumno(req);
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const items = await TramiteSolicitud.findAll({
    where: { id_alumno: validacion.idAlumno },
    include: [{ model: Usuario, as: 'resolutor', attributes: ['id_usuario', 'nombre_completo', 'rol'] }],
    order: [['fecha_solicitud', 'DESC'], ['id_tramite', 'DESC']],
  });

  return res.json({ items });
}

async function notificaciones(req, res) {
  const validacion = await validarAccesoAlumno(req, { requiereAcademico: true });
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const { materiasIds } = await obtenerContextoAcademicoAlumno(validacion.idAlumno);

  const [meritos, pagosAprobados, tramites, anuncios, tareas, notificacionesInternas] = await Promise.all([
    MeritoAcademico.findAll({
      where: { id_alumno: validacion.idAlumno },
      order: [['fecha', 'DESC']],
      limit: 10,
    }),
    PagoEstatus.findAll({
      where: {
        id_alumno: validacion.idAlumno,
        estatus: { [Op.in]: ['pagado', 'condonado'] },
      },
      order: [['fecha_pago', 'DESC']],
      limit: 10,
    }),
    TramiteSolicitud.findAll({
      where: { id_alumno: validacion.idAlumno },
      order: [['fecha_solicitud', 'DESC']],
      limit: 10,
    }),
    materiasIds.length > 0
      ? AnuncioDocente.findAll({
        where: {
          [Op.or]: [
            { id_materia: null },
            { id_materia: { [Op.in]: materiasIds } },
          ],
        },
        include: [{ model: Materia, as: 'materia', attributes: ['id_materia', 'nombre_materia'] }],
        order: [['fecha_publicacion', 'DESC']],
        limit: 10,
      })
      : [],
    materiasIds.length > 0
      ? Tarea.findAll({
        where: {
          id_materia: { [Op.in]: materiasIds },
          fecha_limite: { [Op.gte]: new Date() },
        },
        include: [{ model: Materia, as: 'materia', attributes: ['id_materia', 'nombre_materia'] }],
        order: [['fecha_limite', 'ASC']],
        limit: 10,
      })
      : [],
    NotificacionAlumno.findAll({
      where: { id_alumno: validacion.idAlumno },
      order: [['fecha', 'DESC']],
      limit: 10,
    }),
  ]);

  const notifs = [];

  tareas.forEach((item) => {
    notifs.push({
      tipo: 'tarea_por_vencer',
      titulo: `Tarea por vencer: ${item.titulo}`,
      detalle: `${item.materia?.nombre_materia || 'Materia'} · vence ${item.fecha_limite}`,
      fecha: item.fecha_limite,
      prioridad: 'media',
    });
  });

  pagosAprobados.forEach((item) => {
    notifs.push({
      tipo: 'pago_aprobado',
      titulo: `Pago ${item.estatus === 'condonado' ? 'condonado' : 'aprobado'}`,
      detalle: `${item.concepto} · ${item.monto} MXN`,
      fecha: item.fecha_pago || item.fecha_limite,
      prioridad: 'baja',
    });
  });

  meritos.forEach((item) => {
    notifs.push({
      tipo: 'merito_otorgado',
      titulo: `Merito: ${item.nombre}`,
      detalle: item.tipo_merito || 'Reconocimiento academico',
      fecha: item.fecha,
      prioridad: 'baja',
    });
  });

  anuncios.forEach((item) => {
    notifs.push({
      tipo: 'aviso_grupal',
      titulo: item.titulo,
      detalle: `${item.materia?.nombre_materia || 'Comunidad'} · ${item.descripcion}`,
      fecha: item.fecha_publicacion,
      prioridad: 'media',
    });
  });

  tramites.forEach((item) => {
    notifs.push({
      tipo: 'tramite_actualizado',
      titulo: `Tramite ${item.tipo}`,
      detalle: `Estatus: ${item.estatus}`,
      fecha: item.fecha_resolucion || item.fecha_solicitud,
      prioridad: 'baja',
    });
  });

  notificacionesInternas.forEach((item) => {
    notifs.push({
      tipo: item.tipo,
      titulo: item.titulo,
      detalle: item.detalle,
      fecha: item.fecha,
      prioridad: 'alta',
    });
  });

  notifs.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  return res.json({ items: notifs.slice(0, 40) });
}

async function dashboard(req, res) {
  const validacion = await validarAccesoAlumno(req);
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const [horarioResp, tareasResp, pagosResp] = await Promise.all([
    horarioAulas(req, {
      status(code) {
        this._status = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return this;
      },
    }),
    tareasPendientes(req, {
      status(code) {
        this._status = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return this;
      },
    }),
    PagoEstatus.findAll({
      where: { id_alumno: validacion.idAlumno },
      order: [['fecha_limite', 'ASC']],
      limit: 10,
    }),
  ]);

  return res.json({
    perfil: validacion.estado.perfil,
    usuario: validacion.estado.usuario,
    bloqueo_plataforma: validacion.estado.bloqueo_plataforma,
    bloqueo_calificaciones: validacion.estado.bloqueo_calificaciones,
    horario_aulas: horarioResp?.payload?.items || [],
    tareas_pendientes: tareasResp?.payload?.items || [],
    pagos: pagosResp,
  });
}

async function horarios(req, res) {
  return horarioAulas(req, res);
}

async function tareas(req, res) {
  const validacion = await validarAccesoAlumno(req, { requiereAcademico: true });
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const { materiasIds, gruposPorMateria } = await obtenerContextoAcademicoAlumno(validacion.idAlumno);
  if (materiasIds.length === 0) {
    return res.json({ items: [] });
  }

  const [tareasItems, entregas] = await Promise.all([
    Tarea.findAll({
      where: { id_materia: { [Op.in]: materiasIds } },
      include: [{ model: Materia, as: 'materia' }],
      order: [['fecha_limite', 'ASC']],
    }),
    EntregaTarea.findAll({ where: { id_alumno: validacion.idAlumno } }),
  ]);

  const entregasMap = new Map(entregas.map((item) => [item.id_tarea, item]));

  const items = tareasItems
    .filter((tareaItem) => {
      if (!tareaItem.grupo_id) return true;
      const gruposMateria = gruposPorMateria.get(tareaItem.id_materia);
      return gruposMateria ? gruposMateria.has(String(tareaItem.grupo_id).trim()) : false;
    })
    .map((tareaItem) => ({
      id_tarea: tareaItem.id_tarea,
      id_materia: tareaItem.id_materia,
      grupo_id: tareaItem.grupo_id,
      titulo: tareaItem.titulo,
      descripcion: tareaItem.descripcion,
      fecha_limite: tareaItem.fecha_limite,
      archivo_adjunto_url: tareaItem.archivo_adjunto_url,
      materia: tareaItem.materia,
      entrega: entregasMap.get(tareaItem.id_tarea) || null,
      estatus: entregasMap.get(tareaItem.id_tarea)?.estatus || 'pendiente',
      calificacion: entregasMap.get(tareaItem.id_tarea)?.calificacion || null,
      retroalimentacion: entregasMap.get(tareaItem.id_tarea)?.retroalimentacion || null,
    }));

  return res.json({ items });
}

async function asistencias(req, res) {
  return asistencia(req, res);
}

async function pagos(req, res) {
  const validacion = await validarAccesoAlumno(req);
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const [items, comprobantesEnRevision] = await Promise.all([
    PagoEstatus.findAll({
      where: { id_alumno: validacion.idAlumno },
      order: [['fecha_limite', 'ASC']],
    }),
    TramiteSolicitud.findAll({
      where: {
        id_alumno: validacion.idAlumno,
        tipo: 'comprobante_pago',
        estatus: { [Op.in]: ['recibido', 'en_revision'] },
      },
      attributes: ['descripcion'],
    }),
  ]);

  const descripcionesEnRevision = comprobantesEnRevision.map((item) => String(item.descripcion || '').toLowerCase());
  const tieneComprobantePendiente = (concepto) => {
    const nombre = String(concepto || '').toLowerCase();
    return nombre && descripcionesEnRevision.some((descripcion) => descripcion.includes(nombre));
  };

  const itemsConEstatusVisible = items.map((item) => {
    let estatusVisible = 'pendiente';
    if (['pagado', 'condonado'].includes(item.estatus)) {
      estatusVisible = 'aprobado';
    } else if (item.estatus === 'en_revision') {
      estatusVisible = 'en_revision';
    } else if (tieneComprobantePendiente(item.concepto)) {
      estatusVisible = 'en_revision';
    }

    return {
      ...item.toJSON(),
      estatus_visible: estatusVisible,
    };
  });

  const totalPagado = items
    .filter((item) => ['pagado', 'condonado'].includes(item.estatus))
    .reduce((acc, item) => acc + Number(item.monto || 0), 0);

  const adeudoPendiente = items
    .filter((item) => ['pendiente', 'vencido'].includes(item.estatus))
    .reduce((acc, item) => acc + Number(item.monto || 0), 0);

  return res.json({
    items: itemsConEstatusVisible,
    resumen: {
      estado_general: adeudoPendiente > 0 ? 'adeudo' : 'al_corriente',
      total_pagado: totalPagado,
      adeudo_pendiente: adeudoPendiente,
      periodo_activo: items[0]?.fecha_limite || null,
    },
  });
}

async function materiales(req, res) {
  return materialesClase(req, res);
}

async function portafolio(_req, res) {
  const validacion = await validarAccesoAlumno(_req);
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const evidencias = await PortafolioEvidencia.findAll({
    where: { id_alumno: validacion.idAlumno },
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

async function subirDocumentoPortafolio(req, res) {
  const validacion = await validarAccesoAlumno(req);
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const tipoDocumento = normalizeText(req.body.tipo_documento)?.toLowerCase() || null;
  if (!tipoDocumento || !TIPOS_DOCUMENTO_PERMITIDOS.has(tipoDocumento)) {
    return res.status(400).json({ message: 'tipo_documento invalido.' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'Selecciona un archivo para subir.' });
  }

  const evidencia = await PortafolioEvidencia.create({
    id_alumno: validacion.idAlumno,
    archivo_url: `/uploads/portafolio/${req.file.filename}`,
    nombre_archivo: req.file.originalname,
    tipo_documento: tipoDocumento,
    origen: 'alumno',
    id_subido_por: req.user.id_usuario,
    fecha_creacion: new Date(),
  });

  return res.status(201).json({
    id_evidencia: evidencia.id_evidencia,
    archivo_url: evidencia.archivo_url,
    nombre_archivo: evidencia.nombre_archivo,
    tipo_documento: evidencia.tipo_documento,
    origen: evidencia.origen,
  });
}

async function portafolioRecursos(req, res) {
  const validacion = await validarAccesoAlumno(req, { requiereAcademico: true });
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const idParam = toNumber(req.params.id);
  if (idParam !== null && idParam !== validacion.idAlumno) {
    return res.status(403).json({ message: 'No tienes acceso al portafolio de otro alumno.' });
  }

  const { grupos, asignaciones, materiasIds } = await obtenerContextoAcademicoAlumno(validacion.idAlumno);
  const gruposAlumno = [...new Set(grupos.map((item) => String(item.grupo || '').trim()).filter(Boolean))];
  const carreraAlumno = normalizeText(validacion.estado.perfil.carrera) || null;

  const docentesPorMateriaGrupo = new Map(
    asignaciones.map((item) => [
      `${Number(item.id_materia)}:${String(item.grupo || '').trim()}`,
      item.docente?.usuario?.nombre_completo || 'Por asignar',
    ]),
  );

  const evidenciasExistentes = materiasIds.length > 0
    ? await PortafolioMateriaEvidencia.findAll({
      where: {
        alumno_id: validacion.idAlumno,
        materia_id: { [Op.in]: materiasIds },
      },
    })
    : [];
  const evidenciaPorMateria = new Map(evidenciasExistentes.map((item) => [Number(item.materia_id), item]));

  const misEvidencias = grupos.map((grupo) => {
    const materiaId = Number(grupo.id_materia);
    const grupoId = String(grupo.grupo || '').trim();
    const evidencia = evidenciaPorMateria.get(materiaId) || null;

    return {
      materia_id: materiaId,
      materia_nombre: grupo.materia?.nombre_materia || `Materia ${materiaId}`,
      docente_nombre: docentesPorMateriaGrupo.get(`${materiaId}:${grupoId}`) || 'Por asignar',
      drive_url: evidencia ? evidencia.drive_url : null,
      estado: evidencia ? evidencia.estado : 'pendiente',
    };
  });

  const filtrosRecurso = {
    activo: true,
    [Op.and]: [
      {
        [Op.or]: [
          { carrera_id: null },
          ...(carreraAlumno ? [{ carrera_id: carreraAlumno }] : []),
        ],
      },
      {
        [Op.or]: [
          { grupo_id: null },
          ...(gruposAlumno.length > 0 ? [{ grupo_id: { [Op.in]: gruposAlumno } }] : []),
        ],
      },
      {
        [Op.or]: [
          { remitente_tipo: 'coordinacion' },
          ...(materiasIds.length > 0 ? [{ [Op.and]: [{ remitente_tipo: 'docente' }, { id_materia: { [Op.in]: materiasIds } }] }] : []),
        ],
      },
    ],
  };

  const recursos = await RecursoAcademico.findAll({
    where: filtrosRecurso,
    include: [{ model: Materia, as: 'materia', attributes: ['id_materia', 'nombre_materia'], required: false }],
    order: [['created_at', 'DESC'], ['id_recurso', 'DESC']],
    limit: 200,
  });

  const recursosInstitucionales = recursos.map((item) => ({
    titulo: item.titulo,
    remitente_tipo: item.remitente_tipo,
    remitente_nombre: item.remitente_nombre,
    materia_nombre: item.materia?.nombre_materia || null,
    tipo_recurso: item.tipo_recurso,
    url_recurso: item.url_recurso,
  }));

  return res.json({ misEvidencias, recursosInstitucionales });
}

async function guardarPortafolioMateria(req, res) {
  const validacion = await validarAccesoAlumno(req, { requiereAcademico: true });
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const materiaId = toNumber(req.body.materia_id);
  const driveUrl = normalizeText(req.body.drive_url);
  const cuatrimestreId = toNumber(req.body.cuatrimestre_id);

  if (!Number.isInteger(materiaId)) {
    return res.status(400).json({ message: 'materia_id invalido.' });
  }
  if (!driveUrl || !esUrlValida(driveUrl)) {
    return res.status(400).json({ message: 'drive_url debe ser una URL valida.' });
  }

  const { materiasIds } = await obtenerContextoAcademicoAlumno(validacion.idAlumno);
  if (!materiasIds.includes(materiaId)) {
    return res.status(403).json({ message: 'No estas inscrito en esa materia.' });
  }

  const [evidencia] = await PortafolioMateriaEvidencia.findOrCreate({
    where: { alumno_id: validacion.idAlumno, materia_id: materiaId },
    defaults: {
      alumno_id: validacion.idAlumno,
      materia_id: materiaId,
      cuatrimestre_id: Number.isInteger(cuatrimestreId) ? cuatrimestreId : (validacion.estado.perfil.bimestre_actual || null),
      drive_url: driveUrl,
      estado: 'entregado',
      fecha_actualizacion: new Date(),
      created_at: new Date(),
    },
  });

  if (!evidencia.isNewRecord) {
    evidencia.drive_url = driveUrl;
    evidencia.estado = 'entregado';
    evidencia.fecha_actualizacion = new Date();
    if (Number.isInteger(cuatrimestreId)) {
      evidencia.cuatrimestre_id = cuatrimestreId;
    }
    await evidencia.save();
  }

  return res.status(201).json({
    materia_id: evidencia.materia_id,
    drive_url: evidencia.drive_url,
    estado: evidencia.estado,
  });
}

async function meritos(req, res) {
  const validacion = await validarAccesoAlumno(req);
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const items = await MeritoAcademico.findAll({
    where: { id_alumno: validacion.idAlumno },
    order: [['fecha', 'DESC']],
  });

  return res.json({ items });
}

async function alertas(req, res) {
  return notificaciones(req, res);
}

async function videoClases(req, res) {
  const validacion = await validarAccesoAlumno(req, { requiereAcademico: true });
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const { materiasIds, gruposPorMateria } = await obtenerContextoAcademicoAlumno(validacion.idAlumno);
  if (materiasIds.length === 0) {
    return res.json({ items: [] });
  }

  const grupos = [...new Set([
    ...[...gruposPorMateria.values()].flatMap((set) => [...set]),
  ])];

  const items = await SalaVideoDocente.findAll({
    where: {
      id_materia: { [Op.in]: materiasIds },
      [Op.or]: [{ grupo_id: null }, { grupo_id: { [Op.in]: grupos } }],
    },
    include: [{ model: Materia, as: 'materia' }],
    order: [['fecha_programada', 'DESC']],
  });

  return res.json({ items });
}

async function planEstudio(req, res) {
  const validacion = await validarAccesoAlumno(req);
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const [materias, grupos] = await Promise.all([
    Materia.findAll({ order: [['bimestre_pertenece', 'ASC'], ['nombre_materia', 'ASC']] }),
    AlumnoGrupo.findAll({ where: { id_alumno: validacion.idAlumno } }),
  ]);

  const gruposMap = new Map(grupos.map((item) => [item.id_materia, item.grupo]));

  const items = materias.map((materia) => {
    let estatus = 'pendiente';
    if (gruposMap.has(materia.id_materia)) {
      estatus = 'en_curso';
    } else if (Number(materia.bimestre_pertenece) < Number(validacion.estado.perfil.bimestre_actual || 0)) {
      estatus = 'cursada';
    }

    return {
      ...materia.toJSON(),
      estatus,
      grupo: gruposMap.get(materia.id_materia) || null,
    };
  });

  const avanceBase = items.reduce((acc, item) => {
    if (item.estatus === 'cursada') return acc + 1;
    if (item.estatus === 'en_curso') return acc + 0.5;
    return acc;
  }, 0);

  const porcentajeAvance = items.length > 0 ? Math.round((avanceBase / items.length) * 100) : 0;

  return res.json({
    carrera: validacion.estado.perfil.carrera,
    bimestre_actual: validacion.estado.perfil.bimestre_actual,
    porcentaje_avance: porcentajeAvance,
    items,
  });
}

async function listarTramites(req, res) {
  return historialTramites(req, res);
}

async function crearTramite(req, res) {
  return solicitarTramite(req, res);
}

async function recursosInstitucionales(_req, res) {
  const filas = await ConfiguracionInstitucional.findAll({
    where: { clave: { [Op.in]: ['biblioteca_virtual_url', 'manual_servicio_social_url'] } },
  });

  const valores = new Map(filas.map((item) => [item.clave, item.valor]));

  return res.json({
    biblioteca_virtual_url: valores.get('biblioteca_virtual_url') || null,
    manual_servicio_social_url: valores.get('manual_servicio_social_url') || null,
  });
}

async function tiposTramite(_req, res) {
  return res.json({
    items: TRAMITES_ESCOLARES.map((tipo) => ({
      value: tipo,
      label: TRAMITES_ESCOLARES_LABELS[tipo] || tipo,
    })),
  });
}

async function descargarBoleta(req, res) {
  const validacion = await validarAccesoAlumno(req, { requiereCalificaciones: true });
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const resultado = await generarWorkbookBoleta(validacion.idAlumno);
  if (resultado.notFound) {
    return res.status(404).json({ message: 'Perfil de alumno no encontrado.' });
  }
  if (resultado.worksheetMissing) {
    return res.status(500).json({ message: "No existe la hoja 'BOLETA' en la plantilla." });
  }

  const { workbook, filename } = resultado;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  return res.end();
}

module.exports = {
  estadoAcceso,
  horarioAulas,
  tareasPendientes,
  materialesClase,
  calificaciones,
  asistencia,
  subirComprobantePago,
  solicitarTramite,
  historialTramites,
  notificaciones,
  descargarBoleta,

  dashboard,
  horarios,
  tareas,
  asistencias,
  pagos,
  portafolio,
  subirDocumentoPortafolio,
  portafolioRecursos,
  guardarPortafolioMateria,
  meritos,
  alertas,
  videoClases,
  planEstudio,
  listarTramites,
  crearTramite,
  listarAvisos,
  descartarAviso,
  recursosInstitucionales,
  tiposTramite,
};
