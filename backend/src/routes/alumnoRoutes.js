const express = require('express');
const auth = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissions');
const alumnoController = require('../controllers/alumnoController');
const { PERMISSIONS } = require('../constants/rbac');
const { handlePortafolioUpload } = require('../middlewares/upload');

const router = express.Router();

router.use(auth(['alumno']));

router.get('/estado-acceso', requirePermission(PERMISSIONS.ALUMNO_DASHBOARD_READ), alumnoController.estadoAcceso);

router.get('/horario-aulas', requirePermission(PERMISSIONS.ALUMNO_DASHBOARD_READ), alumnoController.horarioAulas);
router.get('/calificaciones', requirePermission(PERMISSIONS.ALUMNO_CALIFICACIONES_READ), alumnoController.calificaciones);
router.get('/asistencia', requirePermission(PERMISSIONS.ALUMNO_CALIFICACIONES_READ), alumnoController.asistencia);
router.get('/boleta', requirePermission(PERMISSIONS.ALUMNO_CALIFICACIONES_READ), alumnoController.descargarBoleta);

router.post('/pagos/comprobantes', requirePermission(PERMISSIONS.ALUMNO_TRAMITES_CREATE), handlePortafolioUpload, alumnoController.subirComprobantePago);
router.post('/tramites/solicitar', requirePermission(PERMISSIONS.ALUMNO_TRAMITES_CREATE), handlePortafolioUpload, alumnoController.solicitarTramite);
router.get('/tramites/tipos', requirePermission(PERMISSIONS.ALUMNO_TRAMITES_READ), alumnoController.tiposTramite);
router.get('/historial-tramites', requirePermission(PERMISSIONS.ALUMNO_TRAMITES_READ), alumnoController.historialTramites);
router.get('/avisos', requirePermission(PERMISSIONS.ALUMNO_DASHBOARD_READ), alumnoController.listarAvisos);
router.post('/avisos/:id/descartar', requirePermission(PERMISSIONS.ALUMNO_DASHBOARD_READ), alumnoController.descartarAviso);
router.get('/notificaciones', requirePermission(PERMISSIONS.ALUMNO_DASHBOARD_READ), alumnoController.notificaciones);

// Rutas legacy para compatibilidad con clientes antiguos.
router.get('/dashboard', requirePermission(PERMISSIONS.ALUMNO_DASHBOARD_READ), alumnoController.dashboard);
router.get('/horarios', requirePermission(PERMISSIONS.ALUMNO_DASHBOARD_READ), alumnoController.horarios);
router.get('/asistencias', requirePermission(PERMISSIONS.ALUMNO_CALIFICACIONES_READ), alumnoController.asistencias);
router.get('/video-clases', requirePermission(PERMISSIONS.ALUMNO_MATERIALES_READ), alumnoController.videoClases);
router.get('/portafolio', requirePermission(PERMISSIONS.ALUMNO_PORTAFOLIO_READ), alumnoController.portafolio);
router.post('/portafolio', requirePermission(PERMISSIONS.ALUMNO_TRAMITES_CREATE), handlePortafolioUpload, alumnoController.subirDocumentoPortafolio);
router.get('/meritos', requirePermission(PERMISSIONS.ALUMNO_MERITOS_READ), alumnoController.meritos);
router.get('/alertas', requirePermission(PERMISSIONS.ALUMNO_DASHBOARD_READ), alumnoController.alertas);
router.get('/plan-estudio', requirePermission(PERMISSIONS.ALUMNO_PLAN_ESTUDIO_READ), alumnoController.planEstudio);
router.get('/pagos', requirePermission(PERMISSIONS.ALUMNO_PAGOS_READ), alumnoController.pagos);
router.get('/tramites', requirePermission(PERMISSIONS.ALUMNO_TRAMITES_READ), alumnoController.listarTramites);
router.post('/tramites', requirePermission(PERMISSIONS.ALUMNO_TRAMITES_CREATE), handlePortafolioUpload, alumnoController.crearTramite);
router.get('/recursos-institucionales', requirePermission(PERMISSIONS.ALUMNO_DASHBOARD_READ), alumnoController.recursosInstitucionales);

module.exports = router;
