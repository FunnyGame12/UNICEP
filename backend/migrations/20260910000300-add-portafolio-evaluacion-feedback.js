'use strict';

async function columnExists(queryInterface, tableName, columnName) {
  const table = await queryInterface.describeTable(tableName);
  return Object.prototype.hasOwnProperty.call(table, columnName);
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'portafolio_materia_evidencias';

    const hasEstado = await columnExists(queryInterface, tableName, 'portafolio_estado').catch(() => false);
    if (!hasEstado) {
      await queryInterface.addColumn(tableName, 'portafolio_estado', {
        type: Sequelize.ENUM('pendiente', 'validado', 'rechazado', 'no_entregado'),
        allowNull: false,
        defaultValue: 'no_entregado',
      });
    }

    const hasFeedback = await columnExists(queryInterface, tableName, 'portafolio_feedback').catch(() => false);
    if (!hasFeedback) {
      await queryInterface.addColumn(tableName, 'portafolio_feedback', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE ${tableName}
      SET portafolio_estado = CASE
        WHEN estado = 'validado' THEN 'validado'
        WHEN estado = 'entregado' THEN 'pendiente'
        ELSE 'no_entregado'
      END
      WHERE portafolio_estado IS NULL
         OR portafolio_estado = ''
         OR portafolio_estado = 'no_entregado';
    `);
  },

  async down(queryInterface) {
    const tableName = 'portafolio_materia_evidencias';

    await queryInterface.removeColumn(tableName, 'portafolio_feedback').catch(() => {});
    await queryInterface.removeColumn(tableName, 'portafolio_estado').catch(() => {});
  },
};
