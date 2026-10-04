'use strict';

module.exports = (sequelize, DataTypes) => {
  const PlantillaDetalle = sequelize.define(
    'PlantillaDetalle',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      plantilla_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      concepto_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      monto_sugerido: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      dia_vencimiento: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      fecha_exacta: {
        type: DataTypes.DATEONLY,
        allowNull: true,
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
      tableName: 'plantillas_detalles',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  PlantillaDetalle.associate = (models) => {
    PlantillaDetalle.belongsTo(models.PlantillaPlan, {
      foreignKey: 'plantilla_id',
      targetKey: 'id',
      as: 'plantilla',
    });

    PlantillaDetalle.belongsTo(models.ConceptoPago, {
      foreignKey: 'concepto_id',
      targetKey: 'id_concepto_pago',
      as: 'concepto',
    });
  };

  return PlantillaDetalle;
};
