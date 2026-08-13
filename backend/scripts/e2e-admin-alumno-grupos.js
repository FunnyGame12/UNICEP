const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const {
  sequelize,
  Usuario,
  AlumnoPerfil,
  DocentePerfil,
  Materia,
  AsignacionGrupo,
  AlumnoGrupo,
} = require('../models');

function uniq(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function shortCode(prefix) {
  const num = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `${prefix}${num}`;
}

async function run() {
  const ids = {};

  try {
    await sequelize.authenticate();

    const adminPassword = 'Admin123!';
    const adminHash = await bcrypt.hash(adminPassword, 10);

    const admin = await Usuario.create({
      folio_matricula: uniq('ADM'),
      nombre_completo: 'Admin E2E',
      correo: `${uniq('admin')}@unicep.test`,
      password_hash: adminHash,
      rol: 'administrativo',
      foto_url: null,
      fecha_creacion: new Date(),
    });
    ids.admin = admin.id_usuario;

    const alumnoUser = await Usuario.create({
      folio_matricula: uniq('ALU'),
      nombre_completo: 'Alumno E2E',
      correo: `${uniq('alumno')}@unicep.test`,
      password_hash: await bcrypt.hash('Alumno123!', 10),
      rol: 'alumno',
      foto_url: null,
      fecha_creacion: new Date(),
    });
    ids.alumno = alumnoUser.id_usuario;

    await AlumnoPerfil.create({
      id_alumno: alumnoUser.id_usuario,
      carrera: 'Ingenieria en Sistemas',
      id_plan_estudio: 1,
      bimestre_actual: 1,
    });

    const docenteUser = await Usuario.create({
      folio_matricula: uniq('DOC'),
      nombre_completo: 'Docente E2E',
      correo: `${uniq('docente')}@unicep.test`,
      password_hash: await bcrypt.hash('Docente123!', 10),
      rol: 'docente',
      foto_url: null,
      fecha_creacion: new Date(),
    });
    ids.docente = docenteUser.id_usuario;

    await DocentePerfil.create({
      id_docente: docenteUser.id_usuario,
      estatus_laboral: 'activo',
    });

    const materia = await Materia.create({
      nombre_materia: 'Arquitectura de Software',
      codigo_materia: shortCode('MAT'),
      bimestre_pertenece: 1,
    });
    ids.materia = materia.id_materia;

    await AsignacionGrupo.create({
      id_materia: materia.id_materia,
      id_docente: docenteUser.id_usuario,
      grupo: 'A1',
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ correo: admin.correo, password: adminPassword });

    if (loginRes.status !== 200 || !loginRes.body.token) {
      throw new Error(`Login admin fallo: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
    }

    const token = loginRes.body.token;

    const altaRes = await request(app)
      .post('/api/v1/admin/alumno-grupos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id_alumno: alumnoUser.id_usuario,
        id_materia: materia.id_materia,
        grupo: 'A1',
      });

    if (![200, 201].includes(altaRes.status)) {
      throw new Error(`Alta alumno-grupo fallo: ${altaRes.status} ${JSON.stringify(altaRes.body)}`);
    }

    const consultaRes = await request(app)
      .get(`/api/v1/admin/alumno-grupos?id_alumno=${alumnoUser.id_usuario}`)
      .set('Authorization', `Bearer ${token}`);

    if (consultaRes.status !== 200 || !Array.isArray(consultaRes.body.items)) {
      throw new Error(`Consulta alumno-grupo fallo: ${consultaRes.status} ${JSON.stringify(consultaRes.body)}`);
    }

    const found = consultaRes.body.items.find(
      (x) => x.id_alumno === alumnoUser.id_usuario && x.id_materia === materia.id_materia,
    );

    if (!found) {
      throw new Error('Consulta no devolvio la asignacion creada.');
    }

    const bajaRes = await request(app)
      .delete(`/api/v1/admin/alumno-grupos/${alumnoUser.id_usuario}/${materia.id_materia}`)
      .set('Authorization', `Bearer ${token}`);

    if (bajaRes.status !== 204) {
      throw new Error(`Baja alumno-grupo fallo: ${bajaRes.status} ${JSON.stringify(bajaRes.body)}`);
    }

    console.log('E2E OK: login, alta, consulta y baja de alumno-grupo completados.');
  } catch (error) {
    console.error('E2E FAIL:', error.message);
    process.exitCode = 1;
  } finally {
    if (ids.alumno && ids.materia) {
      await AlumnoGrupo.destroy({
        where: {
          id_alumno: ids.alumno,
          id_materia: ids.materia,
        },
      }).catch(() => {});
    }

    if (ids.materia) {
      await AsignacionGrupo.destroy({ where: { id_materia: ids.materia } }).catch(() => {});
      await Materia.destroy({ where: { id_materia: ids.materia } }).catch(() => {});
    }

    if (ids.docente) {
      await DocentePerfil.destroy({ where: { id_docente: ids.docente } }).catch(() => {});
      await Usuario.destroy({ where: { id_usuario: ids.docente } }).catch(() => {});
    }

    if (ids.alumno) {
      await AlumnoPerfil.destroy({ where: { id_alumno: ids.alumno } }).catch(() => {});
      await Usuario.destroy({ where: { id_usuario: ids.alumno } }).catch(() => {});
    }

    if (ids.admin) {
      await Usuario.destroy({ where: { id_usuario: ids.admin } }).catch(() => {});
    }

    await sequelize.close().catch(() => {});
  }
}

run();
