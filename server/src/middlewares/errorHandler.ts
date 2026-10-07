import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '@/utils/logger';
import { config } from '@/config/env';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    details?: Record<string, unknown>,
    isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error factories
export const errors = {
  notFound: (resource = 'Resource') =>
    new AppError(`${resource} not found`, 404, 'NOT_FOUND'),

  unauthorized: (message = 'Unauthorized') =>
    new AppError(message, 401, 'UNAUTHORIZED'),

  forbidden: (message = 'Forbidden') =>
    new AppError(message, 403, 'FORBIDDEN'),

  badRequest: (message: string, code = 'BAD_REQUEST', details?: Record<string, unknown>) =>
    new AppError(message, 400, code, details),

  conflict: (message: string, code = 'CONFLICT') =>
    new AppError(message, 409, code),

  tooManyRequests: (message = 'Too many requests') =>
    new AppError(message, 429, 'RATE_LIMIT_EXCEEDED'),

  validation: (details: Record<string, unknown>) =>
    new AppError('Validation failed', 422, 'VALIDATION_ERROR', details),

  // Domain-specific
  driverOutsideRadius: () =>
    new AppError(
      'Driver is outside the queue location radius',
      400,
      'DRIVER_OUTSIDE_QUEUE_RADIUS'
    ),

  qrInvalid: () =>
    new AppError('QR code is invalid or expired', 400, 'QR_INVALID'),

  driverAlreadyInQueue: () =>
    new AppError('Driver is already in an active queue', 409, 'DRIVER_ALREADY_IN_QUEUE'),

  driverNotActive: () =>
    new AppError('Driver account is not active', 400, 'DRIVER_NOT_ACTIVE'),

  vehicleNotActive: () =>
    new AppError('Assigned vehicle is not active', 400, 'VEHICLE_NOT_ACTIVE'),
};

// Global error handler middleware
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    const details = err.errors.reduce(
      (acc, e) => {
        const key = e.path.join('.');
        acc[key] = e.message;
        return acc;
      },
      {} as Record<string, string>
    );

    res.status(422).json({
      success: false,
      message: 'Validation failed',
      error: {
        code: 'VALIDATION_ERROR',
        details,
      },
    });
    return;
  }

  // Known operational errors
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`[${err.code}] ${err.message}`, {
        url: req.url,
        method: req.method,
        stack: err.stack,
      });
    }

    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: {
        code: err.code,
        details: err.details,
      },
    });
    return;
  }

  // Mongoose duplicate key error
  if (String((err as NodeJS.ErrnoException & { code?: unknown }).code) === '11000') {
    const mongoErr = err as Error & { keyValue?: Record<string, unknown> };
    const field = Object.keys(mongoErr.keyValue ?? {})[0] ?? 'field';
    res.status(409).json({
      success: false,
      message: `A record with this ${field} already exists`,
      error: { code: 'DUPLICATE_KEY', details: mongoErr.keyValue },
    });
    return;
  }

  // Mongoose CastError
  if (err.name === 'CastError') {
    res.status(400).json({
      success: false,
      message: 'Invalid ID format',
      error: { code: 'INVALID_ID' },
    });
    return;
  }

  // Unknown errors — log details, hide from client in production
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    message: config.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    error: {
      code: 'INTERNAL_ERROR',
      ...(config.NODE_ENV !== 'production' && { details: { stack: err.stack } }),
    },
  });
}
