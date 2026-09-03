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
    if (!(await columnExists(queryInterface, 'alumnos_perfil', 'drive_folder_url'))) {
      await queryInterface.addColumn('alumnos_perfil', 'drive_folder_url', {
        type: Sequelize.STRING(500),
        allowNull: true,
      });
    }

    await queryInterface.changeColumn('portafolio_evidencias', 'id_materia', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.changeColumn('portafolio_evidencias', 'periodo_bimestre', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    if (!(await columnExists(queryInterface, 'portafolio_evidencias', 'nombre_archivo'))) {
      await queryInterface.addColumn('portafolio_evidencias', 'nombre_archivo', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'portafolio_evidencias', 'origen'))) {
      await queryInterface.addColumn('portafolio_evidencias', 'origen', {
        type: Sequelize.ENUM('docente', 'control_escolar'),
        allowNull: false,
        defaultValue: 'docente',
      });
    }

    if (!(await columnExists(queryInterface, 'portafolio_evidencias', 'id_subido_por'))) {
      await queryInterface.addColumn('portafolio_evidencias', 'id_subido_por', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'portafolio_evidencias', 'fecha_creacion'))) {
      await queryInterface.addColumn('portafolio_evidencias', 'fecha_creacion', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
    }

    if (!(await tableExists(queryInterface, 'notificaciones_alumno'))) {
      await queryInterface.createTable('notificaciones_alumno', {
        id_notificacion: {
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
          type: Sequelize.STRING(60),
          allowNull: false,
        },
        titulo: {
          type: Sequelize.STRING(160),
          allowNull: false,
        },
        detalle: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        fecha: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        leida: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
      });

      await queryInterface.addIndex('notificaciones_alumno', ['id_alumno']);
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('notificaciones_alumno', ['id_alumno']).catch(() => {});
    await queryInterface.dropTable('notificaciones_alumno').catch(() => {});

    await queryInterface.removeColumn('portafolio_evidencias', 'fecha_creacion').catch(() => {});
    await queryInterface.removeColumn('portafolio_evidencias', 'id_subido_por').catch(() => {});
    await queryInterface.removeColumn('portafolio_evidencias', 'origen').catch(() => {});
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_portafolio_evidencias_origen;').catch(() => {});
    await queryInterface.removeColumn('portafolio_evidencias', 'nombre_archivo').catch(() => {});

    await queryInterface.removeColumn('alumnos_perfil', 'drive_folder_url').catch(() => {});
  },
};
