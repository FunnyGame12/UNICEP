'use strict';

async function columnExists(queryInterface, tableName, columnName) {
  const table = await queryInterface.describeTable(tableName);
  return Object.prototype.hasOwnProperty.call(table, columnName);
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (await columnExists(queryInterface, 'avisos_institucionales', 'id_publicado_por')) {
      return;
    }

    await queryInterface.addColumn('avisos_institucionales', 'id_publicado_por', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'usuarios',
        key: 'id_usuario',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('avisos_institucionales', ['id_publicado_por']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('avisos_institucionales', ['id_publicado_por']).catch(() => {});
    await queryInterface.removeColumn('avisos_institucionales', 'id_publicado_por').catch(() => {});
  },
};