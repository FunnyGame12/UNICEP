const { Op } = require('sequelize');
const {
  Usuario,
  Rol,
  Subrol,
  Permiso,
  RolPermiso,
  SubrolPermiso,
} = require('../../models');
const { PERMISSIONS } = require('../constants/rbac');

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function fallbackPermissionsByRole(role) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  const allPermissions = Object.values(PERMISSIONS);

  if (normalizedRole === 'alumno') {
    return allPermissions.filter((code) => code.startsWith('alumno.'));
  }

  if (normalizedRole === 'maestro' || normalizedRole === 'docente') {
    return allPermissions.filter((code) => code.startsWith('maestro.'));
  }

  if (normalizedRole === 'coordinacion_academica' || normalizedRole === 'coordinacion_escolar') {
    return allPermissions.filter((code) => code.startsWith('admin.') || code.startsWith('maestro.'));
  }

  if (normalizedRole === 'control_escolar' || normalizedRole === 'administrativo') {
    return allPermissions.filter((code) => code.startsWith('admin.') || code.startsWith('alumno.'));
  }

  if (normalizedRole === 'director') {
    return allPermissions;
  }

  return [];
}

async function resolveUserAuthorization(idUsuario) {
  const usuario = await Usuario.findByPk(idUsuario, {
    attributes: ['id_usuario', 'rol', 'id_rol', 'id_subrol'],
    include: [
      {
        model: Rol,
        as: 'rol_configurado',
        attributes: ['id_rol', 'nombre_tecnico'],
      },
      {
        model: Subrol,
        as: 'subrol_configurado',
        attributes: ['id_subrol', 'nombre_tecnico'],
      },
    ],
  });

  if (!usuario) {
    return null;
  }

  const idRol = usuario.id_rol || usuario.rol_configurado?.id_rol;
  const idSubrol = usuario.id_subrol || usuario.subrol_configurado?.id_subrol || null;

  if (!idRol) {
    const effectiveFallback = fallbackPermissionsByRole(usuario.rol);
    return {
      rol: usuario.rol,
      subrol: null,
      permisos: effectiveFallback,
    };
  }

  const [rolPermisos, subrolPermisos] = await Promise.all([
    RolPermiso.findAll({
      where: { id_rol: idRol, permitido: true },
      include: [{ model: Permiso, as: 'permiso', attributes: ['codigo'] }],
      attributes: ['id_permiso'],
    }),
    idSubrol
      ? SubrolPermiso.findAll({
        where: { id_subrol: idSubrol },
        include: [{ model: Permiso, as: 'permiso', attributes: ['codigo'] }],
        attributes: ['id_permiso', 'permitido'],
      })
      : Promise.resolve([]),
  ]);

  const baseCodes = rolPermisos
    .map((entry) => entry.permiso?.codigo)
    .filter(Boolean);

  const explicitDeny = new Set(
    subrolPermisos
      .filter((entry) => entry.permitido === false)
      .map((entry) => entry.permiso?.codigo)
      .filter(Boolean),
  );

  const explicitAllow = new Set(
    subrolPermisos
      .filter((entry) => entry.permitido === true)
      .map((entry) => entry.permiso?.codigo)
      .filter(Boolean),
  );

  const effective = uniq([
    ...baseCodes.filter((code) => !explicitDeny.has(code)),
    ...explicitAllow,
  ]);

  return {
    rol: usuario.rol_configurado?.nombre_tecnico || usuario.rol,
    subrol: usuario.subrol_configurado?.nombre_tecnico || null,
    permisos: effective,
  };
}

function hasAnyPermission(user, requiredPermissions = []) {
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  const userPermissions = new Set(user?.permisos || []);
  return requiredPermissions.some((permission) => userPermissions.has(permission));
}

module.exports = {
  resolveUserAuthorization,
  hasAnyPermission,
};
