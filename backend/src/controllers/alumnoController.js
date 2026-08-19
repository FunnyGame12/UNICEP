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
  PortafolioEvidencia,
  MeritoAcademico,
  AsignacionGrupo,
  DocentePerfil,
  Horario,
  TramiteSolicitud,
  SalaVideoDocente,
  AsistenciaDocente,
} = require('../../models');
const { registrarEventoAuditoria } = require('../services/auditService');
const { buildPaymentSummary, getAlumnoFinancialState } = require('../services/financialService');
const { TRAMITE_TIPOS } = require('../constants/tramites');

function buildAcademicStatus(calificacion) {
  if (calificacion === null || calificacion === undefined) {
    return 'sin_registrar';
  }

  return Number(calificacion) >= 6 ? 'aprobado' : 'reprobado';
}

function normalizeText(value) {
  return String(value || '').trim();
}

function mapTaskRecord(tarea, entrega, grupo) {
  return {
    id_tarea: tarea.id_tarea,
    titulo: tarea.titulo,
    descripcion: tarea.descripcion,
    fecha_limite: tarea.fecha_limite,
    archivo_adjunto_url: tarea.archivo_adjunto_url,
    materia: tarea.materia,
    grupo,
    entrega: entrega
      ? {
        id_entrega: entrega.id_entrega,
        archivo_entrega_url: entrega.archivo_entrega_url,
        fecha_entrega: entrega.fecha_entrega,
        estatus: entrega.estatus,
        calificacion: entrega.calificacion,
        retroalimentacion: entrega.retroalimentacion,
      }
      : null,
    estatus: entrega?.estatus || 'pendiente',
    calificacion: entrega?.calificacion || null,
    retroalimentacion: entrega?.retroalimentacion || null,
  };
}

async function obtenerPerfilAlumno(idAlumno) {
  return AlumnoPerfil.findByPk(idAlumno, {
    include: [{
      model: Usuario,
      as: 'usuario',
      attributes: ['id_usuario', 'nombre_completo', 'correo', 'foto_url', 'folio_matricula', 'cuenta_activada', 'cuenta_bloqueada'],
    }],
  });
}

async function obtenerContextoAcademico(idAlumno) {
  const grupos = await AlumnoGrupo.findAll({
    where: { id_alumno: idAlumno },
    include: [{ model: Materia, as: 'materia' }],
    order: [[{ model: Materia, as: 'materia' }, 'bimestre_pertenece', 'ASC']],
  });

  const filtrosAsignacion = grupos.map((grupo) => ({
    id_materia: grupo.id_materia,
    grupo: grupo.grupo,
  }));

  const asignaciones = filtrosAsignacion.length > 0
    ? await AsignacionGrupo.findAll({
      where: { [Op.or]: filtrosAsignacion },
      include: [{
        model: DocentePerfil,
        as: 'docente',
        include: [{
          model: Usuario,
          as: 'usuario',
          attributes: ['id_usuario', 'nombre_completo', 'correo'],
        }],
      }],
    })
    : [];

  const materiasIds = [...new Set(grupos.map((grupo) => Number(grupo.id_materia)).filter(Number.isInteger))];
  const docentesIds = [...new Set(asignaciones.map((item) => Number(item.id_docente)).filter(Number.isInteger))];

  return { grupos, asignaciones, materiasIds, docentesIds };
}

async function validarLiberacionControlEscolar(idAlumno) {
  const [usuario, perfil] = await Promise.all([
    Usuario.findByPk(idAlumno, {
      attributes: ['id_usuario', 'cuenta_activada', 'cuenta_bloqueada'],
    }),
    AlumnoPerfil.findByPk(idAlumno, {
      attributes: ['id_alumno', 'bloqueo_plataforma', 'bloqueo_calificaciones'],
    }),
  ]);

  if (!usuario) {
    return {
      ok: false,
      status: 404,
      payload: { message: 'Usuario alumno no encontrado.' },
    };
  }

  if (!usuario.cuenta_activada || usuario.cuenta_bloqueada || perfil?.bloqueo_plataforma || perfil?.bloqueo_calificaciones) {
    const razon = !usuario.cuenta_activada
      ? 'cuenta_no_activada'
      : usuario.cuenta_bloqueada || perfil?.bloqueo_plataforma
        ? 'bloqueo_plataforma'
        : 'bloqueo_calificaciones';

    return {
      ok: false,
      status: 423,
      payload: {
        message: 'Tu progreso academico esta temporalmente restringido hasta liberacion de Control Escolar.',
        razon,
      },
    };
  }

  return { ok: true };
}

