'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE asistencias_docente
      SET fecha_clase = DATE(fecha_clase)
      WHERE fecha_clase IS NOT NULL
    `);

    await queryInterface.sequelize.query(`
      DELETE a1
      FROM asistencias_docente a1
      INNER JOIN asistencias_docente a2
        ON a1.id_registro < a2.id_registro
       AND a1.id_alumno = a2.id_alumno
       AND a1.id_materia = a2.id_materia
       AND a1.fecha_clase = a2.fecha_clase
    `);

    await queryInterface.addIndex('asistencias_docente', {
      name: 'uq_asistencia_docente_alumno_materia_fecha',
      unique: true,
      fields: ['id_alumno', 'id_materia', 'fecha_clase'],
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('asistencias_docente', 'uq_asistencia_docente_alumno_materia_fecha');
  },
};
