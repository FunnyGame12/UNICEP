require('dotenv').config();

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildConfig(defaultDatabase) {
  return {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME || defaultDatabase,
    host: process.env.DB_HOST || '127.0.0.1',
    port: toNumber(process.env.DB_PORT, 3306),
    dialect: 'mysql',
  };
}

module.exports = {
  development: buildConfig('unicep_db'),
  test: buildConfig('unicep_test_db'),
  production: buildConfig('unicep_prod_db'),
};