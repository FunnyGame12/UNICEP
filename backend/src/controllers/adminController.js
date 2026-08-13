const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { Op } = require('sequelize');
const {
  sequelize,
  Sequelize,
  Usuario,
  ConceptoPago,
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
  AuditoriaEvento,
} = require('../../models');
const { registrarEventoAuditoria } = require('../services/auditService');

const SECURE_FOLIO_PREFIX_BY_ROLE = {
  director: 'DIR',
  control_escolar: 'CTL',
  coordinacion: 'COO',
  docente: 'DOC',
  alumno: 'ALU',
};

const ROLE_ALIASES = {
  director: 'director',
  control_escolar: 'control_escolar',
  coordinacion: 'coordinacion',
  coordinacion_academica: 'coordinacion',
  docente: 'docente',
  maestro: 'docente',
  alumno: 'alumno',
};

const MANAGED_FOLIO_ROLES = new Set(Object.keys(SECURE_FOLIO_PREFIX_BY_ROLE));
const FOLIO_TABLE_ROLE_ORDER = {
  director: 1,
  control_escolar: 2,
  coordinacion: 3,
  docente: 4,
  alumno: 5,
  administrativo: 6,
  otro: 99,
};

const VALID_FINANCIAL_STATUS = new Set(['pagado', 'pendiente', 'vencido']);
const CONCEPTO_CLASIFICACION = new Set(['base', 'subrama']);
const CONCEPTO_NATURALEZA = new Set(['descuento', 'penalizacion']);
const CONCEPTO_MODO = new Set(['monto_fijo', 'porcentaje']);

let conceptoPagoSchemaReadyPromise;

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase();
}

function canonicalFolioRole(value) {
  const normalized = normalizeRole(value);
  return ROLE_ALIASES[normalized] || null;
}

