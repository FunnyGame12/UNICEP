'use strict';

module.exports = (sequelize, DataTypes) => {
  const AnuncioDocente = sequelize.define(
    'AnuncioDocente',
    {
      id_anuncio: {
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
      titulo: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      descripcion: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      fecha_publicacion: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'anuncios_docente',
      timestamps: false,
    },
  );

  AnuncioDocente.associate = (models) => {
    AnuncioDocente.belongsTo(models.DocentePerfil, {
      foreignKey: 'id_docente',
      targetKey: 'id_docente',
      as: 'docente',
    });

    AnuncioDocente.belongsTo(models.Materia, {
      foreignKey: 'id_materia',
      targetKey: 'id_materia',
      as: 'materia',
    });
  };

  return AnuncioDocente;
};
