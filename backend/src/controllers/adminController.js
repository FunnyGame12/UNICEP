const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { Op } = require('sequelize');
const {
  sequelize,
  Sequelize,
  Usuario,
  PagoEstatus,
  PeriodoAcademico,
  PlanEstudio,
  EntregaTarea,
  TramiteSolicitud,
  DocentePerfil,
  AlumnoPerfil,
  AlumnoGrupo,
  Materia,
  AsignacionGrupo,
  Horario,
} = require('../../models');
const { registrarEventoAuditoria } = require('../services/auditService');

const ROLE_FOLIO_PREFIX = {
  director: 'DIR',
  control_escolar: 'CES',
  coordinacion_academica: 'COA',
  maestro: 'DOC',
  alumno: 'ALU',
};

const VALID_FINANCIAL_STATUS = new Set(['pagado', 'pendiente', 'vencido']);

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase();
}

function getRolePrefix(role) {
  return ROLE_FOLIO_PREFIX[normalizeRole(role)] || 'USR';
}

function buildRoleBasedFolio(role, sequence) {
  const year = new Date().getFullYear();
  return `${getRolePrefix(role)}-${year}-${String(sequence).padStart(5, '0')}`;
}

async function nextFolioForRole(role) {
  const normalizedRole = normalizeRole(role);
  const prefix = getRolePrefix(normalizedRole);
  const year = new Date().getFullYear();

  const [existing, totalByRole] = await Promise.all([
    Usuario.count({
      where: {
        folio_matricula: {
          [Op.like]: `${prefix}-${year}-%`,
        },
      },
    }),
    Usuario.count({ where: { rol: normalizedRole } }),
  ]);

  const seed = Math.max(existing, totalByRole) + 1;
  let attempts = 0;

  while (attempts < 20) {
    const candidate = buildRoleBasedFolio(normalizedRole, seed + attempts);
    // Evita colisión por folio único cuando hay altas concurrentes.
    // eslint-disable-next-line no-await-in-loop
    const duplicate = await Usuario.findOne({
      where: { folio_matricula: candidate },
      attributes: ['id_usuario'],
    });
    if (!duplicate) {
      return candidate;
    }
    attempts += 1;
  }

  throw new Error('No se pudo generar un folio unico para el rol especificado.');
}

async function assignOrGenerateFolio({ folioInput, role }) {
  const normalizedRole = normalizeRole(role);
  const incomingFolio = String(folioInput || '').trim().toUpperCase();
  const expectedPrefix = `${getRolePrefix(normalizedRole)}-`;

  if (incomingFolio) {
    if (!incomingFolio.startsWith(expectedPrefix)) {
      const readableRole = normalizedRole || 'rol_desconocido';
      return {
        error: `El folio para rol ${readableRole} debe iniciar con ${expectedPrefix}.`,
      };
    }
    return { folio: incomingFolio, auto: false };
  }

  const generated = await nextFolioForRole(normalizedRole);
  return { folio: generated, auto: true };
}

async function resumenUsuarios(_req, res) {
  const [alumnos, docentes, administrativos] = await Promise.all([
    Usuario.count({ where: { rol: 'alumno' } }),
    Usuario.count({ where: { rol: 'maestro' } }),
    Usuario.count({
      where: {
        rol: {
          [Op.in]: ['director', 'control_escolar', 'coordinacion_academica'],
        },
      },
    }),
  ]);

  return res.json({ alumnos, docentes, administrativos });
}

async function buscarUsuariosDirector(req, res) {
  const query = String(req.query.q || '').trim();
  const where = query
    ? {
      [Op.or]: [
        { nombre_completo: { [Op.like]: `%${query}%` } },
        { correo: { [Op.like]: `%${query}%` } },
        { folio_matricula: { [Op.like]: `%${query}%` } },
      ],
    }
    : {};

  const usuarios = await Usuario.findAll({
    where,
    attributes: ['id_usuario', 'nombre_completo', 'correo', 'folio_matricula', 'rol'],
    order: [['nombre_completo', 'ASC']],
    limit: 25,
  });

  return res.json({ items: usuarios });
}

