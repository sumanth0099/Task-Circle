import { Router } from 'express';
import { param } from 'express-validator';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { handleValidation } from '../middleware/errorHandler.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const notifications = await pool.query(
    `SELECT *
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [req.user.id]
  );
  sendSuccess(res, notifications.rows);
}));

router.get('/unread-count', requireAuth, asyncHandler(async (req, res) => {
  const count = await pool.query(
    `SELECT COUNT(*)::int AS unread_count
     FROM notifications
     WHERE user_id = $1 AND is_read = FALSE`,
    [req.user.id]
  );
  sendSuccess(res, count.rows[0]);
}));

router.patch('/:notificationId/read', requireAuth, param('notificationId').isInt(), handleValidation, asyncHandler(async (req, res) => {
  await pool.query(
    `UPDATE notifications
     SET is_read = TRUE, updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [req.params.notificationId, req.user.id]
  );
  sendSuccess(res, null, 'Notification marked as read');
}));

router.patch('/read-all', requireAuth, asyncHandler(async (req, res) => {
  await pool.query(
    `UPDATE notifications
     SET is_read = TRUE, updated_at = NOW()
     WHERE user_id = $1 AND is_read = FALSE`,
    [req.user.id]
  );
  sendSuccess(res, null, 'All notifications marked as read');
}));

export default router;
