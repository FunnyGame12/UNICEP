'use strict';

module.exports = (sequelize, DataTypes) => {
  const CargoAlumno = sequelize.define(
    'CargoAlumno',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      alumno_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      concepto_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      plantilla_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      monto_final: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      fecha_vencimiento: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      estado: {
        type: DataTypes.ENUM('pendiente', 'pagado', 'cancelado'),
        allowNull: false,
        defaultValue: 'pendiente',
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
      tableName: 'cargos_alumno',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  CargoAlumno.associate = (models) => {
    CargoAlumno.belongsTo(models.AlumnoPerfil, {
      foreignKey: 'alumno_id',
      targetKey: 'id_alumno',
      as: 'alumno',
    });

    CargoAlumno.belongsTo(models.ConceptoPago, {
      foreignKey: 'concepto_id',
      targetKey: 'id_concepto_pago',
      as: 'concepto',
    });

    CargoAlumno.belongsTo(models.PlantillaPlan, {
      foreignKey: 'plantilla_id',
      targetKey: 'id',
      as: 'plantilla',
    });
  };

  return CargoAlumno;
};
