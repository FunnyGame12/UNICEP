const { getAlumnoFinancialState, getBlockedServicesForModules } = require('../services/financialService');

function financialLock(blockedModules = []) {
  return async (req, res, next) => {
    if (!req.user || req.user.rol !== 'alumno') {
      return next();
    }

    const financialState = await getAlumnoFinancialState(req.user.id_usuario);
    const blockedServices = getBlockedServicesForModules(blockedModules, financialState.servicios);

    if (blockedServices.length === 0) {
      return next();
    }

    const firstBlockedService = blockedServices[0];
    const pagoReferencia =
      financialState.pagos.find((pago) => pago.estatus === 'vencido')
      || financialState.pagos.find((pago) => pago.estatus === 'pendiente')
      || financialState.pagos[0];

    return res.status(423).json({
      message: 'Acceso academico restringido por reglas financieras activas.',
      bloqueado: true,
      modulos_restringidos: blockedModules,
      servicios_bloqueados: blockedServices.map((service) => ({
        servicio: service.servicio,
        etiqueta: service.etiqueta,
        detalle: service.detalle,
      })),
      motivo_principal: {
        servicio: firstBlockedService.servicio,
        etiqueta: firstBlockedService.etiqueta,
        detalle: firstBlockedService.detalle,
      },
      referencia_pago: {
        id_pago: pagoReferencia?.id_pago || null,
        concepto: pagoReferencia?.concepto || null,
        fecha_limite: pagoReferencia?.fecha_limite || null,
      },
    });
  };
}

module.exports = financialLock;
