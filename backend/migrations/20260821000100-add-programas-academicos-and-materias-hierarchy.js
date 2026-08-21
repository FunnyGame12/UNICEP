'use strict';

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some((entry) => {
    if (typeof entry === 'string') {
      return entry === tableName;
    }
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
    if (!(await tableExists(queryInterface, 'programas_academicos'))) {
      await queryInterface.createTable('programas_academicos', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        tipo_nivel: {
          type: Sequelize.ENUM('preparatoria', 'licenciatura', 'ingenieria', 'maestria'),
          allowNull: false,
        },
        nombre: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        modalidad_periodo: {
          type: Sequelize.ENUM('semestral', 'cuatrimestral'),
          allowNull: false,
        },
        total_periodos: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        estatus: {
          type: Sequelize.ENUM('activo', 'inactivo'),
          allowNull: false,
          defaultValue: 'activo',
        },
        fecha_creacion: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('programas_academicos', ['estatus']);
      await queryInterface.addIndex('programas_academicos', ['tipo_nivel']);
    }

    if (!(await columnExists(queryInterface, 'materias', 'programa_academico_id'))) {
      await queryInterface.addColumn('materias', 'programa_academico_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'programas_academicos',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    if (!(await columnExists(queryInterface, 'materias', 'periodo_numero'))) {
      await queryInterface.addColumn('materias', 'periodo_numero', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'materias', 'creditos'))) {
      await queryInterface.addColumn('materias', 'creditos', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'materias', 'horas_semanales'))) {
      await queryInterface.addColumn('materias', 'horas_semanales', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    await queryInterface.changeColumn('materias', 'codigo_materia', {
      type: Sequelize.STRING(50),
      allowNull: false,
    });

    await queryInterface.changeColumn('materias', 'nombre_materia', {
      type: Sequelize.STRING(255),
      allowNull: false,
    });

    await queryInterface.sequelize.query(`
      UPDATE materias
      SET periodo_numero = bimestre_pertenece
      WHERE periodo_numero IS NULL
    `);

    await queryInterface.addIndex('materias', ['programa_academico_id']);
    await queryInterface.addIndex('materias', ['periodo_numero']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('materias', ['periodo_numero']).catch(() => {});
    await queryInterface.removeIndex('materias', ['programa_academico_id']).catch(() => {});
    await queryInterface.removeColumn('materias', 'horas_semanales').catch(() => {});
    await queryInterface.removeColumn('materias', 'creditos').catch(() => {});
    await queryInterface.removeColumn('materias', 'periodo_numero').catch(() => {});
    await queryInterface.removeColumn('materias', 'programa_academico_id').catch(() => {});

    await queryInterface.removeIndex('programas_academicos', ['tipo_nivel']).catch(() => {});
    await queryInterface.removeIndex('programas_academicos', ['estatus']).catch(() => {});
    await queryInterface.dropTable('programas_academicos').catch(() => {});
  },
};
