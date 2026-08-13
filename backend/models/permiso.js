'use strict';

module.exports = (sequelize, DataTypes) => {
  const Permiso = sequelize.define(
    'Permiso',
    {
      id_permiso: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      codigo: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true,
      },
      modulo: {
        type: DataTypes.STRING(60),
        allowNull: false,
      },
      accion: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      scope: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'any',
      },
      descripcion: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'permisos',
      timestamps: false,
    },
  );

  Permiso.associate = (models) => {
    Permiso.hasMany(models.RolPermiso, {
      foreignKey: 'id_permiso',
      sourceKey: 'id_permiso',
      as: 'roles',
    });

    Permiso.hasMany(models.SubrolPermiso, {
      foreignKey: 'id_permiso',
      sourceKey: 'id_permiso',
      as: 'subroles',
    });
  };

  return Permiso;
};