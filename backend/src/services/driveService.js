'use strict';

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

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
  extractDriveFolderId,
  buildDriveFolderUrl,
};
