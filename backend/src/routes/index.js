const express = require('express');
const authRoutes = require('./authRoutes');
const alumnoRoutes = require('./alumnoRoutes');
const docenteRoutes = require('./docenteRoutes');
const adminRoutes = require('./adminRoutes');
const controlEscolarRoutes = require('./controlEscolarRoutes');
const coordinacionRoutes = require('./coordinacionRoutes');
const auth = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissions');
const docenteController = require('../controllers/docenteController');
const alumnoController = require('../controllers/alumnoController');
const { handlePortafolioUpload } = require('../middlewares/upload');
const { PERMISSIONS } = require('../constants/rbac');

const router = express.Router();
const authMaestro = auth(['maestro']);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'unicep-api' });
});

router.use('/auth', authRoutes);
router.post('/tramites', auth(['alumno']), requirePermission(PERMISSIONS.ALUMNO_TRAMITES_CREATE), handlePortafolioUpload, alumnoController.solicitarTramite);
router.use('/alumnos', alumnoRoutes);
router.use('/alumno', alumnoRoutes);
router.use('/estudiante', alumnoRoutes);
router.get('/asistencias/historial/:materiaId/:grupoId', auth(), requirePermission(PERMISSIONS.MAESTRO_ASISTENCIAS_READ), docenteController.historialAsistenciaGrupo);
router.get('/asistencias/:materiaId/:grupoId', auth(), requirePermission(PERMISSIONS.MAESTRO_ASISTENCIAS_READ), docenteController.listarAsistenciaGrupoFecha);
router.post('/asistencias', auth(), requirePermission(PERMISSIONS.MAESTRO_ASISTENCIAS_CREATE), docenteController.registrarAsistenciaGrupo);
router.get('/docentes/asistencias', authMaestro, requirePermission(PERMISSIONS.MAESTRO_ASISTENCIAS_READ), docenteController.listarAsistencias);
router.post('/docentes/asistencias', authMaestro, requirePermission(PERMISSIONS.MAESTRO_ASISTENCIAS_CREATE), docenteController.registrarAsistencia);
router.get('/docentes/aprovechamiento', authMaestro, requirePermission(PERMISSIONS.MAESTRO_APROVECHAMIENTO_READ), docenteController.aprovechamiento);
router.get('/docentes/justificantes-preaprobados', authMaestro, requirePermission(PERMISSIONS.MAESTRO_JUSTIFICANTES_READ), docenteController.justificantesPreaprobados);
router.use('/docentes', docenteRoutes);
router.use('/docente', docenteRoutes);
router.use('/maestro', docenteRoutes);
router.use('/admin', adminRoutes);
router.use('/control-escolar', controlEscolarRoutes);
router.use('/coordinacion', coordinacionRoutes);

module.exports = router;
