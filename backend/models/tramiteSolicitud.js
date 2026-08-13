'use strict';

const { TRAMITE_TIPOS, TRAMITE_ESTATUS } = require('../src/constants/tramites');

module.exports = (sequelize, DataTypes) => {
  const TramiteSolicitud = sequelize.define(
    'TramiteSolicitud',
    {
      id_tramite: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_alumno: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tipo: {
        type: DataTypes.ENUM(...TRAMITE_TIPOS),
        allowNull: false,
      },
      descripcion: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      adjunto_url: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      estatus: {
        type: DataTypes.ENUM(...TRAMITE_ESTATUS),
        allowNull: false,
      },
      respuesta: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      resuelto_por: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      fecha_solicitud: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      fecha_resolucion: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'tramites_solicitudes',
      timestamps: false,
    },
  );

  TramiteSolicitud.associate = (models) => {
    TramiteSolicitud.belongsTo(models.AlumnoPerfil, {
      foreignKey: 'id_alumno',
      targetKey: 'id_alumno',
      as: 'alumno',
    });

    TramiteSolicitud.belongsTo(models.Usuario, {
      foreignKey: 'resuelto_por',
      targetKey: 'id_usuario',
      as: 'resolutor',
    });
  };

  return TramiteSolicitud;
};