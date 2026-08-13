const express = require('express');
const auth = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissions');
const { ADMIN_ROLES, PERMISSIONS, ROLES } = require('../constants/rbac');
const adminController = require('../controllers/adminController');

const router = express.Router();
const directorOnly = auth([ROLES.DIRECTOR]);

router.use(auth(ADMIN_ROLES));

router.get('/dashboard', requirePermission(PERMISSIONS.ADMIN_DASHBOARD_READ), adminController.dashboard);
router.get('/director/dashboard', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_SUPERVISION_READ), adminController.dashboard);
router.get('/usuarios/resumen', requirePermission(PERMISSIONS.ADMIN_USUARIOS_RESUMEN_READ), adminController.resumenUsuarios);
router.get('/director/usuarios', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_SUPERVISION_READ), adminController.buscarUsuariosDirector);
router.get('/director/pagos', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_SUPERVISION_READ), adminController.buscarPagosDirector);
router.get('/director/docentes', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_SUPERVISION_READ), adminController.buscarDocentesDirector);
router.get('/director/materias', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_SUPERVISION_READ), adminController.buscarMateriasDirector);
router.get('/director/horarios', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_SUPERVISION_READ), adminController.buscarHorariosDirector);
router.get('/director/auditoria-eventos', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_SUPERVISION_READ), adminController.ultimosEventosAuditoriaDirector);
router.post('/usuarios', requirePermission(PERMISSIONS.ADMIN_USUARIOS_CREATE), adminController.crearUsuario);
router.patch('/usuarios/:id_usuario/cuenta', requirePermission(PERMISSIONS.ADMIN_CUENTAS_UPDATE), adminController.actualizarCuentaUsuario);

router.post('/materias', requirePermission(PERMISSIONS.ADMIN_MATERIAS_CREATE), adminController.crearMateria);
router.post('/docente-grupos', requirePermission(PERMISSIONS.ADMIN_DOCENTE_GRUPOS_CREATE), adminController.asignarDocenteAGrupo);

router.get('/tramites', requirePermission(PERMISSIONS.ADMIN_TRAMITES_READ), adminController.listarTramites);
router.patch('/tramites/:id_tramite', requirePermission(PERMISSIONS.ADMIN_TRAMITES_UPDATE), adminController.actualizarTramite);

router.get('/reportes/financieros', requirePermission(PERMISSIONS.ADMIN_REPORTES_FINANCIEROS_READ), adminController.reporteFinanciero);
router.get('/respaldo', requirePermission(PERMISSIONS.ADMIN_RESPALDO_READ), adminController.respaldoMetadatos);

router.get('/folios/politica', requirePermission(PERMISSIONS.ADMIN_FOLIOS_USUARIOS_READ), adminController.politicaFoliosPorRol);
router.post('/folios/preasignacion', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_FOLIOS_MANAGE), adminController.preasignarFolioPorRol);

router.patch('/usuarios/:id_usuario/folio', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_FOLIOS_MANAGE), adminController.actualizarFolioUsuario);
router.patch('/pagos/:id_pago/folio', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_FOLIOS_MANAGE), adminController.actualizarFolioPago);

router.patch('/pagos/:id/validar', requirePermission(PERMISSIONS.ADMIN_PAGOS_VALIDAR), adminController.validarPago);
router.patch('/pagos/:id_pago/estatus-director', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_FINANCIAL_OVERRIDE), adminController.overrideEstatusFinanciero);

router.post('/director/calificaciones-extemporaneas/autorizaciones', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_CALIFICACIONES_EXTEMPORANEAS_AUTHORIZE), adminController.autorizarCalificacionExtemporanea);
router.patch('/director/horarios/:id_horario/aula', directorOnly, requirePermission(PERMISSIONS.DIRECTOR_AULAS_ASSIGN), adminController.asignarAulaHorario);

router.get('/alumno-grupos', requirePermission(PERMISSIONS.ADMIN_ALUMNO_GRUPOS_READ), adminController.listarAsignacionesAlumnoGrupo);
router.post('/alumno-grupos', requirePermission(PERMISSIONS.ADMIN_ALUMNO_GRUPOS_CREATE), adminController.asignarAlumnoAGrupo);
router.delete('/alumno-grupos/:id_alumno/:id_materia', requirePermission(PERMISSIONS.ADMIN_ALUMNO_GRUPOS_DELETE), adminController.desasignarAlumnoDeGrupo);

module.exports = router;