async function buscarPagosDirector(req, res) {
  const query = String(req.query.q || '').trim();
  const where = query
    ? {
      [Op.or]: [
        { concepto: { [Op.like]: `%${query}%` } },
        { folio_interno: { [Op.like]: `%${query}%` } },
      ],
    }
    : {};

  const pagos = await PagoEstatus.findAll({
    where,
    attributes: ['id_pago', 'id_alumno', 'concepto', 'monto', 'estatus', 'folio_interno'],
    order: [['id_pago', 'DESC']],
    limit: 25,
  });

  return res.json({ items: pagos });
}

async function dashboard(_req, res) {
  const [
    totalMaterias,
    totalAlumnos,
    periodosActivos,
    planesActivos,
    rolesRaw,
    estatusRaw,
    pagosVencidos,
    entregasPendientesControl,
  ] = await Promise.all([
    Materia.count({ where: { activa: true } }),
    AlumnoPerfil.count(),
    PeriodoAcademico.count({ where: { estatus: 'activo' } }),
    PlanEstudio.count({ where: { activo: true } }),
    Usuario.findAll({
      attributes: ['rol', [sequelize.fn('COUNT', sequelize.col('rol')), 'total']],
      group: ['rol'],
      raw: true,
    }),
    PagoEstatus.findAll({
      attributes: [
        'estatus',
        [sequelize.fn('COUNT', sequelize.col('estatus')), 'total'],
        [sequelize.fn('SUM', sequelize.col('monto')), 'monto_total'],
      ],
      group: ['estatus'],
      raw: true,
    }),
    PagoEstatus.count({ where: { estatus: 'vencido' } }),
    EntregaTarea.count({ where: { validada_control_escolar: false } }),
  ]);

  return res.json({
    academico: {
      materias_activas: totalMaterias,
      alumnos_total: totalAlumnos,
      periodos_activos: periodosActivos,
      planes_activos: planesActivos,
      entregas_pendientes_validacion: entregasPendientesControl,
    },
    financiero: {
      pagos_vencidos: pagosVencidos,
      estatus: estatusRaw,
    },
    usuarios: {
      roles: rolesRaw,
    },
  });
}

async function crearUsuario(req, res) {
  const {
    folio_matricula,
    nombre_completo,
    correo,
    password,
    rol,
    foto_url,
  } = req.body;

  const rolNormalizado = normalizeRole(rol);
  const nombre = String(nombre_completo || '').trim();
  const correoInput = (correo || '').trim().toLowerCase();

  if (!nombre || !rolNormalizado) {
    return res.status(400).json({
      message: 'nombre_completo y rol son obligatorios.',
    });
  }

  const folioData = await assignOrGenerateFolio({
    folioInput: folio_matricula,
    role: rolNormalizado,
  });
  if (folioData.error) {
    return res.status(400).json({ message: folioData.error });
  }

  const cuentaActivada = Boolean(correoInput && password);
  const folio = folioData.folio;
  const correoFinal = cuentaActivada
    ? correoInput
    : `pending+${folio.toLowerCase()}@unicep.local`;
  const passwordSource = cuentaActivada ? password : crypto.randomUUID();

  const password_hash = await bcrypt.hash(passwordSource, 10);
  const nuevo = await Usuario.create({
    folio_matricula: folio,
    nombre_completo: nombre,
    correo: correoFinal,
    password_hash,
    cuenta_activada: cuentaActivada,
    rol: rolNormalizado,
    foto_url: foto_url || null,
    fecha_creacion: new Date(),
  });

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: cuentaActivada ? 'crear_usuario_activado' : 'pre_registrar_usuario_folio',
    modulo: 'admin',
    entidad: 'usuarios',
    idEntidad: nuevo.id_usuario,
    detalle: {
      folio_matricula: nuevo.folio_matricula,
      rol: nuevo.rol,
      cuenta_activada: nuevo.cuenta_activada,
      folio_automatico: folioData.auto,
    },
  });

  return res.status(201).json({
    id_usuario: nuevo.id_usuario,
    folio_matricula: nuevo.folio_matricula,
    nombre_completo: nuevo.nombre_completo,
    rol: nuevo.rol,
    cuenta_activada: nuevo.cuenta_activada,
    folio_generado_automaticamente: folioData.auto,
    mensaje: cuentaActivada
      ? 'Usuario creado y activado.'
      : 'Usuario preregistrado. Debe activar cuenta con folio.',
  });
}

