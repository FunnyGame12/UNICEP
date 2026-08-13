'use strict';

module.exports = (sequelize, DataTypes) => {
  const RolPermiso = sequelize.define(
    'RolPermiso',
    {
      id_rol_permiso: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_rol: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      id_permiso: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      permitido: {
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
      tableName: 'roles_permisos',
      timestamps: false,
    },
  );

  RolPermiso.associate = (models) => {
    RolPermiso.belongsTo(models.Rol, {
      foreignKey: 'id_rol',
      targetKey: 'id_rol',
      as: 'rol',
    });

    RolPermiso.belongsTo(models.Permiso, {
      foreignKey: 'id_permiso',
      targetKey: 'id_permiso',
      as: 'permiso',
    });
  };

  return RolPermiso;
};