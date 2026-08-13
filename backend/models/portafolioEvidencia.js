'use strict';

module.exports = (sequelize, DataTypes) => {
  const PortafolioEvidencia = sequelize.define(
    'PortafolioEvidencia',
    {
      id_evidencia: {
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
      periodo_bimestre: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      archivo_url: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
    },
    {
      tableName: 'portafolio_evidencias',
      timestamps: false,
    },
  );

  PortafolioEvidencia.associate = (models) => {
    PortafolioEvidencia.belongsTo(models.AlumnoPerfil, {
      foreignKey: 'id_alumno',
      targetKey: 'id_alumno',
      as: 'alumno',
    });

    PortafolioEvidencia.belongsTo(models.Materia, {
      foreignKey: 'id_materia',
      targetKey: 'id_materia',
      as: 'materia',
    });
  };

  return PortafolioEvidencia;
};
