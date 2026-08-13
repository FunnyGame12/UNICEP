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

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'anuncios_docente'))) {
      await queryInterface.createTable('anuncios_docente', {
        id_anuncio: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        id_docente: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'docentes_perfil',
            key: 'id_docente',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        id_materia: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'materias',
            key: 'id_materia',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        titulo: {
          type: Sequelize.STRING(160),
          allowNull: false,
        },
        descripcion: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        fecha_publicacion: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('anuncios_docente', ['id_docente']);
      await queryInterface.addIndex('anuncios_docente', ['id_materia']);
      await queryInterface.addIndex('anuncios_docente', ['fecha_publicacion']);
    }

    if (!(await tableExists(queryInterface, 'salas_video_docente'))) {
      await queryInterface.createTable('salas_video_docente', {
        id_sala: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        id_docente: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'docentes_perfil',
            key: 'id_docente',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        titulo: {
          type: Sequelize.STRING(160),
          allowNull: false,
        },
        plataforma: {
          type: Sequelize.STRING(80),
          allowNull: false,
        },
        enlace: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        fecha_programada: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        fecha_creacion: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('salas_video_docente', ['id_docente']);
      await queryInterface.addIndex('salas_video_docente', ['fecha_programada']);
    }

    if (!(await tableExists(queryInterface, 'asistencias_docente'))) {
      await queryInterface.createTable('asistencias_docente', {
        id_registro: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        id_docente: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'docentes_perfil',
            key: 'id_docente',
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
          onDelete: 'CASCADE',
        },
        id_alumno: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'alumnos_perfil',
            key: 'id_alumno',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        fecha_clase: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        estatus_asistencia: {
          type: Sequelize.ENUM('presente', 'ausente', 'retardo', 'justificado'),
          allowNull: false,
          defaultValue: 'presente',
        },
        aprovechamiento: {
          type: Sequelize.ENUM('alto', 'medio', 'bajo'),
          allowNull: false,
          defaultValue: 'medio',
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

      await queryInterface.addIndex('asistencias_docente', ['id_docente']);
      await queryInterface.addIndex('asistencias_docente', ['id_materia']);
      await queryInterface.addIndex('asistencias_docente', ['id_alumno']);
      await queryInterface.addIndex('asistencias_docente', ['fecha_clase']);
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('asistencias_docente', ['fecha_clase']).catch(() => {});
    await queryInterface.removeIndex('asistencias_docente', ['id_alumno']).catch(() => {});
    await queryInterface.removeIndex('asistencias_docente', ['id_materia']).catch(() => {});
    await queryInterface.removeIndex('asistencias_docente', ['id_docente']).catch(() => {});
    await queryInterface.dropTable('asistencias_docente').catch(() => {});

    await queryInterface.removeIndex('salas_video_docente', ['fecha_programada']).catch(() => {});
    await queryInterface.removeIndex('salas_video_docente', ['id_docente']).catch(() => {});
    await queryInterface.dropTable('salas_video_docente').catch(() => {});

    await queryInterface.removeIndex('anuncios_docente', ['fecha_publicacion']).catch(() => {});
    await queryInterface.removeIndex('anuncios_docente', ['id_materia']).catch(() => {});
    await queryInterface.removeIndex('anuncios_docente', ['id_docente']).catch(() => {});
    await queryInterface.dropTable('anuncios_docente').catch(() => {});
  },
};
