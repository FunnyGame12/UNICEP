'use strict';

function toIsoDate(value) {
  return value.toISOString().slice(0, 10);
}

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const fechaFutura = toIsoDate(new Date(Date.now() + 45 * 24 * 60 * 60 * 1000));

    const [usuarios] = await queryInterface.sequelize.query(
      'SELECT id_usuario, correo FROM usuarios WHERE correo IN (?, ?, ?)',
      {
        replacements: ['admin@unicep.test', 'alumno@unicep.test', 'docente@unicep.test'],
      },
    );

    const admin = usuarios.find((usuario) => usuario.correo === 'admin@unicep.test');
    const alumno = usuarios.find((usuario) => usuario.correo === 'alumno@unicep.test');

    if (!admin || !alumno) {
      throw new Error('Las cuentas demo de admin y alumno deben existir para sembrar datos administrativos.');
    }

    const conceptosDemo = [
      {
        clave: 'INSC-ADM-2026',
        nombre: 'Inscripción anual',
        descripcion: 'Concepto de inscripción para apertura de periodo y acceso institucional.',
        categoria: 'inscripcion',
        periodicidad: 'unico',
        carrera_objetivo: 'Lic. en Administración de Empresas',
      },
      {
        clave: 'MENS-ADM-2026',
        nombre: 'Mensualidad ordinaria',
        descripcion: 'Mensualidad académica ordinaria del programa ejecutivo.',
        categoria: 'mensualidad',
        periodicidad: 'mensual',
        carrera_objetivo: 'Lic. en Administración de Empresas',
      },
      {
        clave: 'BECA-ADM-2026',
        nombre: 'Apoyo institucional',
        descripcion: 'Registro administrativo para descuentos o apoyos sobre colegiatura.',
        categoria: 'beca',
        periodicidad: 'extraordinario',
        carrera_objetivo: 'Lic. en Administración de Empresas',
      },
    ];

    for (const concepto of conceptosDemo) {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT id_concepto_pago FROM conceptos_pago WHERE clave = ? LIMIT 1',
        {
          replacements: [concepto.clave],
        },
      );

      if (existing.length === 0) {
        await queryInterface.bulkInsert('conceptos_pago', [{
          ...concepto,
          activo: true,
          fecha_creacion: now,
        }]);
      }
    }

    const [conceptos] = await queryInterface.sequelize.query(
      'SELECT id_concepto_pago, clave, nombre FROM conceptos_pago WHERE clave IN (?)',
      {
        replacements: [conceptosDemo.map((concepto) => concepto.clave)],
      },
    );

    const conceptoByClave = new Map(conceptos.map((concepto) => [concepto.clave, concepto]));

    const reglasDemo = [
      {
        nombre: 'Acceso a clases con mensualidad cubierta',
        servicio: 'acceso_clases',
        tipo_condicion: 'concepto_pagado',
        id_concepto_pago: conceptoByClave.get('MENS-ADM-2026')?.id_concepto_pago || null,
        concepto_requerido: 'Mensualidad ordinaria',
        carrera_objetivo: 'Lic. en Administración de Empresas',
        prioridad: 1,
      },
      {
        nombre: 'Acceso a calificaciones sin adeudos vencidos',
        servicio: 'acceso_calificaciones',
        tipo_condicion: 'sin_adeudo_vencido',
        id_concepto_pago: null,
        concepto_requerido: null,
        carrera_objetivo: null,
        prioridad: 1,
      },
      {
        nombre: 'Acceso a material sin adeudos vencidos',
        servicio: 'acceso_material',
        tipo_condicion: 'sin_adeudo_vencido',
        id_concepto_pago: null,
        concepto_requerido: null,
        carrera_objetivo: null,
        prioridad: 1,
      },
      {
        nombre: 'Inscripción liberada al cubrir inscripción anual',
        servicio: 'inscripcion',
        tipo_condicion: 'concepto_pagado',
        id_concepto_pago: conceptoByClave.get('INSC-ADM-2026')?.id_concepto_pago || null,
        concepto_requerido: 'Inscripción',
        carrera_objetivo: 'Lic. en Administración de Empresas',
        prioridad: 1,
      },
      {
        nombre: 'Mensualidad al corriente sin adeudos vencidos',
        servicio: 'mensualidad',
        tipo_condicion: 'sin_adeudo_vencido',
        id_concepto_pago: null,
        concepto_requerido: null,
        carrera_objetivo: null,
        prioridad: 1,
      },
    ];

    for (const regla of reglasDemo) {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT id_regla FROM reglas_desbloqueo WHERE nombre = ? LIMIT 1',
        {
          replacements: [regla.nombre],
        },
      );

      if (existing.length === 0) {
        await queryInterface.bulkInsert('reglas_desbloqueo', [{
          ...regla,
          activo: true,
          fecha_creacion: now,
        }]);
      }
    }

    const [planes] = await queryInterface.sequelize.query(
      'SELECT id_plan_estudio FROM planes_estudio WHERE nombre = ? LIMIT 1',
      {
        replacements: ['Plan Ejecutivo Administración 2026'],
      },
    );

    if (planes.length === 0) {
      await queryInterface.bulkInsert('planes_estudio', [{
        nombre: 'Plan Ejecutivo Administración 2026',
        carrera: 'Lic. en Administración de Empresas',
        version: '2026.1',
        activo: true,
        fecha_creacion: now,
      }]);
    }

    const [periodos] = await queryInterface.sequelize.query(
      'SELECT id_periodo FROM periodos_academicos WHERE nombre = ? LIMIT 1',
      {
        replacements: ['Bimestre Julio-Agosto 2026'],
      },
    );

    if (periodos.length === 0) {
      await queryInterface.bulkInsert('periodos_academicos', [{
        nombre: 'Bimestre Julio-Agosto 2026',
        ciclo: '2026',
        bimestre: 4,
        fecha_inicio: toIsoDate(new Date('2026-07-01T00:00:00Z')),
        fecha_fin: toIsoDate(new Date('2026-08-31T00:00:00Z')),
        estatus: 'activo',
        fecha_creacion: now,
      }]);
    }

    const conceptoInscripcion = conceptoByClave.get('INSC-ADM-2026');
    const conceptoMensualidad = conceptoByClave.get('MENS-ADM-2026');
    const conceptoBeca = conceptoByClave.get('BECA-ADM-2026');

    if (conceptoInscripcion) {
      await queryInterface.sequelize.query(
        'UPDATE pagos_estatus SET id_concepto_pago = ? WHERE id_alumno = ? AND concepto = ? AND id_concepto_pago IS NULL',
        {
          replacements: [conceptoInscripcion.id_concepto_pago, alumno.id_usuario, 'Inscripción'],
        },
      );
    }

    if (conceptoMensualidad) {
      await queryInterface.sequelize.query(
        'UPDATE pagos_estatus SET id_concepto_pago = ? WHERE id_alumno = ? AND concepto LIKE ? AND id_concepto_pago IS NULL',
        {
          replacements: [conceptoMensualidad.id_concepto_pago, alumno.id_usuario, 'Mensualidad%'],
        },
      );
    }

    if (conceptoBeca) {
      await queryInterface.sequelize.query(
        'UPDATE pagos_estatus SET id_concepto_pago = ? WHERE id_alumno = ? AND concepto = ? AND id_concepto_pago IS NULL',
        {
          replacements: [conceptoBeca.id_concepto_pago, alumno.id_usuario, 'Beca disponible'],
        },
      );
    }

    await queryInterface.sequelize.query(
      "UPDATE pagos_estatus SET estatus = 'pendiente', fecha_limite = ? WHERE id_alumno = ? AND estatus = 'vencido'",
      {
        replacements: [fechaFutura, alumno.id_usuario],
      },
    );

    if (conceptoInscripcion) {
      await queryInterface.sequelize.query(
        "UPDATE pagos_estatus SET estatus = 'pagado', fecha_pago = COALESCE(fecha_pago, ?), fecha_limite = COALESCE(fecha_limite, ?) WHERE id_alumno = ? AND id_concepto_pago = ?",
        {
          replacements: [now, fechaFutura, alumno.id_usuario, conceptoInscripcion.id_concepto_pago],
        },
      );
    }

    if (conceptoMensualidad) {
      await queryInterface.sequelize.query(
        "UPDATE pagos_estatus SET estatus = 'pagado', fecha_pago = COALESCE(fecha_pago, ?), fecha_limite = COALESCE(fecha_limite, ?) WHERE id_alumno = ? AND id_concepto_pago = ? LIMIT 1",
        {
          replacements: [now, fechaFutura, alumno.id_usuario, conceptoMensualidad.id_concepto_pago],
        },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('reglas_desbloqueo', {
      nombre: [
        'Acceso a clases con mensualidad cubierta',
        'Acceso a calificaciones sin adeudos vencidos',
        'Acceso a material sin adeudos vencidos',
        'Inscripción liberada al cubrir inscripción anual',
        'Mensualidad al corriente sin adeudos vencidos',
      ],
    });

    await queryInterface.bulkDelete('periodos_academicos', {
      nombre: 'Bimestre Julio-Agosto 2026',
    });

    await queryInterface.bulkDelete('planes_estudio', {
      nombre: 'Plan Ejecutivo Administración 2026',
    });

    await queryInterface.bulkDelete('conceptos_pago', {
      clave: ['INSC-ADM-2026', 'MENS-ADM-2026', 'BECA-ADM-2026'],
    });
  },
};
