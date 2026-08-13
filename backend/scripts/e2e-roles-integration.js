const request = require('supertest');
const app = require('../src/app');
const {
  sequelize,
  Materia,
  AsignacionGrupo,
  AlumnoGrupo,
  Tarea,
  MaterialClase,
  TramiteSolicitud,
  DesbloqueoManual,
} = require('../models');

const DEMO_USERS = {
  admin: { correo: 'admin@unicep.test', password: 'Admin123!', rol: 'director' },
  control: { correo: 'control.escolar@unicep.test', password: 'Control123!', rol: 'control_escolar' },
  docente: { correo: 'docente@unicep.test', password: 'Docente123!', rol: 'maestro' },
  alumno: { correo: 'alumno@unicep.test', password: 'Alumno123!', rol: 'alumno' },
};

function assertStatus(response, expectedStatus, context) {
  if (response.status !== expectedStatus) {
    throw new Error(
      `${context} fallo. Esperado ${expectedStatus}, recibido ${response.status}. Respuesta: ${JSON.stringify(response.body)}`,
    );
  }
}

function assertForbidden(response, context) {
  if (response.status !== 403) {
    throw new Error(
      `${context} fallo. Esperado 403, recibido ${response.status}. Respuesta: ${JSON.stringify(response.body)}`,
    );
  }
}

