const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const env = require('../config/env');
const { Usuario, AlumnoPerfil, DocentePerfil } = require('../../models');

async function login(req, res) {
  const { correo, folio_matricula, password } = req.body;

  const correoNormalized = (correo || '').trim().toLowerCase();
  const folioNormalized = (folio_matricula || '').trim();

  const identity = correoNormalized || folioNormalized;
  if (!identity) {
    return res.status(400).json({ message: 'correo o folio_matricula es obligatorio.' });
  }
  if (!password) {
    return res.status(400).json({ message: 'password es obligatorio.' });
  }

  const where = {};
  if (correoNormalized && folioNormalized) {
    where[Op.or] = [
      { correo: correoNormalized },
      { folio_matricula: folioNormalized },
    ];
  } else if (correoNormalized) {
    where.correo = correoNormalized;
  } else {
    where.folio_matricula = folioNormalized;
  }

  const user = await Usuario.findOne({
    where,
    include: [
      {
        model: AlumnoPerfil,
        as: 'perfil_alumno',
      },
      {
        model: DocentePerfil,
        as: 'perfil_docente',
      },
    ],
  });

  if (!user) {
    return res.status(401).json({ message: 'Credenciales invalidas.' });
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

  const normalizedUser = {
    id_usuario: user.id_usuario,
    nombre_completo: user.nombre_completo,
    rol: user.rol,
    correo: user.correo,
    folio_matricula: user.folio_matricula,
    perfil_alumno: user.perfil_alumno,
    perfil_docente: user.perfil_docente,
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

  if (user.cuenta_activada) {
    return res.status(409).json({ message: 'La cuenta ya esta activada. Inicia sesion.' });
  }

  const correoEnUso = await Usuario.findOne({ where: { correo } });
  if (correoEnUso && correoEnUso.id_usuario !== user.id_usuario) {
    return res.status(409).json({ message: 'El correo ya esta en uso.' });
  }

  user.correo = correo;
  user.password_hash = await bcrypt.hash(password, 10);
  user.cuenta_activada = true;
  await user.save();

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
