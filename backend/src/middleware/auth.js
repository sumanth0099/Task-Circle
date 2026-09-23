import { AppError } from '../utils/errors.js';
import { pool } from '../db/pool.js';

export const requireAuth = (req, _res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return next(new AppError('Authentication required', 401));
  }
  return next();
};

export const requireCircleRole = (allowedRoles = []) => async (req, _res, next) => {
  const userId = req.user?.id;
  const circleId = Number(req.params.circleId || req.body.circleId);

  if (!userId || Number.isNaN(circleId)) {
    return next(new AppError('Invalid authorization context', 400));
  }

  const result = await pool.query(
    `SELECT role
     FROM memberships
     WHERE user_id = $1 AND circle_id = $2 AND status = 'ACTIVE'`,
    [userId, circleId]
  );

  if (result.rowCount === 0) {
    return next(new AppError('Circle access denied', 403));
  }

  if (allowedRoles.length && !allowedRoles.includes(result.rows[0].role)) {
    return next(new AppError('Insufficient permissions', 403));
  }

  return next();
};
