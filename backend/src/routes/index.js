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
const { PERMISSIONS } = require('../constants/rbac');

const router = express.Router();
const authMaestro = auth(['maestro']);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'unicep-api' });
});

router.use('/auth', authRoutes);
router.use('/alumnos', alumnoRoutes);
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
