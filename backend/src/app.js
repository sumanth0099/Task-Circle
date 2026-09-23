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

app.use(helmet());

const allowedOrigins = env.frontendUrl.split(',').map((origin) => origin.trim());

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

// Global rate limit
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

app.use(session({
  store: sessionStore,
  name: 'taskcircle.sid',
  secret: env.sessionSecret,
  saveUninitialized: false,
  resave: false,
  cookie: {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
}));

app.use(passport.initialize());
app.use(passport.session());
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

// Serve frontend static files in production
if (env.nodeEnv === 'production') {
  const publicPath = path.join(__dirname, '../public');
  app.use(express.static(publicPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

app.use(errorHandler);

export default app;
