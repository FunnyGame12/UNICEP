'use strict';

const { Op } = require('sequelize');
const {
  AlumnoPerfil,
  ConceptoPago,
  DesbloqueoManual,
  PagoEstatus,
  ReglaDesbloqueo,
} = require('../../models');

const SERVICE_KEYS = [
  'mensualidad',
  'inscripcion',
  'acceso_clases',
  'acceso_calificaciones',
  'acceso_material',
];

const SERVICE_LABELS = {
  mensualidad: 'Mensualidad',
  inscripcion: 'Inscripción',
  acceso_clases: 'Acceso a clases',
  acceso_calificaciones: 'Acceso a calificaciones',
  acceso_material: 'Acceso a material',
};

function toNumber(value) {
  return Number.parseFloat(value || 0);
}

function buildPaymentSummary(pagos = []) {
  const totalPagado = pagos
    .filter((pago) => pago.estatus === 'pagado')
    .reduce((acc, pago) => acc + toNumber(pago.monto), 0);

  const totalPendiente = pagos
    .filter((pago) => pago.estatus !== 'pagado')
    .reduce((acc, pago) => acc + toNumber(pago.monto), 0);

  const periodoActivo = pagos[0]?.fecha_limite || null;
  const estadoGeneral = pagos.some((pago) => pago.estatus === 'vencido')
    ? 'adeudo'
    : totalPendiente > 0
      ? 'pendiente'
      : 'al_corriente';

  return {
    estado_general: estadoGeneral,
    periodo_activo: periodoActivo,
    total_pagado: totalPagado,
    adeudo_pendiente: totalPendiente,
  };
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function matchesCareer(ruleCareer, alumnoCareer) {
  if (!ruleCareer) {
    return true;
  }

  return normalizeText(ruleCareer) === normalizeText(alumnoCareer);
}

function isManualUnlockActive(unlock, now = new Date()) {
  if (!unlock || !unlock.activo) {
    return false;
  }

  const start = unlock.fecha_inicio ? new Date(unlock.fecha_inicio) : null;
  const end = unlock.fecha_fin ? new Date(unlock.fecha_fin) : null;

  if (start && start > now) {
    return false;
  }

  if (end && end < now) {
    return false;
  }

  return true;
}

function paymentMatchesRule(pago, regla) {
  if (pago.estatus !== 'pagado') {
    return false;
  }

  if (regla.id_concepto_pago && pago.id_concepto_pago === regla.id_concepto_pago) {
    return true;
  }

  if (regla.concepto_requerido) {
    return normalizeText(pago.concepto) === normalizeText(regla.concepto_requerido);
  }

  if (regla.id_concepto_pago) {
    return false;
  }

  return true;
}

function evaluateRule({ regla, pagos, overduePayments }) {
  if (regla.tipo_condicion === 'sin_adeudo_vencido') {
    return {
      cumplida: overduePayments.length === 0,
      detalle: overduePayments.length === 0
        ? 'No hay adeudos vencidos.'
        : `Existe ${overduePayments.length} adeudo(s) vencido(s).`,
    };
  }

  if (regla.tipo_condicion === 'concepto_pagado') {
    const matchedPayment = pagos.find((pago) => paymentMatchesRule(pago, regla));
    return {
      cumplida: Boolean(matchedPayment),
      detalle: matchedPayment
        ? `Concepto cubierto: ${matchedPayment.concepto}.`
        : `Falta cubrir el concepto requerido${regla.concepto_requerido ? `: ${regla.concepto_requerido}` : ''}.`,
    };
  }

  return {
    cumplida: false,
    detalle: 'Regla no reconocida.',
  };
}

function resolveServiceStatuses({ alumno, pagos, reglas, desbloqueos }) {
  const overduePayments = pagos.filter((pago) => pago.estatus === 'vencido');

  return SERVICE_KEYS.reduce((acc, serviceKey) => {
    const manualUnlock = desbloqueos.find(
      (unlock) => unlock.servicio === serviceKey && isManualUnlockActive(unlock),
    );

    const applicableRules = reglas.filter(
      (regla) => regla.servicio === serviceKey && regla.activo && matchesCareer(regla.carrera_objetivo, alumno?.carrera),
    );

    const evaluatedRules = applicableRules.map((regla) => ({
      id_regla: regla.id_regla,
      nombre: regla.nombre,
      tipo_condicion: regla.tipo_condicion,
      ...evaluateRule({ regla, pagos, overduePayments }),
    }));

    const desbloqueado = manualUnlock
      ? true
      : evaluatedRules.length > 0
        ? evaluatedRules.every((rule) => rule.cumplida)
        : overduePayments.length === 0;

    acc[serviceKey] = {
      servicio: serviceKey,
      etiqueta: SERVICE_LABELS[serviceKey],
      desbloqueado,
      origen: manualUnlock ? 'manual' : evaluatedRules.length > 0 ? 'reglas' : 'automatico',
      detalle: manualUnlock
        ? manualUnlock.motivo || 'Desbloqueo manual vigente.'
        : evaluatedRules.length > 0
          ? evaluatedRules.map((rule) => `${rule.nombre}: ${rule.detalle}`)
          : overduePayments.length === 0
            ? ['Sin adeudos vencidos.']
            : overduePayments.map((pago) => `Adeudo vencido: ${pago.concepto}.`),
      reglas: evaluatedRules,
    };

    return acc;
  }, {});
}

async function getAlumnoFinancialState(idAlumno) {
  const [alumno, pagos, reglas, desbloqueos] = await Promise.all([
    AlumnoPerfil.findByPk(idAlumno),
    PagoEstatus.findAll({
      where: { id_alumno: idAlumno },
      include: [{ model: ConceptoPago, as: 'concepto_pago', required: false }],
      order: [['fecha_limite', 'ASC'], ['id_pago', 'ASC']],
    }),
    ReglaDesbloqueo.findAll({
      where: { activo: true },
      include: [{ model: ConceptoPago, as: 'concepto_pago', required: false }],
      order: [['prioridad', 'ASC'], ['id_regla', 'ASC']],
    }),
    DesbloqueoManual.findAll({
      where: {
        id_alumno: idAlumno,
        activo: true,
        [Op.or]: [
          { fecha_fin: null },
          { fecha_fin: { [Op.gte]: new Date() } },
        ],
      },
      order: [['fecha_inicio', 'DESC']],
    }),
  ]);

  const servicios = resolveServiceStatuses({ alumno, pagos, reglas, desbloqueos });

  return {
    alumno,
    pagos,
    resumen: buildPaymentSummary(pagos),
    servicios,
    reglas,
    desbloqueos,
  };
}

function getBlockedServicesForModules(blockedModules = [], servicios = {}) {
  const routeToService = {
    tareas: ['acceso_clases'],
    clases: ['acceso_clases'],
    calificaciones: ['acceso_calificaciones'],
    kardex: ['acceso_calificaciones'],
    plan_estudios: ['acceso_calificaciones'],
    materiales: ['acceso_material'],
    portafolio: ['acceso_material'],
  };

  const serviceKeys = [...new Set(blockedModules.flatMap((moduleKey) => routeToService[moduleKey] || []))];

  return serviceKeys
    .map((serviceKey) => servicios[serviceKey])
    .filter((service) => service && !service.desbloqueado);
}

module.exports = {
  SERVICE_KEYS,
  SERVICE_LABELS,
  buildPaymentSummary,
  getAlumnoFinancialState,
  getBlockedServicesForModules,
};
