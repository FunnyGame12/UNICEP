'use strict';

const { TRAMITE_ESTATUS } = require('../src/constants/tramites');

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
    if (!(await columnExists(queryInterface, 'alumnos_perfil', 'estatus_financiero'))) {
      await queryInterface.addColumn('alumnos_perfil', 'estatus_financiero', {
        type: Sequelize.ENUM('al_dia', 'deudor', 'suspendido'),
        allowNull: false,
        defaultValue: 'al_dia',
      });
    }

    if (!(await columnExists(queryInterface, 'alumnos_perfil', 'bloqueo_plataforma'))) {
      await queryInterface.addColumn('alumnos_perfil', 'bloqueo_plataforma', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!(await columnExists(queryInterface, 'alumnos_perfil', 'bloqueo_calificaciones'))) {
      await queryInterface.addColumn('alumnos_perfil', 'bloqueo_calificaciones', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    await queryInterface.changeColumn('tramites_solicitudes', 'estatus', {
      type: Sequelize.ENUM(...TRAMITE_ESTATUS),
      allowNull: false,
      defaultValue: 'recibido',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('alumnos_perfil', 'bloqueo_calificaciones').catch(() => {});
    await queryInterface.removeColumn('alumnos_perfil', 'bloqueo_plataforma').catch(() => {});
    await queryInterface.removeColumn('alumnos_perfil', 'estatus_financiero').catch(() => {});

    await queryInterface.changeColumn('tramites_solicitudes', 'estatus', {
      type: Sequelize.ENUM('recibido', 'en_revision', 'resuelto', 'rechazado', 'cancelado'),
      allowNull: false,
      defaultValue: 'recibido',
    }).catch(() => {});
  },
};
