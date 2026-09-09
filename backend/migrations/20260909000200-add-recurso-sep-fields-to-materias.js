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
    if (!(await columnExists(queryInterface, 'materias', 'recurso_sep_tipo'))) {
      await queryInterface.addColumn('materias', 'recurso_sep_tipo', {
        type: Sequelize.ENUM('enlace_drive', 'archivo_local', 'ninguno'),
        allowNull: false,
        defaultValue: 'ninguno',
      });
    }

    if (!(await columnExists(queryInterface, 'materias', 'recurso_sep_url'))) {
      await queryInterface.addColumn('materias', 'recurso_sep_url', {
        type: Sequelize.STRING(500),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('materias', 'recurso_sep_url').catch(() => {});
    await queryInterface.removeColumn('materias', 'recurso_sep_tipo').catch(() => {});
  },
};
