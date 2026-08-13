'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('alumno_grupos', {
      id_alumno_grupo: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
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
        onDelete: 'RESTRICT',
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
      grupo: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      fecha_alta: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addConstraint('alumno_grupos', {
      fields: ['id_alumno', 'id_materia'],
      type: 'unique',
      name: 'uq_alumno_grupos_alumno_materia',
    });

    await queryInterface.addIndex('alumno_grupos', ['id_alumno']);
    await queryInterface.addIndex('alumno_grupos', ['id_materia']);

    await queryInterface.createTable('auditoria_eventos', {
      id_evento: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      id_usuario: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'usuarios',
          key: 'id_usuario',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      rol_actor: {
        type: Sequelize.ENUM('alumno', 'docente', 'administrativo'),
        allowNull: false,
      },
      accion: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      modulo: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },
      entidad: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },
      id_entidad: {
        type: Sequelize.STRING(60),
        allowNull: true,
      },
      detalle: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      fecha_evento: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('auditoria_eventos', ['id_usuario']);
    await queryInterface.addIndex('auditoria_eventos', ['modulo']);
    await queryInterface.addIndex('auditoria_eventos', ['fecha_evento']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('auditoria_eventos');
    await queryInterface.dropTable('alumno_grupos');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_auditoria_eventos_rol_actor;').catch(() => {});
  },
};