function normalizeRoleForTable(value) {
  const canonical = canonicalFolioRole(value);
  if (canonical) return canonical;
  const normalized = normalizeRole(value);
  if (normalized === 'administrativo') return 'administrativo';
  return normalized || 'otro';
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeFolioInterno(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeClasificacion(value) {
  return String(value || '').trim().toLowerCase();
}

function parseNullableNumber(value) {
  if (value === '' || value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

async function ensureConceptoPagoSchema() {
  if (conceptoPagoSchemaReadyPromise) {
    return conceptoPagoSchemaReadyPromise;
  }

  conceptoPagoSchemaReadyPromise = (async () => {
    const qi = sequelize.getQueryInterface();
    const tableName = 'conceptos_pago';
    const desc = await qi.describeTable(tableName);

    if (!desc.clasificacion) {
      await qi.addColumn(tableName, 'clasificacion', {
        type: Sequelize.ENUM('base', 'subrama'),
        allowNull: false,
        defaultValue: 'base',
      });
    }

    if (!desc.precio_base_inicial) {
      await qi.addColumn(tableName, 'precio_base_inicial', {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      });
    }

    if (!desc.id_concepto_padre) {
      await qi.addColumn(tableName, 'id_concepto_padre', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'conceptos_pago',
          key: 'id_concepto_pago',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      });
    }

    if (!desc.naturaleza_ajuste) {
      await qi.addColumn(tableName, 'naturaleza_ajuste', {
        type: Sequelize.ENUM('descuento', 'penalizacion'),
        allowNull: true,
      });
    }

    if (!desc.modo_aplicacion) {
      await qi.addColumn(tableName, 'modo_aplicacion', {
        type: Sequelize.ENUM('monto_fijo', 'porcentaje'),
        allowNull: true,
      });
    }

    if (!desc.valor_ajuste) {
      await qi.addColumn(tableName, 'valor_ajuste', {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      });
    }

    if (!desc.folio_interno) {
      await qi.addColumn(tableName, 'folio_interno', {
        type: Sequelize.STRING(80),
        allowNull: true,
      });
      await sequelize.query('UPDATE conceptos_pago SET folio_interno = UPPER(clave) WHERE folio_interno IS NULL OR folio_interno = \''\'');
      await qi.changeColumn(tableName, 'folio_interno', {
        type: Sequelize.STRING(80),
        allowNull: false,
      });
    }

    const indexes = await qi.showIndex(tableName);
    const hasUniqueFolioIndex = indexes.some((idx) => idx.name === 'conceptos_pago_folio_interno_unique');
    if (!hasUniqueFolioIndex) {
      await qi.addIndex(tableName, ['folio_interno'], {
        unique: true,
        name: 'conceptos_pago_folio_interno_unique',
      });
    }
  })();

  return conceptoPagoSchemaReadyPromise;
}

function validateConceptoPayload(payload, { isEdit = false } = {}) {
  const nombre = normalizeText(payload.nombre);
  const clasificacion = normalizeClasificacion(payload.clasificacion);
  const folioInterno = normalizeFolioInterno(payload.folio_interno);
  const naturalezaAjuste = normalizeClasificacion(payload.naturaleza_ajuste);
  const modoAplicacion = normalizeClasificacion(payload.modo_aplicacion);
  const precioBaseInicial = parseNullableNumber(payload.precio_base_inicial);
  const valorAjuste = parseNullableNumber(payload.valor_ajuste);
  const idConceptoPadre = payload.id_concepto_padre ? Number(payload.id_concepto_padre) : null;

  if (!nombre || nombre.length < 3) {
    return { error: 'nombre debe tener al menos 3 caracteres.' };
  }

  if (!CONCEPTO_CLASIFICACION.has(clasificacion)) {
    return { error: 'clasificacion invalida. Usa base o subrama.' };
  }

  if (!isEdit && (!folioInterno || folioInterno.length < 10)) {
    return { error: 'folio_interno es obligatorio y debe tener al menos 10 caracteres.' };
  }

  if (clasificacion === 'base') {
    if (precioBaseInicial === null || Number.isNaN(precioBaseInicial) || precioBaseInicial < 0) {
      return { error: 'precio_base_inicial es obligatorio para conceptos base y debe ser >= 0.' };
    }

    return {
      data: {
        nombre,
        clasificacion,
        folio_interno: folioInterno,
        precio_base_inicial: precioBaseInicial,
        id_concepto_padre: null,
        naturaleza_ajuste: null,
        modo_aplicacion: null,
        valor_ajuste: null,
      },
    };
  }

  if (!Number.isInteger(idConceptoPadre)) {
    return { error: 'id_concepto_padre es obligatorio para subrama.' };
  }
  if (!CONCEPTO_NATURALEZA.has(naturalezaAjuste)) {
    return { error: 'naturaleza_ajuste invalida. Usa descuento o penalizacion.' };
  }
  if (!CONCEPTO_MODO.has(modoAplicacion)) {
    return { error: 'modo_aplicacion invalido. Usa monto_fijo o porcentaje.' };
  }
  if (valorAjuste === null || Number.isNaN(valorAjuste) || valorAjuste <= 0) {
    return { error: 'valor_ajuste debe ser un numero positivo para subrama.' };
  }

  return {
    data: {
      nombre,
      clasificacion,
      folio_interno: folioInterno,
      precio_base_inicial: null,
      id_concepto_padre: idConceptoPadre,
      naturaleza_ajuste: naturalezaAjuste,
      modo_aplicacion: modoAplicacion,
      valor_ajuste: valorAjuste,
    },
  };
}

function mapConceptoRow(row) {
  return {
    id_concepto_pago: row.id_concepto_pago,
    nombre: row.nombre,
    clasificacion: row.clasificacion,
    precio_base_inicial: row.precio_base_inicial,
    id_concepto_padre: row.id_concepto_padre,
    naturaleza_ajuste: row.naturaleza_ajuste,
    modo_aplicacion: row.modo_aplicacion,
    valor_ajuste: row.valor_ajuste,
    folio_interno: row.folio_interno,
    fecha_creacion: row.fecha_creacion,
  };
}

async function listConceptosPagoCatalog(req, res) {
  await ensureConceptoPagoSchema();

  const searchQuery = normalizeText(req.query.q).toLowerCase();
  const sort = normalizeClasificacion(req.query.sort) === 'za' ? 'za' : 'az';

  const [rows] = await sequelize.query(`
    SELECT
      id_concepto_pago,
      nombre,
      clasificacion,
      precio_base_inicial,
      id_concepto_padre,
      naturaleza_ajuste,
      modo_aplicacion,
      valor_ajuste,
      folio_interno,
      fecha_creacion
    FROM conceptos_pago
  `);

  const mapped = rows.map(mapConceptoRow);
  const filtered = searchQuery
    ? mapped.filter((item) => String(item.nombre || '').toLowerCase().includes(searchQuery))
    : mapped;

  const sorted = filtered.sort((a, b) => {
    const cmp = String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' });
    return sort === 'za' ? cmp * -1 : cmp;
  });

  const bases = sorted.filter((item) => item.clasificacion === 'base').map((base) => ({ ...base, subramas: [] }));
  const baseMap = new Map(bases.map((base) => [base.id_concepto_pago, base]));

  sorted
    .filter((item) => item.clasificacion === 'subrama')
    .forEach((subrama) => {
      const parent = baseMap.get(subrama.id_concepto_padre);
      if (parent) {
        parent.subramas.push(subrama);
      }
    });

  return res.json({
    items: sorted,
    hierarchy: bases,
  });
}

async function createConceptoPagoCatalog(req, res) {
  await ensureConceptoPagoSchema();

  const validation = validateConceptoPayload(req.body, { isEdit: false });
  if (validation.error) {
    return res.status(400).json({ message: validation.error });
  }

  const payload = validation.data;

  const existingFolio = await sequelize.query(
    'SELECT id_concepto_pago FROM conceptos_pago WHERE folio_interno = :folio LIMIT 1',
    { replacements: { folio: payload.folio_interno }, type: Sequelize.QueryTypes.SELECT },
  );
  if (existingFolio.length > 0) {
    return res.status(409).json({ message: 'folio_interno ya existe.' });
  }

  if (payload.clasificacion === 'subrama') {
    const parent = await sequelize.query(
      'SELECT id_concepto_pago, clasificacion FROM conceptos_pago WHERE id_concepto_pago = :id LIMIT 1',
      { replacements: { id: payload.id_concepto_padre }, type: Sequelize.QueryTypes.SELECT },
    );
    if (parent.length === 0 || parent[0].clasificacion !== 'base') {
      return res.status(400).json({ message: 'id_concepto_padre debe apuntar a un concepto base existente.' });
    }
  }

  const created = await ConceptoPago.create({
    clave: payload.folio_interno,
    nombre: payload.nombre,
    descripcion: null,
    categoria: 'otro',
    periodicidad: 'unico',
    carrera_objetivo: null,
    activo: true,
    fecha_creacion: new Date(),
  });

  await sequelize.query(
    `
      UPDATE conceptos_pago
      SET
        clasificacion = :clasificacion,
        precio_base_inicial = :precio_base_inicial,
        id_concepto_padre = :id_concepto_padre,
        naturaleza_ajuste = :naturaleza_ajuste,
        modo_aplicacion = :modo_aplicacion,
        valor_ajuste = :valor_ajuste,
        folio_interno = :folio_interno
      WHERE id_concepto_pago = :id_concepto_pago
    `,
    {
      replacements: {
        ...payload,
        id_concepto_pago: created.id_concepto_pago,
      },
    },
  );

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'crear_concepto_pago_jerarquico',
    modulo: 'director',
    entidad: 'conceptos_pago',
    idEntidad: created.id_concepto_pago,
    detalle: payload,
  });

  return res.status(201).json({ id_concepto_pago: created.id_concepto_pago });
}

async function updateConceptoPagoCatalog(req, res) {
  await ensureConceptoPagoSchema();

  const idConcepto = Number(req.params.id_concepto_pago);
  if (!Number.isInteger(idConcepto)) {
    return res.status(400).json({ message: 'id_concepto_pago invalido.' });
  }

  const existingRows = await sequelize.query(
    'SELECT id_concepto_pago, folio_interno FROM conceptos_pago WHERE id_concepto_pago = :id LIMIT 1',
    { replacements: { id: idConcepto }, type: Sequelize.QueryTypes.SELECT },
  );
  if (existingRows.length === 0) {
    return res.status(404).json({ message: 'Concepto de pago no encontrado.' });
  }

  const existing = existingRows[0];
  const incomingFolio = req.body.folio_interno === undefined ? existing.folio_interno : normalizeFolioInterno(req.body.folio_interno);
  if (incomingFolio !== existing.folio_interno) {
    return res.status(400).json({ message: 'folio_interno es inmutable y no puede modificarse.' });
  }

  const validation = validateConceptoPayload({ ...req.body, folio_interno: existing.folio_interno }, { isEdit: true });
  if (validation.error) {
    return res.status(400).json({ message: validation.error });
  }
  const payload = validation.data;

  if (payload.clasificacion === 'subrama') {
    if (payload.id_concepto_padre === idConcepto) {
      return res.status(400).json({ message: 'Una subrama no puede ser su propio padre.' });
    }
    const parent = await sequelize.query(
      'SELECT id_concepto_pago, clasificacion FROM conceptos_pago WHERE id_concepto_pago = :id LIMIT 1',
      { replacements: { id: payload.id_concepto_padre }, type: Sequelize.QueryTypes.SELECT },
    );
    if (parent.length === 0 || parent[0].clasificacion !== 'base') {
      return res.status(400).json({ message: 'id_concepto_padre debe apuntar a un concepto base existente.' });
    }
  }

  await sequelize.query(
    `
      UPDATE conceptos_pago
      SET
        nombre = :nombre,
        clave = :folio_interno,
        clasificacion = :clasificacion,
        precio_base_inicial = :precio_base_inicial,
        id_concepto_padre = :id_concepto_padre,
        naturaleza_ajuste = :naturaleza_ajuste,
        modo_aplicacion = :modo_aplicacion,
        valor_ajuste = :valor_ajuste
      WHERE id_concepto_pago = :id_concepto_pago
    `,
    {
      replacements: {
        ...payload,
        folio_interno: existing.folio_interno,
        id_concepto_pago: idConcepto,
      },
    },
  );

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'actualizar_concepto_pago_jerarquico',
    modulo: 'director',
    entidad: 'conceptos_pago',
    idEntidad: idConcepto,
    detalle: payload,
  });

  return res.json({ id_concepto_pago: idConcepto, actualizado: true });
}

