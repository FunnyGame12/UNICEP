'use strict';

module.exports = (sequelize, DataTypes) => {
  const SalaVideoDocente = sequelize.define(
    'SalaVideoDocente',
    {
      id_sala: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_docente: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      id_materia: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      grupo_id: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      titulo: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      plataforma: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      enlace: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      fecha_programada: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'salas_video_docente',
      timestamps: false,
    },
  );

  SalaVideoDocente.associate = (models) => {
    SalaVideoDocente.belongsTo(models.Materia, {
      foreignKey: 'id_materia',
      targetKey: 'id_materia',
      as: 'materia',
    });

    SalaVideoDocente.belongsTo(models.DocentePerfil, {
      foreignKey: 'id_docente',
      targetKey: 'id_docente',
      as: 'docente',
    });
  };

  return SalaVideoDocente;
};
