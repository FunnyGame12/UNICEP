'use strict';

module.exports = (sequelize, DataTypes) => {
  const PagoEstatus = sequelize.define(
    'PagoEstatus',
    {
      id_pago: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_alumno: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      id_concepto_pago: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      concepto: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      monto: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      fecha_limite: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      estatus: {
        type: DataTypes.ENUM('pagado', 'pendiente', 'vencido', 'condonado', 'cancelado', 'en_revision'),
        allowNull: false,
      },
      fecha_pago: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      folio_interno: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      observaciones: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      comprobante_url: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: 'pagos_estatus',
      timestamps: false,
    },
  );

  PagoEstatus.associate = (models) => {
    PagoEstatus.belongsTo(models.AlumnoPerfil, {
      foreignKey: 'id_alumno',
      targetKey: 'id_alumno',
      as: 'alumno',
    });

    PagoEstatus.belongsTo(models.ConceptoPago, {
      foreignKey: 'id_concepto_pago',
      targetKey: 'id_concepto_pago',
      as: 'concepto_pago',
    });
  };

  return PagoEstatus;
};