async function politicaFoliosPorRol(_req, res) {
  const year = new Date().getFullYear();
  const politica = Object.entries(ROLE_FOLIO_PREFIX).map(([rol, prefijo]) => ({
    rol,
    prefijo,
    ejemplo: `${prefijo}-${year}-00001`,
  }));

  return res.json({ items: politica });
}

async function preasignarFolioPorRol(req, res) {
  const rol = normalizeRole(req.body.rol);
  if (!rol) {
    return res.status(400).json({ message: 'rol es obligatorio.' });
  }

  const folio = await nextFolioForRole(rol);
  return res.json({ rol, folio });
}

async function actualizarFolioUsuario(req, res) {
  const idUsuario = Number(req.params.id_usuario);
  if (!Number.isInteger(idUsuario)) {
    return res.status(400).json({ message: 'id_usuario invalido.' });
  }

  const usuario = await Usuario.findByPk(idUsuario);
  if (!usuario) {
    return res.status(404).json({ message: 'Usuario no encontrado.' });
  }

  const nuevoFolioInput = req.body.folio_matricula;
  const retiroManual = Boolean(req.body.retirar);
  const previo = usuario.folio_matricula;

  if (retiroManual) {
    usuario.folio_matricula = `RET-${idUsuario}-${Date.now()}`;
    await usuario.save();

    await registrarEventoAuditoria({
      idUsuario: req.user.id_usuario,
      rolActor: req.user.rol,
      accion: 'retirar_folio_usuario',
      modulo: 'director',
      entidad: 'usuarios',
      idEntidad: usuario.id_usuario,
      detalle: { folio_anterior: previo, folio_nuevo: usuario.folio_matricula },
    });

    return res.json({
      id_usuario: usuario.id_usuario,
      folio_anterior: previo,
      folio_matricula: usuario.folio_matricula,
      accion: 'retirado',
    });
  }

  const folioData = await assignOrGenerateFolio({
    folioInput: nuevoFolioInput,
    role: usuario.rol,
  });

  if (folioData.error) {
    return res.status(400).json({ message: folioData.error });
  }

  const existeEnOtro = await Usuario.findOne({
    where: {
      folio_matricula: folioData.folio,
      id_usuario: { [Op.ne]: usuario.id_usuario },
    },
    attributes: ['id_usuario'],
  });

  if (existeEnOtro) {
    return res.status(409).json({ message: 'El folio ya esta asignado a otro usuario.' });
  }

  usuario.folio_matricula = folioData.folio;
  await usuario.save();

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: previo ? 'reasignar_folio_usuario' : 'asignar_folio_usuario',
    modulo: 'director',
    entidad: 'usuarios',
    idEntidad: usuario.id_usuario,
    detalle: {
      folio_anterior: previo,
      folio_nuevo: usuario.folio_matricula,
      auto_generado: folioData.auto,
    },
  });

  return res.json({
    id_usuario: usuario.id_usuario,
    folio_anterior: previo,
    folio_matricula: usuario.folio_matricula,
    auto_generado: folioData.auto,
  });
}

async function validarPago(req, res) {
  const { id } = req.params;
  const { folio_interno } = req.body;

  const pago = await PagoEstatus.findByPk(id);
  if (!pago) {
    return res.status(404).json({ message: 'Pago no encontrado.' });
  }

  pago.estatus = 'pagado';
  pago.fecha_pago = new Date();
  pago.folio_interno = folio_interno || pago.folio_interno;
  await pago.save();

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'validar_pago',
    modulo: 'admin',
    entidad: 'pagos_estatus',
    idEntidad: pago.id_pago,
    detalle: {
      id_alumno: pago.id_alumno,
      estatus: pago.estatus,
      fecha_pago: pago.fecha_pago,
      folio_interno: pago.folio_interno,
    },
  });

  return res.json(pago);
}

