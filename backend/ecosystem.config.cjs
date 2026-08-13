module.exports = {
  apps: [
    {
      name: 'unicep-api',
      cwd: '/var/www/unicep/backend',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
