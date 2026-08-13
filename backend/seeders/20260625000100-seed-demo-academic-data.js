'use strict';

function addDays(baseDate, days) {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(value) {
  return value.toISOString().slice(0, 10);
}

function toIsoDateTime(value) {
  return value.toISOString().slice(0, 19).replace('T', ' ');
}

const materiasDemo = [
  { nombre_materia: 'Fundamentos de Administración', codigo_materia: 'ADM-101', bimestre_pertenece: 1 },
  { nombre_materia: 'Comunicación Oral y Escrita', codigo_materia: 'COE-101', bimestre_pertenece: 1 },
  { nombre_materia: 'Contabilidad Básica', codigo_materia: 'CON-201', bimestre_pertenece: 2 },
  { nombre_materia: 'Derecho Corporativo', codigo_materia: 'DER-201', bimestre_pertenece: 2 },
  { nombre_materia: 'Planeación Estratégica', codigo_materia: 'ADM-301', bimestre_pertenece: 3 },
  { nombre_materia: 'Psicología Organizacional', codigo_materia: 'PSI-301', bimestre_pertenece: 3 },
];

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const [usuarios] = await queryInterface.sequelize.query(
      'SELECT id_usuario, correo, rol FROM usuarios WHERE correo IN (?, ?)',
      {
        replacements: ['alumno@unicep.test', 'docente@unicep.test'],
      },
    );

    const alumno = usuarios.find((usuario) => usuario.correo === 'alumno@unicep.test');
    const docente = usuarios.find((usuario) => usuario.correo === 'docente@unicep.test');

    if (!alumno || !docente) {
      throw new Error('Las cuentas demo de alumno y docente deben existir antes de sembrar datos académicos.');
    }

    await queryInterface.sequelize.query(
      'UPDATE alumnos_perfil SET carrera = ?, bimestre_actual = ? WHERE id_alumno = ?',
      {
        replacements: ['Lic. en Administración de Empresas', 2, alumno.id_usuario],
      },
    );

    for (const materia of materiasDemo) {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT id_materia FROM materias WHERE codigo_materia = ? LIMIT 1',
        {
          replacements: [materia.codigo_materia],
        },
      );

      if (existing.length === 0) {
        await queryInterface.bulkInsert('materias', [materia]);
      }
    }

    const [materias] = await queryInterface.sequelize.query(
      'SELECT id_materia, nombre_materia, codigo_materia, bimestre_pertenece FROM materias WHERE codigo_materia IN (?) ORDER BY bimestre_pertenece ASC, codigo_materia ASC',
      {
        replacements: [materiasDemo.map((item) => item.codigo_materia)],
      },
    );

    const materiaByCode = new Map(materias.map((item) => [item.codigo_materia, item]));
    const materiasActivas = ['CON-201', 'DER-201'].map((codigo) => materiaByCode.get(codigo)).filter(Boolean);

    for (const materia of materiasActivas) {
      const [grupoDocente] = await queryInterface.sequelize.query(
        'SELECT id_asignacion FROM asignacion_grupos WHERE id_materia = ? AND id_docente = ? AND grupo = ? LIMIT 1',
        {
          replacements: [materia.id_materia, docente.id_usuario, 'A2'],
        },
      );

      if (grupoDocente.length === 0) {
        await queryInterface.bulkInsert('asignacion_grupos', [
          {
            id_materia: materia.id_materia,
            id_docente: docente.id_usuario,
            grupo: 'A2',
          },
        ]);
      }

      const [grupoAlumno] = await queryInterface.sequelize.query(
        'SELECT id_alumno_grupo FROM alumno_grupos WHERE id_alumno = ? AND id_materia = ? LIMIT 1',
        {
          replacements: [alumno.id_usuario, materia.id_materia],
        },
      );

      if (grupoAlumno.length === 0) {
        await queryInterface.bulkInsert('alumno_grupos', [
          {
            id_alumno: alumno.id_usuario,
            id_materia: materia.id_materia,
            grupo: 'A2',
            fecha_alta: toIsoDateTime(now),
          },
        ]);
      }
    }

    const tareasDemo = [
      {
        codigo_materia: 'CON-201',
        titulo: 'Estado de resultados básico',
        descripcion: 'Elabora un estado de resultados con el caso práctico compartido en clase.',
        fecha_limite: addDays(now, 5),
        archivo_adjunto_url: 'https://drive.google.com/file/d/demo-contabilidad-estado-resultados/view',
      },
      {
        codigo_materia: 'CON-201',
        titulo: 'Balance general integrador',
        descripcion: 'Integra activos, pasivos y capital contable en el formato institucional.',
        fecha_limite: addDays(now, -3),
        archivo_adjunto_url: 'https://drive.google.com/file/d/demo-contabilidad-balance-general/view',
      },
      {
        codigo_materia: 'DER-201',
        titulo: 'Mapa conceptual de sociedades mercantiles',
        descripcion: 'Resume tipos de sociedades, obligaciones y órganos de administración.',
        fecha_limite: addDays(now, 2),
        archivo_adjunto_url: null,
      },
      {
        codigo_materia: 'DER-201',
        titulo: 'Análisis del acta constitutiva',
        descripcion: 'Presenta observaciones jurídicas del acta constitutiva del caso de estudio.',
        fecha_limite: addDays(now, -6),
        archivo_adjunto_url: 'https://drive.google.com/file/d/demo-derecho-acta-constitutiva/view',
      },
    ];

    for (const tarea of tareasDemo) {
      const materia = materiaByCode.get(tarea.codigo_materia);
      if (!materia) continue;

      const [existing] = await queryInterface.sequelize.query(
        'SELECT id_tarea FROM tareas WHERE id_materia = ? AND titulo = ? LIMIT 1',
        {
          replacements: [materia.id_materia, tarea.titulo],
        },
      );

      if (existing.length === 0) {
        await queryInterface.bulkInsert('tareas', [
          {
            id_materia: materia.id_materia,
            titulo: tarea.titulo,
            descripcion: tarea.descripcion,
            fecha_limite: toIsoDateTime(tarea.fecha_limite),
            archivo_adjunto_url: tarea.archivo_adjunto_url,
          },
        ]);
      }
    }

    const [tareas] = await queryInterface.sequelize.query(
      'SELECT id_tarea, id_materia, titulo FROM tareas WHERE titulo IN (?)',
      {
        replacements: [tareasDemo.map((item) => item.titulo)],
      },
    );

    const tareaByTitle = new Map(tareas.map((item) => [item.titulo, item]));

    const entregasDemo = [
      {
        titulo: 'Balance general integrador',
        archivo_entrega_url: 'https://drive.google.com/file/d/demo-entrega-balance-general/view',
        fecha_entrega: addDays(now, -2),
        estatus: 'calificada',
        calificacion: 9.2,
        retroalimentacion: 'Buen dominio del formato, solo revisa la clasificación de pasivos a corto plazo.',
      },
      {
        titulo: 'Mapa conceptual de sociedades mercantiles',
        archivo_entrega_url: 'https://drive.google.com/file/d/demo-entrega-sociedades-mercantiles/view',
        fecha_entrega: addDays(now, -1),
        estatus: 'entregada',
        calificacion: null,
        retroalimentacion: null,
      },
      {
        titulo: 'Análisis del acta constitutiva',
        archivo_entrega_url: 'https://drive.google.com/file/d/demo-entrega-acta-constitutiva/view',
        fecha_entrega: addDays(now, -1),
        estatus: 'fuera_de_tiempo',
        calificacion: null,
        retroalimentacion: 'Entrega fuera de tiempo. Pendiente de revisión extraordinaria.',
      },
    ];

    for (const entrega of entregasDemo) {
      const tarea = tareaByTitle.get(entrega.titulo);
      if (!tarea) continue;

      const [existing] = await queryInterface.sequelize.query(
        'SELECT id_entrega FROM entregas_tareas WHERE id_tarea = ? AND id_alumno = ? LIMIT 1',
        {
          replacements: [tarea.id_tarea, alumno.id_usuario],
        },
      );

      if (existing.length === 0) {
        await queryInterface.bulkInsert('entregas_tareas', [
          {
            id_tarea: tarea.id_tarea,
            id_alumno: alumno.id_usuario,
            archivo_entrega_url: entrega.archivo_entrega_url,
            fecha_entrega: toIsoDateTime(entrega.fecha_entrega),
            estatus: entrega.estatus,
            calificacion: entrega.calificacion,
            retroalimentacion: entrega.retroalimentacion,
          },
        ]);
      }
    }

    const materialesDemo = [
      {
        codigo_materia: 'CON-201',
        tema_semana: 'Semana 1 · Fundamentos del balance',
        tipo_archivo: 'diapositivas',
        archivo_url: 'https://drive.google.com/file/d/demo-material-balance-slides/view',
      },
      {
        codigo_materia: 'CON-201',
        tema_semana: 'Semana 2 · Caso práctico contable',
        tipo_archivo: 'pdf',
        archivo_url: 'https://drive.google.com/file/d/demo-material-caso-practico/view',
      },
      {
        codigo_materia: 'DER-201',
        tema_semana: 'Semana 1 · Sociedades mercantiles',
        tipo_archivo: 'resumen',
        archivo_url: 'https://drive.google.com/file/d/demo-material-sociedades-mercantiles/view',
      },
      {
        codigo_materia: 'DER-201',
        tema_semana: 'Semana 2 · Recurso audiovisual de apoyo',
        tipo_archivo: 'enlace',
        archivo_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
    ];

    for (const material of materialesDemo) {
      const materia = materiaByCode.get(material.codigo_materia);
      if (!materia) continue;

      const [existing] = await queryInterface.sequelize.query(
        'SELECT id_material FROM materiales_clase WHERE id_materia = ? AND tema_semana = ? LIMIT 1',
        {
          replacements: [materia.id_materia, material.tema_semana],
        },
      );

      if (existing.length === 0) {
        await queryInterface.bulkInsert('materiales_clase', [
          {
            id_materia: materia.id_materia,
            tema_semana: material.tema_semana,
            tipo_archivo: material.tipo_archivo,
            archivo_url: material.archivo_url,
          },
        ]);
      }
    }

    const portafolioDemo = [
      {
        codigo_materia: 'CON-201',
        periodo_bimestre: 2,
        archivo_url: 'https://drive.google.com/file/d/demo-portafolio-contabilidad/view',
      },
      {
        codigo_materia: 'DER-201',
        periodo_bimestre: 2,
        archivo_url: 'https://drive.google.com/file/d/demo-portafolio-derecho/view',
      },
    ];

    for (const evidencia of portafolioDemo) {
      const materia = materiaByCode.get(evidencia.codigo_materia);
      if (!materia) continue;

      const [existing] = await queryInterface.sequelize.query(
        'SELECT id_evidencia FROM portafolio_evidencias WHERE id_alumno = ? AND id_materia = ? AND archivo_url = ? LIMIT 1',
        {
          replacements: [alumno.id_usuario, materia.id_materia, evidencia.archivo_url],
        },
      );

      if (existing.length === 0) {
        await queryInterface.bulkInsert('portafolio_evidencias', [
          {
            id_alumno: alumno.id_usuario,
            id_materia: materia.id_materia,
            periodo_bimestre: evidencia.periodo_bimestre,
            archivo_url: evidencia.archivo_url,
          },
        ]);
      }
    }

    const meritosDemo = [
      {
        tipo_merito: 'constancia',
        nombre: 'Constancia de liderazgo estudiantil',
        fecha: toIsoDate(addDays(now, -90)),
        archivo_url: 'https://drive.google.com/file/d/demo-merito-liderazgo/view',
      },
      {
        tipo_merito: 'curso_adicional',
        nombre: 'Curso adicional de Excel aplicado a negocios',
        fecha: toIsoDate(addDays(now, -60)),
        archivo_url: 'https://drive.google.com/file/d/demo-merito-excel/view',
      },
      {
        tipo_merito: 'reconocimiento',
        nombre: 'Reconocimiento por participación académica',
        fecha: toIsoDate(addDays(now, -30)),
        archivo_url: 'https://drive.google.com/file/d/demo-merito-participacion/view',
      },
    ];

    for (const merito of meritosDemo) {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT id_merito FROM meritos_academicos WHERE id_alumno = ? AND nombre = ? LIMIT 1',
        {
          replacements: [alumno.id_usuario, merito.nombre],
        },
      );

      if (existing.length === 0) {
        await queryInterface.bulkInsert('meritos_academicos', [
          {
            id_alumno: alumno.id_usuario,
            tipo_merito: merito.tipo_merito,
            nombre: merito.nombre,
            fecha: merito.fecha,
            archivo_url: merito.archivo_url,
          },
        ]);
      }
    }

    const pagosDemo = [
      {
        concepto: 'Inscripción',
        monto: 2500.0,
        fecha_limite: toIsoDate(addDays(now, -40)),
        estatus: 'pagado',
        fecha_pago: toIsoDate(addDays(now, -38)),
        folio_interno: 'PAG-INS-0001',
      },
      {
        concepto: 'Mensualidad junio',
        monto: 1850.0,
        fecha_limite: toIsoDate(addDays(now, -10)),
        estatus: 'pagado',
        fecha_pago: toIsoDate(addDays(now, -8)),
        folio_interno: 'PAG-MEN-0006',
      },
      {
        concepto: 'Mensualidad julio',
        monto: 1850.0,
        fecha_limite: toIsoDate(addDays(now, 12)),
        estatus: 'pendiente',
        fecha_pago: null,
        folio_interno: null,
      },
      {
        concepto: 'Beca disponible',
        monto: 500.0,
        fecha_limite: toIsoDate(addDays(now, 15)),
        estatus: 'pendiente',
        fecha_pago: null,
        folio_interno: 'BECA-2026-01',
      },
    ];

    for (const pago of pagosDemo) {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT id_pago FROM pagos_estatus WHERE id_alumno = ? AND concepto = ? LIMIT 1',
        {
          replacements: [alumno.id_usuario, pago.concepto],
        },
      );

      if (existing.length === 0) {
        await queryInterface.bulkInsert('pagos_estatus', [
          {
            id_alumno: alumno.id_usuario,
            concepto: pago.concepto,
            monto: pago.monto,
            fecha_limite: pago.fecha_limite,
            estatus: pago.estatus,
            fecha_pago: pago.fecha_pago,
            folio_interno: pago.folio_interno,
          },
        ]);
      }
    }
  },

  async down(queryInterface) {
    const [usuarios] = await queryInterface.sequelize.query(
      'SELECT id_usuario, correo FROM usuarios WHERE correo IN (?, ?)',
      {
        replacements: ['alumno@unicep.test', 'docente@unicep.test'],
      },
    );

    const alumno = usuarios.find((usuario) => usuario.correo === 'alumno@unicep.test');
    const docente = usuarios.find((usuario) => usuario.correo === 'docente@unicep.test');

    const codigos = materiasDemo.map((item) => item.codigo_materia);
    const [materias] = await queryInterface.sequelize.query(
      'SELECT id_materia FROM materias WHERE codigo_materia IN (?)',
      {
        replacements: [codigos],
      },
    );

    const materiaIds = materias.map((item) => item.id_materia);

    if (alumno) {
      await queryInterface.bulkDelete('entregas_tareas', { id_alumno: alumno.id_usuario });
      await queryInterface.bulkDelete('portafolio_evidencias', { id_alumno: alumno.id_usuario });
      await queryInterface.bulkDelete('meritos_academicos', { id_alumno: alumno.id_usuario });
      await queryInterface.bulkDelete('pagos_estatus', { id_alumno: alumno.id_usuario });
      await queryInterface.bulkDelete('alumno_grupos', { id_alumno: alumno.id_usuario });
      await queryInterface.sequelize.query(
        'UPDATE alumnos_perfil SET bimestre_actual = ? WHERE id_alumno = ?',
        {
          replacements: [1, alumno.id_usuario],
        },
      );
    }

    if (docente && materiaIds.length > 0) {
      await queryInterface.bulkDelete('asignacion_grupos', {
        id_docente: docente.id_usuario,
        id_materia: materiaIds,
      });
    }

    if (materiaIds.length > 0) {
      await queryInterface.bulkDelete('materiales_clase', { id_materia: materiaIds });
      await queryInterface.bulkDelete('tareas', { id_materia: materiaIds });
      await queryInterface.bulkDelete('materias', { id_materia: materiaIds });
    }
  },
};