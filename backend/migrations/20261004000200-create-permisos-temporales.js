'use strict';

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some((entry) => {
    if (typeof entry === 'string') return entry === tableName;
    return entry.tableName === tableName || entry.TABLE_NAME === tableName || Object.values(entry)[0] === tableName;
  });
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (await tableExists(queryInterface, 'permisos_temporales')) {
      return;
    }

    await queryInterface.createTable('permisos_temporales', {
      id_permiso: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      modulo_destino: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      rol_autorizado: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      fecha_expiracion: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('permisos_temporales', ['modulo_destino', 'rol_autorizado'], {
      name: 'uq_permisos_temporales_modulo_rol',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('permisos_temporales', 'uq_permisos_temporales_modulo_rol').catch(() => {});
    await queryInterface.dropTable('permisos_temporales').catch(() => {});
  },
};
