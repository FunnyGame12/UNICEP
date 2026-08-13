'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    await queryInterface.createTable('roles', {
      id_rol: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      nombre: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      nombre_tecnico: {
        type: Sequelize.STRING(80),
        allowNull: false,
        unique: true,
      },
      descripcion: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      nivel_jerarquia: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.createTable('subroles', {
      id_subrol: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      id_rol: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'roles',
          key: 'id_rol',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      nombre: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      nombre_tecnico: {
        type: Sequelize.STRING(80),
        allowNull: false,
        unique: true,
      },
      descripcion: {
        type: Sequelize.STRING(255),
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

    await queryInterface.createTable('permisos', {
      id_permiso: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      codigo: {
        type: Sequelize.STRING(120),
        allowNull: false,
        unique: true,
      },
      modulo: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },
      accion: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      scope: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'any',
      },
      descripcion: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      fecha_creacion: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.createTable('roles_permisos', {
      id_rol_permiso: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      id_rol: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'roles',
          key: 'id_rol',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      id_permiso: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'permisos',
          key: 'id_permiso',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      permitido: {
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

    await queryInterface.addConstraint('roles_permisos', {
      fields: ['id_rol', 'id_permiso'],
      type: 'unique',
      name: 'uq_roles_permisos',
    });

    await queryInterface.createTable('subroles_permisos', {
      id_subrol_permiso: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      id_subrol: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'subroles',
          key: 'id_subrol',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      id_permiso: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'permisos',
          key: 'id_permiso',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      permitido: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
      },
      fecha_creacion: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addConstraint('subroles_permisos', {
      fields: ['id_subrol', 'id_permiso'],
      type: 'unique',
      name: 'uq_subroles_permisos',
    });

    await queryInterface.bulkInsert('roles', [
      { nombre: 'Director', nombre_tecnico: 'director', descripcion: 'Nivel ejecutivo con supervision institucional.', nivel_jerarquia: 100, activo: true, fecha_creacion: now },
      { nombre: 'Control Escolar', nombre_tecnico: 'control_escolar', descripcion: 'Operacion administrativa y tesoreria.', nivel_jerarquia: 80, activo: true, fecha_creacion: now },
      { nombre: 'Coordinacion Academica', nombre_tecnico: 'coordinacion_academica', descripcion: 'Planeacion academica y seguimiento curricular.', nivel_jerarquia: 70, activo: true, fecha_creacion: now },
      { nombre: 'Maestro', nombre_tecnico: 'maestro', descripcion: 'Docencia y evaluacion academica.', nivel_jerarquia: 40, activo: true, fecha_creacion: now },
      { nombre: 'Alumno', nombre_tecnico: 'alumno', descripcion: 'Consulta y ejecucion de actividades academicas personales.', nivel_jerarquia: 10, activo: true, fecha_creacion: now },
      { nombre: 'Soporte TI', nombre_tecnico: 'soporte_ti', descripcion: 'Soporte tecnico sin acceso a decisiones academicas/financieras.', nivel_jerarquia: 60, activo: true, fecha_creacion: now },
    ]);

    const [roles] = await queryInterface.sequelize.query('SELECT id_rol, nombre_tecnico FROM roles');
    const roleByCode = new Map(roles.map((item) => [item.nombre_tecnico, item.id_rol]));

    await queryInterface.bulkInsert('subroles', [
      {
        id_rol: roleByCode.get('control_escolar'),
        nombre: 'Control Escolar Preparatoria',
        nombre_tecnico: 'control_escolar_preparatoria',
        descripcion: 'Subrol operativo para prepa dentro de control escolar.',
        activo: true,
        fecha_creacion: now,
      },
      {
        id_rol: roleByCode.get('control_escolar'),
        nombre: 'Prefecto en Linea',
        nombre_tecnico: 'prefecto_en_linea',
        descripcion: 'Subrol operativo para seguimiento y disciplina en linea.',
        activo: true,
        fecha_creacion: now,
      },
    ]);

    await queryInterface.addColumn('usuarios', 'id_rol', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addColumn('usuarios', 'id_subrol', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.sequelize.query(
      `UPDATE usuarios
       SET rol = CASE
         WHEN rol = 'docente' THEN 'maestro'
         WHEN rol = 'administrativo' THEN 'control_escolar'
         ELSE rol
       END`,
    );

    await queryInterface.sequelize.query(
      `UPDATE auditoria_eventos
       SET rol_actor = CASE
         WHEN rol_actor = 'docente' THEN 'maestro'
         WHEN rol_actor = 'administrativo' THEN 'control_escolar'
         ELSE rol_actor
       END`,
    );

    await queryInterface.changeColumn('usuarios', 'rol', {
      type: Sequelize.ENUM(
        'director',
        'control_escolar',
        'coordinacion_academica',
        'maestro',
        'alumno',
        'soporte_ti',
      ),
      allowNull: false,
    });

    await queryInterface.changeColumn('auditoria_eventos', 'rol_actor', {
      type: Sequelize.ENUM(
        'director',
        'control_escolar',
        'coordinacion_academica',
        'maestro',
        'alumno',
        'soporte_ti',
        'control_escolar_preparatoria',
        'prefecto_en_linea',
      ),
      allowNull: false,
    });

    await queryInterface.sequelize.query(
      `UPDATE usuarios u
       JOIN roles r ON r.nombre_tecnico = u.rol
       SET u.id_rol = r.id_rol`,
    );

    await queryInterface.changeColumn('usuarios', 'id_rol', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'roles',
        key: 'id_rol',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });

    await queryInterface.changeColumn('usuarios', 'id_subrol', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'subroles',
        key: 'id_subrol',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('usuarios', ['id_rol']);
    await queryInterface.addIndex('usuarios', ['id_subrol']);
    await queryInterface.addIndex('roles_permisos', ['id_rol']);
    await queryInterface.addIndex('roles_permisos', ['id_permiso']);
    await queryInterface.addIndex('subroles_permisos', ['id_subrol']);
    await queryInterface.addIndex('subroles_permisos', ['id_permiso']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('subroles_permisos', ['id_permiso']);
    await queryInterface.removeIndex('subroles_permisos', ['id_subrol']);
    await queryInterface.removeIndex('roles_permisos', ['id_permiso']);
    await queryInterface.removeIndex('roles_permisos', ['id_rol']);
    await queryInterface.removeIndex('usuarios', ['id_subrol']);
    await queryInterface.removeIndex('usuarios', ['id_rol']);

    await queryInterface.sequelize.query(
      `UPDATE auditoria_eventos
       SET rol_actor = CASE
         WHEN rol_actor IN ('director', 'control_escolar', 'coordinacion_academica', 'soporte_ti') THEN 'administrativo'
         WHEN rol_actor = 'maestro' THEN 'docente'
         ELSE 'alumno'
       END`,
    );

    await queryInterface.changeColumn('auditoria_eventos', 'rol_actor', {
      type: Sequelize.ENUM('alumno', 'docente', 'administrativo'),
      allowNull: false,
    });

    await queryInterface.sequelize.query(
      `UPDATE usuarios
       SET rol = CASE
         WHEN rol = 'maestro' THEN 'docente'
         WHEN rol IN ('director', 'control_escolar', 'coordinacion_academica', 'soporte_ti') THEN 'administrativo'
         ELSE 'alumno'
       END`,
    );

    await queryInterface.changeColumn('usuarios', 'rol', {
      type: Sequelize.ENUM('alumno', 'docente', 'administrativo'),
      allowNull: false,
    });

    await queryInterface.removeColumn('usuarios', 'id_subrol');
    await queryInterface.removeColumn('usuarios', 'id_rol');

    await queryInterface.dropTable('subroles_permisos');
    await queryInterface.dropTable('roles_permisos');
    await queryInterface.dropTable('permisos');
    await queryInterface.dropTable('subroles');
    await queryInterface.dropTable('roles');
  },
};
