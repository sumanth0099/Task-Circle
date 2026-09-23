import { Router } from 'express';
import { body } from 'express-validator';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { handleValidation } from '../middleware/errorHandler.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

const DEFAULT_PREFS = {
  due_today_enabled: true,
  due_tomorrow_enabled: true,
  overdue_enabled: true
};

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = $1',
    [req.user.id]
  );
  sendSuccess(res, result.rows[0]);
}));

router.patch(
  '/',
  requireAuth,
  body('name').isString().trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2-120 characters'),
  handleValidation,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, name, avatar_url',
      [req.body.name, req.user.id]
    );
    sendSuccess(res, result.rows[0], 'Profile updated');
  })
);

router.get('/notification-preferences', requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT due_today_enabled, due_tomorrow_enabled, overdue_enabled FROM notification_preferences WHERE user_id = $1',
    [req.user.id]
  );

  // Return defaults if no row exists yet (new user before first preference save)
  if (!result.rowCount) {
    return sendSuccess(res, DEFAULT_PREFS);
  }

  sendSuccess(res, result.rows[0]);
}));

router.patch(
  '/notification-preferences',
  requireAuth,
  body('due_today_enabled').optional().isBoolean(),
  body('due_tomorrow_enabled').optional().isBoolean(),
  body('overdue_enabled').optional().isBoolean(),
  handleValidation,
  asyncHandler(async (req, res) => {
    // Fetch current prefs (or use defaults if none exist)
    const current = await pool.query(
      'SELECT * FROM notification_preferences WHERE user_id = $1',
      [req.user.id]
    );
    const currentPrefs = current.rowCount ? current.rows[0] : DEFAULT_PREFS;

    const merged = {
      due_today_enabled: req.body.due_today_enabled ?? currentPrefs.due_today_enabled,
      due_tomorrow_enabled: req.body.due_tomorrow_enabled ?? currentPrefs.due_tomorrow_enabled,
      overdue_enabled: req.body.overdue_enabled ?? currentPrefs.overdue_enabled
    };

    const result = await pool.query(
      `INSERT INTO notification_preferences (user_id, due_today_enabled, due_tomorrow_enabled, overdue_enabled)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         due_today_enabled = EXCLUDED.due_today_enabled,
         due_tomorrow_enabled = EXCLUDED.due_tomorrow_enabled,
         overdue_enabled = EXCLUDED.overdue_enabled,
         updated_at = NOW()
       RETURNING due_today_enabled, due_tomorrow_enabled, overdue_enabled`,
      [req.user.id, merged.due_today_enabled, merged.due_tomorrow_enabled, merged.overdue_enabled]
    );

    sendSuccess(res, result.rows[0], 'Preferences updated');
  })
);

export default router;
