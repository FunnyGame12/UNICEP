'use strict';

module.exports = (sequelize, DataTypes) => {
  const AlumnoAvisoOculto = sequelize.define(
    'AlumnoAvisoOculto',
    {
      id_alumno_aviso_oculto: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      alumno_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      aviso_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'alumno_avisos_ocultos',
      timestamps: false,
    },
  );

  AlumnoAvisoOculto.associate = (models) => {
    AlumnoAvisoOculto.belongsTo(models.AlumnoPerfil, {
      foreignKey: 'alumno_id',
      targetKey: 'id_alumno',
      as: 'alumno',
    });

    AlumnoAvisoOculto.belongsTo(models.Aviso, {
      foreignKey: 'aviso_id',
      targetKey: 'id_aviso',
      as: 'aviso',
    });
  };

  return AlumnoAvisoOculto;
};
