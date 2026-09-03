const { Op } = require('sequelize');
const path = require('path');
const ExcelJS = require('exceljs');
const {
  AlumnoPerfil,
  AlumnoGrupo,
  Usuario,
  PagoEstatus,
  ConceptoPago,
  TramiteSolicitud,
  PortafolioEvidencia,
  NotificacionAlumno,
  Materia,
  ProgramaAcademico,
  EntregaTarea,
  Tarea,
  EvaluacionExtraordinaria,
  AsistenciaDocente,
  ConfiguracionInstitucional,
} = require('../../models');

const TRAMITES_ESCOLARES = ['constancia', 'credencial', 'uniforme', 'papeleria_oficial'];
const TRAMITE_STATUS_PERMITIDOS = new Set(['en_proceso', 'listo_para_entrega', 'entregado', 'cancelado']);
const ESTATUS_FINANCIERO_PERMITIDO = new Set(['al_dia', 'deudor', 'suspendido']);
const CONCEPTO_EXTRAORDINARIO_MATCH = /extraordinario/i;
const CLAVE_BIBLIOTECA_VIRTUAL = 'biblioteca_virtual_url';
const CLAVE_MANUAL_SERVICIO_SOCIAL = 'manual_servicio_social_url';
const MODALIDADES_BOLETA_PERMITIDAS = new Set(['ONLINE', 'PRESENCIAL', 'MIXTA']);

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function esConceptoExtraordinario(concepto) {
  return CONCEPTO_EXTRAORDINARIO_MATCH.test(String(concepto?.nombre || ''));
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

function sanitizeFilenamePart(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function comprobantesPendientes(_req, res) {
  const comprobantes = await TramiteSolicitud.findAll({
    where: {
      tipo: 'comprobante_pago',
      estatus: { [Op.in]: ['recibido', 'en_revision'] },
    },
    include: [
      {
        model: AlumnoPerfil,
        as: 'alumno',
        include: [{
          model: Usuario,
          as: 'usuario',
          attributes: ['id_usuario', 'folio_matricula', 'nombre_completo', 'correo'],
        }],
      },
    ],
    order: [['fecha_solicitud', 'DESC'], ['id_tramite', 'DESC']],
    limit: 500,
  });

  const alumnoIds = comprobantes.map((item) => item.id_alumno);
  const pagosPendientes = alumnoIds.length > 0
    ? await PagoEstatus.findAll({
      where: {
        id_alumno: { [Op.in]: alumnoIds },
        estatus: { [Op.in]: ['pendiente', 'vencido'] },
      },
      include: [{
        model: ConceptoPago,
        as: 'concepto_pago',
        attributes: ['id_concepto_pago', 'nombre'],
      }],
      order: [['fecha_limite', 'DESC'], ['id_pago', 'DESC']],
    })
    : [];

  const pagoPorAlumno = new Map();
  pagosPendientes.forEach((pago) => {
    if (!pagoPorAlumno.has(pago.id_alumno)) {
      pagoPorAlumno.set(pago.id_alumno, pago);
    }
  });

  const items = comprobantes.map((item) => {
    const pago = pagoPorAlumno.get(item.id_alumno);
    return {
      id_tramite: item.id_tramite,
      id_alumno: item.id_alumno,
      folio_matricula: item.alumno?.usuario?.folio_matricula || null,
      alumno_nombre: item.alumno?.usuario?.nombre_completo || null,
      comprobante_url: item.adjunto_url,
      descripcion: item.descripcion,
      estatus_tramite: item.estatus,
      fecha_solicitud: item.fecha_solicitud,
      pago_relacionado: pago
        ? {
          id_pago: pago.id_pago,
          monto: Number(pago.monto),
          concepto: pago.concepto_pago?.nombre || pago.concepto,
          folio_interno: pago.folio_interno,
        }
        : null,
    };
  });

  return res.json({ items });
}

async function conceptosActivos(_req, res) {
  const items = await ConceptoPago.findAll({
    where: { activo: true },
    attributes: ['id_concepto_pago', 'clave', 'nombre', 'categoria', 'folio_interno'],
    order: [['nombre', 'ASC']],
    limit: 500,
  });

  return res.json({ items });
}

async function registrarCobroCaja(req, res) {
  const idAlumno = toNumber(req.body.alumno_id);
  const idConceptoPago = toNumber(req.body.concepto_folio_id);
  const referenciaCaja = normalizeText(req.body.referencia_caja);
  const montoRecibido = toNumber(req.body.monto_recibido);
  const metodoPago = normalizeText(req.body.metodo_pago);

  if (!Number.isInteger(idAlumno)) {
    return res.status(400).json({ message: 'alumno_id invalido.' });
  }
  if (!Number.isInteger(idConceptoPago)) {
    return res.status(400).json({ message: 'concepto_folio_id invalido.' });
  }
  if (!referenciaCaja) {
    return res.status(400).json({ message: 'referencia_caja es obligatoria.' });
  }
  if (!Number.isFinite(montoRecibido) || montoRecibido <= 0) {
    return res.status(400).json({ message: 'monto_recibido debe ser mayor a 0.' });
  }

  const [alumno, concepto] = await Promise.all([
    AlumnoPerfil.findByPk(idAlumno, {
      include: [{
        model: Usuario,
        as: 'usuario',
        attributes: ['id_usuario', 'folio_matricula', 'nombre_completo'],
      }],
    }),
    ConceptoPago.findOne({
      where: { id_concepto_pago: idConceptoPago, activo: true },
    }),
  ]);

  if (!alumno) {
    return res.status(404).json({ message: 'Alumno no encontrado.' });
  }
  if (!concepto) {
    return res.status(404).json({ message: 'Concepto de pago activo no encontrado.' });
  }

  const esExtraordinario = esConceptoExtraordinario(concepto);
  const comentariosExtra = esExtraordinario ? normalizeText(req.body.comentarios) : null;
  const enlaceClassroom = esExtraordinario ? normalizeText(req.body.enlace_classroom) : null;

  if (enlaceClassroom && !esUrlValida(enlaceClassroom)) {
    return res.status(400).json({ message: 'enlace_classroom debe ser una URL valida.' });
  }

  const observacionesPartes = [metodoPago ? `Cobro en caja (${metodoPago}).` : 'Cobro en caja.'];
  if (comentariosExtra) observacionesPartes.push(`Comentarios: ${comentariosExtra}`);
  if (enlaceClassroom) observacionesPartes.push(`Google Classroom: ${enlaceClassroom}`);

  const pago = await PagoEstatus.create({
    id_alumno: idAlumno,
    id_concepto_pago: idConceptoPago,
    concepto: concepto.nombre,
    monto: montoRecibido,
    fecha_limite: new Date(),
    estatus: 'pagado',
    fecha_pago: new Date(),
    folio_interno: referenciaCaja,
    observaciones: observacionesPartes.join(' '),
  });

  if (esExtraordinario) {
    const detallePartes = [`Se registro tu pago de ${concepto.nombre}.`];
    if (comentariosExtra) detallePartes.push(`Observaciones: ${comentariosExtra}`);
    if (enlaceClassroom) detallePartes.push(`Enlace de Google Classroom: ${enlaceClassroom}`);

    await NotificacionAlumno.create({
      id_alumno: idAlumno,
      tipo: 'examen_extraordinario',
      titulo: 'Registro de Examen Extraordinario',
      detalle: detallePartes.join(' '),
      fecha: new Date(),
    });
  }

  return res.status(201).json({
    id_pago: pago.id_pago,
    id_alumno: pago.id_alumno,
    alumno: alumno.usuario?.nombre_completo || null,
    folio_matricula: alumno.usuario?.folio_matricula || null,
    concepto: pago.concepto,
    monto: Number(pago.monto),
    metodo_pago: metodoPago,
    referencia_caja: pago.folio_interno,
    estatus: pago.estatus,
    fecha_pago: pago.fecha_pago,
    comentarios: comentariosExtra,
    enlace_classroom: enlaceClassroom,
  });
}

async function validarComprobante(req, res) {
  const idPago = toNumber(req.params.pagoId);
  const decision = String(req.body.decision || '').trim().toLowerCase();
  const motivo = String(req.body.motivo || '').trim();
  const idTramiteBody = req.body.id_tramite;

  if (!Number.isInteger(idPago)) {
    return res.status(400).json({ message: 'pagoId invalido.' });
  }
  if (!['aprobar', 'rechazar'].includes(decision)) {
    return res.status(400).json({ message: "decision invalida. Usa 'aprobar' o 'rechazar'." });
  }
  if (decision === 'rechazar' && motivo.length < 8) {
    return res.status(400).json({ message: 'motivo es obligatorio y debe tener al menos 8 caracteres.' });
  }

  const pago = await PagoEstatus.findByPk(idPago);
  if (!pago) {
    return res.status(404).json({ message: 'Pago no encontrado.' });
  }

  let tramite = null;
  if (idTramiteBody !== undefined && idTramiteBody !== null) {
    const idTramite = toNumber(idTramiteBody);
    if (!Number.isInteger(idTramite)) {
      return res.status(400).json({ message: 'id_tramite invalido.' });
    }
    tramite = await TramiteSolicitud.findByPk(idTramite);
    if (!tramite || tramite.tipo !== 'comprobante_pago') {
      return res.status(404).json({ message: 'Comprobante de tramite no encontrado para el pago.' });
    }
  } else {
    tramite = await TramiteSolicitud.findOne({
      where: {
        id_alumno: pago.id_alumno,
        tipo: 'comprobante_pago',
        estatus: { [Op.in]: ['recibido', 'en_revision'] },
      },
      order: [['fecha_solicitud', 'DESC'], ['id_tramite', 'DESC']],
    });
  }

  if (decision === 'aprobar') {
    pago.estatus = 'pagado';
    pago.fecha_pago = new Date();
    pago.observaciones = pago.observaciones || 'Comprobante validado por control escolar.';
    await pago.save();

    if (tramite) {
      tramite.estatus = 'resuelto';
      tramite.respuesta = 'Comprobante aprobado. Pago aplicado correctamente.';
      tramite.fecha_resolucion = new Date();
      tramite.resuelto_por = req.user.id_usuario;
      await tramite.save();
    }

    return res.json({
      id_pago: pago.id_pago,
      decision,
      estatus_pago: pago.estatus,
      tramite_actualizado: tramite ? tramite.id_tramite : null,
    });
  }

  pago.estatus = 'pendiente';
  pago.fecha_pago = null;
  pago.observaciones = `Comprobante rechazado: ${motivo}`;
  await pago.save();

  if (tramite) {
    tramite.estatus = 'rechazado';
    tramite.respuesta = motivo;
    tramite.fecha_resolucion = new Date();
    tramite.resuelto_por = req.user.id_usuario;
    await tramite.save();
  }

  return res.json({
    id_pago: pago.id_pago,
    decision,
    motivo,
    estatus_pago: pago.estatus,
    tramite_actualizado: tramite ? tramite.id_tramite : null,
    notificacion_alumno: motivo,
  });
}

async function alumnosEstatus(req, res) {
  const q = String(req.query.q || '').trim().toLowerCase();
  const estatusFiltro = String(req.query.estatus || '').trim().toLowerCase();

  const perfiles = await AlumnoPerfil.findAll({
    include: [{
      model: Usuario,
      as: 'usuario',
      attributes: ['id_usuario', 'folio_matricula', 'nombre_completo', 'correo'],
    }],
    order: [['id_alumno', 'ASC']],
    limit: 1000,
  });

  const filtered = perfiles
    .map((perfil) => ({
      id_alumno: perfil.id_alumno,
      folio_matricula: perfil.usuario?.folio_matricula || null,
      nombre_completo: perfil.usuario?.nombre_completo || null,
      correo: perfil.usuario?.correo || null,
      estatus_financiero: perfil.estatus_financiero || 'al_dia',
      bloqueo_plataforma: Boolean(perfil.bloqueo_plataforma),
      bloqueo_calificaciones: Boolean(perfil.bloqueo_calificaciones),
      modalidad_boleta: perfil.modalidad_boleta || 'ONLINE',
      campus_boleta: perfil.campus_boleta || 'UNICEP MERIDA',
    }))
    .filter((item) => {
      const matchesQ = !q
        || String(item.nombre_completo || '').toLowerCase().includes(q)
        || String(item.folio_matricula || '').toLowerCase().includes(q)
        || String(item.correo || '').toLowerCase().includes(q);
      const matchesEstatus = !estatusFiltro || item.estatus_financiero === estatusFiltro;
      return matchesQ && matchesEstatus;
    });

  return res.json({ items: filtered });
}

async function actualizarAccesosAlumno(req, res) {
  const idAlumno = toNumber(req.params.alumnoId);
  if (!Number.isInteger(idAlumno)) {
    return res.status(400).json({ message: 'alumnoId invalido.' });
  }

  const alumno = await AlumnoPerfil.findByPk(idAlumno);
  if (!alumno) {
    return res.status(404).json({ message: 'Alumno no encontrado.' });
  }

  const cambios = {};

  if (Object.prototype.hasOwnProperty.call(req.body, 'bloqueo_plataforma')) {
    cambios.bloqueo_plataforma = Boolean(req.body.bloqueo_plataforma);
    alumno.bloqueo_plataforma = cambios.bloqueo_plataforma;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'bloqueo_calificaciones')) {
    cambios.bloqueo_calificaciones = Boolean(req.body.bloqueo_calificaciones);
    alumno.bloqueo_calificaciones = cambios.bloqueo_calificaciones;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'estatus_financiero')) {
    const estatus = String(req.body.estatus_financiero || '').trim().toLowerCase();
    if (!ESTATUS_FINANCIERO_PERMITIDO.has(estatus)) {
      return res.status(400).json({ message: 'estatus_financiero invalido. Usa: al_dia, deudor, suspendido.' });
    }
    cambios.estatus_financiero = estatus;
    alumno.estatus_financiero = estatus;
  }

  if (Object.keys(cambios).length === 0) {
    return res.status(400).json({ message: 'No hay cambios de acceso para aplicar.' });
  }

  await alumno.save();

  return res.json({
    id_alumno: alumno.id_alumno,
    estatus_financiero: alumno.estatus_financiero,
    bloqueo_plataforma: Boolean(alumno.bloqueo_plataforma),
    bloqueo_calificaciones: Boolean(alumno.bloqueo_calificaciones),
  });
}

