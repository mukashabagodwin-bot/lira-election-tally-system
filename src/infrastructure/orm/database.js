const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const fs = require('fs');
const env = require('../../config/env');

function buildSequelize() {
  if (env.databaseUrl.startsWith('sqlite:')) {
    const storage = env.databaseUrl.replace('sqlite:', '');
    const absoluteStorage = path.resolve(process.cwd(), storage);
    fs.mkdirSync(path.dirname(absoluteStorage), { recursive: true });
    return new Sequelize({
      dialect: 'sqlite',
      storage: absoluteStorage,
      logging: false,
      pool: { max: 10, min: 0, idle: 10000 }
    });
  }

  return new Sequelize(env.databaseUrl, {
    logging: false,
    pool: { max: 20, min: 2, acquire: 30000, idle: 10000 }
  });
}

const sequelize = buildSequelize();
const models = require('./models')(sequelize, DataTypes);

module.exports = {
  sequelize,
  ...models
};
