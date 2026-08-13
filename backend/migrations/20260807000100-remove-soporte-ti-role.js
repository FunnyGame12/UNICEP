'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `UPDATE usuarios u
       INNER JOIN roles r_soporte ON r_soporte.id_rol = u.id_rol AND r_soporte.nombre_tecnico = 'soporte_ti'
       INNER JOIN roles r_control ON r_control.nombre_tecnico = 'control_escolar'
       SET u.id_rol = r_control.id_rol`,
    );

    await queryInterface.sequelize.query(
      `UPDATE usuarios
       SET rol = 'control_escolar'
       WHERE rol = 'soporte_ti'`,
    );

    await queryInterface.sequelize.query(
      `UPDATE auditoria_eventos
       SET rol_actor = 'control_escolar'
       WHERE rol_actor = 'soporte_ti'`,
    );

    await queryInterface.sequelize.query(
      `DELETE rp
       FROM roles_permisos rp
       INNER JOIN roles r ON r.id_rol = rp.id_rol
       WHERE r.nombre_tecnico = 'soporte_ti'`,
    );

    await queryInterface.sequelize.query(
      `DELETE FROM roles
       WHERE nombre_tecnico = 'soporte_ti'`,
    );

    await queryInterface.changeColumn('usuarios', 'rol', {
      type: Sequelize.ENUM(
        'director',
        'control_escolar',
        'coordinacion_academica',
        'maestro',
        'alumno',
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
        'control_escolar_preparatoria',
        'prefecto_en_linea',
      ),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
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

    const nowLiteral = Sequelize.literal('CURRENT_TIMESTAMP');

    await queryInterface.bulkInsert('roles', [
      {
        nombre: 'Soporte TI',
        nombre_tecnico: 'soporte_ti',
        descripcion: 'Soporte tecnico sin acceso a decisiones academicas/financieras.',
        nivel_jerarquia: 60,
        activo: true,
        fecha_creacion: nowLiteral,
      },
    ]);
  },
};
