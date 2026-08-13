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

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'programas_externos'))) {
      await queryInterface.createTable('programas_externos', {
        id_programa: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        id_alumno: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'alumnos_perfil',
            key: 'id_alumno',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        tipo_programa: {
          type: Sequelize.ENUM('servicio_social', 'practicas_profesionales'),
          allowNull: false,
        },
        organizacion: {
          type: Sequelize.STRING(160),
          allowNull: false,
        },
        estatus: {
          type: Sequelize.ENUM('registrado', 'en_proceso', 'validado', 'liberado'),
          allowNull: false,
          defaultValue: 'registrado',
        },
        fecha_inicio: {
          type: Sequelize.DATEONLY,
          allowNull: true,
        },
        fecha_fin: {
          type: Sequelize.DATEONLY,
          allowNull: true,
        },
        evidencia_url: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        observaciones: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        fecha_creacion: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('programas_externos', ['id_alumno']);
      await queryInterface.addIndex('programas_externos', ['tipo_programa']);
      await queryInterface.addIndex('programas_externos', ['estatus']);
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('programas_externos', ['estatus']).catch(() => {});
    await queryInterface.removeIndex('programas_externos', ['tipo_programa']).catch(() => {});
    await queryInterface.removeIndex('programas_externos', ['id_alumno']).catch(() => {});
    await queryInterface.dropTable('programas_externos').catch(() => {});
  },
};
