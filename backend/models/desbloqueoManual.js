'use strict';

module.exports = (sequelize, DataTypes) => {
  const DesbloqueoManual = sequelize.define(
    'DesbloqueoManual',
    {
      id_desbloqueo: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_alumno: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      servicio: {
        type: DataTypes.ENUM('mensualidad', 'inscripcion', 'acceso_clases', 'acceso_calificaciones', 'acceso_material'),
        allowNull: false,
      },
      motivo: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      autorizado_por: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      fecha_inicio: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      fecha_fin: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      activo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'desbloqueos_manuales',
      timestamps: false,
    },
  );

  DesbloqueoManual.associate = (models) => {
    DesbloqueoManual.belongsTo(models.AlumnoPerfil, {
      foreignKey: 'id_alumno',
      targetKey: 'id_alumno',
      as: 'alumno',
    });

    DesbloqueoManual.belongsTo(models.Usuario, {
      foreignKey: 'autorizado_por',
      targetKey: 'id_usuario',
      as: 'autorizador',
    });
  };

  return DesbloqueoManual;
};
