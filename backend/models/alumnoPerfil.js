'use strict';

module.exports = (sequelize, DataTypes) => {
  const AlumnoPerfil = sequelize.define(
    'AlumnoPerfil',
    {
      id_alumno: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
      },
      carrera: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      id_plan_estudio: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      bimestre_actual: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      tableName: 'alumnos_perfil',
      timestamps: false,
    },
  );

  AlumnoPerfil.associate = (models) => {
    AlumnoPerfil.belongsTo(models.Usuario, {
      foreignKey: 'id_alumno',
      targetKey: 'id_usuario',
      as: 'usuario',
    });

    AlumnoPerfil.hasMany(models.EntregaTarea, {
      foreignKey: 'id_alumno',
      sourceKey: 'id_alumno',
      as: 'entregas',
    });

    AlumnoPerfil.hasMany(models.PortafolioEvidencia, {
      foreignKey: 'id_alumno',
      sourceKey: 'id_alumno',
      as: 'evidencias',
    });

    AlumnoPerfil.hasMany(models.MeritoAcademico, {
      foreignKey: 'id_alumno',
      sourceKey: 'id_alumno',
      as: 'meritos',
    });

    AlumnoPerfil.hasMany(models.PagoEstatus, {
      foreignKey: 'id_alumno',
      sourceKey: 'id_alumno',
      as: 'pagos',
    });

    AlumnoPerfil.hasMany(models.AlumnoGrupo, {
      foreignKey: 'id_alumno',
      sourceKey: 'id_alumno',
      as: 'grupos',
    });
  };

  return AlumnoPerfil;
};
