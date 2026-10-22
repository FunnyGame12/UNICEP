'use strict';

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { AlumnoGrupo, AlumnoPerfil, PlanEstudio, Usuario } = require('../../models');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_DRIVE_CLIENT_ID,
  process.env.GOOGLE_DRIVE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });
const DRIVE_FOLDER_URL_PREFIX = 'https://drive.google.com/drive/folders/';
const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const EXPEDIENTES_ROOT_NAME = 'EXPEDIENTES_UNICEP';
const folderCreationLocks = new Map();

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeFolderSegment(value, fallback = 'SIN_DATO') {
  const raw = normalizeText(value)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return raw || fallback;
}

function buildAlumnoDriveFolderName({ carrera, grupo, cuatrimestre } = {}) {
  const carreraPart = normalizeFolderSegment(carrera, 'PENDIENTE_CARRERA');
  const grupoPart = normalizeFolderSegment(grupo, 'PENDIENTE_GRUPO');
  const cuatrimestrePart = normalizeFolderSegment(cuatrimestre, 'PENDIENTE_CUATRIMESTRE');
  return `${carreraPart}-${grupoPart}-${cuatrimestrePart}`;
}

function normalizeDriveFolderName(value) {
  return normalizeText(value)
    .replace(/[\/\\<>:"|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveGrupoPrincipal(grupos) {
  const counts = new Map();
  grupos.forEach(({ grupo }) => {
    const name = normalizeText(grupo);
    if (!name) return;
    const key = name.toLocaleUpperCase('es-MX');
    const current = counts.get(key);
    counts.set(key, { name: current?.name || name, count: (current?.count || 0) + 1 });
  });

  const ranked = [...counts.values()].sort((left, right) => right.count - left.count);
  if (ranked.length === 0) {
    const error = new Error('El alumno no tiene un grupo académico asignado.');
    error.code = 'DRIVE_STUDENT_GROUP_REQUIRED';
    throw error;
  }
  if (ranked.length > 1 && ranked[0].count === ranked[1].count) {
    const error = new Error('No se pudo determinar un grupo principal: hay un empate en sus inscripciones.');
    error.code = 'DRIVE_STUDENT_GROUP_AMBIGUOUS';
    throw error;
  }
  return ranked[0].name;
}

function escapeDriveQueryValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function buscarOCrearCarpetaDrive(nombre, carpetaPadreId) {
  const folderName = normalizeDriveFolderName(nombre);
  const parentId = normalizeText(carpetaPadreId);
  if (!folderName || !parentId) {
    const error = new Error('El nombre y la carpeta padre son obligatorios para organizar el expediente.');
    error.code = 'DRIVE_FOLDER_INPUT_INVALID';
    throw error;
  }

  const lockKey = `${parentId}\u0000${folderName}`;
  const existing = folderCreationLocks.get(lockKey);
  if (existing) return existing;

  const operation = (async () => {
    const escapedName = escapeDriveQueryValue(folderName);
    const escapedParent = escapeDriveQueryValue(parentId);
    const found = await drive.files.list({
      q: `name = '${escapedName}' and mimeType = '${DRIVE_FOLDER_MIME_TYPE}' and '${escapedParent}' in parents and trashed = false`,
      spaces: 'drive',
      pageSize: 100,
      orderBy: 'createdTime',
      fields: 'files(id,name,webViewLink)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const existingFolder = found.data.files?.[0];
    if (existingFolder) return existingFolder;

    const created = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: DRIVE_FOLDER_MIME_TYPE,
        parents: [parentId],
      },
      fields: 'id,name,webViewLink',
      supportsAllDrives: true,
    });
    return created.data;
  })();

  folderCreationLocks.set(lockKey, operation);
  try {
    return await operation;
  } finally {
    if (folderCreationLocks.get(lockKey) === operation) {
      folderCreationLocks.delete(lockKey);
    }
  }
}

async function asegurarCarpetaDriveAlumno(alumnoId) {
  const alumno = await AlumnoPerfil.findByPk(alumnoId, {
    include: [{
      model: Usuario,
      as: 'usuario',
      attributes: ['id_usuario', 'folio_matricula', 'nombre_completo'],
    }],
  });
  if (!alumno) {
    const error = new Error('Alumno no encontrado.');
    error.code = 'DRIVE_STUDENT_NOT_FOUND';
    throw error;
  }

  const rootParentId = normalizeText(process.env.GOOGLE_DRIVE_ALUMNOS_ROOT_FOLDER_ID);
  if (!rootParentId) {
    const error = new Error('No está configurada la carpeta raíz de Google Drive.');
    error.code = 'DRIVE_ROOT_FOLDER_REQUIRED';
    throw error;
  }

  const [rootMetadata, plan, grupos] = await Promise.all([
    drive.files.get({
      fileId: rootParentId,
      fields: 'id,name,mimeType',
      supportsAllDrives: true,
    }),
    PlanEstudio.findByPk(alumno.id_plan_estudio, { attributes: ['carrera'] }),
    AlumnoGrupo.findAll({
      where: { id_alumno: alumno.id_alumno },
      attributes: ['grupo'],
      raw: true,
    }),
  ]);

  if (rootMetadata.data.mimeType !== DRIVE_FOLDER_MIME_TYPE) {
    const error = new Error('GOOGLE_DRIVE_ALUMNOS_ROOT_FOLDER_ID debe apuntar a una carpeta de Drive.');
    error.code = 'DRIVE_ROOT_FOLDER_INVALID';
    throw error;
  }

  const career = normalizeDriveFolderName(alumno.carrera || plan?.carrera);
  if (!career) {
    const error = new Error('El perfil académico del alumno no tiene una carrera definida.');
    error.code = 'DRIVE_STUDENT_CAREER_REQUIRED';
    throw error;
  }

  const termNumber = Number(alumno.bimestre_actual);
  if (!Number.isInteger(termNumber) || termNumber < 1) {
    const error = new Error('El perfil académico del alumno no tiene un cuatrimestre válido.');
    error.code = 'DRIVE_STUDENT_TERM_INVALID';
    throw error;
  }

  const folio = normalizeDriveFolderName(alumno.usuario?.folio_matricula);
  const fullName = normalizeDriveFolderName(alumno.usuario?.nombre_completo);
  if (!folio && !fullName) {
    const error = new Error('El alumno no tiene folio ni nombre para identificar su carpeta.');
    error.code = 'DRIVE_STUDENT_IDENTITY_REQUIRED';
    throw error;
  }

  const root = rootMetadata.data.name === EXPEDIENTES_ROOT_NAME
    ? rootMetadata.data
    : await buscarOCrearCarpetaDrive(EXPEDIENTES_ROOT_NAME, rootParentId);
  const careerFolder = await buscarOCrearCarpetaDrive(career, root.id);
  const termFolder = await buscarOCrearCarpetaDrive(`Cuatrimestre ${termNumber}`, careerFolder.id);
  const group = resolveGrupoPrincipal(grupos);
  const groupFolder = await buscarOCrearCarpetaDrive(
    /^grupo\b/i.test(group) ? group : `Grupo ${group}`,
    termFolder.id,
  );
  const studentFolder = await buscarOCrearCarpetaDrive(
    [folio, fullName].filter(Boolean).join(' - '),
    groupFolder.id,
  );

  alumno.drive_folder_id = studentFolder.id;
  alumno.drive_folder_url = studentFolder.webViewLink || buildDriveFolderUrl(studentFolder.id);
  await alumno.save();

  return {
    folderId: alumno.drive_folder_id,
    folderUrl: alumno.drive_folder_url,
    folderName: studentFolder.name,
  };
}

function buildDriveFolderUrl(folderId) {
  const id = normalizeText(folderId);
  return id ? `${DRIVE_FOLDER_URL_PREFIX}${id}` : null;
}

function extractDriveFolderId(value) {
  const raw = normalizeText(value);
  if (!raw) return null;

  if (/^[a-zA-Z0-9_-]{10,}$/.test(raw)) {
    return raw;
  }

  try {
    const parsed = new URL(raw);
    const fromPath = parsed.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/i);
    if (fromPath?.[1]) return fromPath[1];

    const fromQuery = parsed.searchParams.get('id');
    if (fromQuery && /^[a-zA-Z0-9_-]{10,}$/.test(fromQuery)) {
      return fromQuery;
    }
  } catch (_error) {
    return null;
  }

  return null;
}


