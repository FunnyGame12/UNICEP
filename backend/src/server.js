const app = require('./app');
const env = require('./config/env');

app.listen(env.port, () => {
  console.log(`UNICEP API escuchando en puerto ${env.port}`);
});
