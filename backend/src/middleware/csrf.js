import crypto from 'crypto';
import { AppError } from '../utils/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const csrfMiddleware = (req, res, next) => {
  if (!req.session) {
    return next(new AppError('Session unavailable', 500));
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }

  res.setHeader('x-csrf-token', req.session.csrfToken);

  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const token = req.get('x-csrf-token');
  if (!token || token !== req.session.csrfToken) {
    return next(new AppError('Invalid CSRF token', 403));
  }

  return next();
};
