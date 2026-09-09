'use strict';

module.exports = (sequelize, DataTypes) => {
  const AvisoInstitucional = sequelize.define(
    'AvisoInstitucional',
    {
      id_aviso_institucional: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      titulo: {
        type: DataTypes.STRING(180),
        allowNull: false,
      },
      mensaje: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      destinatario: {
        type: DataTypes.ENUM('alumnos', 'docentes', 'general'),
        allowNull: false,
        defaultValue: 'general',
      },
      tipo_adjunto: {
        type: DataTypes.ENUM('ninguno', 'archivo_local', 'enlace_drive'),
        allowNull: false,
        defaultValue: 'ninguno',
      },
      url_adjunto: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      carrera_id: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      cuatrimestre_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      activo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
      tableName: 'avisos_institucionales',
      timestamps: false,
    },
  );

  return AvisoInstitucional;
};
