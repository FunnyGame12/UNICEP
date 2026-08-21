'use strict';

module.exports = (sequelize, DataTypes) => {
  const Usuario = sequelize.define(
    'Usuario',
    {
      id_usuario: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      folio_matricula: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      nombre_completo: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      correo: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      cuenta_activada: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
      id_rol: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      id_subrol: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      rol: {
        type: DataTypes.ENUM(
          'director',
          'control_escolar',
          'coordinacion_academica',
          'maestro',
          'alumno',
          'soporte_ti',
          'administrativo',
          'docente',
        ),
        allowNull: false,
      },
      foto_url: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'usuarios',
      timestamps: false,
    },
  );

  Usuario.associate = (models) => {
    Usuario.hasOne(models.AlumnoPerfil, {
      foreignKey: 'id_alumno',
      sourceKey: 'id_usuario',
      as: 'perfil_alumno',
    });

    Usuario.hasOne(models.DocentePerfil, {
      foreignKey: 'id_docente',
      sourceKey: 'id_usuario',
      as: 'perfil_docente',
    });

    Usuario.hasMany(models.AuditoriaEvento, {
      foreignKey: 'id_usuario',
      sourceKey: 'id_usuario',
      as: 'eventos_auditoria',
    });

    Usuario.belongsTo(models.Rol, {
      foreignKey: 'id_rol',
      targetKey: 'id_rol',
      as: 'rol_configurado',
    });

    Usuario.belongsTo(models.Subrol, {
      foreignKey: 'id_subrol',
      targetKey: 'id_subrol',
      as: 'subrol_configurado',
    });
  };

  return Usuario;
};
