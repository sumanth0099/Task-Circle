import { pool } from '../db/pool.js';

const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const randomCode = () => {
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

export const generateUniqueCircleCode = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = randomCode();
    const exists = await pool.query('SELECT 1 FROM circles WHERE code = $1', [code]);
    if (exists.rowCount === 0) {
      return code;
    }
  }
  throw new Error('Unable to generate unique circle code');
};
