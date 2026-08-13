'use strict';

module.exports = (sequelize, DataTypes) => {
  const EntregaTarea = sequelize.define(
    'EntregaTarea',
    {
      id_entrega: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_tarea: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      id_alumno: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      archivo_entrega_url: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      fecha_entrega: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      estatus: {
        type: DataTypes.ENUM('pendiente', 'entregada', 'fuera_de_tiempo', 'calificada'),
        allowNull: false,
      },
      calificacion: {
        type: DataTypes.DECIMAL(4, 2),
        allowNull: true,
      },
      retroalimentacion: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      validada_control_escolar: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      fecha_validacion: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      id_validado_por: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: 'entregas_tareas',
      timestamps: false,
    },
  );

  EntregaTarea.associate = (models) => {
    EntregaTarea.belongsTo(models.Tarea, {
      foreignKey: 'id_tarea',
      targetKey: 'id_tarea',
      as: 'tarea',
    });

    EntregaTarea.belongsTo(models.AlumnoPerfil, {
      foreignKey: 'id_alumno',
      targetKey: 'id_alumno',
      as: 'alumno',
    });

    EntregaTarea.belongsTo(models.Usuario, {
      foreignKey: 'id_validado_por',
      targetKey: 'id_usuario',
      as: 'validador',
    });
  };

  return EntregaTarea;
};
