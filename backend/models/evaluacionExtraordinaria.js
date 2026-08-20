'use strict';

module.exports = (sequelize, DataTypes) => {
  const EvaluacionExtraordinaria = sequelize.define(
    'EvaluacionExtraordinaria',
    {
      id_evaluacion: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_alumno: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      id_materia: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      id_periodo: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      id_docente_sinodal: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      tipo: {
        type: DataTypes.ENUM('extraordinario', 'recursamiento'),
        allowNull: false,
      },
      estatus: {
        type: DataTypes.ENUM('programado', 'en_proceso', 'acreditado', 'no_acreditado'),
        allowNull: false,
        defaultValue: 'programado',
      },
      fecha_programada: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      calificacion_final: {
        type: DataTypes.DECIMAL(4, 2),
        allowNull: true,
      },
      observaciones: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      costo_folio_ref: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'evaluaciones_extraordinarias',
      timestamps: false,
    },
  );

  EvaluacionExtraordinaria.associate = (models) => {
    EvaluacionExtraordinaria.belongsTo(models.AlumnoPerfil, {
      foreignKey: 'id_alumno',
      targetKey: 'id_alumno',
      as: 'alumno',
    });

    EvaluacionExtraordinaria.belongsTo(models.Materia, {
      foreignKey: 'id_materia',
      targetKey: 'id_materia',
      as: 'materia',
    });

    EvaluacionExtraordinaria.belongsTo(models.PeriodoAcademico, {
      foreignKey: 'id_periodo',
      targetKey: 'id_periodo',
      as: 'periodo',
    });

    EvaluacionExtraordinaria.belongsTo(models.DocentePerfil, {
      foreignKey: 'id_docente_sinodal',
      targetKey: 'id_docente',
      as: 'sinodal',
    });
  };

  return EvaluacionExtraordinaria;
};
