'use strict';

module.exports = (sequelize, DataTypes) => {
  const Materia = sequelize.define(
    'Materia',
    {
      id_materia: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      nombre_materia: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      codigo_materia: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      programa_academico_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      periodo_numero: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      creditos: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      horas_semanales: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      carrera: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      activa: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      bimestre_pertenece: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      tableName: 'materias',
      timestamps: false,
    },
  );

  Materia.associate = (models) => {
    Materia.belongsTo(models.ProgramaAcademico, {
      foreignKey: 'programa_academico_id',
      targetKey: 'id',
      as: 'programa_academico',
    });

    Materia.hasMany(models.AsignacionGrupo, {
      foreignKey: 'id_materia',
      sourceKey: 'id_materia',
      as: 'asignaciones',
    });

    Materia.hasMany(models.Tarea, {
      foreignKey: 'id_materia',
      sourceKey: 'id_materia',
      as: 'tareas',
    });

    Materia.hasMany(models.PortafolioEvidencia, {
      foreignKey: 'id_materia',
      sourceKey: 'id_materia',
      as: 'evidencias',
    });

    Materia.hasMany(models.MaterialClase, {
      foreignKey: 'id_materia',
      sourceKey: 'id_materia',
      as: 'materiales',
    });

    Materia.hasMany(models.AlumnoGrupo, {
      foreignKey: 'id_materia',
      sourceKey: 'id_materia',
      as: 'alumnos_grupo',
    });
  };

  return Materia;
};
