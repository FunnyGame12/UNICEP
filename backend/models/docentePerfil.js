'use strict';

module.exports = (sequelize, DataTypes) => {
  const DocentePerfil = sequelize.define(
    'DocentePerfil',
    {
      id_docente: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
      },
      estatus_laboral: {
        type: DataTypes.ENUM('activo', 'inactivo'),
        allowNull: false,
      },
    },
    {
      tableName: 'docentes_perfil',
      timestamps: false,
    },
  );

  DocentePerfil.associate = (models) => {
    DocentePerfil.belongsTo(models.Usuario, {
      foreignKey: 'id_docente',
      targetKey: 'id_usuario',
      as: 'usuario',
    });

    DocentePerfil.hasMany(models.AsignacionGrupo, {
      foreignKey: 'id_docente',
      sourceKey: 'id_docente',
      as: 'asignaciones',
    });
  };

  return DocentePerfil;
};
