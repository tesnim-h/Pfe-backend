require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const seedHelper = require('./src/utils/seed.helper');
const initSockets = require('./src/sockets');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    const autoSeedEnabled = process.env.AUTO_SEED_ON_STARTUP !== 'false';
    const autoSeedAllowed = autoSeedEnabled &&
      (process.env.NODE_ENV !== 'production' || process.env.AUTO_SEED_ON_STARTUP === 'true');

    if (autoSeedAllowed) {
      const shouldSeed = await seedHelper.shouldSeedDatabase();
      if (shouldSeed) {
        console.log('Database is empty. Running initial demo seed...');
        await seedHelper.seedDatabase({ reset: false, logger: console });
      }
    }

    const server = http.createServer(app);
    initSockets(server);

    server.listen(PORT, () => {
      console.log(` Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    });
  } catch (error) {
    console.error(' Failed to start server:', error);
    process.exit(1);
  }
};

startServer();