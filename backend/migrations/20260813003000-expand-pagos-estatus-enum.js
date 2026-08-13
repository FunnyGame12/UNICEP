'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('pagos_estatus', 'estatus', {
      type: Sequelize.ENUM('pagado', 'pendiente', 'vencido', 'condonado', 'cancelado'),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('pagos_estatus', 'estatus', {
      type: Sequelize.ENUM('pagado', 'pendiente', 'vencido'),
      allowNull: false,
    });
  },
};
