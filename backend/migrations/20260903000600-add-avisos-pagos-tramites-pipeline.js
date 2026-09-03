'use strict';

const {
  TRAMITE_ESTATUS,
} = require('../src/constants/tramites');

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some((entry) => {
    if (typeof entry === 'string') return entry === tableName;
    return entry.tableName === tableName || entry.TABLE_NAME === tableName || Object.values(entry)[0] === tableName;
  });
}

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
    if (!(await tableExists(queryInterface, 'avisos'))) {
      await queryInterface.createTable('avisos', {
        id_aviso: {
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
        remitente_tipo: {
          type: Sequelize.ENUM('coordinacion', 'docente'),
          allowNull: false,
        },
        carrera_id: {
          type: Sequelize.STRING(120),
          allowNull: true,
        },
        grupo_id: {
          type: Sequelize.STRING(20),
          allowNull: true,
        },
        docente_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'usuarios',
            key: 'id_usuario',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('avisos', ['created_at']);
      await queryInterface.addIndex('avisos', ['remitente_tipo']);
      await queryInterface.addIndex('avisos', ['carrera_id']);
      await queryInterface.addIndex('avisos', ['grupo_id']);
      await queryInterface.addIndex('avisos', ['docente_id']);
    }

    if (!(await tableExists(queryInterface, 'alumno_avisos_ocultos'))) {
      await queryInterface.createTable('alumno_avisos_ocultos', {
        id_alumno_aviso_oculto: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        alumno_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'alumnos_perfil',
            key: 'id_alumno',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        aviso_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'avisos',
            key: 'id_aviso',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('alumno_avisos_ocultos', ['alumno_id']);
      await queryInterface.addIndex('alumno_avisos_ocultos', ['aviso_id']);
      await queryInterface.addConstraint('alumno_avisos_ocultos', {
        fields: ['alumno_id', 'aviso_id'],
        type: 'unique',
        name: 'uk_alumno_aviso_oculto',
      });
    }

    if (!(await columnExists(queryInterface, 'pagos_estatus', 'comprobante_url'))) {
      await queryInterface.addColumn('pagos_estatus', 'comprobante_url', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }

    await queryInterface.changeColumn('pagos_estatus', 'estatus', {
      type: Sequelize.ENUM('pagado', 'pendiente', 'vencido', 'condonado', 'cancelado', 'en_revision'),
      allowNull: false,
      defaultValue: 'pendiente',
    });

    if (!(await columnExists(queryInterface, 'tramites_solicitudes', 'tipo_tramite_id'))) {
      await queryInterface.addColumn('tramites_solicitudes', 'tipo_tramite_id', {
        type: Sequelize.STRING(80),
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'tramites_solicitudes', 'comprobante_pago_url'))) {
      await queryInterface.addColumn('tramites_solicitudes', 'comprobante_pago_url', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'tramites_solicitudes', 'documento_resultado_url'))) {
      await queryInterface.addColumn('tramites_solicitudes', 'documento_resultado_url', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'tramites_solicitudes', 'motivo_rechazo'))) {
      await queryInterface.addColumn('tramites_solicitudes', 'motivo_rechazo', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    await queryInterface.changeColumn('tramites_solicitudes', 'estatus', {
      type: Sequelize.ENUM(...TRAMITE_ESTATUS),
      allowNull: false,
      defaultValue: 'en_revision',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('tramites_solicitudes', 'estatus', {
      type: Sequelize.ENUM(
        'recibido',
        'en_revision',
        'en_proceso',
        'listo_para_entrega',
        'entregado',
        'resuelto',
        'rechazado',
        'cancelado',
      ),
      allowNull: false,
      defaultValue: 'recibido',
    }).catch(() => {});

    await queryInterface.removeColumn('tramites_solicitudes', 'motivo_rechazo').catch(() => {});
    await queryInterface.removeColumn('tramites_solicitudes', 'documento_resultado_url').catch(() => {});
    await queryInterface.removeColumn('tramites_solicitudes', 'comprobante_pago_url').catch(() => {});
    await queryInterface.removeColumn('tramites_solicitudes', 'tipo_tramite_id').catch(() => {});

    await queryInterface.changeColumn('pagos_estatus', 'estatus', {
      type: Sequelize.ENUM('pagado', 'pendiente', 'vencido', 'condonado', 'cancelado'),
      allowNull: false,
      defaultValue: 'pendiente',
    }).catch(() => {});

    await queryInterface.removeColumn('pagos_estatus', 'comprobante_url').catch(() => {});

    await queryInterface.removeConstraint('alumno_avisos_ocultos', 'uk_alumno_aviso_oculto').catch(() => {});
    await queryInterface.removeIndex('alumno_avisos_ocultos', ['aviso_id']).catch(() => {});
    await queryInterface.removeIndex('alumno_avisos_ocultos', ['alumno_id']).catch(() => {});
    await queryInterface.dropTable('alumno_avisos_ocultos').catch(() => {});

    await queryInterface.removeIndex('avisos', ['docente_id']).catch(() => {});
    await queryInterface.removeIndex('avisos', ['grupo_id']).catch(() => {});
    await queryInterface.removeIndex('avisos', ['carrera_id']).catch(() => {});
    await queryInterface.removeIndex('avisos', ['remitente_tipo']).catch(() => {});
    await queryInterface.removeIndex('avisos', ['created_at']).catch(() => {});
    await queryInterface.dropTable('avisos').catch(() => {});
  },
};
