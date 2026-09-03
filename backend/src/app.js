const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const apiRoutes = require('./routes');

const app = express();
const cspDirectives = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'self'"],
  scriptSrc: env.cspScriptSrc,
  styleSrc: env.cspStyleSrc,
  imgSrc: env.cspImgSrc,
  fontSrc: env.cspFontSrc,
  connectSrc: env.cspConnectSrc,
  frameSrc: ["'self'", 'blob:', 'https://docs.google.com'],
  formAction: ["'self'"],
};

if (env.cspReportUri) {
  cspDirectives.reportUri = env.cspReportUri;
}

const allowedOrigins = new Set(
  String(env.corsOrigin || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const devViteOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):5173$/;

function corsOrigin(origin, callback) {
  if (!origin) {
    return callback(null, true);
  }

  if (allowedOrigins.has(origin)) {
    return callback(null, true);
  }

  if (env.nodeEnv === 'development' && devViteOriginPattern.test(origin)) {
    return callback(null, true);
  }

  return callback(new Error(`Origen no permitido por CORS: ${origin}`));
}

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: cspDirectives,
    },
  }),
);
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (_req, res) => {
  res.json({
    name: 'UNICEP API',
    version: '1.0.0',
    docs: '/api/v1/health',
  });
});

app.use('/api/v1', apiRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `No existe ${req.method} ${req.originalUrl}` });
});

module.exports = app;