async function actualizarFolioPago(req, res) {
  const idPago = Number(req.params.id_pago);
  if (!Number.isInteger(idPago)) {
    return res.status(400).json({ message: 'id_pago invalido.' });
  }

  const pago = await PagoEstatus.findByPk(idPago);
  if (!pago) {
    return res.status(404).json({ message: 'Pago no encontrado.' });
  }

  const retiroManual = Boolean(req.body.retirar);
  const previo = pago.folio_interno;

  if (retiroManual) {
    pago.folio_interno = null;
    await pago.save();

    await registrarEventoAuditoria({
      idUsuario: req.user.id_usuario,
      rolActor: req.user.rol,
      accion: 'retirar_folio_pago',
      modulo: 'director',
      entidad: 'pagos_estatus',
      idEntidad: pago.id_pago,
      detalle: { folio_anterior: previo, folio_nuevo: null },
    });

    return res.json({
      id_pago: pago.id_pago,
      folio_anterior: previo,
      folio_interno: pago.folio_interno,
      accion: 'retirado',
    });
  }

  const nuevoFolio = String(req.body.folio_interno || '').trim().toUpperCase();
  if (!nuevoFolio) {
    return res.status(400).json({ message: 'folio_interno es obligatorio.' });
  }

  pago.folio_interno = nuevoFolio;
  await pago.save();

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: previo ? 'reasignar_folio_pago' : 'asignar_folio_pago',
    modulo: 'director',
    entidad: 'pagos_estatus',
    idEntidad: pago.id_pago,
    detalle: { folio_anterior: previo, folio_nuevo: nuevoFolio },
  });

  return res.json({
    id_pago: pago.id_pago,
    folio_anterior: previo,
    folio_interno: pago.folio_interno,
  });
}

async function overrideEstatusFinanciero(req, res) {
  const idPago = Number(req.params.id_pago);
  if (!Number.isInteger(idPago)) {
    return res.status(400).json({ message: 'id_pago invalido.' });
  }

  const pago = await PagoEstatus.findByPk(idPago);
  if (!pago) {
    return res.status(404).json({ message: 'Pago no encontrado.' });
  }

  const estatusNuevo = String(req.body.estatus || '').trim().toLowerCase();
  if (estatusNuevo && !VALID_FINANCIAL_STATUS.has(estatusNuevo)) {
    return res.status(400).json({ message: 'estatus invalido. Usa: pagado, pendiente o vencido.' });
  }

  const montoNuevo = req.body.monto;
  const fechaLimiteNueva = req.body.fecha_limite;
  const observaciones = req.body.observaciones || null;
  const motivo = String(req.body.motivo || '').trim();

  if (!motivo) {
    return res.status(400).json({ message: 'motivo es obligatorio para override financiero.' });
  }

  const before = {
    estatus: pago.estatus,
    monto: pago.monto,
    fecha_limite: pago.fecha_limite,
    observaciones: pago.observaciones,
  };

  if (estatusNuevo) {
    pago.estatus = estatusNuevo;
    if (estatusNuevo === 'pagado') {
      pago.fecha_pago = req.body.fecha_pago || new Date();
    }
  }

  if (montoNuevo !== undefined && montoNuevo !== null) {
    const parsed = Number(montoNuevo);
    if (Number.isNaN(parsed) || parsed < 0) {
      return res.status(400).json({ message: 'monto invalido.' });
    }
    pago.monto = parsed;
  }

  if (fechaLimiteNueva) {
    pago.fecha_limite = fechaLimiteNueva;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'observaciones')) {
    pago.observaciones = observaciones;
  }

  await pago.save();

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'override_estatus_financiero',
    modulo: 'director',
    entidad: 'pagos_estatus',
    idEntidad: pago.id_pago,
    detalle: {
      motivo,
      before,
      after: {
        estatus: pago.estatus,
        monto: pago.monto,
        fecha_limite: pago.fecha_limite,
        observaciones: pago.observaciones,
      },
    },
  });

  return res.json(pago);
}

