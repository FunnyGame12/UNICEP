'use strict';

async function columnExists(queryInterface, tableName, columnName) {
  try {
    const description = await queryInterface.describeTable(tableName);
    return Boolean(description[columnName]);
  } catch (_error) {
    return false;
  }
}

async function indexExists(queryInterface, tableName, indexName) {
  try {
    const indexes = await queryInterface.showIndex(tableName);
    return indexes.some((item) => item.name === indexName);
  } catch (_error) {
    return false;
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await columnExists(queryInterface, 'usuarios', 'curp'))) {
      await queryInterface.addColumn('usuarios', 'curp', {
        type: Sequelize.STRING(18),
        allowNull: true,
      });
    }

    if (!(await indexExists(queryInterface, 'usuarios', 'usuarios_curp_unique'))) {
      await queryInterface.addIndex('usuarios', ['curp'], {
        name: 'usuarios_curp_unique',
        unique: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('usuarios', 'usuarios_curp_unique').catch(() => {});
    await queryInterface.removeColumn('usuarios', 'curp').catch(() => {});
  },
};