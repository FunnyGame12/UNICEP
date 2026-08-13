'use strict';

module.exports = (sequelize, DataTypes) => {
  const ActaCalificacion = sequelize.define(
    'ActaCalificacion',
    {
      id_acta: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_periodo: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      carrera: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      estatus: {
        type: DataTypes.ENUM('borrador', 'validada', 'cerrada'),
        allowNull: false,
        defaultValue: 'borrador',
      },
      total_alumnos: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      total_reprobados: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      observaciones: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      fecha_cierre: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'actas_calificaciones',
      timestamps: false,
    },
  );

  ActaCalificacion.associate = (models) => {
    ActaCalificacion.belongsTo(models.PeriodoAcademico, {
      foreignKey: 'id_periodo',
      targetKey: 'id_periodo',
      as: 'periodo',
    });
  };

  return ActaCalificacion;
};
