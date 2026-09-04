'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE asistencias_docente
      SET fecha_clase = DATE(fecha_clase)
      WHERE fecha_clase IS NOT NULL
    `);

    await queryInterface.changeColumn('asistencias_docente', 'fecha_clase', {
      type: Sequelize.DATEONLY,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('asistencias_docente', 'fecha_clase', {
      type: Sequelize.DATE,
      allowNull: false,
    });
  },
};
