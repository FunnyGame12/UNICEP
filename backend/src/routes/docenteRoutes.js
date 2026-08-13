const express = require('express');
const auth = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissions');
const docenteController = require('../controllers/docenteController');
const { PERMISSIONS } = require('../constants/rbac');

const router = express.Router();

router.use(auth(['maestro']));

router.get('/dashboard', requirePermission(PERMISSIONS.MAESTRO_DASHBOARD_READ), docenteController.dashboard);
router.get('/grupos', requirePermission(PERMISSIONS.MAESTRO_GRUPOS_READ), docenteController.grupos);
router.get('/tareas', requirePermission(PERMISSIONS.MAESTRO_TAREAS_READ), docenteController.tareas);
router.post('/materias/:id_materia/tareas', requirePermission(PERMISSIONS.MAESTRO_TAREAS_CREATE), docenteController.crearTarea);
router.get('/entregas', requirePermission(PERMISSIONS.MAESTRO_ENTREGAS_READ), docenteController.entregas);
router.patch('/entregas/:id/calificar', requirePermission(PERMISSIONS.MAESTRO_ENTREGAS_UPDATE), docenteController.calificarEntrega);
router.get('/materiales', requirePermission(PERMISSIONS.MAESTRO_MATERIALES_READ), docenteController.materiales);
router.post('/materias/:id_materia/materiales', requirePermission(PERMISSIONS.MAESTRO_MATERIALES_CREATE), docenteController.subirMaterial);
router.get('/portafolios', requirePermission(PERMISSIONS.MAESTRO_PORTAFOLIOS_READ), docenteController.portafolios);
router.get('/calificaciones-finales', requirePermission(PERMISSIONS.MAESTRO_CALIFICACIONES_FINALES_READ), docenteController.calificacionesFinales);
router.get('/anuncios', requirePermission(PERMISSIONS.MAESTRO_ANUNCIOS_READ), docenteController.anuncios);
router.post('/anuncios', requirePermission(PERMISSIONS.MAESTRO_ANUNCIOS_CREATE), docenteController.publicarAnuncio);
router.get('/salas-video', requirePermission(PERMISSIONS.MAESTRO_SALAS_VIDEO_READ), docenteController.salasVideo);
router.post('/salas-video', requirePermission(PERMISSIONS.MAESTRO_SALAS_VIDEO_CREATE), docenteController.crearSalaVideo);
router.get('/asistencias', requirePermission(PERMISSIONS.MAESTRO_ASISTENCIAS_READ), docenteController.listarAsistencias);
router.post('/asistencias', requirePermission(PERMISSIONS.MAESTRO_ASISTENCIAS_CREATE), docenteController.registrarAsistencia);
router.get('/aprovechamiento', requirePermission(PERMISSIONS.MAESTRO_APROVECHAMIENTO_READ), docenteController.aprovechamiento);
router.get('/justificantes-preaprobados', requirePermission(PERMISSIONS.MAESTRO_JUSTIFICANTES_READ), docenteController.justificantesPreaprobados);

module.exports = router;
