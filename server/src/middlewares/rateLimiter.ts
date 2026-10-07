import rateLimit from 'express-rate-limit';
import { config } from '@/config/env';

export const rateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
  skip: req => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

export const otpRateLimiter = rateLimit({
  windowMs: config.OTP_RATE_LIMIT_WINDOW_MS,
  max: config.OTP_RATE_LIMIT_MAX_REQUESTS,
  keyGenerator: req => req.ip ?? 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests. Please wait before requesting again.',
    error: {
      code: 'OTP_RATE_LIMIT_EXCEEDED',
    },
  },
});
