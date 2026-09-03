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
    if (!(await columnExists(queryInterface, 'tramites_solicitudes', 'documento_respuesta_url'))) {
      await queryInterface.addColumn('tramites_solicitudes', 'documento_respuesta_url', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('tramites_solicitudes', 'documento_respuesta_url').catch(() => {});
  },
};
