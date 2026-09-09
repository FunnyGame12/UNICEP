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
    if (await tableExists(queryInterface, 'avisos_institucionales')) {
      return;
    }

    await queryInterface.createTable('avisos_institucionales', {
      id_aviso_institucional: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      titulo: {
        type: Sequelize.STRING(180),
        allowNull: false,
      },
      mensaje: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      destinatario: {
        type: Sequelize.ENUM('alumnos', 'docentes', 'general'),
        allowNull: false,
        defaultValue: 'general',
      },
      tipo_adjunto: {
        type: Sequelize.ENUM('ninguno', 'archivo_local', 'enlace_drive'),
        allowNull: false,
        defaultValue: 'ninguno',
      },
      url_adjunto: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      carrera_id: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      cuatrimestre_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      activo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('avisos_institucionales', ['created_at']);
    await queryInterface.addIndex('avisos_institucionales', ['destinatario']);
    await queryInterface.addIndex('avisos_institucionales', ['activo']);
    await queryInterface.addIndex('avisos_institucionales', ['carrera_id']);
    await queryInterface.addIndex('avisos_institucionales', ['cuatrimestre_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('avisos_institucionales', ['cuatrimestre_id']).catch(() => {});
    await queryInterface.removeIndex('avisos_institucionales', ['carrera_id']).catch(() => {});
    await queryInterface.removeIndex('avisos_institucionales', ['activo']).catch(() => {});
    await queryInterface.removeIndex('avisos_institucionales', ['destinatario']).catch(() => {});
    await queryInterface.removeIndex('avisos_institucionales', ['created_at']).catch(() => {});
    await queryInterface.dropTable('avisos_institucionales').catch(() => {});
  },
};
