'use strict';

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some((entry) => {
    if (typeof entry === 'string') return entry === tableName;
    return entry.tableName === tableName || entry.TABLE_NAME === tableName || Object.values(entry)[0] === tableName;
  });
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (await tableExists(queryInterface, 'recursos_institucionales')) return;

    await queryInterface.createTable('recursos_institucionales', {
      id_recurso_institucional: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      titulo: {
        type: Sequelize.STRING(180),
        allowNull: false,
      },
      archivo_url: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      tipo_asignacion: {
        type: Sequelize.ENUM('masivo', 'individual'),
        allowNull: false,
      },
      carrera_id: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      semestre: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      grupo_id: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      alumno_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'alumnos_perfil',
          key: 'id_alumno',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('recursos_institucionales', ['tipo_asignacion']);
    await queryInterface.addIndex('recursos_institucionales', ['carrera_id']);
    await queryInterface.addIndex('recursos_institucionales', ['semestre']);
    await queryInterface.addIndex('recursos_institucionales', ['grupo_id']);
    await queryInterface.addIndex('recursos_institucionales', ['alumno_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('recursos_institucionales', ['alumno_id']).catch(() => {});
    await queryInterface.removeIndex('recursos_institucionales', ['grupo_id']).catch(() => {});
    await queryInterface.removeIndex('recursos_institucionales', ['semestre']).catch(() => {});
    await queryInterface.removeIndex('recursos_institucionales', ['carrera_id']).catch(() => {});
    await queryInterface.removeIndex('recursos_institucionales', ['tipo_asignacion']).catch(() => {});
    await queryInterface.dropTable('recursos_institucionales').catch(() => {});
  },
};
