'use strict';

module.exports = (sequelize, DataTypes) => {
  const Subrol = sequelize.define(
    'Subrol',
    {
      id_subrol: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_rol: {
        type: DataTypes.INTEGER,
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
      tableName: 'subroles',
      timestamps: false,
    },
  );

  Subrol.associate = (models) => {
    Subrol.belongsTo(models.Rol, {
      foreignKey: 'id_rol',
      targetKey: 'id_rol',
      as: 'rol_base',
    });

    Subrol.hasMany(models.Usuario, {
      foreignKey: 'id_subrol',
      sourceKey: 'id_subrol',
      as: 'usuarios',
    });

    Subrol.hasMany(models.SubrolPermiso, {
      foreignKey: 'id_subrol',
      sourceKey: 'id_subrol',
      as: 'permisos_overrides',
    });
  };

  return Subrol;
};