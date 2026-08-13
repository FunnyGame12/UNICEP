const request = require('supertest');
const app = require('../src/app');
const { sequelize, Horario, ProgramaExterno, MeritoAcademico } = require('../models');

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
    horarioId: null,
    programaId: null,
    meritoId: null,
  };

  try {
    await sequelize.authenticate();

    const coordinacion = await loginAs(USERS.coordinacion);
    const alumno = await loginAs(USERS.alumno);
    const token = coordinacion.token;
    const alumnoId = alumno.user.id_usuario;

    const cargaRes = await request(app)
      .get('/api/v1/admin/carga-horaria')
      .set('Authorization', `Bearer ${token}`);
    assertStatus(cargaRes, 200, 'Consulta carga horaria');

    const horarioRes = await request(app)
      .post('/api/v1/admin/horarios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        modalidad: 'ejecutiva',
        periodo: '2026-C3',
        turno: 'vespertino',
        hora_inicio: '17:00',
        hora_fin: '21:00',
        descripcion: 'E2E Coordinacion',
      });
    assertStatus(horarioRes, 201, 'Creacion de horario');
    created.horarioId = horarioRes.body.id_horario;

    const horarioUpdateRes = await request(app)
      .patch(`/api/v1/admin/horarios/${created.horarioId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descripcion: 'E2E Coordinacion actualizado' });
    assertStatus(horarioUpdateRes, 200, 'Actualizacion de horario');

    const programaRes = await request(app)
      .post('/api/v1/admin/programas-externos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id_alumno: alumnoId,
        tipo_programa: 'servicio_social',
        organizacion: 'Institucion E2E',
        estatus: 'registrado',
      });
    assertStatus(programaRes, 201, 'Creacion de programa externo');
    created.programaId = programaRes.body.id_programa;

    const programaUpdateRes = await request(app)
      .patch(`/api/v1/admin/programas-externos/${created.programaId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estatus: 'liberado' });
    assertStatus(programaUpdateRes, 200, 'Actualizacion de programa externo');

    const meritoRes = await request(app)
      .post('/api/v1/admin/meritos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id_alumno: alumnoId,
        tipo_merito: 'constancia',
        nombre: `Constancia E2E ${Date.now()}`,
        fecha: '2026-08-05',
        archivo_url: 'https://ejemplo.test/constancia-e2e',
      });
    assertStatus(meritoRes, 201, 'Creacion de merito academico');
    created.meritoId = meritoRes.body.id_merito;

    const meritosRes = await request(app)
      .get('/api/v1/admin/meritos')
      .set('Authorization', `Bearer ${token}`);
    assertStatus(meritosRes, 200, 'Listado de meritos academicos');

    console.log('E2E COORDINACION OK: carga horaria, horarios, programas externos y meritos operando.');
  } catch (error) {
    console.error('E2E COORDINACION FAIL:', error.message);
    process.exitCode = 1;
  } finally {
    if (created.meritoId) {
      await MeritoAcademico.destroy({ where: { id_merito: created.meritoId } }).catch(() => {});
    }
    if (created.programaId) {
      await ProgramaExterno.destroy({ where: { id_programa: created.programaId } }).catch(() => {});
    }
    if (created.horarioId) {
      await Horario.destroy({ where: { id_horario: created.horarioId } }).catch(() => {});
    }

    await sequelize.close().catch(() => {});
  }
}

run();
