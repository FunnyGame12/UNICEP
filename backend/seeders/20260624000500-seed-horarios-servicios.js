'use strict';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('horarios', [
      {
        modalidad: 'Rango de Horario Oficial',
        periodo: 'Entre Semana',
        turno: 'Clases Entre Semana',
        hora_inicio: '17:00',
        hora_fin: '21:00',
        descripcion: 'Clases entre semana de 5:00 PM a 9:00 PM en modalidad ejecutiva y flexible.',
      },
      {
        modalidad: 'Rango de Horario Oficial',
        periodo: 'Fin de Semana',
        turno: 'Turno Matutino',
        hora_inicio: '07:00',
        hora_fin: '13:20',
        descripcion: 'Clases sabatino/dominical en turno matutino: 7:00 AM a 1:20 PM.',
      },
      {
        modalidad: 'Rango de Horario Oficial',
        periodo: 'Fin de Semana',
        turno: 'Turno Vespertino',
        hora_inicio: '14:00',
        hora_fin: '20:20',
        descripcion: 'Clases sabatino/dominical en turno vespertino: 2:00 PM a 8:20 PM.',
      },
    ]);

    await queryInterface.bulkInsert('campus_servicios', [
      {
        titulo: 'Equipo de Asesores',
        descripcion: 'Acompañamiento docente y académico personalizado constante.',
        icono: '👥',
      },
      {
        titulo: 'Biblioteca 24/7',
        descripcion: 'Acceso a recursos de información físicos y digitales en cualquier momento.',
        icono: '📚',
      },
      {
        titulo: 'Clínica Universitaria',
        descripcion: 'Ecosistema de práctica real y vinculación social para el alumnado.',
        icono: '🩺',
      },
      {
        titulo: 'Cineteca 24/7',
        descripcion: 'Espacios culturales y de proyección audiovisual multimedia.',
        icono: '🎬',
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('horarios', null, {});
    await queryInterface.bulkDelete('campus_servicios', null, {});
  },
};
