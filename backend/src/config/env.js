const dotenv = require('dotenv');

dotenv.config();

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || '';
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || '';

if (nodeEnv === 'production' && (!jwtSecret || !jwtRefreshSecret)) {
  throw new Error('JWT_SECRET y JWT_REFRESH_SECRET son obligatorios en producción.');
}

module.exports = {
  nodeEnv,
  port: toNumber(process.env.PORT, 4000),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  jwtRefreshSecret,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || '',
};
