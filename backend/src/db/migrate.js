import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, '../../migrations');

export const runMigrations = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      executed_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  const files = (await fs.readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();

  for (const filename of files) {
    const existing = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [filename]);
    if (existing.rowCount > 0) {
      continue;
    }

    const sql = await fs.readFile(path.join(migrationsDir, filename), 'utf8');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
      await client.query('COMMIT');
      console.log(`Applied migration: ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
};

// If run directly as a script (e.g. via npm run migrate)
if (process.argv[1] === __filename) {
  runMigrations()
    .then(() => pool.end())
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
