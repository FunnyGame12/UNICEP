'use strict';

module.exports = (sequelize, DataTypes) => {
  const Tarea = sequelize.define(
    'Tarea',
    {
      id_tarea: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_materia: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      titulo: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      descripcion: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      fecha_limite: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      archivo_adjunto_url: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: 'tareas',
      timestamps: false,
    },
  );

  Tarea.associate = (models) => {
    Tarea.belongsTo(models.Materia, {
      foreignKey: 'id_materia',
      targetKey: 'id_materia',
      as: 'materia',
    });

    Tarea.hasMany(models.EntregaTarea, {
      foreignKey: 'id_tarea',
      sourceKey: 'id_tarea',
      as: 'entregas',
    });
  };

  return Tarea;
};