async function deleteConceptoPagoCatalog(req, res) {
  await ensureConceptoPagoSchema();

  const idConcepto = Number(req.params.id_concepto_pago);
  if (!Number.isInteger(idConcepto)) {
    return res.status(400).json({ message: 'id_concepto_pago invalido.' });
  }

  const rows = await sequelize.query(
    'SELECT id_concepto_pago, clasificacion FROM conceptos_pago WHERE id_concepto_pago = :id LIMIT 1',
    { replacements: { id: idConcepto }, type: Sequelize.QueryTypes.SELECT },
  );
  if (rows.length === 0) {
    return res.status(404).json({ message: 'Concepto de pago no encontrado.' });
  }

  const concept = rows[0];
  const tx = await sequelize.transaction();
  try {
    if (concept.clasificacion === 'base') {
      await sequelize.query('DELETE FROM conceptos_pago WHERE id_concepto_padre = :id', {
        replacements: { id: idConcepto },
        transaction: tx,
      });
    }

    await sequelize.query('DELETE FROM conceptos_pago WHERE id_concepto_pago = :id', {
      replacements: { id: idConcepto },
      transaction: tx,
    });

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'eliminar_concepto_pago_jerarquico',
    modulo: 'director',
    entidad: 'conceptos_pago',
    idEntidad: idConcepto,
    detalle: {
      clasificacion: concept.clasificacion,
      cascada_subramas: concept.clasificacion === 'base',
    },
  });

  return res.status(204).send();
}

