'use strict';

module.exports = (sequelize, DataTypes) => {
  const ProgramaAcademico = sequelize.define(
    'ProgramaAcademico',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      tipo_nivel: {
        type: DataTypes.ENUM('preparatoria', 'licenciatura', 'ingenieria', 'maestria'),
        allowNull: false,
      },
      nombre: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      modalidad_periodo: {
        type: DataTypes.ENUM('semestral', 'cuatrimestral'),
        allowNull: false,
      },
      total_periodos: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      estatus: {
        type: DataTypes.ENUM('activo', 'inactivo'),
        allowNull: false,
        defaultValue: 'activo',
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'programas_academicos',
      timestamps: false,
    },
  );

  ProgramaAcademico.associate = (models) => {
    ProgramaAcademico.hasMany(models.Materia, {
      foreignKey: 'programa_academico_id',
      sourceKey: 'id',
      as: 'materias_plan',
    });
  };

  return ProgramaAcademico;
};
