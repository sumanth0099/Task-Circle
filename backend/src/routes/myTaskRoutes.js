import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const tasks = await pool.query(
    `SELECT t.*, c.name AS circle_name
     FROM tasks t
     JOIN circles c ON c.id = t.circle_id
     WHERE t.assigned_to = $1
     ORDER BY t.created_at DESC`,
    [req.user.id]
  );

  sendSuccess(res, tasks.rows);
}));

export default router;
