import dotenv from 'dotenv';

dotenv.config();

const requiredVars = [
  'NODE_ENV',
  'DATABASE_URL',
  'REDIS_URL',
  'SESSION_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
  'FRONTEND_URL'
];

for (const variable of requiredVars) {
  if (!process.env[variable]) {
    throw new Error(`Missing required environment variable: ${variable}`);
  }
}

if (!process.env.GROQ_API_KEY) {
  console.warn('[WARN] GROQ_API_KEY is not set. The /api/chat endpoint will return an error until it is configured.');
}

const GROQ_MODEL_DEFAULT = 'openai/gpt-oss-120b';
if (process.env.GROQ_MODEL) {
  console.log(`[INFO] Using Groq model: ${process.env.GROQ_MODEL}`);
} else {
  console.log(`[INFO] GROQ_MODEL not set, using default: ${GROQ_MODEL_DEFAULT}`);
}

export const env = {
  nodeEnv: process.env.NODE_ENV,
  port: Number(process.env.PORT) || 5000,
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  sessionSecret: process.env.SESSION_SECRET,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL,
  frontendUrl: process.env.FRONTEND_URL,
  groqApiKey: process.env.GROQ_API_KEY || null,
  groqModel: process.env.GROQ_MODEL || GROQ_MODEL_DEFAULT
};

