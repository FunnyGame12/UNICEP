'use strict';

module.exports = (sequelize, DataTypes) => {
  const PortafolioMateriaEvidencia = sequelize.define(
    'PortafolioMateriaEvidencia',
    {
      id_evidencia_materia: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      alumno_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      materia_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      cuatrimestre_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      drive_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      estado: {
        type: DataTypes.ENUM('pendiente', 'entregado', 'validado'),
        allowNull: false,
        defaultValue: 'pendiente',
      },
      fecha_actualizacion: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'portafolio_materia_evidencias',
      timestamps: false,
    },
  );

  PortafolioMateriaEvidencia.associate = (models) => {
    PortafolioMateriaEvidencia.belongsTo(models.AlumnoPerfil, {
      foreignKey: 'alumno_id',
      targetKey: 'id_alumno',
      as: 'alumno',
    });

    PortafolioMateriaEvidencia.belongsTo(models.Materia, {
      foreignKey: 'materia_id',
      targetKey: 'id_materia',
      as: 'materia',
    });
  };

  return PortafolioMateriaEvidencia;
};