async function construirVideoClases(docentesIds) {
  if (docentesIds.length === 0) {
    return [];
  }

  const salas = await SalaVideoDocente.findAll({
    where: { id_docente: { [Op.in]: docentesIds } },
    include: [{
      model: DocentePerfil,
      as: 'docente',
      include: [{ model: Usuario, as: 'usuario', attributes: ['id_usuario', 'nombre_completo', 'correo'] }],
    }],
    order: [['fecha_programada', 'DESC']],
    limit: 50,
  });

  return salas.map((sala) => ({
    id_sala: sala.id_sala,
    titulo: sala.titulo,
    plataforma: sala.plataforma,
    enlace: sala.enlace,
    fecha_programada: sala.fecha_programada,
    docente: sala.docente?.usuario?.nombre_completo || 'Docente',
  }));
}

async function dashboard(req, res) {
  const alumno = await obtenerPerfilAlumno(req.user.id_usuario);
  if (!alumno) {
    return res.status(404).json({ message: 'Perfil de alumno no encontrado.' });
  }

  const [{ grupos, asignaciones, docentesIds }, pagos, horariosOficiales] = await Promise.all([
    obtenerContextoAcademico(req.user.id_usuario),
    PagoEstatus.findAll({
      where: { id_alumno: req.user.id_usuario },
      order: [['fecha_limite', 'ASC']],
      limit: 10,
    }),
    Horario.findAll({ order: [['id_horario', 'ASC']] }),
  ]);

  const videoClases = await construirVideoClases(docentesIds);
  const asignacionIndex = new Map(asignaciones.map((item) => [`${item.id_materia}-${item.grupo}`, item]));

  const horarioBimestre = grupos.reduce((acc, grupo) => {
    const materia = grupo.materia;
    const key = materia?.bimestre_pertenece || 0;
    const asignacion = asignacionIndex.get(`${grupo.id_materia}-${grupo.grupo}`);

    if (!acc[key]) {
      acc[key] = { bimestre: key, materias: [] };
    }

    acc[key].materias.push({
      id_materia: grupo.id_materia,
      nombre_materia: materia?.nombre_materia || 'Materia',
      codigo_materia: materia?.codigo_materia || 'N/A',
      grupo: grupo.grupo,
      docente: asignacion?.docente?.usuario?.nombre_completo || 'Por asignar',
      modalidad: 'Ejecutiva flexible',
    });

    return acc;
  }, {});

  return res.json({
    perfil: alumno,
    pagos,
    resumen_pagos: buildPaymentSummary(pagos),
    horario_bimestre: Object.values(horarioBimestre),
    horarios_oficiales: horariosOficiales,
    video_clases: videoClases,
  });
}

async function horarios(req, res) {
  const { grupos, asignaciones } = await obtenerContextoAcademico(req.user.id_usuario);
  const horariosOficiales = await Horario.findAll({ order: [['id_horario', 'ASC']] });

  const asignacionIndex = new Map(asignaciones.map((item) => [`${item.id_materia}-${item.grupo}`, item]));
  const materias = grupos.map((grupo) => ({
    id_materia: grupo.id_materia,
    nombre_materia: grupo.materia?.nombre_materia || 'Materia',
    grupo: grupo.grupo,
    aula_referencia: horariosOficiales[0]?.aula || null,
    docente: asignacionIndex.get(`${grupo.id_materia}-${grupo.grupo}`)?.docente?.usuario?.nombre_completo || 'Por asignar',
  }));

  return res.json({ horarios_oficiales: horariosOficiales, materias });
}

async function tareas(req, res) {
  const grupos = await AlumnoGrupo.findAll({ where: { id_alumno: req.user.id_usuario } });
  const materiasIds = [...new Set(grupos.map((grupo) => grupo.id_materia))];
  if (materiasIds.length === 0) {
    return res.json({ items: [] });
  }

  const [tareasAsignadas, entregas] = await Promise.all([
    Tarea.findAll({
      where: { id_materia: { [Op.in]: materiasIds } },
      include: [{ model: Materia, as: 'materia' }],
      order: [['fecha_limite', 'ASC']],
    }),
    EntregaTarea.findAll({ where: { id_alumno: req.user.id_usuario } }),
  ]);

  const gruposIndex = new Map(grupos.map((grupo) => [grupo.id_materia, grupo.grupo]));
  const entregasIndex = new Map(entregas.map((entrega) => [entrega.id_tarea, entrega]));

  const items = tareasAsignadas.map((tarea) => mapTaskRecord(
    tarea,
    entregasIndex.get(tarea.id_tarea),
    gruposIndex.get(tarea.id_materia) || 'Sin grupo',
  ));

  return res.json({ items });
}

