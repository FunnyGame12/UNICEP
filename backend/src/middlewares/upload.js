'use strict';

const fs = require('fs');
const path = require('path');
const multer = require('multer');

const UPLOAD_ROOT = path.join(__dirname, '../../uploads');
const PORTAFOLIO_DIR = path.join(UPLOAD_ROOT, 'portafolio');
const INSTITUCIONAL_DIR = path.join(UPLOAD_ROOT, 'institucional');

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const EXTENSION_BY_MIME = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    fs.mkdirSync(PORTAFOLIO_DIR, { recursive: true });
    cb(null, PORTAFOLIO_DIR);
  },
  filename(_req, file, cb) {
    const extension = EXTENSION_BY_MIME[file.mimetype] || path.extname(file.originalname).slice(0, 10);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
    cb(null, uniqueName);
  },
});

const uploadPortafolio = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Tipo de archivo no permitido. Usa PDF, imagen o documento de Word.'));
      return;
    }
    cb(null, true);
  },
});

function handlePortafolioUpload(req, res, next) {
  uploadPortafolio.single('archivo')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ message: 'El archivo excede el tamano maximo permitido (10MB).' });
      return;
    }

    res.status(400).json({ message: error.message || 'No se pudo procesar el archivo.' });
  });
}

const institucionalStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    fs.mkdirSync(INSTITUCIONAL_DIR, { recursive: true });
    cb(null, INSTITUCIONAL_DIR);
  },
  filename(_req, file, cb) {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.pdf`;
    cb(null, uniqueName);
  },
});

const uploadInstitucional = multer({
  storage: institucionalStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Solo se permite subir archivos PDF.'));
      return;
    }
    cb(null, true);
  },
});

function handleManualServicioSocialUpload(req, res, next) {
  uploadInstitucional.single('archivo')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ message: 'El archivo excede el tamano maximo permitido (15MB).' });
      return;
    }

    res.status(400).json({ message: error.message || 'No se pudo procesar el archivo.' });
  });
}

function handleTramiteRespuestaUpload(req, res, next) {
  uploadPortafolio.fields([
    { name: 'documento_respuesta', maxCount: 1 },
    { name: 'documento_resultado', maxCount: 1 },
    { name: 'archivo', maxCount: 1 },
  ])(req, res, (error) => {
    if (!error) {
      const candidate = (req.files?.documento_respuesta && req.files.documento_respuesta[0])
        || (req.files?.documento_resultado && req.files.documento_resultado[0])
        || (req.files?.archivo && req.files.archivo[0])
        || null;

      if (candidate) {
        req.file = candidate;
      }

      next();
      return;
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ message: 'El archivo excede el tamano maximo permitido (10MB).' });
      return;
    }

    res.status(400).json({ message: error.message || 'No se pudo procesar el archivo.' });
  });
}

module.exports = {
  uploadPortafolio,
  handlePortafolioUpload,
  handleManualServicioSocialUpload,
  handleTramiteRespuestaUpload,
  PORTAFOLIO_DIR,
  INSTITUCIONAL_DIR,
};