async function actualizarConfiguracionBoletaAlumno(req, res) {
  const idAlumno = toNumber(req.params.alumnoId);
  if (!Number.isInteger(idAlumno)) {
    return res.status(400).json({ message: 'alumnoId invalido.' });
  }

  const alumno = await AlumnoPerfil.findByPk(idAlumno);
  if (!alumno) {
    return res.status(404).json({ message: 'Alumno no encontrado.' });
  }

  const modalidadRaw = req.body.modalidad_boleta;
  const campusRaw = req.body.campus_boleta;
  const cambios = {};

  if (modalidadRaw !== undefined) {
    const modalidad = String(modalidadRaw || '').trim().toUpperCase();
    if (!MODALIDADES_BOLETA_PERMITIDAS.has(modalidad)) {
      return res.status(400).json({ message: 'modalidad_boleta invalida. Usa: ONLINE, PRESENCIAL, MIXTA.' });
    }
    alumno.modalidad_boleta = modalidad;
    cambios.modalidad_boleta = modalidad;
  }

  if (campusRaw !== undefined) {
    const campus = normalizeText(campusRaw);
    if (!campus) {
      return res.status(400).json({ message: 'campus_boleta no puede ser vacio.' });
    }
    if (campus.length > 120) {
      return res.status(400).json({ message: 'campus_boleta excede 120 caracteres.' });
    }
    alumno.campus_boleta = campus;
    cambios.campus_boleta = campus;
  }

  if (Object.keys(cambios).length === 0) {
    return res.status(400).json({ message: 'No hay cambios para aplicar en la boleta.' });
  }

  await alumno.save();

  return res.json({
    id_alumno: alumno.id_alumno,
    modalidad_boleta: alumno.modalidad_boleta,
    campus_boleta: alumno.campus_boleta,
  });
}

