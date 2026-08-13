'use strict';

module.exports = (sequelize, DataTypes) => {
  const MeritoAcademico = sequelize.define(
    'MeritoAcademico',
    {
      id_merito: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_alumno: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tipo_merito: {
        type: DataTypes.ENUM('diploma', 'constancia', 'reconocimiento', 'curso_adicional', 'taller'),
        allowNull: false,
      },
      nombre: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      archivo_url: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
    },
    {
      tableName: 'meritos_academicos',
      timestamps: false,
    },
  );

  MeritoAcademico.associate = (models) => {
    MeritoAcademico.belongsTo(models.AlumnoPerfil, {
      foreignKey: 'id_alumno',
      targetKey: 'id_alumno',
      as: 'alumno',
    });
  };

  return MeritoAcademico;
};