async function autorizarCalificacionExtemporanea(req, res) {
  const idDocente = Number(req.body.id_docente);
  const idMateria = Number(req.body.id_materia);
  const fechaLimiteAutorizacion = req.body.fecha_limite_autorizacion;
  const motivo = String(req.body.motivo || '').trim();

  if (!Number.isInteger(idDocente) || !Number.isInteger(idMateria) || !fechaLimiteAutorizacion || !motivo) {
    return res.status(400).json({
      message: 'id_docente, id_materia, fecha_limite_autorizacion y motivo son obligatorios.',
    });
  }

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'autorizar_calificaciones_extemporaneas',
    modulo: 'director',
    entidad: 'docentes',
    idEntidad: idDocente,
    detalle: {
      id_docente: idDocente,
      id_materia: idMateria,
      fecha_limite_autorizacion: fechaLimiteAutorizacion,
      motivo,
    },
  });

  return res.status(201).json({
    autorizado: true,
    id_docente: idDocente,
    id_materia: idMateria,
    fecha_limite_autorizacion: fechaLimiteAutorizacion,
  });
}

async function asignarAulaHorario(req, res) {
  const idHorario = Number(req.params.id_horario);
  const aula = String(req.body.aula || '').trim();

  if (!Number.isInteger(idHorario)) {
    return res.status(400).json({ message: 'id_horario invalido.' });
  }
  if (!aula) {
    return res.status(400).json({ message: 'aula es obligatoria.' });
  }

  const horario = await Horario.findByPk(idHorario);
  if (!horario) {
    return res.status(404).json({ message: 'Horario no encontrado.' });
  }

  const aulaAnterior = horario.aula;
  horario.aula = aula;
  await horario.save();

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'asignar_aula_docente',
    modulo: 'director',
    entidad: 'horarios',
    idEntidad: horario.id_horario,
    detalle: {
      aula_anterior: aulaAnterior,
      aula_nueva: aula,
      id_docente: req.body.id_docente || null,
      id_materia: req.body.id_materia || null,
      grupo: req.body.grupo || null,
      motivo: req.body.motivo || null,
    },
  });

  return res.json(horario);
}

async function actualizarCuentaUsuario(req, res) {
  const idUsuario = Number(req.params.id_usuario);
  if (!Number.isInteger(idUsuario)) {
    return res.status(400).json({ message: 'id_usuario invalido.' });
  }

  const usuario = await Usuario.findByPk(idUsuario);
  if (!usuario) {
    return res.status(404).json({ message: 'Usuario no encontrado.' });
  }

  const cambios = {};
  if (Object.prototype.hasOwnProperty.call(req.body, 'cuenta_bloqueada')) {
    cambios.cuenta_bloqueada = Boolean(req.body.cuenta_bloqueada);
    usuario.cuenta_bloqueada = cambios.cuenta_bloqueada;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'cuenta_activada')) {
    cambios.cuenta_activada = Boolean(req.body.cuenta_activada);
    usuario.cuenta_activada = cambios.cuenta_activada;
  }

  if (Object.keys(cambios).length === 0) {
    return res.status(400).json({ message: 'No hay cambios de cuenta para aplicar.' });
  }

  await usuario.save();

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'actualizar_cuenta_usuario',
    modulo: 'admin',
    entidad: 'usuarios',
    idEntidad: usuario.id_usuario,
    detalle: cambios,
  });

  return res.json({
    id_usuario: usuario.id_usuario,
    cuenta_activada: usuario.cuenta_activada,
    cuenta_bloqueada: usuario.cuenta_bloqueada,
  });
}