async function crearCarpetaAlumno(nombreCarpeta, carpetaPadreId) {
  const nombre = normalizeText(nombreCarpeta) || `alumno-${Date.now()}`;
  const parentId = normalizeText(carpetaPadreId || process.env.GOOGLE_DRIVE_ALUMNOS_ROOT_FOLDER_ID);

  const response = await drive.files.create({
    requestBody: {
      name: nombre,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id,name,webViewLink',
    supportsAllDrives: true,
  });

  return {
    folderId: response.data.id,
    folderUrl: response.data.webViewLink || buildDriveFolderUrl(response.data.id),
    folderName: response.data.name,
  };
}

async function renombrarCarpetaDrive(folderId, nuevoNombre) {
  const id = normalizeText(folderId);
  const name = normalizeText(nuevoNombre);
  if (!id || !name) {
    const error = new Error('folderId y nuevoNombre son obligatorios para renombrar carpeta en Drive.');
    error.code = 'DRIVE_RENAME_INPUT_INVALID';
    throw error;
  }

  const response = await drive.files.update({
    fileId: id,
    requestBody: { name },
    fields: 'id,name,webViewLink',
    supportsAllDrives: true,
  });

  return {
    folderId: response.data.id,
    folderName: response.data.name,
    folderUrl: response.data.webViewLink || buildDriveFolderUrl(response.data.id),
  };
}

async function subirDocumentoAlumno(archivoMulter, folderId) {
  if (!archivoMulter?.path) {
    const error = new Error('No se encontro el archivo temporal para subir a Drive.');
    error.code = 'DRIVE_UPLOAD_INPUT_INVALID';
    throw error;
  }

  const targetFolderId = normalizeText(folderId);
  if (!targetFolderId) {
    const error = new Error('No se proporciono folderId para la subida a Drive.');
    error.code = 'DRIVE_FOLDER_REQUIRED';
    throw error;
  }

  try {
    const response = await drive.files.create({
      requestBody: {
        name: archivoMulter.originalname || path.basename(archivoMulter.path),
        parents: [targetFolderId],
      },
      media: {
        mimeType: archivoMulter.mimetype || 'application/octet-stream',
        body: fs.createReadStream(archivoMulter.path),
      },
      fields: 'id,name,webViewLink,webContentLink',
      supportsAllDrives: true,
    });

    return {
      fileId: response.data.id,
      webViewLink: response.data.webViewLink || null,
      webContentLink: response.data.webContentLink || null,
      fileName: response.data.name || archivoMulter.originalname || null,
    };
  } finally {
    try {
      if (fs.existsSync(archivoMulter.path)) {
        fs.unlinkSync(archivoMulter.path);
      }
    } catch (_error) {
      // Eliminar temporales no debe romper el flujo principal.
    }
  }
}

const subirArchivoDrive = subirDocumentoAlumno;

module.exports = {
  crearCarpetaAlumno,
  renombrarCarpetaDrive,
  subirDocumentoAlumno,
  subirArchivoDrive,
  buildAlumnoDriveFolderName,
  asegurarCarpetaDriveAlumno,
  resolveGrupoPrincipal,
  extractDriveFolderId,
  buildDriveFolderUrl,
};
