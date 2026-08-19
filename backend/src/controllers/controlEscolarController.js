const { Op } = require('sequelize');
const {
  AlumnoPerfil,
  Usuario,
  PagoEstatus,
  ConceptoPago,
  TramiteSolicitud,
} = require('../../models');

const TRAMITES_ESCOLARES = ['constancia', 'credencial', 'uniforme', 'papeleria_oficial'];
const TRAMITE_STATUS_PERMITIDOS = new Set(['en_proceso', 'listo_para_entrega', 'entregado', 'cancelado']);
const ESTATUS_FINANCIERO_PERMITIDO = new Set(['al_dia', 'deudor', 'suspendido']);

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeText(value) {
  const text = String(value || '').trim();
  return text || null;
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

  const pago = await PagoEstatus.create({
    id_alumno: idAlumno,
    id_concepto_pago: idConceptoPago,
    concepto: concepto.nombre,
    monto: montoRecibido,
    fecha_limite: new Date(),
    estatus: 'pagado',
    fecha_pago: new Date(),
    folio_interno: referenciaCaja,
    observaciones: metodoPago ? `Cobro en caja (${metodoPago}).` : 'Cobro en caja.',
  });

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

module.exports = {
  conceptosActivos,
  comprobantesPendientes,
  registrarCobroCaja,
  validarComprobante,
  alumnosEstatus,
  actualizarAccesosAlumno,
  listarTramites,
  actualizarEstatusTramite,
};
