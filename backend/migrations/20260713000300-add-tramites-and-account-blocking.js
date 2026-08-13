'use strict';

const { TRAMITE_TIPOS, TRAMITE_ESTATUS } = require('../src/constants/tramites');

async function columnExists(queryInterface, tableName, columnName) {
  try {
    const description = await queryInterface.describeTable(tableName);
    return Boolean(description[columnName]);
  } catch (_error) {
    return false;
  }
}

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some((entry) => {
    if (typeof entry === 'string') {
      return entry === tableName;
    }
    return entry.tableName === tableName || entry.TABLE_NAME === tableName || Object.values(entry)[0] === tableName;
  });
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await columnExists(queryInterface, 'usuarios', 'cuenta_bloqueada'))) {
      await queryInterface.addColumn('usuarios', 'cuenta_bloqueada', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!(await tableExists(queryInterface, 'tramites_solicitudes'))) {
      await queryInterface.createTable('tramites_solicitudes', {
        id_tramite: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        id_alumno: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'alumnos_perfil',
            key: 'id_alumno',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        tipo: {
          type: Sequelize.ENUM(...TRAMITE_TIPOS),
          allowNull: false,
        },
        descripcion: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        adjunto_url: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        estatus: {
          type: Sequelize.ENUM(...TRAMITE_ESTATUS),
          allowNull: false,
          defaultValue: 'recibido',
        },
        respuesta: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        resuelto_por: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'usuarios',
            key: 'id_usuario',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        fecha_solicitud: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        fecha_resolucion: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      });

      await queryInterface.addIndex('tramites_solicitudes', ['id_alumno']);
      await queryInterface.addIndex('tramites_solicitudes', ['estatus']);
      await queryInterface.addIndex('tramites_solicitudes', ['tipo']);
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('tramites_solicitudes', ['tipo']).catch(() => {});
    await queryInterface.removeIndex('tramites_solicitudes', ['estatus']).catch(() => {});
    await queryInterface.removeIndex('tramites_solicitudes', ['id_alumno']).catch(() => {});
    await queryInterface.dropTable('tramites_solicitudes').catch(() => {});
    await queryInterface.removeColumn('usuarios', 'cuenta_bloqueada').catch(() => {});
  },
};