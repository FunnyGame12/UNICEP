'use strict';

module.exports = (sequelize, DataTypes) => {
  const AuditoriaEvento = sequelize.define(
    'AuditoriaEvento',
    {
      id_evento: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_usuario: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      rol_actor: {
        type: DataTypes.ENUM('alumno', 'docente', 'administrativo'),
        allowNull: false,
      },
      accion: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      modulo: {
        type: DataTypes.STRING(60),
        allowNull: false,
      },
      entidad: {
        type: DataTypes.STRING(60),
        allowNull: false,
      },
      id_entidad: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      detalle: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      fecha_evento: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'auditoria_eventos',
      timestamps: false,
    },
  );

  AuditoriaEvento.associate = (models) => {
    AuditoriaEvento.belongsTo(models.Usuario, {
      foreignKey: 'id_usuario',
      targetKey: 'id_usuario',
      as: 'actor',
    });
  };

  return AuditoriaEvento;
};
