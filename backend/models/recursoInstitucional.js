'use strict';

module.exports = (sequelize, DataTypes) => {
  const RecursoInstitucional = sequelize.define(
    'RecursoInstitucional',
    {
      id_recurso_institucional: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      titulo: {
        type: DataTypes.STRING(180),
        allowNull: false,
      },
      archivo_url: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      tipo_asignacion: {
        type: DataTypes.ENUM('masivo', 'individual'),
        allowNull: false,
      },
      carrera_id: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      semestre: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      grupo_id: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      alumno_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'recursos_institucionales',
      timestamps: false,
    },
  );

  RecursoInstitucional.associate = (models) => {
    RecursoInstitucional.belongsTo(models.AlumnoPerfil, {
      foreignKey: 'alumno_id',
      targetKey: 'id_alumno',
      as: 'alumno',
    });
  };

  return RecursoInstitucional;
};
