const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../models');

const USERS = {
  maestro: { correo: 'docente@unicep.test', password: 'Docente123!', rol: 'maestro' },
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
  try {
    await sequelize.authenticate();

    const maestro = await loginAs(USERS.maestro);
    await loginAs(USERS.alumno);

    const token = maestro.token;

    const dashboardRes = await request(app)
      .get('/api/v1/docentes/dashboard')
      .set('Authorization', `Bearer ${token}`);
    assertStatus(dashboardRes, 200, 'Dashboard docente');

    const gruposRes = await request(app)
      .get('/api/v1/docentes/grupos')
      .set('Authorization', `Bearer ${token}`);
    assertStatus(gruposRes, 200, 'Grupos docente');

    const grupos = gruposRes.body.items || [];
    if (grupos.length === 0) {
      throw new Error('No hay grupos asignados al docente para la prueba.');
    }

    const idMateria = grupos[0].id_materia;

    const salaRes = await request(app)
      .post('/api/v1/docentes/salas-video')
      .set('Authorization', `Bearer ${token}`)
      .send({
        titulo: `Clase en vivo E2E ${Date.now()}`,
        plataforma: 'Google Meet',
        fecha_programada: new Date(Date.now() + 3600000).toISOString(),
      });
    assertStatus(salaRes, 201, 'Creacion de sala en vivo');

    if (!salaRes.body.enlace) {
      throw new Error('No se genero enlace automatico para clase en vivo.');
    }

    const asistenciaRes = await request(app)
      .post('/api/v1/docentes/asistencias')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id_materia: idMateria,
        estatus_asistencia: 'presente',
        aprovechamiento: 'alto',
        fecha_clase: new Date().toISOString(),
        observaciones: 'Registro E2E maestro',
      });
    assertStatus(asistenciaRes, 201, 'Registro de asistencia/aprovechamiento');

    const listAsistenciaRes = await request(app)
      .get('/api/v1/docentes/asistencias')
      .set('Authorization', `Bearer ${token}`);
    assertStatus(listAsistenciaRes, 200, 'Listado de asistencias');

    const aprovechamientoRes = await request(app)
      .get('/api/v1/docentes/aprovechamiento')
      .set('Authorization', `Bearer ${token}`);
    assertStatus(aprovechamientoRes, 200, 'Resumen de aprovechamiento');

    const justificantesRes = await request(app)
      .get('/api/v1/docentes/justificantes-preaprobados')
      .set('Authorization', `Bearer ${token}`);
    assertStatus(justificantesRes, 200, 'Listado de justificantes preaprobados');

    console.log('E2E MAESTRO DOCENCIA OK: aula virtual, clases en vivo, asistencia/aprovechamiento y justificantes operando.');
  } catch (error) {
    console.error('E2E MAESTRO DOCENCIA FAIL:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close().catch(() => {});
  }
}

run();