async function calificaciones(req, res) {
  const gate = await validarLiberacionControlEscolar(req.user.id_usuario);
  if (!gate.ok) {
    return res.status(gate.status).json(gate.payload);
  }

  const calificaciones = await EntregaTarea.findAll({
    where: {
      id_alumno: req.user.id_usuario,
      estatus: { [Op.in]: ['calificada'] },
    },
    include: [{
      model: Tarea,
      as: 'tarea',
      include: [{ model: Materia, as: 'materia' }],
    }],
    order: [[{ model: Tarea, as: 'tarea' }, { model: Materia, as: 'materia' }, 'bimestre_pertenece', 'ASC']],
  });

  const resumenMap = new Map();
  calificaciones.forEach((item) => {
    const materia = item.tarea?.materia?.nombre_materia || 'Sin materia';
    const actual = resumenMap.get(materia) || { materia, suma: 0, total: 0 };
    actual.suma += Number(item.calificacion || 0);
    actual.total += 1;
    resumenMap.set(materia, actual);
  });

  const resumen = [...resumenMap.values()].map((item) => {
    const promedio = item.total > 0 ? Number((item.suma / item.total).toFixed(1)) : 0;
    return { materia: item.materia, promedio, estatus: buildAcademicStatus(promedio) };
  });

  return res.json({
    items: calificaciones.map((item) => ({
      id_entrega: item.id_entrega,
      estatus: item.estatus,
      calificacion: item.calificacion,
      retroalimentacion: item.retroalimentacion,
      fecha_entrega: item.fecha_entrega,
      estatus_academico: buildAcademicStatus(item.calificacion),
      tarea: item.tarea,
    })),
    resumen,
    liberado_por_control_escolar: true,
  });
}

async function asistencias(req, res) {
  const gate = await validarLiberacionControlEscolar(req.user.id_usuario);
  if (!gate.ok) {
    return res.status(gate.status).json(gate.payload);
  }

  const { materiasIds } = await obtenerContextoAcademico(req.user.id_usuario);
  if (materiasIds.length === 0) {
    return res.json({ items: [], acumulado: [] });
  }

  const registros = await AsistenciaDocente.findAll({
    where: {
      id_materia: { [Op.in]: materiasIds },
      [Op.or]: [
        { id_alumno: req.user.id_usuario },
        { id_alumno: null },
      ],
    },
    include: [{ model: Materia, as: 'materia' }],
    order: [['fecha_clase', 'DESC']],
  });

  const acumuladoMap = new Map();
  registros.forEach((item) => {
    const idMateria = Number(item.id_materia);
    const base = acumuladoMap.get(idMateria) || {
      id_materia: idMateria,
      materia: item.materia?.nombre_materia || `Materia ${idMateria}`,
      total: 0,
      presentes: 0,
      ausentes: 0,
      retardos: 0,
      justificados: 0,
    };

    base.total += 1;
    if (item.estatus_asistencia === 'presente') base.presentes += 1;
    if (item.estatus_asistencia === 'ausente') base.ausentes += 1;
    if (item.estatus_asistencia === 'retardo') base.retardos += 1;
    if (item.estatus_asistencia === 'justificado') base.justificados += 1;

    acumuladoMap.set(idMateria, base);
  });

  return res.json({ items: registros, acumulado: [...acumuladoMap.values()] });
}

async function pagos(req, res) {
  const financialState = await getAlumnoFinancialState(req.user.id_usuario);

  return res.json({
    items: financialState.pagos,
    resumen: financialState.resumen,
    servicios: financialState.servicios,
  });
}

async function subirComprobantePago(req, res) {
  const adjuntoUrl = normalizeText(req.body.adjunto_url);
  const descripcion = normalizeText(req.body.descripcion) || 'Comprobante de pago enviado por alumno.';

  if (!adjuntoUrl) {
    return res.status(400).json({ message: 'adjunto_url es obligatorio para registrar comprobante.' });
  }

  const tramite = await TramiteSolicitud.create({
    id_alumno: req.user.id_usuario,
    tipo: 'comprobante_pago',
    descripcion,
    adjunto_url: adjuntoUrl,
    estatus: 'recibido',
    fecha_solicitud: new Date(),
  });

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'subir_comprobante_pago',
    modulo: 'alumnos',
    entidad: 'tramites_solicitudes',
    idEntidad: tramite.id_tramite,
    detalle: {
      tipo: tramite.tipo,
      estatus: tramite.estatus,
    },
  });

  return res.status(201).json(tramite);
}

