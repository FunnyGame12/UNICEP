const express = require('express');
const auth = require('../middlewares/auth');
const { authorizeRoles } = require('../middlewares/auth');
const controlEscolarController = require('../controllers/controlEscolarController');
const { handlePortafolioUpload, handleManualServicioSocialUpload, handleTramiteRespuestaUpload } = require('../middlewares/upload');

const router = express.Router();

router.use(auth());
router.use(authorizeRoles('control_escolar'));

router.get('/conceptos-activos', controlEscolarController.conceptosActivos);
router.get('/catalogos-extraordinario', controlEscolarController.catalogosExtraordinario);
router.get('/comprobantes-pendientes', controlEscolarController.comprobantesPendientes);
router.post('/registrar-cobro-caja', controlEscolarController.registrarCobroCaja);
router.put('/validar-comprobante/:pagoId', controlEscolarController.validarComprobante);

router.get('/alumnos-estatus', controlEscolarController.alumnosEstatus);
router.put('/alumnos/:alumnoId/accesos', controlEscolarController.actualizarAccesosAlumno);
router.put('/alumnos/:alumnoId/boleta-config', controlEscolarController.actualizarConfiguracionBoletaAlumno);
router.get('/alumnos/:alumnoId/boleta', controlEscolarController.descargarBoletaAlumno);

router.get('/alumnos/:alumnoId/portafolio', controlEscolarController.portafolioAlumno);
router.put('/alumnos/:alumnoId/drive-folder', controlEscolarController.actualizarDriveFolder);
router.post('/alumnos/:alumnoId/portafolio', handlePortafolioUpload, controlEscolarController.subirArchivoPortafolio);

router.get('/tramites', controlEscolarController.listarTramites);
router.put('/tramites/:tramiteId/estatus', handleTramiteRespuestaUpload, controlEscolarController.actualizarEstatusTramite);

router.get('/recursos-institucionales', controlEscolarController.obtenerRecursosInstitucionales);
router.put('/recursos-institucionales/biblioteca-virtual', controlEscolarController.actualizarBibliotecaVirtual);
router.post(
  '/recursos-institucionales/manual-servicio-social',
  handleManualServicioSocialUpload,
  controlEscolarController.subirManualServicioSocial,
);

module.exports = router;
