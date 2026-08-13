'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('conceptos_pago', {
      id_concepto_pago: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      clave: {
        type: Sequelize.STRING(40),
        allowNull: false,
        unique: true,
      },
      nombre: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      categoria: {
        type: Sequelize.ENUM('mensualidad', 'inscripcion', 'recargo', 'beca', 'tramite', 'otro'),
        allowNull: false,
      },
      periodicidad: {
        type: Sequelize.ENUM('unico', 'mensual', 'bimestral', 'extraordinario'),
        allowNull: false,
        defaultValue: 'unico',
      },
      carrera_objetivo: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      activo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      fecha_creacion: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addColumn('pagos_estatus', 'id_concepto_pago', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'conceptos_pago',
        key: 'id_concepto_pago',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('pagos_estatus', 'observaciones', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.createTable('reglas_desbloqueo', {
      id_regla: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      nombre: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      servicio: {
        type: Sequelize.ENUM('mensualidad', 'inscripcion', 'acceso_clases', 'acceso_calificaciones', 'acceso_material'),
        allowNull: false,
      },
      tipo_condicion: {
        type: Sequelize.ENUM('sin_adeudo_vencido', 'concepto_pagado'),
        allowNull: false,
      },
      id_concepto_pago: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'conceptos_pago',
          key: 'id_concepto_pago',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      concepto_requerido: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      carrera_objetivo: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      prioridad: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      activo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      fecha_creacion: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.createTable('desbloqueos_manuales', {
      id_desbloqueo: {
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
      servicio: {
        type: Sequelize.ENUM('mensualidad', 'inscripcion', 'acceso_clases', 'acceso_calificaciones', 'acceso_material'),
        allowNull: false,
      },
      motivo: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      autorizado_por: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'usuarios',
          key: 'id_usuario',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      fecha_inicio: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      fecha_fin: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      activo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    });

    await queryInterface.createTable('periodos_academicos', {
      id_periodo: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      nombre: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      ciclo: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },
      bimestre: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      fecha_inicio: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      fecha_fin: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      estatus: {
        type: Sequelize.ENUM('planeado', 'activo', 'cerrado'),
        allowNull: false,
        defaultValue: 'planeado',
      },
      fecha_creacion: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.createTable('planes_estudio', {
      id_plan_estudio: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      nombre: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      carrera: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      version: {
        type: Sequelize.STRING(40),
        allowNull: false,
      },
      activo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      fecha_creacion: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addColumn('materias', 'carrera', {
      type: Sequelize.STRING(120),
      allowNull: true,
    });

    await queryInterface.addColumn('materias', 'activa', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await queryInterface.addColumn('entregas_tareas', 'validada_control_escolar', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('entregas_tareas', 'fecha_validacion', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('entregas_tareas', 'id_validado_por', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'usuarios',
        key: 'id_usuario',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('conceptos_pago', ['categoria']);
    await queryInterface.addIndex('conceptos_pago', ['activo']);
    await queryInterface.addIndex('pagos_estatus', ['id_concepto_pago']);
    await queryInterface.addIndex('reglas_desbloqueo', ['servicio']);
    await queryInterface.addIndex('desbloqueos_manuales', ['id_alumno', 'servicio']);
    await queryInterface.addIndex('periodos_academicos', ['estatus']);
    await queryInterface.addIndex('materias', ['activa']);
    await queryInterface.addIndex('entregas_tareas', ['validada_control_escolar']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('entregas_tareas', ['validada_control_escolar']).catch(() => {});
    await queryInterface.removeIndex('materias', ['activa']).catch(() => {});
    await queryInterface.removeIndex('periodos_academicos', ['estatus']).catch(() => {});
    await queryInterface.removeIndex('desbloqueos_manuales', ['id_alumno', 'servicio']).catch(() => {});
    await queryInterface.removeIndex('reglas_desbloqueo', ['servicio']).catch(() => {});
    await queryInterface.removeIndex('pagos_estatus', ['id_concepto_pago']).catch(() => {});
    await queryInterface.removeIndex('conceptos_pago', ['activo']).catch(() => {});
    await queryInterface.removeIndex('conceptos_pago', ['categoria']).catch(() => {});

    await queryInterface.removeColumn('entregas_tareas', 'id_validado_por');
    await queryInterface.removeColumn('entregas_tareas', 'fecha_validacion');
    await queryInterface.removeColumn('entregas_tareas', 'validada_control_escolar');
    await queryInterface.removeColumn('materias', 'activa');
    await queryInterface.removeColumn('materias', 'carrera');
    await queryInterface.dropTable('planes_estudio');
    await queryInterface.dropTable('periodos_academicos');
    await queryInterface.dropTable('desbloqueos_manuales');
    await queryInterface.dropTable('reglas_desbloqueo');
    await queryInterface.removeColumn('pagos_estatus', 'observaciones');
    await queryInterface.removeColumn('pagos_estatus', 'id_concepto_pago');
    await queryInterface.dropTable('conceptos_pago');

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_conceptos_pago_categoria;').catch(() => {});
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_conceptos_pago_periodicidad;').catch(() => {});
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_reglas_desbloqueo_servicio;').catch(() => {});
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_reglas_desbloqueo_tipo_condicion;').catch(() => {});
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_desbloqueos_manuales_servicio;').catch(() => {});
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_periodos_academicos_estatus;').catch(() => {});
  },
};
