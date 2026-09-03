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
    if (!(await columnExists(queryInterface, 'portafolio_evidencias', 'tipo_documento'))) {
      await queryInterface.addColumn('portafolio_evidencias', 'tipo_documento', {
        type: Sequelize.STRING(60),
        allowNull: true,
      });
    }

    await queryInterface.changeColumn('portafolio_evidencias', 'origen', {
      type: Sequelize.ENUM('docente', 'control_escolar', 'alumno'),
      allowNull: false,
      defaultValue: 'docente',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('portafolio_evidencias', 'origen', {
      type: Sequelize.ENUM('docente', 'control_escolar'),
      allowNull: false,
      defaultValue: 'docente',
    }).catch(() => {});

    await queryInterface.removeColumn('portafolio_evidencias', 'tipo_documento').catch(() => {});
  },
};
