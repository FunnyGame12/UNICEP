'use strict';

const { ROLES, SUBROLES, PERMISSIONS } = require('../src/constants/rbac');

function normalizePermission(permissionCode) {
  const parts = permissionCode.split('.');
  const modulo = parts.slice(0, -1).join('.');
  const rawAction = parts[parts.length - 1] || 'read';
  const accion = rawAction.toUpperCase();
  return { modulo, accion };
}

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const permissionCodes = Object.values(PERMISSIONS);

    const [existingPermissions] = await queryInterface.sequelize.query(
      'SELECT id_permiso, codigo FROM permisos WHERE codigo IN (?)',
      { replacements: [permissionCodes] },
    );

    const existingSet = new Set(existingPermissions.map((item) => item.codigo));

    const toInsert = permissionCodes
      .filter((code) => !existingSet.has(code))
      .map((code) => {
        const parsed = normalizePermission(code);
        return {
          codigo: code,
          modulo: parsed.modulo,
          accion: parsed.accion,
          scope: 'any',
          descripcion: `Permiso RBAC ${code}`,
          fecha_creacion: now,
        };
      });

    if (toInsert.length > 0) {
      await queryInterface.bulkInsert('permisos', toInsert);
    }

    const [roles] = await queryInterface.sequelize.query('SELECT id_rol, nombre_tecnico FROM roles');
    const [subroles] = await queryInterface.sequelize.query('SELECT id_subrol, nombre_tecnico FROM subroles');
    const [permissions] = await queryInterface.sequelize.query('SELECT id_permiso, codigo FROM permisos WHERE codigo IN (?)', {
      replacements: [permissionCodes],
    });

    const roleByCode = new Map(roles.map((item) => [item.nombre_tecnico, item.id_rol]));
    const subroleByCode = new Map(subroles.map((item) => [item.nombre_tecnico, item.id_subrol]));
    const permissionByCode = new Map(permissions.map((item) => [item.codigo, item.id_permiso]));

    const alumnoPermissions = [
      PERMISSIONS.ALUMNO_DASHBOARD_READ,
      PERMISSIONS.ALUMNO_TAREAS_READ,
      PERMISSIONS.ALUMNO_ENTREGAS_CREATE,
      PERMISSIONS.ALUMNO_CALIFICACIONES_READ,
      PERMISSIONS.ALUMNO_MATERIALES_READ,
      PERMISSIONS.ALUMNO_PORTAFOLIO_READ,
      PERMISSIONS.ALUMNO_MERITOS_READ,
      PERMISSIONS.ALUMNO_PLAN_ESTUDIO_READ,
      PERMISSIONS.ALUMNO_PAGOS_READ,
      PERMISSIONS.ALUMNO_TRAMITES_READ,
      PERMISSIONS.ALUMNO_TRAMITES_CREATE,
    ];

    const maestroPermissions = [
      PERMISSIONS.MAESTRO_DASHBOARD_READ,
      PERMISSIONS.MAESTRO_GRUPOS_READ,
      PERMISSIONS.MAESTRO_TAREAS_READ,
      PERMISSIONS.MAESTRO_TAREAS_CREATE,
      PERMISSIONS.MAESTRO_ENTREGAS_READ,
      PERMISSIONS.MAESTRO_ENTREGAS_UPDATE,
      PERMISSIONS.MAESTRO_MATERIALES_READ,
      PERMISSIONS.MAESTRO_MATERIALES_CREATE,
      PERMISSIONS.MAESTRO_PORTAFOLIOS_READ,
      PERMISSIONS.MAESTRO_CALIFICACIONES_FINALES_READ,
      PERMISSIONS.MAESTRO_ANUNCIOS_READ,
      PERMISSIONS.MAESTRO_ANUNCIOS_CREATE,
      PERMISSIONS.MAESTRO_SALAS_VIDEO_READ,
      PERMISSIONS.MAESTRO_SALAS_VIDEO_CREATE,
      PERMISSIONS.MAESTRO_ASISTENCIAS_READ,
      PERMISSIONS.MAESTRO_ASISTENCIAS_CREATE,
      PERMISSIONS.MAESTRO_APROVECHAMIENTO_READ,
      PERMISSIONS.MAESTRO_JUSTIFICANTES_READ,
    ];

    const directorPermissions = [
      PERMISSIONS.DIRECTOR_SUPERVISION_READ,
      PERMISSIONS.DIRECTOR_FOLIOS_MANAGE,
      PERMISSIONS.DIRECTOR_FINANCIAL_OVERRIDE,
      PERMISSIONS.DIRECTOR_CALIFICACIONES_EXTEMPORANEAS_AUTHORIZE,
      PERMISSIONS.DIRECTOR_AULAS_ASSIGN,
    ];

    const adminAll = [
      PERMISSIONS.ADMIN_USUARIOS_RESUMEN_READ,
      PERMISSIONS.ADMIN_USUARIOS_READ,
      PERMISSIONS.ADMIN_USUARIOS_CREATE,
      PERMISSIONS.ADMIN_DASHBOARD_READ,
      PERMISSIONS.ADMIN_MATERIAS_READ,
      PERMISSIONS.ADMIN_MATERIAS_CREATE,
      PERMISSIONS.ADMIN_MATERIAS_UPDATE,
      PERMISSIONS.ADMIN_PLANES_ESTUDIO_READ,
      PERMISSIONS.ADMIN_PLANES_ESTUDIO_CREATE,
      PERMISSIONS.ADMIN_PERIODOS_READ,
      PERMISSIONS.ADMIN_PERIODOS_CREATE,
      PERMISSIONS.ADMIN_CALIFICACIONES_VALIDACIONES_READ,
      PERMISSIONS.ADMIN_CALIFICACIONES_VALIDACIONES_UPDATE,
      PERMISSIONS.ADMIN_REPORTES_ACADEMICOS_READ,
      PERMISSIONS.ADMIN_REPORTES_AVANCE_GLOBAL_READ,
      PERMISSIONS.ADMIN_REPORTES_FINANCIEROS_READ,
      PERMISSIONS.ADMIN_RESPALDO_READ,
      PERMISSIONS.ADMIN_PAGOS_READ,
      PERMISSIONS.ADMIN_PAGOS_CREATE,
      PERMISSIONS.ADMIN_PAGOS_UPDATE,
      PERMISSIONS.ADMIN_PAGOS_VALIDAR,
      PERMISSIONS.ADMIN_CONCEPTOS_PAGO_READ,
      PERMISSIONS.ADMIN_CONCEPTOS_PAGO_CREATE,
      PERMISSIONS.ADMIN_REGLAS_DESBLOQUEO_READ,
      PERMISSIONS.ADMIN_REGLAS_DESBLOQUEO_CREATE,
      PERMISSIONS.ADMIN_DESBLOQUEOS_MANUALES_READ,
      PERMISSIONS.ADMIN_DESBLOQUEOS_MANUALES_CREATE,
      PERMISSIONS.ADMIN_ALUMNO_DESBLOQUEO_READ,
      PERMISSIONS.ADMIN_CUENTAS_UPDATE,
      PERMISSIONS.ADMIN_FOLIOS_USUARIOS_READ,
      PERMISSIONS.ADMIN_FOLIOS_USUARIOS_UPDATE,
      PERMISSIONS.ADMIN_FOLIOS_USUARIOS_RETIRE,
      PERMISSIONS.ADMIN_FOLIOS_PAGOS_READ,
      PERMISSIONS.ADMIN_FOLIOS_PAGOS_UPDATE,
      PERMISSIONS.ADMIN_FOLIOS_PAGOS_RETIRE,
      PERMISSIONS.ADMIN_TRAMITES_READ,
      PERMISSIONS.ADMIN_TRAMITES_UPDATE,
      PERMISSIONS.ADMIN_ALUMNO_GRUPOS_READ,
      PERMISSIONS.ADMIN_ALUMNO_GRUPOS_CREATE,
      PERMISSIONS.ADMIN_ALUMNO_GRUPOS_DELETE,
      PERMISSIONS.ADMIN_DOCENTE_GRUPOS_READ,
      PERMISSIONS.ADMIN_DOCENTE_GRUPOS_CREATE,
      PERMISSIONS.ADMIN_DOCENTE_GRUPOS_DELETE,
      PERMISSIONS.ADMIN_CARGA_HORARIA_READ,
      PERMISSIONS.ADMIN_HORARIOS_READ,
      PERMISSIONS.ADMIN_HORARIOS_CREATE,
      PERMISSIONS.ADMIN_HORARIOS_UPDATE,
      PERMISSIONS.ADMIN_PROGRAMAS_EXTERNOS_READ,
      PERMISSIONS.ADMIN_PROGRAMAS_EXTERNOS_CREATE,
      PERMISSIONS.ADMIN_PROGRAMAS_EXTERNOS_UPDATE,
      PERMISSIONS.ADMIN_MERITOS_READ,
      PERMISSIONS.ADMIN_MERITOS_CREATE,
      PERMISSIONS.ADMIN_MERITOS_UPDATE,
      PERMISSIONS.ADMIN_REPROBADOS_READ,
      PERMISSIONS.ADMIN_ACTAS_READ,
      PERMISSIONS.ADMIN_ACTAS_CREATE,
      PERMISSIONS.ADMIN_ACTAS_UPDATE,
      PERMISSIONS.ADMIN_EXTRAORDINARIOS_READ,
      PERMISSIONS.ADMIN_EXTRAORDINARIOS_CREATE,
      PERMISSIONS.ADMIN_EXTRAORDINARIOS_UPDATE,
    ];

    const controlEscolarPermissions = [
      PERMISSIONS.ADMIN_DASHBOARD_READ,
      PERMISSIONS.ADMIN_PAGOS_READ,
      PERMISSIONS.ADMIN_PAGOS_CREATE,
      PERMISSIONS.ADMIN_PAGOS_UPDATE,
      PERMISSIONS.ADMIN_PAGOS_VALIDAR,
      PERMISSIONS.ADMIN_CONCEPTOS_PAGO_READ,
      PERMISSIONS.ADMIN_REGLAS_DESBLOQUEO_READ,
      PERMISSIONS.ADMIN_REGLAS_DESBLOQUEO_CREATE,
      PERMISSIONS.ADMIN_DESBLOQUEOS_MANUALES_READ,
      PERMISSIONS.ADMIN_DESBLOQUEOS_MANUALES_CREATE,
      PERMISSIONS.ADMIN_ALUMNO_DESBLOQUEO_READ,
      PERMISSIONS.ADMIN_CUENTAS_UPDATE,
      PERMISSIONS.ADMIN_FOLIOS_USUARIOS_READ,
      PERMISSIONS.ADMIN_FOLIOS_PAGOS_READ,
      PERMISSIONS.ADMIN_TRAMITES_READ,
      PERMISSIONS.ADMIN_TRAMITES_UPDATE,
      PERMISSIONS.ADMIN_USUARIOS_RESUMEN_READ,
      PERMISSIONS.ADMIN_USUARIOS_READ,
      PERMISSIONS.ADMIN_CALIFICACIONES_VALIDACIONES_READ,
      PERMISSIONS.ADMIN_CALIFICACIONES_VALIDACIONES_UPDATE,
      PERMISSIONS.ADMIN_REPORTES_ACADEMICOS_READ,
      PERMISSIONS.ADMIN_REPORTES_FINANCIEROS_READ,
    ];

    const coordinacionPermissions = [
      PERMISSIONS.ADMIN_DASHBOARD_READ,
      PERMISSIONS.ADMIN_MATERIAS_READ,
      PERMISSIONS.ADMIN_MATERIAS_CREATE,
      PERMISSIONS.ADMIN_MATERIAS_UPDATE,
      PERMISSIONS.ADMIN_PLANES_ESTUDIO_READ,
      PERMISSIONS.ADMIN_PLANES_ESTUDIO_CREATE,
      PERMISSIONS.ADMIN_PERIODOS_READ,
      PERMISSIONS.ADMIN_PERIODOS_CREATE,
      PERMISSIONS.ADMIN_CALIFICACIONES_VALIDACIONES_READ,
      PERMISSIONS.ADMIN_CALIFICACIONES_VALIDACIONES_UPDATE,
      PERMISSIONS.ADMIN_REPORTES_ACADEMICOS_READ,
      PERMISSIONS.ADMIN_REPORTES_AVANCE_GLOBAL_READ,
      PERMISSIONS.ADMIN_FOLIOS_USUARIOS_READ,
      PERMISSIONS.ADMIN_ALUMNO_GRUPOS_READ,
      PERMISSIONS.ADMIN_DOCENTE_GRUPOS_READ,
      PERMISSIONS.ADMIN_DOCENTE_GRUPOS_CREATE,
      PERMISSIONS.ADMIN_DOCENTE_GRUPOS_DELETE,
      PERMISSIONS.ADMIN_USUARIOS_RESUMEN_READ,
      PERMISSIONS.ADMIN_CARGA_HORARIA_READ,
      PERMISSIONS.ADMIN_HORARIOS_READ,
      PERMISSIONS.ADMIN_HORARIOS_CREATE,
      PERMISSIONS.ADMIN_HORARIOS_UPDATE,
      PERMISSIONS.ADMIN_PROGRAMAS_EXTERNOS_READ,
      PERMISSIONS.ADMIN_PROGRAMAS_EXTERNOS_CREATE,
      PERMISSIONS.ADMIN_PROGRAMAS_EXTERNOS_UPDATE,
      PERMISSIONS.ADMIN_MERITOS_READ,
      PERMISSIONS.ADMIN_MERITOS_CREATE,
      PERMISSIONS.ADMIN_MERITOS_UPDATE,
      PERMISSIONS.ADMIN_REPROBADOS_READ,
      PERMISSIONS.ADMIN_ACTAS_READ,
      PERMISSIONS.ADMIN_ACTAS_CREATE,
      PERMISSIONS.ADMIN_ACTAS_UPDATE,
      PERMISSIONS.ADMIN_EXTRAORDINARIOS_READ,
      PERMISSIONS.ADMIN_EXTRAORDINARIOS_CREATE,
      PERMISSIONS.ADMIN_EXTRAORDINARIOS_UPDATE,
    ];

    const grantsByRole = {
      [ROLES.ALUMNO]: alumnoPermissions,
      [ROLES.MAESTRO]: maestroPermissions,
      [ROLES.DIRECTOR]: [...adminAll, ...directorPermissions],
      [ROLES.CONTROL_ESCOLAR]: controlEscolarPermissions,
      [ROLES.COORDINACION_ACADEMICA]: coordinacionPermissions,
    };

    const roleGrantRows = [];
    for (const [roleCode, rolePermissions] of Object.entries(grantsByRole)) {
      const idRol = roleByCode.get(roleCode);
      if (!idRol) {
        continue;
      }

      for (const permissionCode of rolePermissions) {
        const idPermiso = permissionByCode.get(permissionCode);
        if (!idPermiso) {
          continue;
        }
        roleGrantRows.push({
          id_rol: idRol,
          id_permiso: idPermiso,
          permitido: true,
          fecha_creacion: now,
        });
      }
    }

    if (roleGrantRows.length > 0) {
      await queryInterface.bulkInsert('roles_permisos', roleGrantRows, {
        ignoreDuplicates: true,
      });
    }

    const prefectoDeny = [
      PERMISSIONS.ADMIN_PAGOS_CREATE,
      PERMISSIONS.ADMIN_PAGOS_UPDATE,
      PERMISSIONS.ADMIN_PAGOS_VALIDAR,
      PERMISSIONS.ADMIN_REGLAS_DESBLOQUEO_CREATE,
      PERMISSIONS.ADMIN_DESBLOQUEOS_MANUALES_CREATE,
      PERMISSIONS.ADMIN_REPORTES_FINANCIEROS_READ,
    ];

    const subroleOverrides = [];
    const idSubrolPrefecto = subroleByCode.get(SUBROLES.PREFECTO_EN_LINEA);
    if (idSubrolPrefecto) {
      for (const permissionCode of prefectoDeny) {
        const idPermiso = permissionByCode.get(permissionCode);
        if (!idPermiso) {
          continue;
        }

        subroleOverrides.push({
          id_subrol: idSubrolPrefecto,
          id_permiso: idPermiso,
          permitido: false,
          fecha_creacion: now,
        });
      }
    }

    if (subroleOverrides.length > 0) {
      await queryInterface.bulkInsert('subroles_permisos', subroleOverrides, {
        ignoreDuplicates: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('subroles_permisos', {}, {});
    await queryInterface.bulkDelete('roles_permisos', {}, {});
    await queryInterface.bulkDelete('permisos', {
      codigo: Object.values(PERMISSIONS),
    });
  },
};
