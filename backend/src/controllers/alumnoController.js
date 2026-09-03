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
} = require('../../models');
const { registrarEventoAuditoria } = require('../services/auditService');

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
      attributes: ['id_alumno', 'carrera', 'bimestre_actual', 'estado_academico', 'bloqueo_plataforma', 'bloqueo_calificaciones', 'estatus_financiero'],
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

  const { materiasIds } = await obtenerContextoAcademicoAlumno(validacion.idAlumno);
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

  const acumuladoMap = new Map();
  items.forEach((item) => {
    const idMateria = Number(item.id_materia);
    const base = acumuladoMap.get(idMateria) || {
      id_materia: idMateria,
      materia: item.materia?.nombre_materia || `Materia ${idMateria}`,
      total: 0,
      presentes: 0,
      faltas: 0,
      retardos: 0,
      justificados: 0,
    };

    base.total += 1;
    if (item.estatus_asistencia === 'presente') base.presentes += 1;
    if (item.estatus_asistencia === 'ausente') base.faltas += 1;
    if (item.estatus_asistencia === 'retardo') base.retardos += 1;
    if (item.estatus_asistencia === 'justificado') base.justificados += 1;

    acumuladoMap.set(idMateria, base);
  });

  const acumulado = [...acumuladoMap.values()].map((item) => ({
    ...item,
    porcentaje_asistencia: item.total > 0 ? Number(((item.presentes / item.total) * 100).toFixed(1)) : 0,
  }));

  return res.json({ items, acumulado });
}

async function subirComprobantePago(req, res) {
  const validacion = await validarAccesoAlumno(req);
  if (!validacion.ok) {
    return res.status(validacion.status).json(validacion.payload);
  }

  const idConceptoPago = toNumber(req.body.id_concepto_pago);
  const montoPagado = toNumber(req.body.monto_pagado);
  const adjuntoUrl = normalizeText(req.body.adjunto_url || req.body.archivo_url || req.body.comprobante_url);

  if (!Number.isInteger(idConceptoPago)) {
    return res.status(400).json({ message: 'id_concepto_pago es obligatorio.' });
  }

  if (!montoPagado || montoPagado <= 0) {
    return res.status(400).json({ message: 'monto_pagado debe ser mayor a 0.' });
  }

  if (!adjuntoUrl) {
    return res.status(400).json({ message: 'adjunto_url es obligatorio.' });
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

  const tramite = await TramiteSolicitud.create({
    id_alumno: validacion.idAlumno,
    tipo: 'comprobante_pago',
    descripcion: `Comprobante ${concepto.nombre} por ${montoPagado.toFixed(2)} MXN`,
    adjunto_url: adjuntoUrl,
    estatus: 'recibido',
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
  const tiposPermitidos = new Set(['constancia', 'credencial', 'uniforme']);
  if (!tiposPermitidos.has(tipo)) {
    return res.status(400).json({ message: 'tipo invalido. Usa constancia, credencial o uniforme.' });
  }

  const descripcion = normalizeText(req.body.descripcion) || `Solicitud de ${tipo}.`;

  const tramite = await TramiteSolicitud.create({
    id_alumno: validacion.idAlumno,
    tipo,
    descripcion,
    adjunto_url: normalizeText(req.body.adjunto_url) || null,
    estatus: 'recibido',
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

  const items = await PagoEstatus.findAll({
    where: { id_alumno: validacion.idAlumno },
    order: [['fecha_limite', 'ASC']],
  });

  const totalPagado = items
    .filter((item) => ['pagado', 'condonado'].includes(item.estatus))
    .reduce((acc, item) => acc + Number(item.monto || 0), 0);

  const adeudoPendiente = items
    .filter((item) => ['pendiente', 'vencido'].includes(item.estatus))
    .reduce((acc, item) => acc + Number(item.monto || 0), 0);

  return res.json({
    items,
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
  return res.json({ items: [] });
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

  dashboard,
  horarios,
  tareas,
  asistencias,
  pagos,
  portafolio,
  meritos,
  alertas,
  videoClases,
  planEstudio,
  listarTramites,
  crearTramite,
};
