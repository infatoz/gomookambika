import { Router } from 'express';
import { authController } from '@/controllers/AuthController';
import { authenticate } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { otpRateLimiter } from '@/middlewares/rateLimiter';
import {
  requestOTPSchema,
  verifyOTPSchema,
  adminLoginSchema,
} from '@gomookambika/validation';
import { z } from 'zod';

const router = Router();

// Primary routes
router.post('/request-otp', otpRateLimiter, validate(requestOTPSchema), authController.requestOTP.bind(authController));
router.post('/verify-otp', validate(verifyOTPSchema), authController.verifyOTP.bind(authController));

// Alias routes used by customer-pwa and driver-pwa
router.post('/otp/request', otpRateLimiter, validate(requestOTPSchema), authController.requestOTP.bind(authController));
router.post('/otp/verify', validate(verifyOTPSchema), authController.verifyOTP.bind(authController));

router.post('/admin/login', validate(adminLoginSchema), authController.adminLogin.bind(authController));
router.post('/refresh', validate(z.object({ refreshToken: z.string() })), authController.refreshToken.bind(authController));
router.post('/logout', authenticate, validate(z.object({ refreshToken: z.string() })), authController.logout.bind(authController));
router.get('/me', authenticate, authController.me.bind(authController));

export default router;
