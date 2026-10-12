'use strict';

async function columnExists(queryInterface, tableName, columnName) {
  const description = await queryInterface.describeTable(tableName);
  return Object.prototype.hasOwnProperty.call(description, columnName);
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (await columnExists(queryInterface, 'plantillas_detalles', 'dia_vencimiento')) {
      await queryInterface.removeColumn('plantillas_detalles', 'dia_vencimiento');
    }

    if (await columnExists(queryInterface, 'plantillas_detalles', 'fecha_exacta')) {
      await queryInterface.changeColumn('plantillas_detalles', 'fecha_exacta', {
        type: Sequelize.DATEONLY,
        allowNull: false,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    if (!(await columnExists(queryInterface, 'plantillas_detalles', 'dia_vencimiento'))) {
      await queryInterface.addColumn('plantillas_detalles', 'dia_vencimiento', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (await columnExists(queryInterface, 'plantillas_detalles', 'fecha_exacta')) {
      await queryInterface.changeColumn('plantillas_detalles', 'fecha_exacta', {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }
  },
};
