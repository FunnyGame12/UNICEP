'use strict';

module.exports = (sequelize, DataTypes) => {
  const CalificacionParcialDocente = sequelize.define(
    'CalificacionParcialDocente',
    {
      id_calificacion: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_docente: {
        type: DataTypes.INTEGER,
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
      grupo_id: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      parcial_numero: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      calificacion: {
        type: DataTypes.DECIMAL(4, 2),
        allowNull: false,
      },
      retroalimentacion: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      fecha_captura: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'calificaciones_parciales_docente',
      timestamps: false,
    },
  );

  CalificacionParcialDocente.associate = (models) => {
    CalificacionParcialDocente.belongsTo(models.Materia, {
      foreignKey: 'id_materia',
      targetKey: 'id_materia',
      as: 'materia',
    });

    CalificacionParcialDocente.belongsTo(models.AlumnoPerfil, {
      foreignKey: 'id_alumno',
      targetKey: 'id_alumno',
      as: 'alumno',
    });
  };

  return CalificacionParcialDocente;
};