'use strict';

module.exports = (sequelize, DataTypes) => {
  const ReglaDesbloqueo = sequelize.define(
    'ReglaDesbloqueo',
    {
      id_regla: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      nombre: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      servicio: {
        type: DataTypes.ENUM('mensualidad', 'inscripcion', 'acceso_clases', 'acceso_calificaciones', 'acceso_material'),
        allowNull: false,
      },
      tipo_condicion: {
        type: DataTypes.ENUM('sin_adeudo_vencido', 'concepto_pagado'),
        allowNull: false,
      },
      id_concepto_pago: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      concepto_requerido: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      carrera_objetivo: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      prioridad: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
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
      tableName: 'reglas_desbloqueo',
      timestamps: false,
    },
  );

  ReglaDesbloqueo.associate = (models) => {
    ReglaDesbloqueo.belongsTo(models.ConceptoPago, {
      foreignKey: 'id_concepto_pago',
      targetKey: 'id_concepto_pago',
      as: 'concepto_pago',
    });
  };

  return ReglaDesbloqueo;
};
