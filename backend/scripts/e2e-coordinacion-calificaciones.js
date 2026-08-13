const request = require('supertest');
const app = require('../src/app');
const {
  sequelize,
  PeriodoAcademico,
  Materia,
  ActaCalificacion,
  EvaluacionExtraordinaria,
} = require('../models');

const USERS = {
  coordinacion: { correo: 'coordinacion@unicep.test', password: 'Coordinacion123!', rol: 'coordinacion_academica' },
  alumno: { correo: 'alumno@unicep.test', password: 'Alumno123!', rol: 'alumno' },
};

function assertStatus(response, expected, context) {
  if (response.status !== expected) {
    throw new Error(`${context} fallo. Esperado ${expected}, recibido ${response.status}. Respuesta: ${JSON.stringify(response.body)}`);
  }
}

async function loginAs({ correo, password, rol }) {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ correo, password });

  assertStatus(response, 200, `Login de ${rol}`);

  return {
    token: response.body.token,
    user: response.body.user,
  };
}

async function run() {
  const created = {
    actaId: null,
    evaluacionId: null,
  };

  try {
    await sequelize.authenticate();

    const coordinacion = await loginAs(USERS.coordinacion);
    const alumno = await loginAs(USERS.alumno);
    const token = coordinacion.token;

    const [periodo, materia] = await Promise.all([
      PeriodoAcademico.findOne({ order: [['id_periodo', 'ASC']] }),
      Materia.findOne({ order: [['id_materia', 'ASC']] }),
    ]);

    if (!periodo) {
      throw new Error('No existe PeriodoAcademico para probar actas.');
    }

    if (!materia) {
      throw new Error('No existe Materia para probar extraordinarios.');
    }

    const reprobadosRes = await request(app)
      .get('/api/v1/admin/reprobados')
      .set('Authorization', `Bearer ${token}`);
    assertStatus(reprobadosRes, 200, 'Listado de reprobados');

    const actaRes = await request(app)
      .post('/api/v1/admin/actas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id_periodo: periodo.id_periodo,
        carrera: 'General',
        estatus: 'borrador',
        total_alumnos: 1,
        total_reprobados: 0,
        observaciones: `Acta E2E ${Date.now()}`,
      });
    assertStatus(actaRes, 201, 'Creacion de acta de calificaciones');
    created.actaId = actaRes.body.id_acta;

    const actasRes = await request(app)
      .get('/api/v1/admin/actas')
      .set('Authorization', `Bearer ${token}`);
    assertStatus(actasRes, 200, 'Listado de actas de calificaciones');

    const actaUpdateRes = await request(app)
      .patch(`/api/v1/admin/actas/${created.actaId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        estatus: 'validada',
        total_reprobados: 1,
      });
    assertStatus(actaUpdateRes, 200, 'Actualizacion de acta de calificaciones');

    const extraRes = await request(app)
      .post('/api/v1/admin/extraordinarios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id_alumno: alumno.user.id_usuario,
        id_materia: materia.id_materia,
        id_periodo: periodo.id_periodo,
        tipo: 'extraordinario',
        estatus: 'programado',
        observaciones: `Evaluacion E2E ${Date.now()}`,
      });
    assertStatus(extraRes, 201, 'Creacion de evaluacion extraordinaria');
    created.evaluacionId = extraRes.body.id_evaluacion;

    const extrasRes = await request(app)
      .get('/api/v1/admin/extraordinarios')
      .set('Authorization', `Bearer ${token}`);
    assertStatus(extrasRes, 200, 'Listado de evaluaciones extraordinarias');

    const extraUpdateRes = await request(app)
      .patch(`/api/v1/admin/extraordinarios/${created.evaluacionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        estatus: 'acreditado',
        calificacion_final: 8.5,
      });
    assertStatus(extraUpdateRes, 200, 'Actualizacion de evaluacion extraordinaria');

    console.log('E2E COORDINACION CALIFICACIONES OK: reprobados, actas y extraordinarios operando.');
  } catch (error) {
    console.error('E2E COORDINACION CALIFICACIONES FAIL:', error.message);
    process.exitCode = 1;
  } finally {
    if (created.evaluacionId) {
      await EvaluacionExtraordinaria.destroy({ where: { id_evaluacion: created.evaluacionId } }).catch(() => {});
    }
    if (created.actaId) {
      await ActaCalificacion.destroy({ where: { id_acta: created.actaId } }).catch(() => {});
    }

    await sequelize.close().catch(() => {});
  }
}

run();
