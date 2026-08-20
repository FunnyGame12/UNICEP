'use strict';

async function columnExists(queryInterface, tableName, columnName) {
  try {
    const description = await queryInterface.describeTable(tableName);
    return Boolean(description[columnName]);
  } catch (_error) {
    return false;
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await columnExists(queryInterface, 'asignacion_grupos', 'horas_semanales'))) {
      await queryInterface.addColumn('asignacion_grupos', 'horas_semanales', {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      });
    }

    if (!(await columnExists(queryInterface, 'evaluaciones_extraordinarias', 'id_docente_sinodal'))) {
      await queryInterface.addColumn('evaluaciones_extraordinarias', 'id_docente_sinodal', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'docentes_perfil',
          key: 'id_docente',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    if (!(await columnExists(queryInterface, 'evaluaciones_extraordinarias', 'costo_folio_ref'))) {
      await queryInterface.addColumn('evaluaciones_extraordinarias', 'costo_folio_ref', {
        type: Sequelize.STRING(80),
        allowNull: true,
      });
    }

    await queryInterface.changeColumn('programas_externos', 'estatus', {
      type: Sequelize.ENUM('en_revision', 'horas_cubiertas', 'liberado', 'rechazado', 'registrado', 'en_proceso', 'validado'),
      allowNull: false,
      defaultValue: 'en_revision',
    });

    if (!(await columnExists(queryInterface, 'programas_externos', 'horas_concluidas'))) {
      await queryInterface.addColumn('programas_externos', 'horas_concluidas', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'programas_externos', 'oficio_liberacion'))) {
      await queryInterface.addColumn('programas_externos', 'oficio_liberacion', {
        type: Sequelize.STRING(120),
        allowNull: true,
      });
    }

    await queryInterface.changeColumn('meritos_academicos', 'tipo_merito', {
      type: Sequelize.ENUM(
        'diploma',
        'constancia',
        'reconocimiento',
        'curso_adicional',
        'taller',
        'mencion_honorifica',
        'insignia',
        'cuadro_honor',
      ),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE programas_externos
      SET estatus = CASE
        WHEN estatus = 'en_revision' THEN 'en_proceso'
        WHEN estatus = 'horas_cubiertas' THEN 'validado'
        WHEN estatus = 'rechazado' THEN 'registrado'
        ELSE estatus
      END
    `);

    await queryInterface.changeColumn('programas_externos', 'estatus', {
      type: Sequelize.ENUM('registrado', 'en_proceso', 'validado', 'liberado'),
      allowNull: false,
      defaultValue: 'registrado',
    });

    await queryInterface.sequelize.query(`
      UPDATE meritos_academicos
      SET tipo_merito = CASE
        WHEN tipo_merito IN ('mencion_honorifica', 'insignia', 'cuadro_honor') THEN 'reconocimiento'
        ELSE tipo_merito
      END
    `);

    await queryInterface.changeColumn('meritos_academicos', 'tipo_merito', {
      type: Sequelize.ENUM('diploma', 'constancia', 'reconocimiento', 'curso_adicional', 'taller'),
      allowNull: false,
    });

    if (await columnExists(queryInterface, 'programas_externos', 'oficio_liberacion')) {
      await queryInterface.removeColumn('programas_externos', 'oficio_liberacion');
    }

    if (await columnExists(queryInterface, 'programas_externos', 'horas_concluidas')) {
      await queryInterface.removeColumn('programas_externos', 'horas_concluidas');
    }

    if (await columnExists(queryInterface, 'evaluaciones_extraordinarias', 'costo_folio_ref')) {
      await queryInterface.removeColumn('evaluaciones_extraordinarias', 'costo_folio_ref');
    }

    if (await columnExists(queryInterface, 'evaluaciones_extraordinarias', 'id_docente_sinodal')) {
      await queryInterface.removeColumn('evaluaciones_extraordinarias', 'id_docente_sinodal');
    }

    if (await columnExists(queryInterface, 'asignacion_grupos', 'horas_semanales')) {
      await queryInterface.removeColumn('asignacion_grupos', 'horas_semanales');
    }
  },
};
