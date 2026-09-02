'use strict';

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some((entry) => {
    if (typeof entry === 'string') return entry === tableName;
    return entry.tableName === tableName || entry.TABLE_NAME === tableName || Object.values(entry)[0] === tableName;
  });
}

async function columnExists(queryInterface, tableName, columnName) {
  try {
    const description = await queryInterface.describeTable(tableName);
    return Boolean(description[columnName]);
  } catch (_error) {
    return false;
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await columnExists(queryInterface, 'alumnos_perfil', 'estado_academico'))) {
      await queryInterface.addColumn('alumnos_perfil', 'estado_academico', {
        type: Sequelize.ENUM('activo', 'suspendido'),
        allowNull: false,
        defaultValue: 'activo',
      });
    }

    if (!(await columnExists(queryInterface, 'materias', 'imagen_portada_url'))) {
      await queryInterface.addColumn('materias', 'imagen_portada_url', {
        type: Sequelize.STRING(500),
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'materias', 'recursos_sep'))) {
      await queryInterface.addColumn('materias', 'recursos_sep', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'periodos_academicos', 'fecha_limite_calificaciones'))) {
      await queryInterface.addColumn('periodos_academicos', 'fecha_limite_calificaciones', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (await tableExists(queryInterface, 'programas_academicos')) {
      await queryInterface.sequelize.query("UPDATE programas_academicos SET modalidad_periodo = 'cuatrimestral' WHERE modalidad_periodo = 'semestral'");
      await queryInterface.changeColumn('programas_academicos', 'modalidad_periodo', {
        type: Sequelize.ENUM('cuatrimestral'),
        allowNull: false,
        defaultValue: 'cuatrimestral',
      });
    }

    if (await tableExists(queryInterface, 'calificaciones_parciales_docente') && !(await tableExists(queryInterface, 'calificaciones_formativas_docente'))) {
      await queryInterface.renameTable('calificaciones_parciales_docente', 'calificaciones_formativas_docente');
    }

    if (await columnExists(queryInterface, 'calificaciones_formativas_docente', 'parcial_numero')
      && !(await columnExists(queryInterface, 'calificaciones_formativas_docente', 'formativa_numero'))) {
      await queryInterface.renameColumn('calificaciones_formativas_docente', 'parcial_numero', 'formativa_numero');
      await queryInterface.removeConstraint('calificaciones_formativas_docente', 'uq_parcial_por_alumno_materia_grupo').catch(() => {});
      await queryInterface.addConstraint('calificaciones_formativas_docente', {
        fields: ['id_alumno', 'id_materia', 'grupo_id', 'formativa_numero'],
        type: 'unique',
        name: 'uq_formativa_por_alumno_materia_grupo',
      });
    }
  },

  async down(queryInterface, Sequelize) {
    if (await tableExists(queryInterface, 'calificaciones_formativas_docente')) {
      await queryInterface.removeConstraint('calificaciones_formativas_docente', 'uq_formativa_por_alumno_materia_grupo').catch(() => {});
      if (await columnExists(queryInterface, 'calificaciones_formativas_docente', 'formativa_numero')) {
        await queryInterface.renameColumn('calificaciones_formativas_docente', 'formativa_numero', 'parcial_numero');
      }
      await queryInterface.renameTable('calificaciones_formativas_docente', 'calificaciones_parciales_docente');
      await queryInterface.addConstraint('calificaciones_parciales_docente', {
        fields: ['id_alumno', 'id_materia', 'grupo_id', 'parcial_numero'],
        type: 'unique',
        name: 'uq_parcial_por_alumno_materia_grupo',
      }).catch(() => {});
    }

    if (await tableExists(queryInterface, 'programas_academicos')) {
      await queryInterface.changeColumn('programas_academicos', 'modalidad_periodo', {
        type: Sequelize.ENUM('semestral', 'cuatrimestral'),
        allowNull: false,
      });
    }

    await queryInterface.removeColumn('periodos_academicos', 'fecha_limite_calificaciones').catch(() => {});
    await queryInterface.removeColumn('materias', 'recursos_sep').catch(() => {});
    await queryInterface.removeColumn('materias', 'imagen_portada_url').catch(() => {});
    await queryInterface.removeColumn('alumnos_perfil', 'estado_academico').catch(() => {});
  },
};