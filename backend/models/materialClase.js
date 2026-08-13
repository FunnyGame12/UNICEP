'use strict';

module.exports = (sequelize, DataTypes) => {
  const MaterialClase = sequelize.define(
    'MaterialClase',
    {
      id_material: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_materia: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tema_semana: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      tipo_archivo: {
        type: DataTypes.ENUM('diapositivas', 'libro', 'resumen', 'pdf', 'enlace'),
        allowNull: false,
      },
      archivo_url: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
    },
    {
      tableName: 'materiales_clase',
      timestamps: false,
    },
  );

  MaterialClase.associate = (models) => {
    MaterialClase.belongsTo(models.Materia, {
      foreignKey: 'id_materia',
      targetKey: 'id_materia',
      as: 'materia',
    });
  };

  return MaterialClase;
};
