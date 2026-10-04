'use strict';

module.exports = (sequelize, DataTypes) => {
  const PlantillaPlan = sequelize.define(
    'PlantillaPlan',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      nombre_plan: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      carrera: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      cuatrimestre: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'plantillas_planes',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  PlantillaPlan.associate = (models) => {
    PlantillaPlan.hasMany(models.PlantillaDetalle, {
      foreignKey: 'plantilla_id',
      sourceKey: 'id',
      as: 'detalles',
    });

    PlantillaPlan.hasMany(models.CargoAlumno, {
      foreignKey: 'plantilla_id',
      sourceKey: 'id',
      as: 'cargos',
    });
  };

  return PlantillaPlan;
};
