'use strict';

module.exports = (sequelize, DataTypes) => {
  const BibliotecaConfig = sequelize.define(
    'BibliotecaConfig',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      carrera: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      cuatrimestre: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      url_biblioteca: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'biblioteca_configuraciones',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          name: 'uq_biblioteca_config_carrera_cuatrimestre',
          unique: true,
          fields: ['carrera', 'cuatrimestre'],
        },
      ],
    },
  );

  return BibliotecaConfig;
};
