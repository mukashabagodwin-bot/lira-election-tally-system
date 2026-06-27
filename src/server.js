const app = require('./app');
const env = require('./config/env');
const { sequelize } = require('./infrastructure/orm/database');
const { jsonLog } = require('./infrastructure/observability/logger');

async function start() {
  await sequelize.authenticate();
  await sequelize.sync();
  if (app.locals.sessionStore) await app.locals.sessionStore.sync();
  app.listen(env.port, () => {
    jsonLog('info', 'server.started', { port: env.port, baseUrl: env.baseUrl });
  });
}

start().catch((error) => {
  jsonLog('error', 'server.failed', { message: error.message, stack: error.stack });
  process.exit(1);
});
