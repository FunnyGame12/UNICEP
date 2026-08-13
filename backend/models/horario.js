'use strict';

module.exports = (sequelize, DataTypes) => {
  const Horario = sequelize.define(
    'Horario',
    {
      id_horario: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      modalidad: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      periodo: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      turno: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      hora_inicio: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      hora_fin: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      aula: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      descripcion: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'horarios',
      timestamps: false,
    },
  );

  return Horario;
};
