'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('horarios', {
      id_horario: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      modalidad: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      periodo: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      turno: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      hora_inicio: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      hora_fin: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
    });

    await queryInterface.createTable('campus_servicios', {
      id_servicio: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      titulo: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      icono: {
        type: Sequelize.STRING(60),
        allowNull: true,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('campus_servicios');
    await queryInterface.dropTable('horarios');
  },
};
