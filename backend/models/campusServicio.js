'use strict';

module.exports = (sequelize, DataTypes) => {
  const CampusServicio = sequelize.define(
    'CampusServicio',
    {
      id_servicio: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      titulo: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      descripcion: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      icono: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
    },
    {
      tableName: 'campus_servicios',
      timestamps: false,
    },
  );

  return CampusServicio;
};
