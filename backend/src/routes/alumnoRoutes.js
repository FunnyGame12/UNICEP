const express = require('express');
const auth = require('../middlewares/auth');
const financialLock = require('../middlewares/financialLock');
const { requirePermission } = require('../middlewares/permissions');
const alumnoController = require('../controllers/alumnoController');
const { PERMISSIONS } = require('../constants/rbac');

const router = express.Router();

router.use(auth(['alumno']));

router.get('/dashboard', requirePermission(PERMISSIONS.ALUMNO_DASHBOARD_READ), alumnoController.dashboard);
router.get('/horarios', requirePermission(PERMISSIONS.ALUMNO_DASHBOARD_READ), alumnoController.horarios);
router.get('/tareas', requirePermission(PERMISSIONS.ALUMNO_TAREAS_READ), financialLock(['tareas', 'clases']), alumnoController.tareas);
router.post('/tareas/:id_tarea/entregas', requirePermission(PERMISSIONS.ALUMNO_ENTREGAS_CREATE), financialLock(['tareas', 'clases']), alumnoController.entregarTarea);
router.get('/calificaciones', requirePermission(PERMISSIONS.ALUMNO_CALIFICACIONES_READ), financialLock(['kardex', 'calificaciones']), alumnoController.calificaciones);
router.get('/asistencias', requirePermission(PERMISSIONS.ALUMNO_CALIFICACIONES_READ), financialLock(['kardex', 'calificaciones']), alumnoController.asistencias);
router.get('/materiales', requirePermission(PERMISSIONS.ALUMNO_MATERIALES_READ), financialLock(['materiales', 'clases']), alumnoController.materiales);
router.get('/video-clases', requirePermission(PERMISSIONS.ALUMNO_MATERIALES_READ), financialLock(['clases']), alumnoController.videoClases);
router.get('/portafolio', requirePermission(PERMISSIONS.ALUMNO_PORTAFOLIO_READ), financialLock(['portafolio', 'clases']), alumnoController.portafolio);
router.get('/meritos', requirePermission(PERMISSIONS.ALUMNO_MERITOS_READ), alumnoController.meritos);
router.get('/alertas', requirePermission(PERMISSIONS.ALUMNO_DASHBOARD_READ), alumnoController.alertas);
router.get('/plan-estudio', requirePermission(PERMISSIONS.ALUMNO_PLAN_ESTUDIO_READ), financialLock(['kardex', 'plan_estudios']), alumnoController.planEstudio);
router.get('/pagos', requirePermission(PERMISSIONS.ALUMNO_PAGOS_READ), alumnoController.pagos);
router.post('/pagos/comprobantes', requirePermission(PERMISSIONS.ALUMNO_TRAMITES_CREATE), alumnoController.subirComprobantePago);
router.get('/tramites', requirePermission(PERMISSIONS.ALUMNO_TRAMITES_READ), alumnoController.listarTramites);
router.post('/tramites', requirePermission(PERMISSIONS.ALUMNO_TRAMITES_CREATE), alumnoController.crearTramite);

module.exports = router;
