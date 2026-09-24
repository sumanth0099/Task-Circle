import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import passport from './config/passport.js';
import { env } from './config/env.js';
import { redisClient } from './db/redis.js';
import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import circleRoutes from './routes/circleRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import myTaskRoutes from './routes/myTaskRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { csrfMiddleware } from './middleware/csrf.js';
import { sendSuccess } from './utils/response.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust first proxy — required for Render (behind a load balancer)
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],   // Vite inlines a small bootstrap chunk
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      // Allow Google avatars (OAuth profile pictures)
      imgSrc: ["'self'", 'data:', 'https://lh3.googleusercontent.com', 'https://lh4.googleusercontent.com', 'https://lh5.googleusercontent.com', 'https://lh6.googleusercontent.com'],
      // Allow WebSocket connections to same host (wss: in prod, ws: in dev)
      connectSrc: ["'self'", 'wss:', 'ws:', 'https://api.groq.com'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));

// Safely handle missing FRONTEND_URL so the server still starts without env vars set
const allowedOrigins = (env.frontendUrl || '').split(',').map((origin) => origin.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin denied'));
  },
  credentials: true,
  exposedHeaders: ['x-csrf-token']
}));

app.use(express.json({ limit: '1mb' }));

// ─── Serve frontend static files FIRST (before session/auth/CSRF) ────────────
// This ensures CSS/JS/images are never blocked by auth middleware or Redis errors.
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// ─── Global rate limit ───────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: 'draft-8',
  skip: (req) => req.path === '/health'
}));

const sessionStore = new RedisStore({
  client: redisClient,
  prefix: 'taskcircle:'
});

export const sessionMiddleware = session({
  store: sessionStore,
  name: 'taskcircle.sid',
  // Fallback secret prevents express-session from throwing when SESSION_SECRET isn't set yet
  secret: env.sessionSecret || 'temporary-insecure-secret-set-SESSION_SECRET-env-var',
  saveUninitialized: false,
  resave: false,
  cookie: {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
});

// Exported so the WebSocket server can reuse session+passport for WS auth
export const passportSession = passport.session();

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passportSession);
app.use(csrfMiddleware);

// Health check endpoint (Render uses this to verify service is up)
app.get('/health', (_req, res) => {
  sendSuccess(res, { status: 'ok', timestamp: new Date().toISOString() }, 'TaskCircle backend is healthy');
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/circles', circleRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/my-tasks', myTaskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);

import fs from 'fs';

// SPA catch-all: return index.html for any unmatched route (React Router handles it)
app.get(/\/.*/, (req, res) => {
  const indexPath = path.join(publicPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend not built or public folder is empty. Run npm run build.');
  }
});

app.use(errorHandler);

export default app;
