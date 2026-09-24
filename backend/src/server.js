import app, { sessionMiddleware, passportSession } from './app.js';
import { env } from './config/env.js';
import { redisClient } from './db/redis.js';
import { pool } from './db/pool.js';
import { runMigrations } from './db/migrate.js';
import { startNotificationScheduler } from './services/notificationsScheduler.js';
import { initGroupChat } from './services/groupChat.js';
import passport from './config/passport.js';

// Combined session+passport parser for WebSocket upgrade requests
const wsSessionParser = (req, res, next) => {
  sessionMiddleware(req, res, () => {
    passport.initialize()(req, res, () => {
      passportSession(req, res, next);
    });
  });
};

const start = async () => {
  // Start HTTP server FIRST so static assets (CSS/JS) are always reachable,
  // even while waiting for Redis / Postgres to become available on Render.
  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`TaskCircle backend running on port ${env.port}`);
  });

  // Attach WebSocket group chat server to the same HTTP server
  initGroupChat(server, wsSessionParser);

  try {
    console.log('Connecting to Redis...');
    await redisClient.connect();
    console.log('Redis connected.');
  } catch (err) {
    console.error('Redis connection failed:', err.message);
    // Non-fatal on startup — session middleware will error on API routes,
    // but static assets will still be served correctly.
  }

  try {
    await pool.query('SELECT 1');
    console.log('Database connected.');

    console.log('Running database migrations...');
    await runMigrations();
    console.log('Database migrations completed.');

    startNotificationScheduler();
  } catch (err) {
    console.error('Database connection/migration failed:', err.message);
    // Non-fatal for static file serving; API routes will return errors until DB is up.
  }
};

start().catch((error) => {
  console.error('Unexpected startup error:', error);
  process.exit(1);
});
