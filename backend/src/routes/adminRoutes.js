const express = require('express');
const auth = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissions');
const { ADMIN_ROLES, PERMISSIONS, ROLES } = require('../constants/rbac');
const adminController = require('../controllers/adminController');

const router = express.Router();
const directorOnly = auth([ROLES.DIRECTOR]);
const coordinacionOrDirector = auth([ROLES.DIRECTOR, ROLES.COORDINACION_ACADEMICA]);

router.use(auth(ADMIN_ROLES));

router.get('/dashboard', requirePermission(PERMISSIONS.ADMIN_DASHBOARD_READ), adminController.dashboard);
router.get('/director/dashboard', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_SUPERVISION_READ), adminController.dashboard);
router.get('/usuarios/resumen', requirePermission(PERMISSIONS.ADMIN_USUARIOS_RESUMEN_READ), adminController.resumenUsuarios);
router.get('/director/usuarios', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_SUPERVISION_READ), adminController.buscarUsuariosDirector);
router.get('/director/alumnos-override', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_SUPERVISION_READ), adminController.buscarAlumnosOverrideDirector);
router.get('/director/folios', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_SUPERVISION_READ), adminController.listarFoliosDirector);
router.get('/director/conceptos-pago', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_SUPERVISION_READ), adminController.listConceptosPagoCatalog);
router.post('/director/conceptos-pago', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_FINANCIAL_OVERRIDE), adminController.createConceptoPagoCatalog);
router.put('/director/conceptos-pago/:id_concepto_pago', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_FINANCIAL_OVERRIDE), adminController.updateConceptoPagoCatalog);
router.delete('/director/conceptos-pago/:id_concepto_pago', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_FINANCIAL_OVERRIDE), adminController.deleteConceptoPagoCatalog);
router.get('/director/pagos', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_SUPERVISION_READ), adminController.buscarPagosDirector);
router.get('/director/docentes', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_SUPERVISION_READ), adminController.buscarDocentesDirector);
router.get('/director/materias', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_SUPERVISION_READ), adminController.buscarMateriasDirector);
router.get('/director/horarios', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_SUPERVISION_READ), adminController.buscarHorariosDirector);
router.get('/director/auditoria-eventos', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_SUPERVISION_READ), adminController.ultimosEventosAuditoriaDirector);
router.post('/usuarios', requirePermission(PERMISSIONS.ADMIN_USUARIOS_CREATE), adminController.crearUsuario);
router.patch('/usuarios/:id_usuario/cuenta', requirePermission(PERMISSIONS.ADMIN_CUENTAS_UPDATE), adminController.actualizarCuentaUsuario);

router.post('/materias', coordinacionOrDirector, requirePermission(PERMISSIONS.ADMIN_MATERIAS_CREATE), adminController.crearMateria);
router.post('/docente-grupos', coordinacionOrDirector, requirePermission(PERMISSIONS.ADMIN_DOCENTE_GRUPOS_CREATE), adminController.asignarDocenteAGrupo);

router.get('/reportes/financieros', requirePermission(PERMISSIONS.ADMIN_REPORTES_FINANCIEROS_READ), adminController.reporteFinanciero);
router.get('/respaldo', requirePermission(PERMISSIONS.ADMIN_RESPALDO_READ), adminController.respaldoMetadatos);

router.get('/folios/politica', requirePermission(PERMISSIONS.ADMIN_FOLIOS_USUARIOS_READ), adminController.politicaFoliosPorRol);
router.post('/folios/preasignacion', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_FOLIOS_MANAGE), adminController.preasignarFolioPorRol);
router.get('/generate-folio/:userId', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_FOLIOS_MANAGE), adminController.generateFolioByUserId);

router.patch('/usuarios/:id_usuario/folio', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_FOLIOS_MANAGE), adminController.actualizarFolioUsuario);
router.patch('/pagos/:id_pago/folio', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_FOLIOS_MANAGE), adminController.actualizarFolioPago);

router.patch('/pagos/:id_pago/estatus-director', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_FINANCIAL_OVERRIDE), adminController.overrideEstatusFinanciero);

router.post('/director/calificaciones-extemporaneas/autorizaciones', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_CALIFICACIONES_EXTEMPORANEAS_AUTHORIZE), adminController.autorizarCalificacionExtemporanea);
router.patch('/director/horarios/:id_horario/aula', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_AULAS_ASSIGN), adminController.asignarAulaHorario);

router.get('/alumno-grupos', coordinacionOrDirector, requirePermission(PERMISSIONS.ADMIN_ALUMNO_GRUPOS_READ), adminController.listarAsignacionesAlumnoGrupo);
router.post('/alumno-grupos', coordinacionOrDirector, requirePermission(PERMISSIONS.ADMIN_ALUMNO_GRUPOS_CREATE), adminController.asignarAlumnoAGrupo);
router.delete('/alumno-grupos/:id_alumno/:id_materia', coordinacionOrDirector, requirePermission(PERMISSIONS.ADMIN_ALUMNO_GRUPOS_DELETE), adminController.desasignarAlumnoDeGrupo);

module.exports = router;
