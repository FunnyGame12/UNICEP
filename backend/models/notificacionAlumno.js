'use strict';

module.exports = (sequelize, DataTypes) => {
  const NotificacionAlumno = sequelize.define(
    'NotificacionAlumno',
    {
      id_notificacion: {
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
        type: DataTypes.STRING(60),
        allowNull: false,
      },
      titulo: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      detalle: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      fecha: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      leida: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: 'notificaciones_alumno',
      timestamps: false,
    },
  );

  NotificacionAlumno.associate = (models) => {
    NotificacionAlumno.belongsTo(models.AlumnoPerfil, {
      foreignKey: 'id_alumno',
      targetKey: 'id_alumno',
      as: 'alumno',
    });
  };

  return NotificacionAlumno;
};
