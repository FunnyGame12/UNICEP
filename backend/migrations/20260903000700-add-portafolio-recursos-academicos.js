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
    if (!(await tableExists(queryInterface, 'recursos_academicos'))) {
      await queryInterface.createTable('recursos_academicos', {
        id_recurso: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        titulo: {
          type: Sequelize.STRING(180),
          allowNull: false,
        },
        tipo_recurso: {
          type: Sequelize.ENUM('archivo_local', 'enlace_drive'),
          allowNull: false,
        },
        url_recurso: {
          type: Sequelize.STRING(500),
          allowNull: false,
        },
        remitente_tipo: {
          type: Sequelize.ENUM('coordinacion', 'docente'),
          allowNull: false,
        },
        remitente_nombre: {
          type: Sequelize.STRING(150),
          allowNull: false,
        },
        id_docente: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'usuarios',
            key: 'id_usuario',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
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
        carrera_id: {
          type: Sequelize.STRING(120),
          allowNull: true,
        },
        grupo_id: {
          type: Sequelize.STRING(20),
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
      });

      await queryInterface.addIndex('recursos_academicos', ['id_materia']);
      await queryInterface.addIndex('recursos_academicos', ['id_docente']);
      await queryInterface.addIndex('recursos_academicos', ['carrera_id']);
      await queryInterface.addIndex('recursos_academicos', ['grupo_id']);
      await queryInterface.addIndex('recursos_academicos', ['remitente_tipo']);
    }

    if (!(await tableExists(queryInterface, 'portafolio_materia_evidencias'))) {
      await queryInterface.createTable('portafolio_materia_evidencias', {
        id_evidencia_materia: {
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
        materia_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'materias',
            key: 'id_materia',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        cuatrimestre_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        drive_url: {
          type: Sequelize.STRING(500),
          allowNull: true,
        },
        estado: {
          type: Sequelize.ENUM('pendiente', 'entregado', 'validado'),
          allowNull: false,
          defaultValue: 'pendiente',
        },
        fecha_actualizacion: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('portafolio_materia_evidencias', ['alumno_id']);
      await queryInterface.addIndex('portafolio_materia_evidencias', ['materia_id']);
      await queryInterface.addConstraint('portafolio_materia_evidencias', {
        fields: ['alumno_id', 'materia_id'],
        type: 'unique',
        name: 'uk_alumno_materia_evidencia',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('portafolio_materia_evidencias', 'uk_alumno_materia_evidencia').catch(() => {});
    await queryInterface.removeIndex('portafolio_materia_evidencias', ['materia_id']).catch(() => {});
    await queryInterface.removeIndex('portafolio_materia_evidencias', ['alumno_id']).catch(() => {});
    await queryInterface.dropTable('portafolio_materia_evidencias').catch(() => {});

    await queryInterface.removeIndex('recursos_academicos', ['remitente_tipo']).catch(() => {});
    await queryInterface.removeIndex('recursos_academicos', ['grupo_id']).catch(() => {});
    await queryInterface.removeIndex('recursos_academicos', ['carrera_id']).catch(() => {});
    await queryInterface.removeIndex('recursos_academicos', ['id_docente']).catch(() => {});
    await queryInterface.removeIndex('recursos_academicos', ['id_materia']).catch(() => {});
    await queryInterface.dropTable('recursos_academicos').catch(() => {});
  },
};
