'use strict';

async function columnExists(queryInterface, tableName, columnName) {
  const description = await queryInterface.describeTable(tableName);
  return Object.prototype.hasOwnProperty.call(description, columnName);
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await columnExists(queryInterface, 'plantillas_planes', 'grupo_objetivo'))) {
      await queryInterface.addColumn('plantillas_planes', 'grupo_objetivo', {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }

    await queryInterface.addIndex('plantillas_planes', ['carrera', 'cuatrimestre', 'grupo_objetivo'], {
      name: 'idx_plantillas_planes_scope',
    }).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('plantillas_planes', 'idx_plantillas_planes_scope').catch(() => {});

    if (await columnExists(queryInterface, 'plantillas_planes', 'grupo_objetivo')) {
      await queryInterface.removeColumn('plantillas_planes', 'grupo_objetivo');
    }
  },
};
