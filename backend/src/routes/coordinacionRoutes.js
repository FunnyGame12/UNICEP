const express = require('express');
const auth = require('../middlewares/auth');
const { authorizeRoles } = require('../middlewares/auth');
const coordinacionController = require('../controllers/coordinacionController');

const router = express.Router();

router.use(auth());
router.use(authorizeRoles('coordinacion_academica', 'director'));

router.get('/docentes-asignaciones', coordinacionController.docentesAsignaciones);
router.post('/asignar-materia-docente', coordinacionController.asignarMateriaDocente);

router.get('/aulas-disponibilidad', coordinacionController.aulasDisponibilidad);
router.post('/programar-horario-grupo', coordinacionController.programarHorarioGrupo);

router.get('/actas-pendientes', coordinacionController.actasPendientes);
router.put('/actas/:actaId/validar', coordinacionController.validarActa);
router.post('/programar-extraordinario', coordinacionController.programarExtraordinario);

router.get('/programas-externos', coordinacionController.programasExternos);
router.put('/programas-externos/:expedienteId/estatus', coordinacionController.actualizarEstatusProgramaExterno);

router.get('/programas', coordinacionController.listarProgramasAcademicos);
router.post('/programas', coordinacionController.crearProgramaAcademico);
router.put('/programas/:id', coordinacionController.actualizarProgramaAcademico);
router.delete('/programas/:id', coordinacionController.eliminarProgramaAcademico);

router.get('/programas/:id/materias', coordinacionController.materiasPorPrograma);
router.post('/materias', coordinacionController.crearMateriaPrograma);
router.put('/materias/:id', coordinacionController.actualizarMateriaPrograma);
router.delete('/materias/:id', coordinacionController.eliminarMateriaPrograma);

router.get('/alumnos-progreso', coordinacionController.alumnosProgreso);
router.get('/alumnos/:alumnoId/portafolio', coordinacionController.portafolioAlumno);
router.get('/meritos-recientes', coordinacionController.meritosRecientes);
router.post('/asignar-merito', coordinacionController.asignarMerito);

module.exports = router;