async function crearMateria(req, res) {
  const nombreMateria = String(req.body.nombre_materia || '').trim();
  const codigoMateria = String(req.body.codigo_materia || '').trim();
  const carrera = String(req.body.carrera || '').trim();
  const bimestre = Number(req.body.bimestre_pertenece);
  const activa = req.body.activa === undefined ? true : Boolean(req.body.activa);

  if (!nombreMateria || !codigoMateria || !carrera || !Number.isInteger(bimestre) || bimestre < 1) {
    return res.status(400).json({
      message: 'nombre_materia, codigo_materia, carrera y bimestre_pertenece son obligatorios.',
    });
  }

  const [created] = await sequelize.query(
    `INSERT INTO materias (nombre_materia, codigo_materia, carrera, bimestre_pertenece, activa)
     VALUES (?, ?, ?, ?, ?)`,
    {
      replacements: [nombreMateria, codigoMateria, carrera, bimestre, activa],
      type: Sequelize.QueryTypes.INSERT,
    },
  );

  const idMateria = Array.isArray(created) ? created[0] : created;
  const [rows] = await sequelize.query(
    `SELECT id_materia, nombre_materia, codigo_materia, carrera, bimestre_pertenece, activa
     FROM materias WHERE id_materia = ?`,
    {
      replacements: [idMateria],
      type: Sequelize.QueryTypes.SELECT,
    },
  );

  const materia = rows || null;

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'crear_materia',
    modulo: 'admin',
    entidad: 'materias',
    idEntidad: idMateria,
    detalle: materia,
  });

  return res.status(201).json(materia);
}

async function asignarDocenteAGrupo(req, res) {
  const idDocente = Number(req.body.id_docente);
  const idMateria = Number(req.body.id_materia);
  const grupo = String(req.body.grupo || '').trim();

  if (!Number.isInteger(idDocente) || !Number.isInteger(idMateria) || !grupo) {
    return res.status(400).json({ message: 'id_docente, id_materia y grupo son obligatorios.' });
  }

  const [docente, materia] = await Promise.all([
    DocentePerfil.findByPk(idDocente),
    Materia.findByPk(idMateria),
  ]);

  if (!docente) {
    return res.status(404).json({ message: 'Docente no encontrado.' });
  }
  if (!materia) {
    return res.status(404).json({ message: 'Materia no encontrada.' });
  }

  const existente = await AsignacionGrupo.findOne({
    where: { id_materia: idMateria, grupo },
  });

  if (existente && Number(existente.id_docente) !== idDocente) {
    return res.status(409).json({
      message: 'El grupo ya esta asignado a otro docente para esa materia.',
    });
  }

  let registro = existente;
  if (!registro) {
    registro = await AsignacionGrupo.create({
      id_docente: idDocente,
      id_materia: idMateria,
      grupo,
    });
  }

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: existente ? 'reusar_asignacion_docente_grupo' : 'crear_asignacion_docente_grupo',
    modulo: 'admin',
    entidad: 'asignacion_grupos',
    idEntidad: registro.id_asignacion,
    detalle: {
      id_docente: idDocente,
      id_materia: idMateria,
      grupo,
    },
  });

  return res.status(existente ? 200 : 201).json(registro);
}

async function listarTramites(_req, res) {
  const items = await TramiteSolicitud.findAll({
    include: [
      {
        model: AlumnoPerfil,
        as: 'alumno',
        include: [{
          model: Usuario,
          as: 'usuario',
          attributes: ['id_usuario', 'folio_matricula', 'nombre_completo', 'correo'],
        }],
      },
      {
        model: Usuario,
        as: 'resolutor',
        attributes: ['id_usuario', 'nombre_completo', 'rol'],
      },
    ],
    order: [['fecha_solicitud', 'DESC'], ['id_tramite', 'DESC']],
    limit: 500,
  });

  return res.json({ items });
}

async function actualizarTramite(req, res) {
  const idTramite = Number(req.params.id_tramite);
  if (!Number.isInteger(idTramite)) {
    return res.status(400).json({ message: 'id_tramite invalido.' });
  }

  const tramite = await TramiteSolicitud.findByPk(idTramite);
  if (!tramite) {
    return res.status(404).json({ message: 'Tramite no encontrado.' });
  }

  const estatus = String(req.body.estatus || '').trim();
  const respuesta = String(req.body.respuesta || '').trim();

  if (!estatus) {
    return res.status(400).json({ message: 'estatus es obligatorio.' });
  }

  tramite.estatus = estatus;
  tramite.respuesta = respuesta || null;
  tramite.fecha_resolucion = new Date();
  tramite.resuelto_por = req.user.id_usuario;
  await tramite.save();

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'resolver_tramite',
    modulo: 'admin',
    entidad: 'tramites_solicitudes',
    idEntidad: tramite.id_tramite,
    detalle: {
      estatus: tramite.estatus,
      respuesta: tramite.respuesta,
      resuelto_por: tramite.resuelto_por,
    },
  });

  return res.json(tramite);
}

