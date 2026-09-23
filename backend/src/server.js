import app from './app.js';
import { env } from './config/env.js';
import { redisClient } from './db/redis.js';
import { pool } from './db/pool.js';
import { runMigrations } from './db/migrate.js';
import { startNotificationScheduler } from './services/notificationsScheduler.js';

const start = async () => {
  await redisClient.connect();
  await pool.query('SELECT 1');
  
  // Run database migrations automatically on startup
  console.log('Running database migrations...');
  await runMigrations();
  console.log('Database migrations completed.');
  
  startNotificationScheduler();

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`TaskCircle backend running on port ${env.port}`);
  });
};

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
