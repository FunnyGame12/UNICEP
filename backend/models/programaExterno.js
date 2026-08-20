'use strict';

module.exports = (sequelize, DataTypes) => {
  const ProgramaExterno = sequelize.define(
    'ProgramaExterno',
    {
      id_programa: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_alumno: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tipo_programa: {
        type: DataTypes.ENUM('servicio_social', 'practicas_profesionales'),
        allowNull: false,
      },
      organizacion: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      estatus: {
        type: DataTypes.ENUM('en_revision', 'horas_cubiertas', 'liberado', 'rechazado', 'registrado', 'en_proceso', 'validado'),
        allowNull: false,
        defaultValue: 'en_revision',
      },
      fecha_inicio: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      fecha_fin: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      evidencia_url: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      observaciones: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      horas_concluidas: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      oficio_liberacion: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'programas_externos',
      timestamps: false,
    },
  );

  ProgramaExterno.associate = (models) => {
    ProgramaExterno.belongsTo(models.AlumnoPerfil, {
      foreignKey: 'id_alumno',
      targetKey: 'id_alumno',
      as: 'alumno',
    });
  };

  return ProgramaExterno;
};
