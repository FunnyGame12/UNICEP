'use strict';

const bcrypt = require('bcrypt');
const {
  sequelize,
  Usuario,
  PlanEstudio,
  ProgramaAcademico,
  Materia,
  DocentePerfil,
  AsignacionGrupo,
  Horario,
  AlumnoPerfil,
  AlumnoGrupo,
  AvisoInstitucional,
} = require('./models');

async function createUser({ folio, nombre, correo, rol, password }) {
  const now = new Date();
  const passwordHash = await bcrypt.hash(password, 10);

  return Usuario.create({
    folio_matricula: folio,
    nombre_completo: nombre,
    correo: correo.toLowerCase(),
    password_hash: passwordHash,
    cuenta_activada: true,
    rol,
    fecha_creacion: now,
  });
}

async function runSeed() {
  const defaultPassword = 'Unicep2026!';
  const now = new Date();

  await sequelize.sync({ force: true });

  // A. Usuarios (identidades reales)
  const director = await createUser({
    folio: 'DIR-2026-0001',
    nombre: 'Dr Roberto Sandoval Medina',
    correo: 'roberto.sandoval@unicep.edu.mx',
    rol: 'director',
    password: defaultPassword,
  });

  const controlEscolar = await createUser({
    folio: 'CTL-2026-0001',
    nombre: 'Lic Mariana Gomez Torres',
    correo: 'mariana.gomez@unicep.edu.mx',
    rol: 'control_escolar',
    password: defaultPassword,
  });

  const coordinacionEscolar = await createUser({
    folio: 'COE-2026-0001',
    nombre: 'Ing Fernando Castro Ruiz',
    correo: 'fernando.castro@unicep.edu.mx',
    rol: 'coordinacion_escolar',
    password: defaultPassword,
  });

  const docente1 = await createUser({
    folio: 'DOC-2026-0001',
    nombre: 'Mtro Arturo Ramirez Vargas',
    correo: 'arturo.ramirez@unicep.edu.mx',
    rol: 'docente',
    password: defaultPassword,
  });

  const docente2 = await createUser({
    folio: 'DOC-2026-0002',
    nombre: 'Dra Elena Medina Canto',
    correo: 'elena.medina@unicep.edu.mx',
    rol: 'docente',
    password: defaultPassword,
  });

  const alumno1 = await createUser({
    folio: 'UNICEP-26-0001',
    nombre: 'Jafet Ricardo Pacheco Dzul',
    correo: 'jafet.pacheco@alumno.unicep.edu.mx',
    rol: 'alumno',
    password: defaultPassword,
  });

  const alumno2 = await createUser({
    folio: 'UNICEP-26-0002',
    nombre: 'Andrea Berenice Chan May',
    correo: 'andrea.chan@alumno.unicep.edu.mx',
    rol: 'alumno',
    password: defaultPassword,
  });

  const alumno3 = await createUser({
    folio: 'UNICEP-26-0003',
    nombre: 'Luis Fernando Pech Canul',
    correo: 'luis.pech@alumno.unicep.edu.mx',
    rol: 'alumno',
    password: defaultPassword,
  });

  const alumno4 = await createUser({
    folio: 'UNICEP-26-0004',
    nombre: 'Valeria Guadalupe Moo Ceh',
    correo: 'valeria.moo@alumno.unicep.edu.mx',
    rol: 'alumno',
    password: defaultPassword,
  });

  const alumno5 = await createUser({
    folio: 'UNICEP-26-0005',
    nombre: 'Daniel Alejandro Cetz Uicab',
    correo: 'daniel.cetz@alumno.unicep.edu.mx',
    rol: 'alumno',
    password: defaultPassword,
  });

  // B. Carrera / programa y plan de estudio
  const programa = await ProgramaAcademico.create({
    tipo_nivel: 'ingenieria',
    nombre: 'Ingenieria en Desarrollo de Software',
    modalidad_periodo: 'cuatrimestral',
    total_periodos: 9,
    estatus: 'activo',
    fecha_creacion: now,
  });

  const plan = await PlanEstudio.create({
    nombre: 'Plan IDS 2026',
    carrera: 'Ingenieria en Desarrollo de Software',
    version: '2026.1',
    activo: true,
    fecha_creacion: now,
  });

  // C. Materias
  const materia1 = await Materia.create({
    nombre_materia: 'Programacion Orientada a Objetos',
    codigo_materia: 'IDS-101',
    programa_academico_id: programa.id,
    periodo_numero: 1,
    creditos: 8,
    horas_semanales: 6,
    carrera: 'Ingenieria en Desarrollo de Software',
    bimestre_pertenece: 1,
    activa: true,
    recurso_sep_tipo: 'ninguno',
  });

  const materia2 = await Materia.create({
    nombre_materia: 'Bases de Datos Relacionales',
    codigo_materia: 'IDS-102',
    programa_academico_id: programa.id,
    periodo_numero: 1,
    creditos: 6,
    horas_semanales: 5,
    carrera: 'Ingenieria en Desarrollo de Software',
    bimestre_pertenece: 1,
    activa: true,
    recurso_sep_tipo: 'ninguno',
  });

  const materia3 = await Materia.create({
    nombre_materia: 'Administracion de Redes',
    codigo_materia: 'IDS-103',
    programa_academico_id: programa.id,
    periodo_numero: 1,
    creditos: 6,
    horas_semanales: 5,
    carrera: 'Ingenieria en Desarrollo de Software',
    bimestre_pertenece: 1,
    activa: true,
    recurso_sep_tipo: 'ninguno',
  });

  // D. Grupos y horarios
  await Horario.bulkCreate([
    {
      modalidad: 'presencial',
      periodo: '2026-C1',
      turno: 'Matutino',
      hora_inicio: '07:00',
      hora_fin: '08:30',
      aula: 'AULA-101',
      descripcion: 'Grupo A1',
    },
    {
      modalidad: 'virtual',
      periodo: '2026-C1',
      turno: 'Vespertino',
      hora_inicio: '17:00',
      hora_fin: '18:30',
      aula: 'SALA-VIRTUAL-1',
      descripcion: 'Grupo A2',
    },
  ]);

  // E. Carga horaria
  await DocentePerfil.bulkCreate([
    { id_docente: docente1.id_usuario, estatus_laboral: 'activo' },
    { id_docente: docente2.id_usuario, estatus_laboral: 'activo' },
  ]);

  await AsignacionGrupo.bulkCreate([
    {
      id_materia: materia1.id_materia,
      id_docente: docente1.id_usuario,
      grupo: 'A1',
      horas_semanales: 6,
    },
    {
      id_materia: materia2.id_materia,
      id_docente: docente2.id_usuario,
      grupo: 'A2',
      horas_semanales: 5,
    },
    {
      id_materia: materia3.id_materia,
      id_docente: docente2.id_usuario,
      grupo: 'A2',
      horas_semanales: 5,
    },
  ]);

  // F. Inscripciones de alumnos
  await AlumnoPerfil.bulkCreate([
    {
      id_alumno: alumno1.id_usuario,
      carrera: 'Ingenieria en Desarrollo de Software',
      id_plan_estudio: plan.id_plan_estudio,
      bimestre_actual: 1,
      estado_academico: 'activo',
      estatus_financiero: 'al_dia',
      modalidad_boleta: 'ONLINE',
      campus_boleta: 'UNICEP MERIDA',
    },
    {
      id_alumno: alumno2.id_usuario,
      carrera: 'Ingenieria en Desarrollo de Software',
      id_plan_estudio: plan.id_plan_estudio,
      bimestre_actual: 1,
      estado_academico: 'activo',
      estatus_financiero: 'al_dia',
      modalidad_boleta: 'ONLINE',
      campus_boleta: 'UNICEP MERIDA',
    },
    {
      id_alumno: alumno3.id_usuario,
      carrera: 'Ingenieria en Desarrollo de Software',
      id_plan_estudio: plan.id_plan_estudio,
      bimestre_actual: 1,
      estado_academico: 'activo',
      estatus_financiero: 'al_dia',
      modalidad_boleta: 'ONLINE',
      campus_boleta: 'UNICEP MERIDA',
    },
    {
      id_alumno: alumno4.id_usuario,
      carrera: 'Ingenieria en Desarrollo de Software',
      id_plan_estudio: plan.id_plan_estudio,
      bimestre_actual: 1,
      estado_academico: 'activo',
      estatus_financiero: 'al_dia',
      modalidad_boleta: 'ONLINE',
      campus_boleta: 'UNICEP MERIDA',
    },
    {
      id_alumno: alumno5.id_usuario,
      carrera: 'Ingenieria en Desarrollo de Software',
      id_plan_estudio: plan.id_plan_estudio,
      bimestre_actual: 1,
      estado_academico: 'activo',
      estatus_financiero: 'al_dia',
      modalidad_boleta: 'ONLINE',
      campus_boleta: 'UNICEP MERIDA',
    },
  ]);

  await AlumnoGrupo.bulkCreate([
    {
      id_alumno: alumno1.id_usuario,
      id_materia: materia1.id_materia,
      grupo: 'A1',
      fecha_alta: now,
    },
    {
      id_alumno: alumno2.id_usuario,
      id_materia: materia1.id_materia,
      grupo: 'A1',
      fecha_alta: now,
    },
    {
      id_alumno: alumno3.id_usuario,
      id_materia: materia1.id_materia,
      grupo: 'A1',
      fecha_alta: now,
    },
    {
      id_alumno: alumno4.id_usuario,
      id_materia: materia2.id_materia,
      grupo: 'A2',
      fecha_alta: now,
    },
    {
      id_alumno: alumno4.id_usuario,
      id_materia: materia3.id_materia,
      grupo: 'A2',
      fecha_alta: now,
    },
    {
      id_alumno: alumno5.id_usuario,
      id_materia: materia2.id_materia,
      grupo: 'A2',
      fecha_alta: now,
    },
    {
      id_alumno: alumno5.id_usuario,
      id_materia: materia3.id_materia,
      grupo: 'A2',
      fecha_alta: now,
    },
  ]);

  // G. Datos transaccionales
  await AvisoInstitucional.bulkCreate([
    {
      titulo: 'Bienvenida al ciclo cuatrimestral 2026',
      mensaje: 'Coordinacion Escolar informa que las clases inician de acuerdo con el calendario oficial.',
      destinatario: 'general',
      tipo_adjunto: 'ninguno',
      url_adjunto: null,
      carrera_id: null,
      cuatrimestre_id: 1,
      grupo_id: null,
      activo: true,
      created_at: now,
      updated_at: now,
    },
    {
      titulo: 'Validacion documental de alumnos de nuevo ingreso',
      mensaje: 'Control Escolar solicita revisar documentos digitales en plataforma antes del cierre administrativo.',
      destinatario: 'alumnos',
      tipo_adjunto: 'ninguno',
      url_adjunto: null,
      carrera_id: 'Ingenieria en Desarrollo de Software',
      cuatrimestre_id: 1,
      grupo_id: null,
      activo: true,
      created_at: now,
      updated_at: now,
    },
  ]);

  // Variables referenciadas para mantener claridad del orden de creacion solicitado.
  void director;
  void controlEscolar;
  void coordinacionEscolar;

  console.log('Credenciales de acceso para todos los usuarios: Unicep2026!');
  console.log('✅ Base de datos reiniciada y poblada con identidades reales.');
  process.exit(0);
}

runSeed().catch(async (error) => {
  console.error('Error al ejecutar seed.js:', error);
  try {
    await sequelize.close();
  } catch (_closeError) {
    // no-op
  }
  process.exit(1);
});