async function reporteFinanciero(_req, res) {
  const [estatus, conceptos, vencidosPorCarrera] = await Promise.all([
    sequelize.query(
      `SELECT estatus, COUNT(id_pago) AS total, COALESCE(SUM(monto), 0) AS monto_total
       FROM pagos_estatus GROUP BY estatus`,
      { type: Sequelize.QueryTypes.SELECT },
    ),
    sequelize.query(
      `SELECT concepto, COUNT(id_pago) AS total, COALESCE(SUM(monto), 0) AS monto_total
       FROM pagos_estatus
       GROUP BY concepto
       ORDER BY monto_total DESC
       LIMIT 20`,
      { type: Sequelize.QueryTypes.SELECT },
    ),
    sequelize.query(
      `SELECT ap.carrera AS carrera, COUNT(pe.id_pago) AS total, COALESCE(SUM(pe.monto), 0) AS monto_total
       FROM pagos_estatus pe
       LEFT JOIN alumnos_perfil ap ON pe.id_alumno = ap.id_alumno
       WHERE pe.estatus = 'vencido'
       GROUP BY ap.carrera`,
      { type: Sequelize.QueryTypes.SELECT },
    ),
  ]);

  return res.json({ estatus, conceptos, vencidos_por_carrera: vencidosPorCarrera });
}

async function respaldoMetadatos(req, res) {
  const [
    usuarios,
    alumnos,
    asignaciones,
    materias,
    tareas,
    entregas,
    pagos,
    conceptos,
    reglas,
  ] = await Promise.all([
    Usuario.count(),
    AlumnoPerfil.count(),
    AsignacionGrupo.count(),
    Materia.count(),
    sequelize.models.Tarea.count(),
    EntregaTarea.count(),
    PagoEstatus.count(),
    sequelize.models.ConceptoPago.count(),
    sequelize.models.ReglaDesbloqueo.count(),
  ]);

  const payload = {
    fecha: new Date().toISOString(),
    metadata: {
      usuarios,
      alumnos,
      asignaciones,
      materias,
      tareas,
      entregas,
      pagos,
      conceptos,
      reglas,
    },
  };

  const backupsDir = path.resolve(__dirname, '../../backups');
  await fs.mkdir(backupsDir, { recursive: true });
  const filename = `respaldo-metadatos-${payload.fecha.replace(/[:.]/g, '-')}Z.json`;
  const absolutePath = path.join(backupsDir, filename);
  await fs.writeFile(absolutePath, JSON.stringify(payload, null, 2), 'utf8');

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'generar_respaldo_metadatos',
    modulo: 'admin',
    entidad: 'backups',
    idEntidad: filename,
    detalle: payload.metadata,
  });

  return res.json({
    archivo: {
      nombre: filename,
      ruta_relativa: `backups/${filename}`,
    },
    metadata: payload.metadata,
  });
}

async function listarAsignacionesAlumnoGrupo(req, res) {
  const where = {};

  if (req.query.id_alumno) {
    const idAlumno = Number(req.query.id_alumno);
    if (!Number.isInteger(idAlumno)) {
      return res.status(400).json({ message: 'id_alumno invalido.' });
    }
    where.id_alumno = idAlumno;
  }

  if (req.query.id_materia) {
    const idMateria = Number(req.query.id_materia);
    if (!Number.isInteger(idMateria)) {
      return res.status(400).json({ message: 'id_materia invalido.' });
    }
    where.id_materia = idMateria;
  }

  if (req.query.grupo) {
    where.grupo = req.query.grupo;
  }

  const items = await AlumnoGrupo.findAll({
    where,
    include: [
      {
        model: AlumnoPerfil,
        as: 'alumno',
        include: [{
          model: Usuario,
          as: 'usuario',
          attributes: ['id_usuario', 'folio_matricula', 'nombre_completo', 'correo'],
        }],
      },
      {
        model: Materia,
        as: 'materia',
      },
    ],
    order: [['id_alumno_grupo', 'DESC']],
  });

  return res.json({ items });
}

