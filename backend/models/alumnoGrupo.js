'use strict';

module.exports = (sequelize, DataTypes) => {
  const AlumnoGrupo = sequelize.define(
    'AlumnoGrupo',
    {
      id_alumno_grupo: {
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
      grupo: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      fecha_alta: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'alumno_grupos',
      timestamps: false,
    },
  );

  AlumnoGrupo.associate = (models) => {
    AlumnoGrupo.belongsTo(models.AlumnoPerfil, {
      foreignKey: 'id_alumno',
      targetKey: 'id_alumno',
      as: 'alumno',
    });

    AlumnoGrupo.belongsTo(models.Materia, {
      foreignKey: 'id_materia',
      targetKey: 'id_materia',
      as: 'materia',
    });
  };

  return AlumnoGrupo;
};
