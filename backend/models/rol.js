'use strict';

module.exports = (sequelize, DataTypes) => {
  const Rol = sequelize.define(
    'Rol',
    {
      id_rol: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      nombre: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      nombre_tecnico: {
        type: DataTypes.STRING(80),
        allowNull: false,
        unique: true,
      },
      descripcion: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      nivel_jerarquia: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      activo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'roles',
      timestamps: false,
    },
  );

  Rol.associate = (models) => {
    Rol.hasMany(models.Subrol, {
      foreignKey: 'id_rol',
      sourceKey: 'id_rol',
      as: 'subroles',
    });

    Rol.hasMany(models.Usuario, {
      foreignKey: 'id_rol',
      sourceKey: 'id_rol',
      as: 'usuarios',
    });

    Rol.hasMany(models.RolPermiso, {
      foreignKey: 'id_rol',
      sourceKey: 'id_rol',
      as: 'permisos_asignados',
    });
  };

  return Rol;
};