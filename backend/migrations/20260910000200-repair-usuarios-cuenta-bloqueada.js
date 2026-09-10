'use strict';

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
    if (await columnExists(queryInterface, 'usuarios', 'cuenta_bloqueada')) {
      return;
    }

    await queryInterface.addColumn('usuarios', 'cuenta_bloqueada', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    if (!(await columnExists(queryInterface, 'usuarios', 'cuenta_bloqueada'))) {
      return;
    }

    await queryInterface.removeColumn('usuarios', 'cuenta_bloqueada');
  },
};