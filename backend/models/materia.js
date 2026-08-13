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
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      codigo_materia: {
        type: DataTypes.STRING(20),
        allowNull: false,
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
