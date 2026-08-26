const express = require('express');
const auth = require('../middlewares/auth');
const { authorizeRoles } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissions');
const docenteController = require('../controllers/docenteController');
const { PERMISSIONS } = require('../constants/rbac');

const router = express.Router();

router.use(auth());
router.use(authorizeRoles('docente', 'maestro', 'director'));

router.get('/mis-materias', docenteController.misMaterias);
router.get('/grupos/:grupoId/materias/:materiaId/alumnos', docenteController.alumnosPorGrupoMateria);
router.get('/grupos/:grupoId/materias/:materiaId/asistencia', docenteController.listarAsistenciaGrupoFecha);
router.post('/asistencia', docenteController.registrarAsistenciaGrupo);
router.put('/calificaciones/parcial', docenteController.capturarCalificacionesParcial);
router.post('/actas/enviar-a-coordinacion', docenteController.enviarActaCoordinacion);
router.get('/justificantes-recibidos', docenteController.justificantesRecibidos);
router.get('/avisos-grupales', docenteController.listarAvisosGrupales);
router.post('/avisos-grupales', docenteController.publicarAvisoGrupal);

router.get('/dashboard', requirePermission(PERMISSIONS.MAESTRO_DASHBOARD_READ), docenteController.dashboard);
router.get('/grupos', requirePermission(PERMISSIONS.MAESTRO_GRUPOS_READ), docenteController.grupos);
router.get('/calificaciones-finales', requirePermission(PERMISSIONS.MAESTRO_CALIFICACIONES_FINALES_READ), docenteController.calificacionesFinales);
router.get('/asistencias', requirePermission(PERMISSIONS.MAESTRO_ASISTENCIAS_READ), docenteController.listarAsistencias);
router.post('/asistencias', requirePermission(PERMISSIONS.MAESTRO_ASISTENCIAS_CREATE), docenteController.registrarAsistencia);
router.get('/aprovechamiento', requirePermission(PERMISSIONS.MAESTRO_APROVECHAMIENTO_READ), docenteController.aprovechamiento);
router.get('/justificantes-preaprobados', requirePermission(PERMISSIONS.MAESTRO_JUSTIFICANTES_READ), docenteController.justificantesPreaprobados);

module.exports = router;