async function materiales(req, res) {
  const grupos = await AlumnoGrupo.findAll({ where: { id_alumno: req.user.id_usuario } });
  const materiasIds = [...new Set(grupos.map((grupo) => grupo.id_materia))];
  if (materiasIds.length === 0) {
    return res.json({ items: [] });
  }

  const items = await MaterialClase.findAll({
    where: { id_materia: { [Op.in]: materiasIds } },
    include: [{ model: Materia, as: 'materia' }],
    order: [['id_materia', 'ASC'], ['tema_semana', 'ASC']],
  });

  return res.json({ items });
}

async function portafolio(req, res) {
  const items = await PortafolioEvidencia.findAll({
    where: { id_alumno: req.user.id_usuario },
    include: [{ model: Materia, as: 'materia' }],
    order: [['periodo_bimestre', 'DESC'], ['id_evidencia', 'DESC']],
  });

  return res.json({
    items,
    integracion_drive: {
      status: 'pendiente',
      message: 'La conexion con Google Drive requiere definir la carpeta institucional especifica.',
    },
  });
}

async function meritos(req, res) {
  const items = await MeritoAcademico.findAll({
    where: { id_alumno: req.user.id_usuario },
    order: [['fecha', 'DESC']],
  });

  return res.json({ items });
}

async function alertas(req, res) {
  const [meritosItems, tramites, tareasRes] = await Promise.all([
    MeritoAcademico.findAll({
      where: { id_alumno: req.user.id_usuario },
      order: [['fecha', 'DESC']],
      limit: 5,
    }),
    TramiteSolicitud.findAll({
      where: {
        id_alumno: req.user.id_usuario,
        [Op.or]: [
          { descripcion: { [Op.like]: '%justificante%' } },
          { descripcion: { [Op.like]: '%medic%' } },
          { descripcion: { [Op.like]: '%personal%' } },
        ],
      },
      order: [['fecha_solicitud', 'DESC']],
      limit: 10,
    }),
    (async () => {
      const grupos = await AlumnoGrupo.findAll({ where: { id_alumno: req.user.id_usuario } });
      const materiasIds = [...new Set(grupos.map((g) => g.id_materia))];
      if (materiasIds.length === 0) return [];

      const [tareasAsignadas, entregas] = await Promise.all([
        Tarea.findAll({
          where: { id_materia: { [Op.in]: materiasIds } },
          include: [{ model: Materia, as: 'materia' }],
          order: [['fecha_limite', 'ASC']],
        }),
        EntregaTarea.findAll({ where: { id_alumno: req.user.id_usuario } }),
      ]);

      const entregasIndex = new Map(entregas.map((item) => [item.id_tarea, item]));
      return tareasAsignadas
        .map((tarea) => ({ tarea, entrega: entregasIndex.get(tarea.id_tarea) || null }))
        .filter((item) => !item.entrega || ['pendiente', 'fuera_de_tiempo'].includes(item.entrega.estatus))
        .slice(0, 10)
        .map((item) => ({
          id_tarea: item.tarea.id_tarea,
          titulo: item.tarea.titulo,
          fecha_limite: item.tarea.fecha_limite,
          materia: item.tarea.materia?.nombre_materia || 'Materia',
          estatus: item.entrega?.estatus || 'pendiente',
        }));
    })(),
  ]);

  return res.json({
    meritos: meritosItems,
    tareas_pendientes: tareasRes,
    justificaciones: tramites,
  });
}

async function videoClases(req, res) {
  const { docentesIds } = await obtenerContextoAcademico(req.user.id_usuario);
  const items = await construirVideoClases(docentesIds);
  return res.json({ items });
}

async function planEstudio(req, res) {
  const alumno = await AlumnoPerfil.findByPk(req.user.id_usuario);
  if (!alumno) {
    return res.status(404).json({ message: 'Perfil de alumno no encontrado.' });
  }

  const [materias, grupos] = await Promise.all([
    Materia.findAll({ order: [['bimestre_pertenece', 'ASC'], ['nombre_materia', 'ASC']] }),
    AlumnoGrupo.findAll({ where: { id_alumno: req.user.id_usuario } }),
  ]);

  const gruposIndex = new Map(grupos.map((grupo) => [grupo.id_materia, grupo.grupo]));

  const items = materias.map((materia) => {
    let estatus = 'pendiente';
    if (gruposIndex.has(materia.id_materia)) {
      estatus = 'en_curso';
    } else if (materia.bimestre_pertenece < alumno.bimestre_actual) {
      estatus = 'cursada';
    }

    return {
      ...materia.toJSON(),
      estatus,
      grupo: gruposIndex.get(materia.id_materia) || null,
    };
  });

  const avanceBase = items.reduce((acc, item) => {
    if (item.estatus === 'cursada') return acc + 1;
    if (item.estatus === 'en_curso') return acc + 0.5;
    return acc;
  }, 0);

  const porcentaje_avance = items.length > 0 ? Math.round((avanceBase / items.length) * 100) : 0;

  return res.json({
    carrera: alumno.carrera,
    bimestre_actual: alumno.bimestre_actual,
    porcentaje_avance,
    items,
  });
}

