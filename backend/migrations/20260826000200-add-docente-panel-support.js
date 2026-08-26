'use strict';

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
    if (!(await columnExists(queryInterface, 'tareas', 'puntaje_maximo'))) {
      await queryInterface.addColumn('tareas', 'puntaje_maximo', {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 10,
      });
    }

    if (!(await columnExists(queryInterface, 'tareas', 'grupo_id'))) {
      await queryInterface.addColumn('tareas', 'grupo_id', {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'salas_video_docente', 'id_materia'))) {
      await queryInterface.addColumn('salas_video_docente', 'id_materia', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'materias',
          key: 'id_materia',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    if (!(await columnExists(queryInterface, 'salas_video_docente', 'grupo_id'))) {
      await queryInterface.addColumn('salas_video_docente', 'grupo_id', {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }

    if (!(await tableExists(queryInterface, 'calificaciones_parciales_docente'))) {
      await queryInterface.createTable('calificaciones_parciales_docente', {
        id_calificacion: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        id_docente: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        id_alumno: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        id_materia: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'materias',
            key: 'id_materia',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        grupo_id: {
          type: Sequelize.STRING(20),
          allowNull: false,
        },
        parcial_numero: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        calificacion: {
          type: Sequelize.DECIMAL(4, 2),
          allowNull: false,
        },
        retroalimentacion: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        fecha_captura: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addConstraint('calificaciones_parciales_docente', {
        fields: ['id_alumno', 'id_materia', 'grupo_id', 'parcial_numero'],
        type: 'unique',
        name: 'uq_parcial_por_alumno_materia_grupo',
      });

      await queryInterface.addIndex('calificaciones_parciales_docente', ['id_docente']);
      await queryInterface.addIndex('calificaciones_parciales_docente', ['id_materia', 'grupo_id']);
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('calificaciones_parciales_docente', ['id_materia', 'grupo_id']).catch(() => {});
    await queryInterface.removeIndex('calificaciones_parciales_docente', ['id_docente']).catch(() => {});
    await queryInterface.dropTable('calificaciones_parciales_docente').catch(() => {});

    await queryInterface.removeColumn('salas_video_docente', 'grupo_id').catch(() => {});
    await queryInterface.removeColumn('salas_video_docente', 'id_materia').catch(() => {});

    await queryInterface.removeColumn('tareas', 'grupo_id').catch(() => {});
    await queryInterface.removeColumn('tareas', 'puntaje_maximo').catch(() => {});
  },
};