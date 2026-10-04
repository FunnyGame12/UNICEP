'use strict';

module.exports = (sequelize, DataTypes) => {
  const PermisoTemporal = sequelize.define(
    'PermisoTemporal',
    {
      id_permiso: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      modulo_destino: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      rol_autorizado: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      fecha_expiracion: {
        type: DataTypes.DATE,
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
      tableName: 'permisos_temporales',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          name: 'uq_permisos_temporales_modulo_rol',
          unique: true,
          fields: ['modulo_destino', 'rol_autorizado'],
        },
      ],
    },
  );

  return PermisoTemporal;
};
