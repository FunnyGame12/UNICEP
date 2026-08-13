'use strict';

module.exports = (sequelize, DataTypes) => {
  const PlanEstudio = sequelize.define(
    'PlanEstudio',
    {
      id_plan_estudio: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      nombre: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      carrera: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      version: {
        type: DataTypes.STRING(40),
        allowNull: false,
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
      tableName: 'planes_estudio',
      timestamps: false,
    },
  );

  return PlanEstudio;
};