async function portafolioAlumno(req, res) {
  const idAlumno = toNumber(req.params.alumnoId);
  if (!Number.isInteger(idAlumno)) {
    return res.status(400).json({ message: 'alumnoId invalido.' });
  }

  const alumno = await AlumnoPerfil.findByPk(idAlumno, {
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
    where: { id_alumno: idAlumno },
    include: [{ model: Materia, as: 'materia', attributes: ['id_materia', 'nombre_materia'], required: false }],
    order: [['id_evidencia', 'DESC']],
    limit: 200,
  });

  return res.json({
    alumno: {
      id_alumno: alumno.id_alumno,
      folio_matricula: alumno.usuario?.folio_matricula || null,
      nombre_completo: alumno.usuario?.nombre_completo || null,
      correo: alumno.usuario?.correo || null,
      drive_folder_url: alumno.drive_folder_url || null,
    },
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

async function actualizarDriveFolder(req, res) {
  const idAlumno = toNumber(req.params.alumnoId);
  if (!Number.isInteger(idAlumno)) {
    return res.status(400).json({ message: 'alumnoId invalido.' });
  }

  const driveFolderUrl = normalizeText(req.body.drive_folder_url);
  if (driveFolderUrl && !esUrlValida(driveFolderUrl)) {
    return res.status(400).json({ message: 'drive_folder_url debe ser una URL valida.' });
  }

  const alumno = await AlumnoPerfil.findByPk(idAlumno);
  if (!alumno) {
    return res.status(404).json({ message: 'Alumno no encontrado.' });
  }

  alumno.drive_folder_url = driveFolderUrl;
  await alumno.save();

  return res.json({ id_alumno: alumno.id_alumno, drive_folder_url: alumno.drive_folder_url });
}

async function subirArchivoPortafolio(req, res) {
  const idAlumno = toNumber(req.params.alumnoId);
  if (!Number.isInteger(idAlumno)) {
    return res.status(400).json({ message: 'alumnoId invalido.' });
  }
  if (!req.file) {
    return res.status(400).json({ message: 'Selecciona un archivo para subir.' });
  }

  const alumno = await AlumnoPerfil.findByPk(idAlumno);
  if (!alumno) {
    return res.status(404).json({ message: 'Alumno no encontrado.' });
  }

  const evidencia = await PortafolioEvidencia.create({
    id_alumno: idAlumno,
    archivo_url: `/uploads/portafolio/${req.file.filename}`,
    nombre_archivo: req.file.originalname,
    origen: 'control_escolar',
    id_subido_por: req.user.id_usuario,
    fecha_creacion: new Date(),
  });

  return res.status(201).json({
    id_evidencia: evidencia.id_evidencia,
    archivo_url: evidencia.archivo_url,
    nombre_archivo: evidencia.nombre_archivo,
  });
}

async function descargarBoletaAlumno(req, res) {
  const idAlumno = toNumber(req.params.alumnoId);
  if (!Number.isInteger(idAlumno)) {
    return res.status(400).json({ message: 'alumnoId invalido.' });
  }

  const alumno = await AlumnoPerfil.findByPk(idAlumno, {
    include: [
      {
        model: Usuario,
        as: 'usuario',
        attributes: ['id_usuario', 'folio_matricula', 'nombre_completo', 'correo', 'curp'],
      },
      {
        model: AlumnoGrupo,
        as: 'grupos',
        required: false,
        include: [{
          model: Materia,
          as: 'materia',
          required: false,
          include: [{
            model: ProgramaAcademico,
            as: 'programa_academico',
            required: false,
            attributes: ['id', 'nombre'],
          }],
        }],
      },
    ],
  });

  if (!alumno) {
    return res.status(404).json({ message: 'Alumno no encontrado.' });
  }

  const cuatrimestreActual = Number(alumno.bimestre_actual) || 1;
  const gruposCuatrimestre = (alumno.grupos || []).filter((grupo) => {
    const bimestreMateria = Number(grupo?.materia?.bimestre_pertenece);
    return !Number.isInteger(bimestreMateria) || bimestreMateria === cuatrimestreActual;
  });

  const materiasMap = new Map();
  gruposCuatrimestre.forEach((grupo) => {
    const materia = grupo?.materia;
    if (!materia) return;

    const idMateria = Number(materia.id_materia);
    if (!Number.isInteger(idMateria) || materiasMap.has(idMateria)) return;

    materiasMap.set(idMateria, {
      id_materia: idMateria,
      nombre: materia.nombre_materia,
      grupo: grupo.grupo,
      programa_nombre: materia.programa_academico?.nombre || materia.carrera || null,
    });
  });

  const materiasInscritas = [...materiasMap.values()];
  const materiaIds = materiasInscritas.map((item) => item.id_materia);

  const [entregasCalificadas, evidenciasPortafolio, extraordinarios, asistencias] = await Promise.all([
    materiaIds.length > 0
      ? EntregaTarea.findAll({
        where: {
          id_alumno: idAlumno,
          estatus: 'calificada',
          calificacion: { [Op.not]: null },
        },
        include: [{
          model: Tarea,
          as: 'tarea',
          required: true,
          include: [{
            model: Materia,
            as: 'materia',
            required: true,
            where: { id_materia: { [Op.in]: materiaIds } },
            attributes: ['id_materia', 'nombre_materia'],
          }],
          attributes: ['id_tarea', 'id_materia'],
        }],
      })
      : Promise.resolve([]),
    materiaIds.length > 0
      ? PortafolioEvidencia.findAll({
        where: {
          id_alumno: idAlumno,
          id_materia: { [Op.in]: materiaIds },
        },
        attributes: ['id_materia'],
      })
      : Promise.resolve([]),
    materiaIds.length > 0
      ? EvaluacionExtraordinaria.findAll({
        where: {
          id_alumno: idAlumno,
          id_materia: { [Op.in]: materiaIds },
          calificacion_final: { [Op.not]: null },
        },
        order: [['fecha_programada', 'DESC'], ['id_evaluacion', 'DESC']],
        limit: 3,
      })
      : Promise.resolve([]),
    materiaIds.length > 0
      ? AsistenciaDocente.findAll({
        where: {
          id_alumno: idAlumno,
          id_materia: { [Op.in]: materiaIds },
        },
        attributes: ['id_materia', 'estatus_asistencia'],
      })
      : Promise.resolve([]),
  ]);

  const finalesByMateria = new Map();
  entregasCalificadas.forEach((entrega) => {
    const idMateria = Number(entrega?.tarea?.materia?.id_materia);
    if (!Number.isInteger(idMateria)) return;

    const base = finalesByMateria.get(idMateria) || { suma: 0, total: 0 };
    base.suma += Number(entrega.calificacion || 0);
    base.total += 1;
    finalesByMateria.set(idMateria, base);
  });

  const portafolioMateriasSet = new Set(
    evidenciasPortafolio
      .map((item) => Number(item.id_materia))
      .filter(Number.isInteger),
  );

  const asistenciaByMateria = new Map();
  asistencias.forEach((item) => {
    const idMateria = Number(item.id_materia);
    if (!Number.isInteger(idMateria)) return;

    const base = asistenciaByMateria.get(idMateria) || { total: 0, validas: 0 };
    base.total += 1;
    if (item.estatus_asistencia === 'presente' || item.estatus_asistencia === 'justificado') {
      base.validas += 1;
    }
    asistenciaByMateria.set(idMateria, base);
  });

  const materiasParaBoleta = materiasInscritas.map((materia) => {
    const statsFinal = finalesByMateria.get(materia.id_materia);
    const final = statsFinal && statsFinal.total > 0
      ? Number((statsFinal.suma / statsFinal.total).toFixed(2))
      : null;

    return {
      ...materia,
      final,
      entrego_portafolio: portafolioMateriasSet.has(materia.id_materia),
    };
  });

  const promedioFinalCuatrimestre = materiasParaBoleta.length > 0
    ? Number((
      materiasParaBoleta.reduce((acc, item) => acc + Number(item.final || 0), 0)
      / materiasParaBoleta.length
    ).toFixed(2))
    : 0;

  const derechoExamenAsistencia = materiasParaBoleta.length > 0
    && materiasParaBoleta.every((materia) => {
      const stats = asistenciaByMateria.get(materia.id_materia);
      if (!stats || stats.total <= 0) return false;
      return ((stats.validas / stats.total) * 100) >= 80;
    });

  const derechoExamenPortafolio = materiasParaBoleta.length > 0
    && materiasParaBoleta.every((materia) => materia.entrego_portafolio);

  const workbook = new ExcelJS.Workbook();
  const templatePath = path.join(__dirname, '../templates/boleta_template.xlsx');
  await workbook.xlsx.readFile(templatePath);

  const worksheet = workbook.getWorksheet('BOLETA');
  if (!worksheet) {
    return res.status(500).json({ message: "No existe la hoja 'BOLETA' en la plantilla." });
  }

  const programaNombre = materiasParaBoleta.find((item) => item.programa_nombre)?.programa_nombre
    || alumno.carrera
    || 'PSICOLOGIA';
  const grupoAlumno = materiasParaBoleta[0]?.grupo || gruposCuatrimestre[0]?.grupo || '-';
  const modalidadBoleta = alumno.modalidad_boleta || 'ONLINE';
  const campusBoleta = alumno.campus_boleta || 'UNICEP MERIDA';

  worksheet.getCell('C3').value = `${cuatrimestreActual}o. CUATRIMESTRE DE ${programaNombre}\nCICLO ESCOLAR 2025-2026`;
  worksheet.getCell('O4').value = cuatrimestreActual;

  worksheet.getCell('F5').value = alumno.usuario?.nombre_completo || `Alumno ${alumno.id_alumno}`;
  worksheet.getCell('M5').value = alumno.usuario?.curp || '-';
  worksheet.getCell('E7').value = campusBoleta;
  worksheet.getCell('K7').value = modalidadBoleta;
  worksheet.getCell('O7').value = grupoAlumno;

  const columnasMaterias = ['D', 'E', 'F', 'G', 'H'];
  materiasParaBoleta.forEach((materia, index) => {
    if (index >= columnasMaterias.length) return;
    const col = columnasMaterias[index];
    worksheet.getCell(`${col}9`).value = materia.nombre || '-';
    worksheet.getCell(`${col}11`).value = materia.final ?? '-';
    worksheet.getCell(`${col}14`).value = materia.entrego_portafolio ? 'Si' : 'No';
  });

  worksheet.getCell('D12').value = promedioFinalCuatrimestre;
  worksheet.getCell('N9').value = derechoExamenAsistencia ? 'Si' : 'No';
  worksheet.getCell('N10').value = derechoExamenPortafolio ? 'Si' : 'No';

  extraordinarios.forEach((extra, idx) => {
    if (idx === 0) worksheet.getCell('M12').value = Number(extra.calificacion_final);
    if (idx === 1) worksheet.getCell('M13').value = Number(extra.calificacion_final);
    if (idx === 2) worksheet.getCell('M14').value = Number(extra.calificacion_final);
  });

  const fileId = sanitizeFilenamePart(alumno.usuario?.folio_matricula || alumno.usuario?.curp || `alumno_${alumno.id_alumno}`) || `alumno_${alumno.id_alumno}`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="Boleta_${fileId}.xlsx"`);
  await workbook.xlsx.write(res);
  return res.end();
}

async function listarTramites(req, res) {
  const estatus = String(req.query.estatus || '').trim().toLowerCase();
  const where = {
    tipo: { [Op.in]: TRAMITES_ESCOLARES },
  };

  if (estatus) {
    where.estatus = estatus;
  }

  const items = await TramiteSolicitud.findAll({
    where,
    include: [
      {
        model: AlumnoPerfil,
        as: 'alumno',
        include: [{
          model: Usuario,
          as: 'usuario',
          attributes: ['id_usuario', 'folio_matricula', 'nombre_completo', 'correo'],
        }],
      },
      {
        model: Usuario,
        as: 'resolutor',
        attributes: ['id_usuario', 'nombre_completo', 'rol'],
      },
    ],
    order: [['fecha_solicitud', 'DESC'], ['id_tramite', 'DESC']],
    limit: 500,
  });

  return res.json({ items });
}

async function actualizarEstatusTramite(req, res) {
  const idTramite = toNumber(req.params.tramiteId);
  const estatus = String(req.body.estatus || '').trim().toLowerCase();
  const notasEntrega = normalizeText(req.body.notas_entrega);

  if (!Number.isInteger(idTramite)) {
    return res.status(400).json({ message: 'tramiteId invalido.' });
  }
  if (!TRAMITE_STATUS_PERMITIDOS.has(estatus)) {
    return res.status(400).json({ message: 'Estatus invalido. Usa: en_proceso, listo_para_entrega, entregado, cancelado.' });
  }

  const tramite = await TramiteSolicitud.findByPk(idTramite);
  if (!tramite) {
    return res.status(404).json({ message: 'Tramite no encontrado.' });
  }

  if (!TRAMITES_ESCOLARES.includes(tramite.tipo)) {
    return res.status(400).json({ message: 'Este tipo de tramite no corresponde a control escolar.' });
  }

  tramite.estatus = estatus;
  tramite.respuesta = notasEntrega;
  tramite.fecha_resolucion = new Date();
  tramite.resuelto_por = req.user.id_usuario;
  await tramite.save();

  return res.json({
    id_tramite: tramite.id_tramite,
    estatus: tramite.estatus,
    notas_entrega: tramite.respuesta,
    fecha_resolucion: tramite.fecha_resolucion,
  });
}

async function obtenerRecursosInstitucionales(_req, res) {
  const filas = await ConfiguracionInstitucional.findAll({
    where: { clave: { [Op.in]: [CLAVE_BIBLIOTECA_VIRTUAL, CLAVE_MANUAL_SERVICIO_SOCIAL] } },
  });

  const valores = new Map(filas.map((item) => [item.clave, item.valor]));

  return res.json({
    biblioteca_virtual_url: valores.get(CLAVE_BIBLIOTECA_VIRTUAL) || null,
    manual_servicio_social_url: valores.get(CLAVE_MANUAL_SERVICIO_SOCIAL) || null,
  });
}

async function actualizarBibliotecaVirtual(req, res) {
  const bibliotecaVirtualUrl = normalizeText(req.body.biblioteca_virtual_url);
  if (!bibliotecaVirtualUrl || !esUrlValida(bibliotecaVirtualUrl)) {
    return res.status(400).json({ message: 'biblioteca_virtual_url debe ser una URL valida.' });
  }

  const [registro] = await ConfiguracionInstitucional.findOrCreate({
    where: { clave: CLAVE_BIBLIOTECA_VIRTUAL },
    defaults: { valor: bibliotecaVirtualUrl, fecha_actualizacion: new Date(), id_actualizado_por: req.user.id_usuario },
  });

  registro.valor = bibliotecaVirtualUrl;
  registro.fecha_actualizacion = new Date();
  registro.id_actualizado_por = req.user.id_usuario;
  await registro.save();

  return res.json({ biblioteca_virtual_url: registro.valor });
}

async function subirManualServicioSocial(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: 'Selecciona un archivo PDF para el manual.' });
  }

  const manualUrl = `/uploads/institucional/${req.file.filename}`;

  const [registro] = await ConfiguracionInstitucional.findOrCreate({
    where: { clave: CLAVE_MANUAL_SERVICIO_SOCIAL },
    defaults: { valor: manualUrl, fecha_actualizacion: new Date(), id_actualizado_por: req.user.id_usuario },
  });

  registro.valor = manualUrl;
  registro.fecha_actualizacion = new Date();
  registro.id_actualizado_por = req.user.id_usuario;
  await registro.save();

  return res.status(201).json({ manual_servicio_social_url: registro.valor });
}

module.exports = {
  conceptosActivos,
  comprobantesPendientes,
  registrarCobroCaja,
  validarComprobante,
  alumnosEstatus,
  actualizarAccesosAlumno,
  actualizarConfiguracionBoletaAlumno,
  descargarBoletaAlumno,
  portafolioAlumno,
  actualizarDriveFolder,
  subirArchivoPortafolio,
  listarTramites,
  actualizarEstatusTramite,
  obtenerRecursosInstitucionales,
  actualizarBibliotecaVirtual,
  subirManualServicioSocial,
};
