const TRAMITE_TIPOS = [
  'constancia',
  'credencial',
  'uniforme',
  'papeleria_oficial',
  'comprobante_pago',
  'otro',
];

const TRAMITE_ESTATUS = [
  'recibido',
  'en_revision',
  'en_proceso',
  'listo_para_entrega',
  'entregado',
  'resuelto',
  'rechazado',
  'cancelado',
];

const TRAMITES_ESCOLARES = ['constancia', 'credencial', 'uniforme', 'papeleria_oficial'];

const TRAMITES_ESCOLARES_LABELS = {
  constancia: 'Constancia',
  credencial: 'Credencial',
  uniforme: 'Uniforme',
  papeleria_oficial: 'Papelería oficial',
};

module.exports = {
  TRAMITE_TIPOS,
  TRAMITE_ESTATUS,
  TRAMITES_ESCOLARES,
  TRAMITES_ESCOLARES_LABELS,
};