async function asignarAlumnoAGrupo(req, res) {
  const idAlumno = Number(req.body.id_alumno);
  const idMateria = Number(req.body.id_materia);
  const grupo = String(req.body.grupo || '').trim();

  if (!Number.isInteger(idAlumno)) {
    return res.status(400).json({ message: 'id_alumno invalido.' });
  }
  if (!Number.isInteger(idMateria)) {
    return res.status(400).json({ message: 'id_materia invalido.' });
  }
  if (!grupo) {
    return res.status(400).json({ message: 'grupo es obligatorio.' });
  }

  const [alumno, materia, grupoDocente] = await Promise.all([
    AlumnoPerfil.findByPk(idAlumno),
    Materia.findByPk(idMateria),
    AsignacionGrupo.findOne({ where: { id_materia: idMateria, grupo } }),
  ]);

  if (!alumno) {
    return res.status(404).json({ message: 'Alumno no encontrado.' });
  }
  if (!materia) {
    return res.status(404).json({ message: 'Materia no encontrada.' });
  }
  if (!grupoDocente) {
    return res.status(400).json({
      message: 'El grupo no existe para esa materia. Asigna primero el grupo al docente.',
    });
  }

  const existente = await AlumnoGrupo.findOne({
    where: { id_alumno: idAlumno, id_materia: idMateria },
  });

  let registro;
  let accion;
  if (existente) {
    existente.grupo = grupo;
    await existente.save();
    registro = existente;
    accion = 'actualizar_asignacion_alumno_grupo';
  } else {
    registro = await AlumnoGrupo.create({
      id_alumno: idAlumno,
      id_materia: idMateria,
      grupo,
      fecha_alta: new Date(),
    });
    accion = 'crear_asignacion_alumno_grupo';
  }

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion,
    modulo: 'admin',
    entidad: 'alumno_grupos',
    idEntidad: registro.id_alumno_grupo,
    detalle: {
      id_alumno: idAlumno,
      id_materia: idMateria,
      grupo,
    },
  });

  return res.status(existente ? 200 : 201).json(registro);
}

async function desasignarAlumnoDeGrupo(req, res) {
  const idAlumno = Number(req.params.id_alumno);
  const idMateria = Number(req.params.id_materia);

  if (!Number.isInteger(idAlumno)) {
    return res.status(400).json({ message: 'id_alumno invalido.' });
  }
  if (!Number.isInteger(idMateria)) {
    return res.status(400).json({ message: 'id_materia invalido.' });
  }

  const existente = await AlumnoGrupo.findOne({
    where: { id_alumno: idAlumno, id_materia: idMateria },
  });

  if (!existente) {
    return res.status(404).json({ message: 'Asignacion alumno-grupo no encontrada.' });
  }

  await existente.destroy();

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'eliminar_asignacion_alumno_grupo',
    modulo: 'admin',
    entidad: 'alumno_grupos',
    idEntidad: existente.id_alumno_grupo,
    detalle: {
      id_alumno: idAlumno,
      id_materia: idMateria,
      grupo: existente.grupo,
    },
  });

  return res.status(204).send();
}

module.exports = {
  buscarUsuariosDirector,
  buscarPagosDirector,
  dashboard,
  resumenUsuarios,
  crearUsuario,
  actualizarCuentaUsuario,
  crearMateria,
  asignarDocenteAGrupo,
  listarTramites,
  actualizarTramite,
  reporteFinanciero,
  respaldoMetadatos,
  politicaFoliosPorRol,
  preasignarFolioPorRol,
  actualizarFolioUsuario,
  validarPago,
  actualizarFolioPago,
  overrideEstatusFinanciero,
  autorizarCalificacionExtemporanea,
  asignarAulaHorario,
  listarAsignacionesAlumnoGrupo,
  asignarAlumnoAGrupo,
  desasignarAlumnoDeGrupo,
};
