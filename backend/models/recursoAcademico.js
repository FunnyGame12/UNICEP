'use strict';

module.exports = (sequelize, DataTypes) => {
  const RecursoAcademico = sequelize.define(
    'RecursoAcademico',
    {
      id_recurso: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      titulo: {
        type: DataTypes.STRING(180),
        allowNull: false,
      },
      tipo_recurso: {
        type: DataTypes.ENUM('archivo_local', 'enlace_drive'),
        allowNull: false,
      },
      url_recurso: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      remitente_tipo: {
        type: DataTypes.ENUM('coordinacion', 'docente'),
        allowNull: false,
      },
      remitente_nombre: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      id_docente: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      id_materia: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      carrera_id: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      grupo_id: {
        type: DataTypes.STRING(20),
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
    },
    {
      tableName: 'recursos_academicos',
      timestamps: false,
    },
  );

  RecursoAcademico.associate = (models) => {
    RecursoAcademico.belongsTo(models.Usuario, {
      foreignKey: 'id_docente',
      targetKey: 'id_usuario',
      as: 'docente',
    });

    RecursoAcademico.belongsTo(models.Materia, {
      foreignKey: 'id_materia',
      targetKey: 'id_materia',
      as: 'materia',
    });
  };

  return RecursoAcademico;
};
