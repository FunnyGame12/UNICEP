'use strict';

module.exports = (sequelize, DataTypes) => {
  const ConfiguracionInstitucional = sequelize.define(
    'ConfiguracionInstitucional',
    {
      id_configuracion: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      clave: {
        type: DataTypes.STRING(80),
        allowNull: false,
        unique: true,
      },
      valor: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      fecha_actualizacion: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      id_actualizado_por: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: 'configuraciones_institucionales',
      timestamps: false,
    },
  );

  ConfiguracionInstitucional.associate = (models) => {
    ConfiguracionInstitucional.belongsTo(models.Usuario, {
      foreignKey: 'id_actualizado_por',
      targetKey: 'id_usuario',
      as: 'actualizado_por',
    });
  };

  return ConfiguracionInstitucional;
};
