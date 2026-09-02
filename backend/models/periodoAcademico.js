'use strict';

module.exports = (sequelize, DataTypes) => {
  const PeriodoAcademico = sequelize.define(
    'PeriodoAcademico',
    {
      id_periodo: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      nombre: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      ciclo: {
        type: DataTypes.STRING(60),
        allowNull: false,
      },
      bimestre: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      fecha_inicio: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      fecha_fin: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      fecha_limite_calificaciones: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      estatus: {
        type: DataTypes.ENUM('planeado', 'activo', 'cerrado'),
        allowNull: false,
        defaultValue: 'planeado',
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'periodos_academicos',
      timestamps: false,
    },
  );

  return PeriodoAcademico;
};
