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
      clasificacion: {
        type: DataTypes.ENUM('base', 'subrama'),
        allowNull: false,
        defaultValue: 'base',
      },
      precio_base_inicial: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      id_concepto_padre: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      naturaleza_ajuste: {
        type: DataTypes.ENUM('descuento', 'penalizacion'),
        allowNull: true,
      },
      modo_aplicacion: {
        type: DataTypes.ENUM('monto_fijo', 'porcentaje'),
        allowNull: true,
      },
      valor_ajuste: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      folio_interno: {
        type: DataTypes.STRING(80),
        allowNull: false,
        unique: true,
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

    ConceptoPago.belongsTo(models.ConceptoPago, {
      foreignKey: 'id_concepto_padre',
      targetKey: 'id_concepto_pago',
      as: 'concepto_padre',
    });

    ConceptoPago.hasMany(models.ConceptoPago, {
      foreignKey: 'id_concepto_padre',
      sourceKey: 'id_concepto_pago',
      as: 'subramas',
    });
  };

  return ConceptoPago;
};