function uniqueCode(prefix) {
  return `${prefix}${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
}

async function loginAs({ correo, password, rol }) {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ correo, password });

  assertStatus(response, 200, `Login de ${rol}`);

  if (!response.body.token || response.body.user?.rol !== rol) {
    throw new Error(`Login de ${rol} sin token o rol incorrecto. Respuesta: ${JSON.stringify(response.body)}`);
  }

  return {
    token: response.body.token,
    user: response.body.user,
  };
}

async function run() {
  const created = {
    materiaId: null,
    asignacionId: null,
    materiaNoAsignadaId: null,
    tareaNoAsignadaId: null,
    tareaId: null,
    materialId: null,
    tramiteId: null,
  };

  try {
    await sequelize.authenticate();

    const adminSession = await loginAs(DEMO_USERS.admin);
    const controlSession = await loginAs(DEMO_USERS.control);
    const docenteSession = await loginAs(DEMO_USERS.docente);
    const alumnoSession = await loginAs(DEMO_USERS.alumno);

    const adminToken = adminSession.token;
    const controlToken = controlSession.token;
    const docenteToken = docenteSession.token;
    const alumnoToken = alumnoSession.token;

    const docenteId = docenteSession.user.id_usuario;
    const alumnoId = alumnoSession.user.id_usuario;

    console.log('1) Logins por rol: OK');

    const noTokenRes = await request(app).get('/api/v1/admin/dashboard');
    assertStatus(noTokenRes, 401, 'Proteccion sin token en admin/dashboard');

    const adminToAlumnoRes = await request(app)
      .get('/api/v1/alumnos/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    assertForbidden(adminToAlumnoRes, 'RBAC admin -> alumnos/dashboard');

    const docenteToAdminRes = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${docenteToken}`);
    assertForbidden(docenteToAdminRes, 'RBAC docente -> admin/dashboard');

    const alumnoToDocenteRes = await request(app)
      .get('/api/v1/docentes/dashboard')
      .set('Authorization', `Bearer ${alumnoToken}`);
    assertForbidden(alumnoToDocenteRes, 'RBAC alumno -> docentes/dashboard');

    const controlToRespaldoRes = await request(app)
      .get('/api/v1/admin/respaldo')
      .set('Authorization', `Bearer ${controlToken}`);
    assertForbidden(controlToRespaldoRes, 'RBAC control escolar -> respaldo');

    console.log('2) Seguridad y RBAC cruzado: OK');

    const adminDashboard = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    assertStatus(adminDashboard, 200, 'Dashboard admin');

    const docenteDashboard = await request(app)
      .get('/api/v1/docentes/dashboard')
      .set('Authorization', `Bearer ${docenteToken}`);
    assertStatus(docenteDashboard, 200, 'Dashboard docente');

    const alumnoDashboard = await request(app)
      .get('/api/v1/alumnos/dashboard')
      .set('Authorization', `Bearer ${alumnoToken}`);
    assertStatus(alumnoDashboard, 200, 'Dashboard alumno');

    const controlDashboard = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${controlToken}`);
    assertStatus(controlDashboard, 200, 'Dashboard control escolar');

    console.log('3) Dashboards por rol: OK');

    const bloquearAlumnoRes = await request(app)
      .patch(`/api/v1/admin/usuarios/${alumnoId}/cuenta`)
      .set('Authorization', `Bearer ${controlToken}`)
      .send({ cuenta_bloqueada: true });
    assertStatus(bloquearAlumnoRes, 200, 'Control Escolar bloqueando cuenta de alumno');

    const loginAlumnoBloqueadoRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ correo: DEMO_USERS.alumno.correo, password: DEMO_USERS.alumno.password });
    assertStatus(loginAlumnoBloqueadoRes, 423, 'Login rechazado para alumno bloqueado');

    const desbloquearAlumnoRes = await request(app)
      .patch(`/api/v1/admin/usuarios/${alumnoId}/cuenta`)
      .set('Authorization', `Bearer ${controlToken}`)
      .send({ cuenta_bloqueada: false });
    assertStatus(desbloquearAlumnoRes, 200, 'Control Escolar desbloqueando cuenta de alumno');

    console.log('3.1) Control de accesos de cuenta por Control Escolar: OK');

    const codigoMateria = uniqueCode('E2E');
    const crearMateriaRes = await request(app)
      .post('/api/v1/admin/materias')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre_materia: `Materia Integracion ${codigoMateria}`,
        codigo_materia: codigoMateria,
        carrera: 'Lic. en Administración de Empresas',
        bimestre_pertenece: 1,
      });

    assertStatus(crearMateriaRes, 201, 'Creacion de materia por admin');
    created.materiaId = crearMateriaRes.body.id_materia;

    const asignarDocenteRes = await request(app)
      .post('/api/v1/admin/docente-grupos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        id_docente: docenteId,
        id_materia: created.materiaId,
        grupo: 'E2E-A1',
      });
    assertStatus(asignarDocenteRes, 201, 'Asignacion docente-grupo por admin');
    created.asignacionId = asignarDocenteRes.body.id_asignacion;

    const altaAlumnoGrupoRes = await request(app)
      .post('/api/v1/admin/alumno-grupos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        id_alumno: alumnoId,
        id_materia: created.materiaId,
        grupo: 'E2E-A1',
      });

    if (![200, 201].includes(altaAlumnoGrupoRes.status)) {
      throw new Error(`Alta alumno-grupo fallo: ${altaAlumnoGrupoRes.status} ${JSON.stringify(altaAlumnoGrupoRes.body)}`);
    }

    console.log('4) Datos de integración creados por admin: OK');

    const crearMateriaNoAsignadaRes = await request(app)
      .post('/api/v1/admin/materias')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre_materia: `Materia Sin Asignar ${codigoMateria}`,
        codigo_materia: uniqueCode('E2N'),
        carrera: 'Lic. en Administración de Empresas',
        bimestre_pertenece: 1,
      });
    assertStatus(crearMateriaNoAsignadaRes, 201, 'Creacion de materia no asignada para casos negativos');
    created.materiaNoAsignadaId = crearMateriaNoAsignadaRes.body.id_materia;

    const docenteNoAsignadoRes = await request(app)
      .post(`/api/v1/docentes/materias/${created.materiaNoAsignadaId}/tareas`)
      .set('Authorization', `Bearer ${docenteToken}`)
      .send({
        titulo: `Tarea no permitida ${codigoMateria}`,
        descripcion: 'Este caso debe rechazar al docente.',
        fecha_limite: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      });
    assertForbidden(docenteNoAsignadoRes, 'Docente creando tarea en materia no asignada');

    const crearTareaNoAsignadaRes = await request(app)
      .post(`/api/v1/admin/docente-grupos`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        id_docente: docenteId,
        id_materia: created.materiaNoAsignadaId,
        grupo: 'E2E-B1',
      });
    assertStatus(crearTareaNoAsignadaRes, 201, 'Asignacion temporal para crear tarea negativa de alumno');

    const tareaNoAsignadaRes = await request(app)
      .post(`/api/v1/docentes/materias/${created.materiaNoAsignadaId}/tareas`)
      .set('Authorization', `Bearer ${docenteToken}`)
      .send({
        titulo: `Tarea solo para otro grupo ${codigoMateria}`,
        descripcion: 'El alumno demo no está inscrito aquí.',
        fecha_limite: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      });
    assertStatus(tareaNoAsignadaRes, 201, 'Creacion de tarea para negativa de alumno');
    created.tareaNoAsignadaId = tareaNoAsignadaRes.body.id_tarea;

    const alumnoNoInscritoEntregaRes = await request(app)
      .post(`/api/v1/alumnos/tareas/${created.tareaNoAsignadaId}/entregas`)
      .set('Authorization', `Bearer ${alumnoToken}`)
      .send({ archivo_entrega_url: 'https://unicep.test/evidencias/no-inscrito.pdf' });
    assertForbidden(alumnoNoInscritoEntregaRes, 'Alumno entregando tarea en materia no inscrita');

    const validarPagoInexistenteRes = await request(app)
      .patch('/api/v1/admin/pagos/999999/validar')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    assertStatus(validarPagoInexistenteRes, 404, 'Admin validando pago inexistente');

    console.log('4.1) Casos negativos de negocio: OK');

    const crearTareaRes = await request(app)
      .post(`/api/v1/docentes/materias/${created.materiaId}/tareas`)
      .set('Authorization', `Bearer ${docenteToken}`)
      .send({
        titulo: `Tarea E2E ${codigoMateria}`,
        descripcion: 'Actividad de integración entre roles',
        fecha_limite: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      });
    assertStatus(crearTareaRes, 201, 'Creacion de tarea por docente');
    created.tareaId = crearTareaRes.body.id_tarea;

    const crearMaterialRes = await request(app)
      .post(`/api/v1/docentes/materias/${created.materiaId}/materiales`)
      .set('Authorization', `Bearer ${docenteToken}`)
      .send({
        tema_semana: `Semana E2E ${codigoMateria}`,
        tipo_archivo: 'pdf',
        archivo_url: `https://unicep.test/material/${codigoMateria}`,
      });
    assertStatus(crearMaterialRes, 201, 'Publicacion de material por docente');
    created.materialId = crearMaterialRes.body.id_material;

    console.log('5) Producción académica por docente: OK');

    const alumnoTareasRes = await request(app)
      .get('/api/v1/alumnos/tareas')
      .set('Authorization', `Bearer ${alumnoToken}`);
    if (![200, 423].includes(alumnoTareasRes.status)) {
      throw new Error(`Consulta de tareas por alumno fallo. Estado: ${alumnoTareasRes.status}. Respuesta: ${JSON.stringify(alumnoTareasRes.body)}`);
    }

    if (alumnoTareasRes.status === 423) {
      throw new Error(
        'Flujo alumno bloqueado por estado financiero demo. Ejecuta seed de finanzas demo actualizado o regulariza pagos vencidos.',
      );
    }

    const tieneTarea = Array.isArray(alumnoTareasRes.body.items)
      && alumnoTareasRes.body.items.some((item) => item.id_tarea === created.tareaId);

    if (!tieneTarea) {
      throw new Error('El alumno no visualiza la tarea creada para su materia/grupo.');
    }

    const alumnoMaterialesRes = await request(app)
      .get('/api/v1/alumnos/materiales')
      .set('Authorization', `Bearer ${alumnoToken}`);
    if (![200, 423].includes(alumnoMaterialesRes.status)) {
      throw new Error(`Consulta de materiales por alumno fallo. Estado: ${alumnoMaterialesRes.status}. Respuesta: ${JSON.stringify(alumnoMaterialesRes.body)}`);
    }

    if (alumnoMaterialesRes.status === 423) {
      throw new Error(
        'Materiales bloqueados por estado financiero demo. Ejecuta seed de finanzas demo actualizado o regulariza pagos vencidos.',
      );
    }

    const tieneMaterial = Array.isArray(alumnoMaterialesRes.body.items)
      && alumnoMaterialesRes.body.items.some((item) => item.id_material === created.materialId);

    if (!tieneMaterial) {
      throw new Error('El alumno no visualiza el material publicado para su materia/grupo.');
    }

    const alumnoPagosRes = await request(app)
      .get('/api/v1/alumnos/pagos')
      .set('Authorization', `Bearer ${alumnoToken}`);
    assertStatus(alumnoPagosRes, 200, 'Consulta financiera por alumno');

    const crearTramiteAlumnoRes = await request(app)
      .post('/api/v1/alumnos/tramites')
      .set('Authorization', `Bearer ${alumnoToken}`)
      .send({
        tipo: 'constancia',
        descripcion: `Solicitud E2E ${codigoMateria}`,
      });
    assertStatus(crearTramiteAlumnoRes, 201, 'Alta de trámite por alumno');
    created.tramiteId = crearTramiteAlumnoRes.body.id_tramite;

    const listarTramitesControlRes = await request(app)
      .get('/api/v1/admin/tramites')
      .set('Authorization', `Bearer ${controlToken}`);
    assertStatus(listarTramitesControlRes, 200, 'Listado de trámites por Control Escolar');

    const resolverTramiteControlRes = await request(app)
      .patch(`/api/v1/admin/tramites/${created.tramiteId}`)
      .set('Authorization', `Bearer ${controlToken}`)
      .send({
        estatus: 'resuelto',
        respuesta: 'Resuelto por ventanilla de control escolar.',
      });
    assertStatus(resolverTramiteControlRes, 200, 'Resolución de trámite por Control Escolar');

    const listarTramitesAlumnoRes = await request(app)
      .get('/api/v1/alumnos/tramites')
      .set('Authorization', `Bearer ${alumnoToken}`);
    assertStatus(listarTramitesAlumnoRes, 200, 'Consulta de trámites por alumno');

    const tramiteResuelto = Array.isArray(listarTramitesAlumnoRes.body.items)
      && listarTramitesAlumnoRes.body.items.some(
        (item) => item.id_tramite === created.tramiteId && item.estatus === 'resuelto',
      );

    if (!tramiteResuelto) {
      throw new Error('El alumno no refleja el trámite resuelto por Control Escolar.');
    }

    console.log('6.1) Flujo de trámites Alumno <-> Control Escolar: OK');

    const reporteFinanzasRes = await request(app)
      .get('/api/v1/admin/reportes/financieros')
      .set('Authorization', `Bearer ${adminToken}`);
    assertStatus(reporteFinanzasRes, 200, 'Reporte financiero admin');

    const respaldoRes = await request(app)
      .get('/api/v1/admin/respaldo')
      .set('Authorization', `Bearer ${adminToken}`);
    assertStatus(respaldoRes, 200, 'Respaldo de metadatos admin');

    if (!respaldoRes.body.archivo?.ruta_relativa) {
      throw new Error('El respaldo no devolvió metadata de archivo guardado.');
    }

    console.log('7) Consumo por alumno + reporte y respaldo por admin: OK');
    console.log('E2E MULTIROL OK: Admin, Control Escolar, Docente y Alumno se complementan en flujo operativo.');
  } catch (error) {
    console.error('E2E MULTIROL FAIL:', error.message);
    process.exitCode = 1;
  } finally {
    if (created.materialId) {
      await MaterialClase.destroy({ where: { id_material: created.materialId } }).catch(() => {});
    }

    if (created.tareaId) {
      await Tarea.destroy({ where: { id_tarea: created.tareaId } }).catch(() => {});
    }

    if (created.tramiteId) {
      await TramiteSolicitud.destroy({ where: { id_tramite: created.tramiteId } }).catch(() => {});
    }

    if (created.materiaId) {
      await AlumnoGrupo.destroy({ where: { id_materia: created.materiaId } }).catch(() => {});
    }

    if (created.asignacionId) {
      await AsignacionGrupo.destroy({ where: { id_asignacion: created.asignacionId } }).catch(() => {});
    }

    if (created.tareaNoAsignadaId) {
      await Tarea.destroy({ where: { id_tarea: created.tareaNoAsignadaId } }).catch(() => {});
    }

    if (created.materiaNoAsignadaId) {
      await AsignacionGrupo.destroy({ where: { id_materia: created.materiaNoAsignadaId } }).catch(() => {});
      await AlumnoGrupo.destroy({ where: { id_materia: created.materiaNoAsignadaId } }).catch(() => {});
      await Materia.destroy({ where: { id_materia: created.materiaNoAsignadaId } }).catch(() => {});
    }

    if (created.materiaId) {
      await Materia.destroy({ where: { id_materia: created.materiaId } }).catch(() => {});
    }

    await sequelize.close().catch(() => {});
  }
}

run();
