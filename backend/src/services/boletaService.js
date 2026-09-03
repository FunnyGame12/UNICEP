const path = require('path');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const {
  AlumnoPerfil,
  AlumnoGrupo,
  Usuario,
  Materia,
  ProgramaAcademico,
  EntregaTarea,
  Tarea,
  EvaluacionExtraordinaria,
  AsistenciaDocente,
  PortafolioMateriaEvidencia,
} = require('../../models');

const CICLO_ESCOLAR_LABEL = 'CICLO ESCOLAR 2025-2026';
const COLUMNAS_MATERIAS = ['D', 'E', 'F', 'G', 'H'];

function sanitizeFilenamePart(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function formatearFechaExpedicion(fecha) {
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }).format(fecha);
}

async function obtenerAlumnoConContexto(idAlumno) {
  return AlumnoPerfil.findByPk(idAlumno, {
    include: [
      {
        model: Usuario,
        as: 'usuario',
        attributes: ['id_usuario', 'folio_matricula', 'nombre_completo', 'correo', 'curp'],
      },
      {
        model: AlumnoGrupo,
        as: 'grupos',
        required: false,
        include: [{
          model: Materia,
          as: 'materia',
          required: false,
          include: [{
            model: ProgramaAcademico,
            as: 'programa_academico',
            required: false,
            attributes: ['id', 'nombre'],
          }],
        }],
      },
    ],
  });
}

async function construirDatosBoleta(alumno) {
  const idAlumno = alumno.id_alumno;
  const cuatrimestreActual = Number(alumno.bimestre_actual) || 1;
  const gruposCuatrimestre = (alumno.grupos || []).filter((grupo) => {
    const bimestreMateria = Number(grupo?.materia?.bimestre_pertenece);
    return !Number.isInteger(bimestreMateria) || bimestreMateria === cuatrimestreActual;
  });

  const materiasMap = new Map();
  gruposCuatrimestre.forEach((grupo) => {
    const materia = grupo?.materia;
    if (!materia) return;

    const idMateria = Number(materia.id_materia);
    if (!Number.isInteger(idMateria) || materiasMap.has(idMateria)) return;

    materiasMap.set(idMateria, {
      id_materia: idMateria,
      nombre: materia.nombre_materia,
      grupo: grupo.grupo,
      programa_nombre: materia.programa_academico?.nombre || materia.carrera || null,
    });
  });

  const materiasInscritas = [...materiasMap.values()];
  const materiaIds = materiasInscritas.map((item) => item.id_materia);

  const [entregasCalificadas, validacionesPortafolio, extraordinarios, asistencias] = await Promise.all([
    materiaIds.length > 0
      ? EntregaTarea.findAll({
        where: {
          id_alumno: idAlumno,
          estatus: 'calificada',
          calificacion: { [Op.not]: null },
        },
        include: [{
          model: Tarea,
          as: 'tarea',
          required: true,
          include: [{
            model: Materia,
            as: 'materia',
            required: true,
            where: { id_materia: { [Op.in]: materiaIds } },
            attributes: ['id_materia', 'nombre_materia'],
          }],
          attributes: ['id_tarea', 'id_materia'],
        }],
      })
      : Promise.resolve([]),
    materiaIds.length > 0
      ? PortafolioMateriaEvidencia.findAll({
        where: {
          alumno_id: idAlumno,
          materia_id: { [Op.in]: materiaIds },
          estado: 'validado',
        },
        attributes: ['materia_id'],
      })
      : Promise.resolve([]),
    materiaIds.length > 0
      ? EvaluacionExtraordinaria.findAll({
        where: {
          id_alumno: idAlumno,
          id_materia: { [Op.in]: materiaIds },
          calificacion_final: { [Op.not]: null },
        },
        order: [['fecha_programada', 'DESC'], ['id_evaluacion', 'DESC']],
        limit: 3,
      })
      : Promise.resolve([]),
    materiaIds.length > 0
      ? AsistenciaDocente.findAll({
        where: {
          id_alumno: idAlumno,
          id_materia: { [Op.in]: materiaIds },
        },
        attributes: ['id_materia', 'estatus_asistencia'],
      })
      : Promise.resolve([]),
  ]);

  const finalesByMateria = new Map();
  entregasCalificadas.forEach((entrega) => {
    const idMateria = Number(entrega?.tarea?.materia?.id_materia);
    if (!Number.isInteger(idMateria)) return;

    const base = finalesByMateria.get(idMateria) || { suma: 0, total: 0 };
    base.suma += Number(entrega.calificacion || 0);
    base.total += 1;
    finalesByMateria.set(idMateria, base);
  });

  const portafolioValidadoMateriasSet = new Set(
    validacionesPortafolio
      .map((item) => Number(item.materia_id))
      .filter(Number.isInteger),
  );

  const asistenciaByMateria = new Map();
  asistencias.forEach((item) => {
    const idMateria = Number(item.id_materia);
    if (!Number.isInteger(idMateria)) return;

    const base = asistenciaByMateria.get(idMateria) || { total: 0, validas: 0 };
    base.total += 1;
    if (item.estatus_asistencia === 'presente' || item.estatus_asistencia === 'justificado') {
      base.validas += 1;
    }
    asistenciaByMateria.set(idMateria, base);
  });

  const materiasParaBoleta = materiasInscritas.map((materia) => {
    const statsFinal = finalesByMateria.get(materia.id_materia);
    const final = statsFinal && statsFinal.total > 0
      ? Number((statsFinal.suma / statsFinal.total).toFixed(2))
      : null;

    return {
      ...materia,
      final,
      entrego_portafolio: portafolioValidadoMateriasSet.has(materia.id_materia),
    };
  });

  const promedioFinalCuatrimestre = materiasParaBoleta.length > 0
    ? Number((
      materiasParaBoleta.reduce((acc, item) => acc + Number(item.final || 0), 0)
      / materiasParaBoleta.length
    ).toFixed(2))
    : 0;

  const derechoExamenAsistencia = materiasParaBoleta.length > 0
    && materiasParaBoleta.every((materia) => {
      const stats = asistenciaByMateria.get(materia.id_materia);
      if (!stats || stats.total <= 0) return false;
      return ((stats.validas / stats.total) * 100) >= 80;
    });

  const derechoExamenPortafolio = materiasParaBoleta.length > 0
    && materiasParaBoleta.every((materia) => materia.entrego_portafolio);

  const programaNombre = materiasParaBoleta.find((item) => item.programa_nombre)?.programa_nombre
    || alumno.carrera
    || 'PSICOLOGIA';
  const grupoAlumno = materiasParaBoleta[0]?.grupo || gruposCuatrimestre[0]?.grupo || '-';

  return {
    cuatrimestreActual,
    materiasParaBoleta,
    promedioFinalCuatrimestre,
    derechoExamenAsistencia,
    derechoExamenPortafolio,
    extraordinarios,
    programaNombre,
    grupoAlumno,
  };
}

