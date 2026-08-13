'use strict';

module.exports = (sequelize, DataTypes) => {
  const SubrolPermiso = sequelize.define(
    'SubrolPermiso',
    {
      id_subrol_permiso: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_subrol: {
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
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'subroles_permisos',
      timestamps: false,
    },
  );

  SubrolPermiso.associate = (models) => {
    SubrolPermiso.belongsTo(models.Subrol, {
      foreignKey: 'id_subrol',
      targetKey: 'id_subrol',
      as: 'subrol',
    });

    SubrolPermiso.belongsTo(models.Permiso, {
      foreignKey: 'id_permiso',
      targetKey: 'id_permiso',
      as: 'permiso',
    });
  };

  return SubrolPermiso;
};