'use strict';

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
    if (!(await tableExists(queryInterface, 'actas_calificaciones'))) {
      await queryInterface.createTable('actas_calificaciones', {
        id_acta: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        id_periodo: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'periodos_academicos',
            key: 'id_periodo',
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        carrera: {
          type: Sequelize.STRING(120),
          allowNull: false,
        },
        estatus: {
          type: Sequelize.ENUM('borrador', 'validada', 'cerrada'),
          allowNull: false,
          defaultValue: 'borrador',
        },
        total_alumnos: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        total_reprobados: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        observaciones: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        fecha_creacion: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        fecha_cierre: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      });
      await queryInterface.addIndex('actas_calificaciones', ['id_periodo']);
      await queryInterface.addIndex('actas_calificaciones', ['carrera']);
      await queryInterface.addIndex('actas_calificaciones', ['estatus']);
    }

    if (!(await tableExists(queryInterface, 'evaluaciones_extraordinarias'))) {
      await queryInterface.createTable('evaluaciones_extraordinarias', {
        id_evaluacion: {
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
        id_materia: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'materias',
            key: 'id_materia',
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        id_periodo: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'periodos_academicos',
            key: 'id_periodo',
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        tipo: {
          type: Sequelize.ENUM('extraordinario', 'recursamiento'),
          allowNull: false,
        },
        estatus: {
          type: Sequelize.ENUM('programado', 'en_proceso', 'acreditado', 'no_acreditado'),
          allowNull: false,
          defaultValue: 'programado',
        },
        fecha_programada: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        calificacion_final: {
          type: Sequelize.DECIMAL(4, 2),
          allowNull: true,
        },
        observaciones: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        fecha_creacion: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
      await queryInterface.addIndex('evaluaciones_extraordinarias', ['id_alumno']);
      await queryInterface.addIndex('evaluaciones_extraordinarias', ['id_materia']);
      await queryInterface.addIndex('evaluaciones_extraordinarias', ['id_periodo']);
      await queryInterface.addIndex('evaluaciones_extraordinarias', ['tipo']);
      await queryInterface.addIndex('evaluaciones_extraordinarias', ['estatus']);
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('evaluaciones_extraordinarias', ['estatus']).catch(() => {});
    await queryInterface.removeIndex('evaluaciones_extraordinarias', ['tipo']).catch(() => {});
    await queryInterface.removeIndex('evaluaciones_extraordinarias', ['id_periodo']).catch(() => {});
    await queryInterface.removeIndex('evaluaciones_extraordinarias', ['id_materia']).catch(() => {});
    await queryInterface.removeIndex('evaluaciones_extraordinarias', ['id_alumno']).catch(() => {});
    await queryInterface.dropTable('evaluaciones_extraordinarias').catch(() => {});

    await queryInterface.removeIndex('actas_calificaciones', ['estatus']).catch(() => {});
    await queryInterface.removeIndex('actas_calificaciones', ['carrera']).catch(() => {});
    await queryInterface.removeIndex('actas_calificaciones', ['id_periodo']).catch(() => {});
    await queryInterface.dropTable('actas_calificaciones').catch(() => {});
  },
};