async function entregarTarea(req, res) {
  const idTarea = Number(req.params.id_tarea);
  const { archivo_entrega_url } = req.body;

  if (!Number.isInteger(idTarea)) {
    return res.status(400).json({ message: 'id_tarea invalido.' });
  }

  if (!archivo_entrega_url) {
    return res.status(400).json({ message: 'archivo_entrega_url es obligatorio.' });
  }

  const tarea = await Tarea.findByPk(idTarea, {
    include: [{ model: Materia, as: 'materia' }],
  });

  if (!tarea) {
    return res.status(404).json({ message: 'Tarea no encontrada.' });
  }

  const inscripcion = await AlumnoGrupo.findOne({
    where: {
      id_alumno: req.user.id_usuario,
      id_materia: tarea.id_materia,
    },
  });

  if (!inscripcion) {
    return res.status(403).json({ message: 'No puedes entregar tareas de una materia donde no estas inscrito.' });
  }

  const ahora = new Date();
  const fueraDeTiempo = ahora > new Date(tarea.fecha_limite);
  const estatus = fueraDeTiempo ? 'fuera_de_tiempo' : 'entregada';

  const existente = await EntregaTarea.findOne({
    where: {
      id_tarea: idTarea,
      id_alumno: req.user.id_usuario,
    },
  });

  let entrega;
  if (existente) {
    existente.archivo_entrega_url = archivo_entrega_url;
    existente.fecha_entrega = ahora;
    existente.estatus = estatus;
    await existente.save();
    entrega = existente;
  } else {
    entrega = await EntregaTarea.create({
      id_tarea: idTarea,
      id_alumno: req.user.id_usuario,
      archivo_entrega_url,
      fecha_entrega: ahora,
      estatus,
    });
  }

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: existente ? 'actualizar_entrega_tarea' : 'crear_entrega_tarea',
    modulo: 'alumnos',
    entidad: 'entregas_tareas',
    idEntidad: entrega.id_entrega,
    detalle: {
      id_tarea: idTarea,
      id_materia: tarea.id_materia,
      grupo: inscripcion.grupo,
      estatus,
    },
  });

  return res.status(existente ? 200 : 201).json(entrega);
}

async function listarTramites(req, res) {
  const items = await TramiteSolicitud.findAll({
    where: { id_alumno: req.user.id_usuario },
    include: [{ model: Usuario, as: 'resolutor', attributes: ['id_usuario', 'nombre_completo', 'rol'] }],
    order: [['fecha_solicitud', 'DESC'], ['id_tramite', 'DESC']],
  });

  return res.json({ items });
}

async function crearTramite(req, res) {
  const tipo = normalizeText(req.body.tipo);
  const descripcion = normalizeText(req.body.descripcion);

  if (!TRAMITE_TIPOS.includes(tipo)) {
    return res.status(400).json({ message: 'El tipo de tramite no es valido.' });
  }

  if (!descripcion) {
    return res.status(400).json({ message: 'La descripcion del tramite es obligatoria.' });
  }

  const tramite = await TramiteSolicitud.create({
    id_alumno: req.user.id_usuario,
    tipo,
    descripcion,
    adjunto_url: normalizeText(req.body.adjunto_url) || null,
    estatus: 'recibido',
    fecha_solicitud: new Date(),
  });

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'crear_tramite',
    modulo: 'alumnos',
    entidad: 'tramites_solicitudes',
    idEntidad: tramite.id_tramite,
    detalle: {
      tipo: tramite.tipo,
      estatus: tramite.estatus,
    },
  });

  return res.status(201).json(tramite);
}

module.exports = {
  dashboard,
  horarios,
  tareas,
  calificaciones,
  asistencias,
  pagos,
  subirComprobantePago,
  materiales,
  portafolio,
  meritos,
  alertas,
  videoClases,
  planEstudio,
  entregarTarea,
  listarTramites,
  crearTramite,
};
