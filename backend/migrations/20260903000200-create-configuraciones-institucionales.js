'use strict';

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some((entry) => {
    if (typeof entry === 'string') return entry === tableName;
    return entry.tableName === tableName || entry.TABLE_NAME === tableName || Object.values(entry)[0] === tableName;
  });
}

const DEFAULT_VALUES = {
  biblioteca_virtual_url: 'https://www.unicepmerida.com/biblioteca-virtual',
  manual_servicio_social_url: '/pdf/MANUAL_SERVICIO_SOCIAL_Y_PRACTICAS.pdf',
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (await tableExists(queryInterface, 'configuraciones_institucionales')) {
      return;
    }

    await queryInterface.createTable('configuraciones_institucionales', {
      id_configuracion: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      clave: {
        type: Sequelize.STRING(80),
        allowNull: false,
        unique: true,
      },
      valor: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      fecha_actualizacion: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      id_actualizado_por: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
    });

    const now = new Date();
    await queryInterface.bulkInsert('configuraciones_institucionales', Object.entries(DEFAULT_VALUES).map(([clave, valor]) => ({
      clave,
      valor,
      fecha_actualizacion: now,
      id_actualizado_por: null,
    })));
  },

  async down(queryInterface) {
    await queryInterface.dropTable('configuraciones_institucionales').catch(() => {});
  },
};
