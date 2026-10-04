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
    if (!(await tableExists(queryInterface, 'plantillas_planes'))) {
      await queryInterface.createTable('plantillas_planes', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        nombre_plan: {
          type: Sequelize.STRING(150),
          allowNull: false,
        },
        carrera: {
          type: Sequelize.STRING(120),
          allowNull: false,
        },
        cuatrimestre: {
          type: Sequelize.INTEGER,
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
      await queryInterface.addIndex('plantillas_planes', ['carrera', 'cuatrimestre'], {
        name: 'idx_plantillas_planes_carrera_cuatrimestre',
      });
    }

    if (!(await tableExists(queryInterface, 'plantillas_detalles'))) {
      await queryInterface.createTable('plantillas_detalles', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        plantilla_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'plantillas_planes',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        concepto_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'conceptos_pago',
            key: 'id_concepto_pago',
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        monto_sugerido: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
        },
        dia_vencimiento: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        fecha_exacta: {
          type: Sequelize.DATEONLY,
          allowNull: true,
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
      await queryInterface.addIndex('plantillas_detalles', ['plantilla_id'], {
        name: 'idx_plantillas_detalles_plantilla',
      });
    }

    if (!(await tableExists(queryInterface, 'cargos_alumno'))) {
      await queryInterface.createTable('cargos_alumno', {
        id: {
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
        concepto_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'conceptos_pago',
            key: 'id_concepto_pago',
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        plantilla_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'plantillas_planes',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        monto_final: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
        },
        fecha_vencimiento: {
          type: Sequelize.DATEONLY,
          allowNull: false,
        },
        estado: {
          type: Sequelize.ENUM('pendiente', 'pagado', 'cancelado'),
          allowNull: false,
          defaultValue: 'pendiente',
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
      await queryInterface.addIndex('cargos_alumno', ['alumno_id', 'estado'], {
        name: 'idx_cargos_alumno_alumno_estado',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('cargos_alumno').catch(() => {});
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_cargos_alumno_estado;').catch(() => {});
    await queryInterface.dropTable('plantillas_detalles').catch(() => {});
    await queryInterface.dropTable('plantillas_planes').catch(() => {});
  },
};
