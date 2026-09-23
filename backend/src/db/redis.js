import { createClient } from 'redis';
import { env } from '../config/env.js';

export const redisClient = createClient({ url: env.redisUrl });

redisClient.on('error', (error) => {
  console.error('Redis client error:', error);
});