function getRolePrefix(role) {
  const canonical = canonicalFolioRole(role);
  return canonical ? SECURE_FOLIO_PREFIX_BY_ROLE[canonical] : null;
}

function buildRoleBasedFolio(role, entropy) {
  const prefix = getRolePrefix(role);
  if (!prefix) {
    throw new Error('Rol no soportado para generacion de folio.');
  }
  const year2Digits = String(new Date().getFullYear()).slice(-2);
  return `${prefix}-${year2Digits}-${entropy}`;
}

function randomFolioEntropy(length = 6) {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(length);
  let token = '';
  for (let index = 0; index < length; index += 1) {
    token += alphabet[bytes[index] % alphabet.length];
  }
  return token;
}

async function nextFolioForRole(role) {
  const canonicalRole = canonicalFolioRole(role);
  if (!canonicalRole || !MANAGED_FOLIO_ROLES.has(canonicalRole)) {
    throw new Error(`rol invalido para folio automatico: ${normalizeRole(role) || 'sin_rol'}`);
  }

  let attempts = 0;

  while (attempts < 40) {
    const candidate = buildRoleBasedFolio(canonicalRole, randomFolioEntropy());
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
  const canonicalRole = canonicalFolioRole(role);
  const normalizedRole = normalizeRole(role);
  const incomingFolio = String(folioInput || '').trim().toUpperCase();
  const rolePrefix = getRolePrefix(canonicalRole);

  if (!rolePrefix) {
    return {
      error: `rol invalido para folio: ${normalizedRole || 'sin_rol'}.`,
    };
  }

  const expectedPrefix = `${rolePrefix}-`;

  if (incomingFolio) {
    if (!incomingFolio.startsWith(expectedPrefix)) {
      const readableRole = normalizedRole || 'rol_desconocido';
      return {
        error: `El folio para rol ${readableRole} debe iniciar con ${expectedPrefix}.`,
      };
    }
    return { folio: incomingFolio, auto: false };
  }

  const generated = await nextFolioForRole(canonicalRole);
  return { folio: generated, auto: true };
}

function classifyCorreo(correo) {
  const normalized = String(correo || '').trim().toLowerCase();
  if (normalized.endsWith('@gmail.com')) {
    return 'gmail';
  }
  if (normalized.endsWith('@unicepmerida.edu.mx')) {
    return 'institucional';
  }
  return 'otro';
}

async function generateFolioByUserId(req, res) {
  const idUsuario = Number(req.params.userId);
  if (!Number.isInteger(idUsuario)) {
    return res.status(400).json({ message: 'userId invalido.' });
  }

  const usuario = await Usuario.findByPk(idUsuario, {
    attributes: ['id_usuario', 'rol', 'correo', 'folio_matricula'],
  });

  if (!usuario) {
    return res.status(404).json({ message: 'Usuario no encontrado.' });
  }

  const canonicalRole = canonicalFolioRole(usuario.rol);
  if (!canonicalRole || !MANAGED_FOLIO_ROLES.has(canonicalRole)) {
    return res.status(400).json({
      message: `rol no elegible para folios automaticos: ${usuario.rol}.`,
    });
  }

  const folio = await nextFolioForRole(canonicalRole);
  return res.json({
    id_usuario: usuario.id_usuario,
    rol: canonicalRole,
    correo: usuario.correo,
    correo_tipo: classifyCorreo(usuario.correo),
    folio,
    formato: `${getRolePrefix(canonicalRole)}-YY-XXXXXX`,
  });
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

async function listarFoliosDirector(req, res) {
  const roleQuery = normalizeRole(req.query.rol);
  const normalizedRoleFilter = roleQuery ? normalizeRoleForTable(roleQuery) : '';
  const nameQuery = String(req.query.q || '').trim();

  const where = {
    folio_matricula: {
      [Op.ne]: null,
    },
  };
  if (normalizedRoleFilter) {
    where.rol = normalizedRoleFilter;
  }
  if (nameQuery) {
    where.nombre_completo = { [Op.like]: `%${nameQuery}%` };
  }

  const folios = await Usuario.findAll({
    where,
    attributes: [
      'id_usuario',
      'nombre_completo',
      'correo',
      'rol',
      'folio_matricula',
      'fecha_creacion',
      'cuenta_activada',
    ],
    order: [['fecha_creacion', 'ASC'], ['id_usuario', 'ASC']],
  });

  const rows = folios
    .map((item) => {
      const roleKey = normalizeRoleForTable(item.rol);
      const pendingEmail = !item.cuenta_activada || String(item.correo || '').toLowerCase().endsWith('@unicep.local');
      return {
        id_folio_preasignado: item.id_usuario,
        nombre_destinatario: item.nombre_completo,
        correo: pendingEmail ? null : item.correo,
        rol: roleKey,
        folio_matricula: item.folio_matricula,
        fecha_creacion: item.fecha_creacion,
      };
    })
    .sort((a, b) => {
      const orderA = FOLIO_TABLE_ROLE_ORDER[a.rol] || FOLIO_TABLE_ROLE_ORDER.otro;
      const orderB = FOLIO_TABLE_ROLE_ORDER[b.rol] || FOLIO_TABLE_ROLE_ORDER.otro;
      if (orderA !== orderB) return orderA - orderB;
      const dateA = new Date(a.fecha_creacion || 0).getTime();
      const dateB = new Date(b.fecha_creacion || 0).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return Number(a.id_folio_preasignado) - Number(b.id_folio_preasignado);
    });

  return res.json({
    items: rows,
    role_order: Object.keys(FOLIO_TABLE_ROLE_ORDER),
  });
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

async function buscarDocentesDirector(req, res) {
  const query = String(req.query.q || '').trim();
  const usuarioWhere = query
    ? {
      [Op.or]: [
        { nombre_completo: { [Op.like]: `%${query}%` } },
        { correo: { [Op.like]: `%${query}%` } },
        { folio_matricula: { [Op.like]: `%${query}%` } },
      ],
    }
    : undefined;

  const docentes = await DocentePerfil.findAll({
    include: [
      {
        model: Usuario,
        as: 'usuario',
        attributes: ['id_usuario', 'nombre_completo', 'correo', 'folio_matricula'],
        where: usuarioWhere,
      },
    ],
    attributes: ['id_docente', 'estatus_laboral'],
    order: [[{ model: Usuario, as: 'usuario' }, 'nombre_completo', 'ASC']],
    limit: 25,
  });

  const items = docentes.map((docente) => ({
    id: docente.id_docente,
    id_docente: docente.id_docente,
    estatus_laboral: docente.estatus_laboral,
    nombre_completo: docente.usuario?.nombre_completo || `Docente ${docente.id_docente}`,
    correo: docente.usuario?.correo || null,
    folio_matricula: docente.usuario?.folio_matricula || null,
  }));

  return res.json({ items });
}

async function buscarMateriasDirector(req, res) {
  const query = String(req.query.q || '').trim();
  const where = query
    ? {
      [Op.or]: [
        { nombre_materia: { [Op.like]: `%${query}%` } },
        { codigo_materia: { [Op.like]: `%${query}%` } },
      ],
    }
    : {};

  const materias = await Materia.findAll({
    where,
    attributes: ['id_materia', 'nombre_materia', 'codigo_materia', 'bimestre_pertenece'],
    order: [['nombre_materia', 'ASC']],
    limit: 25,
  });

  const items = materias.map((materia) => ({
    id: materia.id_materia,
    id_materia: materia.id_materia,
    nombre_materia: materia.nombre_materia,
    codigo_materia: materia.codigo_materia,
    bimestre_pertenece: materia.bimestre_pertenece,
  }));

  return res.json({ items });
}

async function buscarHorariosDirector(req, res) {
  const query = String(req.query.q || '').trim();
  const queryNumber = Number(query);
  const where = query
    ? {
      [Op.or]: [
        ...(Number.isInteger(queryNumber) ? [{ id_horario: queryNumber }] : []),
        { modalidad: { [Op.like]: `%${query}%` } },
        { periodo: { [Op.like]: `%${query}%` } },
        { turno: { [Op.like]: `%${query}%` } },
        { aula: { [Op.like]: `%${query}%` } },
        { descripcion: { [Op.like]: `%${query}%` } },
      ],
    }
    : {};

  const horarios = await Horario.findAll({
    where,
    attributes: ['id_horario', 'modalidad', 'periodo', 'turno', 'hora_inicio', 'hora_fin', 'aula'],
    order: [['id_horario', 'DESC']],
    limit: 25,
  });

  const items = horarios.map((horario) => ({
    id: horario.id_horario,
    id_horario: horario.id_horario,
    modalidad: horario.modalidad,
    periodo: horario.periodo,
    turno: horario.turno,
    hora_inicio: horario.hora_inicio,
    hora_fin: horario.hora_fin,
    aula: horario.aula,
  }));

  return res.json({ items });
}

async function ultimosEventosAuditoriaDirector(_req, res) {
  const eventos = await AuditoriaEvento.findAll({
    attributes: ['id_evento', 'id_usuario', 'accion', 'modulo', 'entidad', 'id_entidad', 'detalle', 'fecha_evento'],
    include: [
      {
        model: Usuario,
        as: 'actor',
        attributes: ['id_usuario', 'nombre_completo', 'rol'],
        required: false,
      },
    ],
    order: [['fecha_evento', 'DESC']],
    limit: 5,
  });

  const items = eventos.map((evento) => ({
    id_evento: evento.id_evento,
    fecha_evento: evento.fecha_evento,
    accion: evento.accion,
    modulo: evento.modulo,
    entidad: evento.entidad,
    id_entidad: evento.id_entidad,
    detalle: evento.detalle || null,
    actor: {
      id_usuario: evento.id_usuario,
      nombre_completo: evento.actor?.nombre_completo || `Usuario ${evento.id_usuario}`,
      rol: evento.actor?.rol || null,
    },
  }));

  return res.json({ items });
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
  const year2Digits = String(new Date().getFullYear()).slice(-2);
  const politica = Object.entries(SECURE_FOLIO_PREFIX_BY_ROLE).map(([rol, prefijo]) => ({
    rol,
    prefijo,
    ejemplo: `${prefijo}-${year2Digits}-X8K2M9`,
  }));

  return res.json({ items: politica });
}

async function preasignarFolioPorRol(req, res) {
  const rolInput = normalizeRole(req.body.rol);
  const rol = canonicalFolioRole(rolInput);
  const nombreDestinatario = String(req.body.nombre_destinatario || '').trim();

  if (!rol) {
    return res.status(400).json({ message: 'rol es obligatorio.' });
  }

  if (!nombreDestinatario) {
    return res.status(400).json({ message: 'nombre_destinatario es obligatorio.' });
  }

  if (!MANAGED_FOLIO_ROLES.has(rol)) {
    return res.status(400).json({
      message: `rol invalido. Usa uno de: ${Array.from(MANAGED_FOLIO_ROLES).join(', ')}.`,
    });
  }

  const folioInput = String(req.body.folio || '').trim().toUpperCase();
  const folio = folioInput || await nextFolioForRole(rol);
  const expectedPrefix = `${getRolePrefix(rol)}-`;

  if (!folio.startsWith(expectedPrefix)) {
    return res.status(400).json({
      message: `El folio para rol ${rol} debe iniciar con ${expectedPrefix}.`,
    });
  }

  const existsInUsuarios = await Usuario.findOne({
    where: { folio_matricula: folio },
    attributes: ['id_usuario'],
  });
  if (existsInUsuarios) {
    return res.status(409).json({ message: 'El folio ya existe en usuarios.' });
  }

  const password_hash = await bcrypt.hash(crypto.randomUUID(), 10);
  const registro = await Usuario.create({
    folio_matricula: folio,
    nombre_completo: nombreDestinatario,
    correo: `pending+${folio.toLowerCase()}@unicep.local`,
    password_hash,
    cuenta_activada: false,
    rol,
    foto_url: null,
    fecha_creacion: new Date(),
  });

  await registrarEventoAuditoria({
    idUsuario: req.user.id_usuario,
    rolActor: req.user.rol,
    accion: 'preasignar_folio_por_rol',
    modulo: 'director',
    entidad: 'usuarios',
    idEntidad: registro.id_usuario,
    detalle: {
      rol,
      folio,
      nombre_destinatario: nombreDestinatario,
    },
  });

  return res.status(201).json({
    id_usuario: registro.id_usuario,
    nombre_destinatario: registro.nombre_completo,
    rol: registro.rol,
    folio: registro.folio_matricula,
    correo: null,
    fecha_creacion: registro.fecha_creacion,
  });
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
  listConceptosPagoCatalog,
  createConceptoPagoCatalog,
  updateConceptoPagoCatalog,
  deleteConceptoPagoCatalog,
  buscarPagosDirector,
  buscarDocentesDirector,
  buscarMateriasDirector,
  buscarHorariosDirector,
  ultimosEventosAuditoriaDirector,
  dashboard,
  resumenUsuarios,
  crearUsuario,
  actualizarCuentaUsuario,
  listarFoliosDirector,
  crearMateria,
  asignarDocenteAGrupo,
  listarTramites,
  actualizarTramite,
  reporteFinanciero,
  respaldoMetadatos,
  politicaFoliosPorRol,
  preasignarFolioPorRol,
  generateFolioByUserId,
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
