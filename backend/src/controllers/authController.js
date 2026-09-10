const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const env = require('../config/env');
const {
  sequelize,
  Usuario,
  AlumnoPerfil,
  DocentePerfil,
  PlanEstudio,
} = require('../../models');
const { resolveUserAuthorization } = require('../services/rbacService');

let usuariosColumnsCache = null;

async function getUsuariosColumns() {
  if (usuariosColumnsCache) {
    return usuariosColumnsCache;
  }

  try {
    const description = await sequelize.getQueryInterface().describeTable('usuarios');
    usuariosColumnsCache = new Set(Object.keys(description || {}));
  } catch (_error) {
    usuariosColumnsCache = new Set([
      'id_usuario',
      'nombre_completo',
      'correo',
      'folio_matricula',
      'password_hash',
      'cuenta_activada',
      'rol',
    ]);
  }

  return usuariosColumnsCache;
}

function hasColumn(columns, name) {
  return columns instanceof Set && columns.has(name);
}

function normalizeLegacyRole(role) {
  const raw = String(role || '').trim().toLowerCase();
  if (raw === 'docente') return 'maestro';
  if (raw === 'coordinacion_escolar') return 'coordinacion_academica';
  if (raw === 'administrativo') return 'control_escolar';
  return raw || 'alumno';
}

async function login(req, res) {
  const { correo, folio_matricula, password } = req.body;
  const usuariosColumns = await getUsuariosColumns();

  const correoNormalized = (correo || '').trim().toLowerCase();
  const folioNormalized = (folio_matricula || '').trim();

  const canUseCorreo = hasColumn(usuariosColumns, 'correo');
  const canUseFolio = hasColumn(usuariosColumns, 'folio_matricula');

  const correoEnabled = canUseCorreo ? correoNormalized : '';
  const folioEnabled = canUseFolio ? folioNormalized : '';

  const identity = correoEnabled || folioEnabled;
  if (!identity) {
    return res.status(400).json({ message: 'correo o folio_matricula es obligatorio y debe existir en el esquema.' });
  }
  if (!password) {
    return res.status(400).json({ message: 'password es obligatorio.' });
  }

  const where = {};
  if (correoEnabled && folioEnabled) {
    where[Op.or] = [
      { correo: correoEnabled },
      { folio_matricula: folioEnabled },
    ];
  } else if (correoEnabled) {
    where.correo = correoEnabled;
  } else {
    where.folio_matricula = folioEnabled;
  }

  const attributes = [
    'id_usuario',
    'nombre_completo',
    'correo',
    'folio_matricula',
    'password_hash',
    'cuenta_activada',
    'rol',
  ].filter((column) => hasColumn(usuariosColumns, column));

  const user = await Usuario.findOne({
    where,
    attributes,
  });

  if (user && user.cuenta_activada === undefined) {
    user.setDataValue('cuenta_activada', true);
  }

  if (!user) {
    return res.status(401).json({ message: 'Credenciales invalidas.' });
  }

  if (!hasColumn(usuariosColumns, 'password_hash')) {
    return res.status(500).json({ message: 'Esquema de usuarios invalido: falta password_hash.' });
  }

  if (!user.cuenta_activada) {
    return res.status(403).json({
      message: 'Cuenta pendiente de activacion. Completa primero tu registro con folio.',
    });
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ message: 'Credenciales invalidas.' });
  }

  let authorization = null;
  try {
    authorization = await resolveUserAuthorization(user.id_usuario);
  } catch (_error) {
    authorization = null;
  }

  let perfilAlumno = null;
  let perfilDocente = null;
  try {
    [perfilAlumno, perfilDocente] = await Promise.all([
      AlumnoPerfil.findByPk(user.id_usuario).catch(() => null),
      DocentePerfil.findByPk(user.id_usuario).catch(() => null),
    ]);
  } catch (_error) {
    perfilAlumno = null;
    perfilDocente = null;
  }

  const roleFallback = normalizeLegacyRole(user.rol);

  const normalizedUser = {
    id_usuario: user.id_usuario,
    nombre_completo: user.nombre_completo,
    rol: authorization?.rol || roleFallback,
    subrol: authorization?.subrol || null,
    permisos: authorization?.permisos || [],
    correo: user.correo,
    folio_matricula: user.folio_matricula,
    perfil_alumno: perfilAlumno,
    perfil_docente: perfilDocente,
  };

  const token = jwt.sign(
    {
      id_usuario: normalizedUser.id_usuario,
      rol: normalizedUser.rol,
      correo: normalizedUser.correo,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );

  return res.json({ token, user: normalizedUser });
}

async function registroConFolio(req, res) {
  const usuariosColumns = await getUsuariosColumns();

  if (!hasColumn(usuariosColumns, 'folio_matricula')) {
    return res.status(500).json({ message: 'Esquema de usuarios invalido: falta folio_matricula.' });
  }

  const folio = (req.body.folio_matricula || '').trim();
  const correo = (req.body.correo || '').trim().toLowerCase();
  const password = req.body.password || '';

  if (!folio || !correo || !password) {
    return res.status(400).json({
      message: 'folio_matricula, correo y password son obligatorios.',
    });
  }

  const user = await Usuario.findOne({ where: { folio_matricula: folio } });
  if (!user) {
    return res.status(404).json({ message: 'Folio no encontrado. Solicita alta en control escolar.' });
  }

  const cuentaActivada = hasColumn(usuariosColumns, 'cuenta_activada')
    ? Boolean(user.cuenta_activada)
    : true;

  if (cuentaActivada) {
    return res.status(409).json({ message: 'La cuenta ya esta activada. Inicia sesion.' });
  }

  const correoEnUso = await Usuario.findOne({ where: { correo } });
  if (correoEnUso && correoEnUso.id_usuario !== user.id_usuario) {
    return res.status(409).json({ message: 'El correo ya esta en uso.' });
  }

  user.correo = correo;
  user.password_hash = await bcrypt.hash(password, 10);
  if (hasColumn(usuariosColumns, 'cuenta_activada')) {
    user.cuenta_activada = true;
  }
  await user.save();

  try {
    const esAlumno = normalizeLegacyRole(user.rol) === 'alumno' || Number(user.id_rol) === 5;
    if (esAlumno) {
      const [planActivo] = await PlanEstudio.findAll({
        where: { activo: true },
        attributes: ['id_plan_estudio', 'carrera'],
        order: [['id_plan_estudio', 'ASC']],
        limit: 1,
      });

      if (planActivo) {
        await AlumnoPerfil.findOrCreate({
          where: { id_alumno: user.id_usuario },
          defaults: {
            carrera: planActivo.carrera || 'General',
            id_plan_estudio: planActivo.id_plan_estudio,
            bimestre_actual: 1,
            estado_academico: 'activo',
            bloqueo_plataforma: false,
            bloqueo_calificaciones: false,
            estatus_financiero: 'al_dia',
            modalidad_boleta: 'ONLINE',
            campus_boleta: 'UNICEP MERIDA',
          },
        });
      }
    }
  } catch (error) {
    console.error('Error al crear el perfil base del alumno:', error);
  }

  return res.status(200).json({
    message: 'Cuenta activada correctamente. Ya puedes iniciar sesion.',
    user: {
      id_usuario: user.id_usuario,
      nombre_completo: user.nombre_completo,
      folio_matricula: user.folio_matricula,
      correo: user.correo,
      rol: user.rol,
    },
  });
}

module.exports = {
  login,
  registroConFolio,
};
