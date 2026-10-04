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
    if (await tableExists(queryInterface, 'biblioteca_configuraciones')) {
      return;
    }

    await queryInterface.createTable('biblioteca_configuraciones', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      carrera: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      cuatrimestre: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      url_biblioteca: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('biblioteca_configuraciones', ['carrera', 'cuatrimestre'], {
      name: 'uq_biblioteca_config_carrera_cuatrimestre',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('biblioteca_configuraciones', 'uq_biblioteca_config_carrera_cuatrimestre').catch(() => {});
    await queryInterface.dropTable('biblioteca_configuraciones').catch(() => {});
  },
};
