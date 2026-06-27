const { sequelize } = require('../src/infrastructure/orm/database');

async function main() {
  await sequelize.drop();
  await sequelize.sync();
  console.log('Database reset complete. Run npm run seed to load demo data.');
  await sequelize.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
