'use strict';

module.exports = (sequelize, DataTypes) => {
  const ConceptoPago = sequelize.define(
    'ConceptoPago',
    {
      id_concepto_pago: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      clave: {
        type: DataTypes.STRING(40),
        allowNull: false,
        unique: true,
      },
      nombre: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      descripcion: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      categoria: {
        type: DataTypes.ENUM('mensualidad', 'inscripcion', 'recargo', 'beca', 'tramite', 'otro'),
        allowNull: false,
      },
      periodicidad: {
        type: DataTypes.ENUM('unico', 'mensual', 'bimestral', 'extraordinario'),
        allowNull: false,
        defaultValue: 'unico',
      },
      carrera_objetivo: {
        type: DataTypes.STRING(120),
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
      tableName: 'conceptos_pago',
      timestamps: false,
    },
  );

  ConceptoPago.associate = (models) => {
    ConceptoPago.hasMany(models.PagoEstatus, {
      foreignKey: 'id_concepto_pago',
      sourceKey: 'id_concepto_pago',
      as: 'pagos',
    });

    ConceptoPago.hasMany(models.ReglaDesbloqueo, {
      foreignKey: 'id_concepto_pago',
      sourceKey: 'id_concepto_pago',
      as: 'reglas',
    });
  };

  return ConceptoPago;
};
