const express = require('express');
const auth = require('../middlewares/auth');
const { authorizeRoles } = require('../middlewares/auth');
const controlEscolarController = require('../controllers/controlEscolarController');

const router = express.Router();

router.use(auth());
router.use(authorizeRoles('control_escolar'));

router.get('/conceptos-activos', controlEscolarController.conceptosActivos);
router.get('/comprobantes-pendientes', controlEscolarController.comprobantesPendientes);
router.post('/registrar-cobro-caja', controlEscolarController.registrarCobroCaja);
router.put('/validar-comprobante/:pagoId', controlEscolarController.validarComprobante);

router.get('/alumnos-estatus', controlEscolarController.alumnosEstatus);
router.put('/alumnos/:alumnoId/accesos', controlEscolarController.actualizarAccesosAlumno);

router.get('/tramites', controlEscolarController.listarTramites);
router.put('/tramites/:tramiteId/estatus', controlEscolarController.actualizarEstatusTramite);

module.exports = router;
