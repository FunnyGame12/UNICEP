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
    if (!(await columnExists(queryInterface, 'alumnos_perfil', 'modalidad_boleta'))) {
      await queryInterface.addColumn('alumnos_perfil', 'modalidad_boleta', {
        type: Sequelize.ENUM('ONLINE', 'PRESENCIAL', 'MIXTA'),
        allowNull: false,
        defaultValue: 'ONLINE',
      });
    }

    if (!(await columnExists(queryInterface, 'alumnos_perfil', 'campus_boleta'))) {
      await queryInterface.addColumn('alumnos_perfil', 'campus_boleta', {
        type: Sequelize.STRING(120),
        allowNull: false,
        defaultValue: 'UNICEP MERIDA',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('alumnos_perfil', 'campus_boleta').catch(() => {});
    await queryInterface.removeColumn('alumnos_perfil', 'modalidad_boleta').catch(() => {});
  },
};