const dotenv = require('dotenv');

dotenv.config();

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || '';
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || '';

function parseList(value, fallback = []) {
  if (!value) return fallback;

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

if (nodeEnv === 'production' && (!jwtSecret || !jwtRefreshSecret)) {
  throw new Error('JWT_SECRET y JWT_REFRESH_SECRET son obligatorios en producción.');
}

const cspStrict = process.env.CSP_STRICT !== 'false';
const cspScriptSrc = parseList(process.env.CSP_SCRIPT_SRC, cspStrict ? ["'self'", "'unsafe-eval'"] : ["'self'"]);
const cspStyleSrc = parseList(process.env.CSP_STYLE_SRC, ["'self'", "'unsafe-inline'"]);
const cspImgSrc = parseList(process.env.CSP_IMG_SRC, ["'self'", 'data:', 'https:']);
const cspFontSrc = parseList(process.env.CSP_FONT_SRC, ["'self'", 'data:']);
const cspConnectSrc = parseList(process.env.CSP_CONNECT_SRC, ["'self'", 'https:', 'wss:']);

module.exports = {
  nodeEnv,
  port: toNumber(process.env.PORT, 4000),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  jwtRefreshSecret,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || '',
  cspStrict,
  cspScriptSrc,
  cspStyleSrc,
  cspImgSrc,
  cspFontSrc,
  cspConnectSrc,
  cspReportUri: process.env.CSP_REPORT_URI || '',
};
