import { validationResult } from 'express-validator';
import { sendError } from '../utils/response.js';

export const handleValidation = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next({ statusCode: 422, message: errors.array()[0].msg });
  }
  return next();
};

export const errorHandler = (error, _req, res, _next) => {
  const status = error.statusCode || 500;
  return sendError(res, error.message || 'Internal server error', status);
};
