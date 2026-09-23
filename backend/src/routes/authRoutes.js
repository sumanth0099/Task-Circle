import { Router } from 'express';
import passport from '../config/passport.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/api/auth/failed' }),
  (req, res) => {
    const frontendOrigin = env.frontendUrl.split(',').map((origin) => origin.trim())[0];
    res.redirect(`${frontendOrigin}/app`);
  }
);

router.get('/failed', (_req, res) => {
  res.status(401).json({ success: false, message: 'Authentication failed' });
});

router.get('/me', requireAuth, (req, res) => {
  sendSuccess(res, { user: req.user, csrfToken: req.session.csrfToken });
});

router.get('/csrf', (_req, res) => {
  sendSuccess(res, { csrfToken: res.getHeader('x-csrf-token') });
});

router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  await new Promise((resolve, reject) => {
    req.logout((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  if (!req.session) {
    res.clearCookie('taskcircle.sid');
    sendSuccess(res, null, 'Logged out');
    return;
  }

  await new Promise((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  res.clearCookie('taskcircle.sid');
  sendSuccess(res, null, 'Logged out');
}));

export default router;
