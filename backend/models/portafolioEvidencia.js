'use strict';

module.exports = (sequelize, DataTypes) => {
  const PortafolioEvidencia = sequelize.define(
    'PortafolioEvidencia',
    {
      id_evidencia: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_alumno: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      id_materia: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      periodo_bimestre: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      archivo_url: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      nombre_archivo: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      origen: {
        type: DataTypes.ENUM('docente', 'control_escolar'),
        allowNull: false,
        defaultValue: 'docente',
      },
      id_subido_por: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'portafolio_evidencias',
      timestamps: false,
    },
  );

  PortafolioEvidencia.associate = (models) => {
    PortafolioEvidencia.belongsTo(models.AlumnoPerfil, {
      foreignKey: 'id_alumno',
      targetKey: 'id_alumno',
      as: 'alumno',
    });

    PortafolioEvidencia.belongsTo(models.Materia, {
      foreignKey: 'id_materia',
      targetKey: 'id_materia',
      as: 'materia',
    });

    PortafolioEvidencia.belongsTo(models.Usuario, {
      foreignKey: 'id_subido_por',
      targetKey: 'id_usuario',
      as: 'subido_por',
    });
  };

  return PortafolioEvidencia;
};
