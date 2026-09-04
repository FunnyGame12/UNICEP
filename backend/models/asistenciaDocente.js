'use strict';

module.exports = (sequelize, DataTypes) => {
  const AsistenciaDocente = sequelize.define(
    'AsistenciaDocente',
    {
      id_registro: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_docente: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      id_materia: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      id_alumno: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      fecha_clase: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      estatus_asistencia: {
        type: DataTypes.ENUM('presente', 'ausente', 'retardo', 'justificado'),
        allowNull: false,
      },
      aprovechamiento: {
        type: DataTypes.ENUM('alto', 'medio', 'bajo'),
        allowNull: false,
      },
      observaciones: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'asistencias_docente',
      timestamps: false,
      indexes: [
        {
          name: 'uq_asistencia_docente_alumno_materia_fecha',
          unique: true,
          fields: ['id_alumno', 'id_materia', 'fecha_clase'],
        },
      ],
    },
  );

  AsistenciaDocente.associate = (models) => {
    AsistenciaDocente.belongsTo(models.DocentePerfil, {
      foreignKey: 'id_docente',
      targetKey: 'id_docente',
      as: 'docente',
    });

    AsistenciaDocente.belongsTo(models.Materia, {
      foreignKey: 'id_materia',
      targetKey: 'id_materia',
      as: 'materia',
    });

    AsistenciaDocente.belongsTo(models.AlumnoPerfil, {
      foreignKey: 'id_alumno',
      targetKey: 'id_alumno',
      as: 'alumno',
    });
  };

  return AsistenciaDocente;
};
