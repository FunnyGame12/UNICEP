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
      estado_academico: {
        type: DataTypes.ENUM('activo', 'suspendido'),
        allowNull: false,
        defaultValue: 'activo',
      },
      estatus_financiero: {
        type: DataTypes.ENUM('al_dia', 'deudor', 'suspendido'),
        allowNull: false,
        defaultValue: 'al_dia',
      },
      bloqueo_plataforma: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      bloqueo_calificaciones: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      drive_folder_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      modalidad_boleta: {
        type: DataTypes.ENUM('ONLINE', 'PRESENCIAL', 'MIXTA'),
        allowNull: false,
        defaultValue: 'ONLINE',
      },
      campus_boleta: {
        type: DataTypes.STRING(120),
        allowNull: false,
        defaultValue: 'UNICEP MERIDA',
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
