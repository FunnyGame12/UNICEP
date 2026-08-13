'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('usuarios', 'cuenta_activada', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.sequelize.query(
      "UPDATE usuarios SET cuenta_activada = 1 WHERE correo NOT LIKE 'pending+%@unicep.local'",
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('usuarios', 'cuenta_activada');
  },
};
