'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('usuarios', {
      id_usuario: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      folio_matricula: {
        type: Sequelize.STRING(50),
        unique: true,
        allowNull: false,
      },
      nombre_completo: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      correo: {
        type: Sequelize.STRING(100),
        unique: true,
        allowNull: false,
      },
      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      rol: {
        type: Sequelize.ENUM('alumno', 'docente', 'administrativo'),
        allowNull: false,
      },
      foto_url: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      fecha_creacion: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.createTable('materias', {
      id_materia: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      nombre_materia: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      codigo_materia: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      bimestre_pertenece: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
    });

    await queryInterface.createTable('alumnos_perfil', {
      id_alumno: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
          model: 'usuarios',
          key: 'id_usuario',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      carrera: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      id_plan_estudio: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      bimestre_actual: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
    });

    await queryInterface.createTable('docentes_perfil', {
      id_docente: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
          model: 'usuarios',
          key: 'id_usuario',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      estatus_laboral: {
        type: Sequelize.ENUM('activo', 'inactivo'),
        allowNull: false,
        defaultValue: 'activo',
      },
    });

    await queryInterface.createTable('asignacion_grupos', {
      id_asignacion: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
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
        onDelete: 'RESTRICT',
      },
      id_docente: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'docentes_perfil',
          key: 'id_docente',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      grupo: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
    });

    await queryInterface.createTable('tareas', {
      id_tarea: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
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
        onDelete: 'RESTRICT',
      },
      titulo: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      fecha_limite: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      archivo_adjunto_url: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
    });

    await queryInterface.createTable('entregas_tareas', {
      id_entrega: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      id_tarea: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'tareas',
          key: 'id_tarea',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
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
      archivo_entrega_url: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      fecha_entrega: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      estatus: {
        type: Sequelize.ENUM('pendiente', 'entregada', 'fuera_de_tiempo', 'calificada'),
        allowNull: false,
        defaultValue: 'pendiente',
      },
      calificacion: {
        type: Sequelize.DECIMAL(4, 2),
        allowNull: true,
      },
      retroalimentacion: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
    });

    await queryInterface.createTable('portafolio_evidencias', {
      id_evidencia: {
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
      periodo_bimestre: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      archivo_url: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
    });

    await queryInterface.createTable('materiales_clase', {
      id_material: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
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
        onDelete: 'RESTRICT',
      },
      tema_semana: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      tipo_archivo: {
        type: Sequelize.ENUM('diapositivas', 'libro', 'resumen', 'pdf', 'enlace'),
        allowNull: false,
      },
      archivo_url: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
    });

    await queryInterface.createTable('meritos_academicos', {
      id_merito: {
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
      tipo_merito: {
        type: Sequelize.ENUM('diploma', 'constancia', 'reconocimiento', 'curso_adicional', 'taller'),
        allowNull: false,
      },
      nombre: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      fecha: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      archivo_url: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
    });

    await queryInterface.createTable('pagos_estatus', {
      id_pago: {
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
      concepto: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      monto: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      fecha_limite: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      estatus: {
        type: Sequelize.ENUM('pagado', 'pendiente', 'vencido'),
        allowNull: false,
        defaultValue: 'pendiente',
      },
      fecha_pago: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      folio_interno: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
    });

    await queryInterface.addIndex('tareas', ['id_materia']);
    await queryInterface.addIndex('entregas_tareas', ['id_tarea']);
    await queryInterface.addIndex('entregas_tareas', ['id_alumno']);
    await queryInterface.addIndex('pagos_estatus', ['id_alumno']);
    await queryInterface.addIndex('pagos_estatus', ['estatus']);
    await queryInterface.addIndex('pagos_estatus', ['fecha_limite']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('pagos_estatus');
    await queryInterface.dropTable('meritos_academicos');
    await queryInterface.dropTable('materiales_clase');
    await queryInterface.dropTable('portafolio_evidencias');
    await queryInterface.dropTable('entregas_tareas');
    await queryInterface.dropTable('tareas');
    await queryInterface.dropTable('asignacion_grupos');
    await queryInterface.dropTable('docentes_perfil');
    await queryInterface.dropTable('alumnos_perfil');
    await queryInterface.dropTable('materias');
    await queryInterface.dropTable('usuarios');

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_usuarios_rol;').catch(() => {});
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_docentes_perfil_estatus_laboral;').catch(() => {});
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_entregas_tareas_estatus;').catch(() => {});
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_materiales_clase_tipo_archivo;').catch(() => {});
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_meritos_academicos_tipo_merito;').catch(() => {});
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_pagos_estatus_estatus;').catch(() => {});
  },
};
