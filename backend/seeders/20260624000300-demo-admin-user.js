'use strict';

const bcrypt = require('bcrypt');

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface) {
    const [existing] = await queryInterface.sequelize.query(
      'SELECT id_usuario FROM usuarios WHERE correo = ? LIMIT 1',
      {
        replacements: ['admin@unicep.test'],
      },
    );

    if (existing.length > 0) {
      return;
    }

    const passwordHash = await bcrypt.hash('Admin123!', 10);

    await queryInterface.bulkInsert('usuarios', [
      {
        folio_matricula: 'ADM-DEMO-001',
        nombre_completo: 'Administrador Demo',
        correo: 'admin@unicep.test',
        password_hash: passwordHash,
        rol: 'administrativo',
        foto_url: null,
        fecha_creacion: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('usuarios', {
      correo: 'admin@unicep.test',
    });
  },
};
