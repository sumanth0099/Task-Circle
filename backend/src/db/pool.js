import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

const needsSsl = env.nodeEnv === 'production' || env.databaseUrl.includes('neon.tech');

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined
});
