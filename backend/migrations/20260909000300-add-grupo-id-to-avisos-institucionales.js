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
    if (!(await columnExists(queryInterface, 'avisos_institucionales', 'grupo_id'))) {
      await queryInterface.addColumn('avisos_institucionales', 'grupo_id', {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
      await queryInterface.addIndex('avisos_institucionales', ['grupo_id']);
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('avisos_institucionales', ['grupo_id']).catch(() => {});
    await queryInterface.removeColumn('avisos_institucionales', 'grupo_id').catch(() => {});
  },
};