/**
 * Genera el workbook de la boleta oficial para un alumno.
 * Devuelve { notFound: true } o { worksheetMissing: true } si aplica.
 */
async function generarWorkbookBoleta(idAlumno) {
  const alumno = await obtenerAlumnoConContexto(idAlumno);
  if (!alumno) {
    return { notFound: true };
  }

  const {
    cuatrimestreActual,
    materiasParaBoleta,
    promedioFinalCuatrimestre,
    derechoExamenAsistencia,
    derechoExamenPortafolio,
    extraordinarios,
    programaNombre,
    grupoAlumno,
  } = await construirDatosBoleta(alumno);

  const workbook = new ExcelJS.Workbook();
  const templatePath = path.join(__dirname, '../templates/boleta_template.xlsx');
  await workbook.xlsx.readFile(templatePath);

  const worksheet = workbook.getWorksheet('BOLETA');
  if (!worksheet) {
    return { worksheetMissing: true };
  }

  const modalidadBoleta = alumno.modalidad_boleta || 'ONLINE';
  const campusBoleta = alumno.campus_boleta || 'UNICEP MERIDA';

  worksheet.getCell('C3').value = `${cuatrimestreActual}o. CUATRIMESTRE DE ${programaNombre}\n${CICLO_ESCOLAR_LABEL}`;
  worksheet.getCell('O4').value = cuatrimestreActual;

  worksheet.getCell('F5').value = alumno.usuario?.nombre_completo || `Alumno ${alumno.id_alumno}`;
  worksheet.getCell('M5').value = alumno.usuario?.curp || '-';
  worksheet.getCell('E7').value = campusBoleta;
  worksheet.getCell('M7').value = modalidadBoleta;
  worksheet.getCell('O7').value = grupoAlumno;
  worksheet.getCell('E21').value = formatearFechaExpedicion(new Date());
  worksheet.getCell('C24').value = alumno.usuario?.correo || '-';

  materiasParaBoleta.forEach((materia, index) => {
    if (index >= COLUMNAS_MATERIAS.length) return;
    const col = COLUMNAS_MATERIAS[index];
    worksheet.getCell(`${col}9`).value = materia.nombre || '-';
    worksheet.getCell(`${col}11`).value = materia.final ?? '-';
    worksheet.getCell(`${col}14`).value = materia.entrego_portafolio ? 'Si' : 'No';
  });

  worksheet.getCell('D12').value = promedioFinalCuatrimestre;
  worksheet.getCell('N9').value = derechoExamenAsistencia ? 'Si' : 'No';
  worksheet.getCell('N10').value = derechoExamenPortafolio ? 'Si' : 'No';

  extraordinarios.forEach((extra, idx) => {
    if (idx === 0) worksheet.getCell('M12').value = Number(extra.calificacion_final);
    if (idx === 1) worksheet.getCell('M13').value = Number(extra.calificacion_final);
    if (idx === 2) worksheet.getCell('M14').value = Number(extra.calificacion_final);
  });

  const fileId = sanitizeFilenamePart(
    alumno.usuario?.folio_matricula || alumno.usuario?.curp || `alumno_${alumno.id_alumno}`,
  ) || `alumno_${alumno.id_alumno}`;

  return {
    workbook,
    filename: `Boleta_${fileId}.xlsx`,
  };
}

module.exports = {
  generarWorkbookBoleta,
};
