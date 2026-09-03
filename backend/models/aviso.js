'use strict';

module.exports = (sequelize, DataTypes) => {
  const Aviso = sequelize.define(
    'Aviso',
    {
      id_aviso: {
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
      remitente_tipo: {
        type: DataTypes.ENUM('coordinacion', 'docente', 'control_escolar'),
        allowNull: false,
      },
      carrera_id: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      grupo_id: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      docente_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'avisos',
      timestamps: false,
    },
  );

  Aviso.associate = (models) => {
    Aviso.belongsTo(models.Usuario, {
      foreignKey: 'docente_id',
      targetKey: 'id_usuario',
      as: 'docente',
    });

    Aviso.hasMany(models.AlumnoAvisoOculto, {
      foreignKey: 'aviso_id',
      sourceKey: 'id_aviso',
      as: 'ocultos',
    });
  };

  return Aviso;
};
