'use strict';

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const DRIVE_SCOPE = ['https://www.googleapis.com/auth/drive'];
const DEFAULT_CREDENTIALS_PATH = path.resolve(__dirname, '../../credentials.json');
const DRIVE_FOLDER_URL_PREFIX = 'https://drive.google.com/drive/folders/';

function normalizeText(value) {
  return String(value || '').trim();
}

function resolveCredentialsPath() {
  const configuredPath = normalizeText(process.env.GOOGLE_DRIVE_CREDENTIALS_PATH);
  if (!configuredPath) return DEFAULT_CREDENTIALS_PATH;
  if (path.isAbsolute(configuredPath)) return configuredPath;
  return path.resolve(__dirname, '../../', configuredPath);
}

function ensureDriveConfig() {
  const credentialsPath = resolveCredentialsPath();
  if (!fs.existsSync(credentialsPath)) {
    const error = new Error('No se encontro el archivo de credenciales de Google Drive.');
    error.code = 'DRIVE_NOT_CONFIGURED';
    throw error;
  }

  return { credentialsPath };
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

async function getDriveClient() {
  const { credentialsPath } = ensureDriveConfig();

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: DRIVE_SCOPE,
  });

  return google.drive({ version: 'v3', auth });
}

async function crearCarpetaAlumno(nombreCarpeta, carpetaPadreId) {
  const drive = await getDriveClient();
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

async function subirArchivoDrive(archivoMulter, folderId) {
  if (!archivoMulter?.path) {
    const error = new Error('No se encontro el archivo temporal para subir a Drive.');
    error.code = 'DRIVE_UPLOAD_INPUT_INVALID';
    throw error;
  }

  const drive = await getDriveClient();
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

module.exports = {
  crearCarpetaAlumno,
  subirArchivoDrive,
  extractDriveFolderId,
  buildDriveFolderUrl,
};
