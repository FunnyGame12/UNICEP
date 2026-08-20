'use strict';

module.exports = (sequelize, DataTypes) => {
  const AsignacionGrupo = sequelize.define(
    'AsignacionGrupo',
    {
      id_asignacion: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_materia: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      id_docente: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      grupo: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      horas_semanales: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: 'asignacion_grupos',
      timestamps: false,
    },
  );

  AsignacionGrupo.associate = (models) => {
    AsignacionGrupo.belongsTo(models.Materia, {
      foreignKey: 'id_materia',
      targetKey: 'id_materia',
      as: 'materia',
    });

    AsignacionGrupo.belongsTo(models.DocentePerfil, {
      foreignKey: 'id_docente',
      targetKey: 'id_docente',
      as: 'docente',
    });
  };

  return AsignacionGrupo;
};
