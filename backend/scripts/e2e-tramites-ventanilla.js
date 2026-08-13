const request = require('supertest');
const app = require('../src/app');
const { sequelize, TramiteSolicitud } = require('../models');

const USERS = {
  control: { correo: 'control.escolar@unicep.test', password: 'Control123!', rol: 'control_escolar' },
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

  if (!response.body?.token) {
    throw new Error(`Login de ${rol} sin token. Respuesta: ${JSON.stringify(response.body)}`);
  }

  return {
    token: response.body.token,
    user: response.body.user,
  };
}

async function run() {
  let createdTramiteId = null;

  try {
    await sequelize.authenticate();

    const controlSession = await loginAs(USERS.control);
    const alumnoSession = await loginAs(USERS.alumno);

    const controlToken = controlSession.token;
    const alumnoToken = alumnoSession.token;

    const createRes = await request(app)
      .post('/api/v1/alumnos/tramites')
      .set('Authorization', `Bearer ${alumnoToken}`)
      .send({
        tipo: 'constancia',
        descripcion: `Prueba E2E ventanilla ${Date.now()}`,
        adjunto_url: 'https://ejemplo.test/e2e-ventanilla',
      });

    assertStatus(createRes, 201, 'Alta de tramite por alumno');
    createdTramiteId = createRes.body?.id_tramite;

    if (!createdTramiteId) {
      throw new Error(`Alta de tramite sin id_tramite. Respuesta: ${JSON.stringify(createRes.body)}`);
    }

    const adminListRes = await request(app)
      .get('/api/v1/admin/tramites')
      .set('Authorization', `Bearer ${controlToken}`);

    assertStatus(adminListRes, 200, 'Listado de tramites por Control Escolar');

    const tramiteEnAdmin = Array.isArray(adminListRes.body?.items)
      && adminListRes.body.items.some((item) => item.id_tramite === createdTramiteId);

    if (!tramiteEnAdmin) {
      throw new Error('Control Escolar no visualiza el tramite creado por alumno.');
    }

    const resolveRes = await request(app)
      .patch(`/api/v1/admin/tramites/${createdTramiteId}`)
      .set('Authorization', `Bearer ${controlToken}`)
      .send({
        estatus: 'resuelto',
        respuesta: 'Resuelto por Control Escolar en prueba E2E.',
      });

    assertStatus(resolveRes, 200, 'Resolucion de tramite por Control Escolar');

    const alumnoListRes = await request(app)
      .get('/api/v1/alumnos/tramites')
      .set('Authorization', `Bearer ${alumnoToken}`);

    assertStatus(alumnoListRes, 200, 'Consulta de tramites por alumno');

    const tramiteFinal = Array.isArray(alumnoListRes.body?.items)
      ? alumnoListRes.body.items.find((item) => item.id_tramite === createdTramiteId)
      : null;

    if (!tramiteFinal) {
      throw new Error('El alumno no visualiza el tramite creado en su ventanilla.');
    }

    if (tramiteFinal.estatus !== 'resuelto') {
      throw new Error(`Estatus final incorrecto. Esperado "resuelto", recibido "${tramiteFinal.estatus}".`);
    }

    if (!String(tramiteFinal.respuesta || '').includes('Control Escolar')) {
      throw new Error('El alumno no visualiza la respuesta de resolucion del tramite.');
    }

    console.log('E2E VENTANILLA OK: alumno crea tramite, control escolar resuelve y alumno visualiza estatus/respuesta.');
  } catch (error) {
    console.error('E2E VENTANILLA FAIL:', error.message);
    process.exitCode = 1;
  } finally {
    if (createdTramiteId) {
      await TramiteSolicitud.destroy({ where: { id_tramite: createdTramiteId } }).catch(() => {});
    }
    await sequelize.close().catch(() => {});
  }
}

run();
