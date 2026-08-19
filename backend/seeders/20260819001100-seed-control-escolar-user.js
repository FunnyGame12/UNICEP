'use strict';

const bcrypt = require('bcrypt');

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // Buscar id_rol para control_escolar
    const [roles] = await queryInterface.sequelize.query(
      "SELECT id_rol FROM roles WHERE nombre_tecnico = 'control_escolar' LIMIT 1",
    );

    if (!roles || roles.length === 0) {
      console.warn('role control_escolar not found; seeder abortado');
      return;
    }

    const idRol = roles[0].id_rol;

    const correo = 'control.escolar@unicepmerida.edu.mx';
    const folio = 'CTL-ADMIN-001';
    const password = 'Cambio123!';

    // Evitar duplicados
    const [existing] = await queryInterface.sequelize.query(
      'SELECT id_usuario FROM usuarios WHERE correo = ? OR folio_matricula = ? LIMIT 1',
      { replacements: [correo, folio] },
    );
    if (existing && existing.length > 0) {
      console.log('Usuario control_escolar ya existe, seeder no inserta.');
      return;
    }

    const password_hash = await bcrypt.hash(password, 10);

    await queryInterface.bulkInsert('usuarios', [
      {
        folio_matricula: folio,
        nombre_completo: 'Control Escolar Admin',
        correo,
        password_hash,
        cuenta_activada: true,
        id_rol: idRol,
        id_subrol: null,
        rol: 'administrativo',
        foto_url: null,
        fecha_creacion: now,
      },
    ]);

    // Log credentials to console (will appear in remote execution output)
    console.log('CREATED_CONTROL_ESCOLAR_ACCOUNT', { correo, password });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('usuarios', { correo: 'control.escolar@unicepmerida.edu.mx' }, {});
  },
};
