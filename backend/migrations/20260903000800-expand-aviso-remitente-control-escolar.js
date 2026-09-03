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
    if (!(await tableExists(queryInterface, 'avisos'))) {
      return;
    }

    await queryInterface.changeColumn('avisos', 'remitente_tipo', {
      type: Sequelize.ENUM('coordinacion', 'docente', 'control_escolar'),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'avisos'))) {
      return;
    }

    await queryInterface.sequelize.query("UPDATE avisos SET remitente_tipo = 'coordinacion' WHERE remitente_tipo = 'control_escolar'");
    await queryInterface.changeColumn('avisos', 'remitente_tipo', {
      type: Sequelize.ENUM('coordinacion', 'docente'),
      allowNull: false,
    });
  },
};
