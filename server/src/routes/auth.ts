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

// GET /api/v1/auth/profile
router.get('/profile', authenticate, async (req, res) => {
  const { User } = await import('@/models/User');
  const user = await User.findById(req.user!.userId);
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }
  res.json({
    success: true,
    data: {
      id: user._id,
      _id: user._id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      profilePhoto: user.profilePhoto,
      createdAt: user.createdAt,
    },
  });
});

// PATCH /api/v1/auth/profile
router.patch('/profile', authenticate, async (req, res) => {
  const { User } = await import('@/models/User');
  const { name, email, profilePhoto } = req.body;
  const updates: Record<string, unknown> = {};

  if (name && typeof name === 'string') updates.name = name.trim();
  if (email !== undefined) updates.email = email ? String(email).trim() : '';
  if (profilePhoto !== undefined) updates.profilePhoto = profilePhoto;

  const user = await User.findByIdAndUpdate(req.user!.userId, updates, { new: true });
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      id: user._id,
      _id: user._id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      profilePhoto: user.profilePhoto,
    },
  });
});

// POST /api/v1/auth/upload-photo
router.post('/upload-photo', authenticate, async (req, res, next) => {
  const { profilePhotoUpload } = await import('@/middlewares/upload');
  profilePhotoUpload.single('photo')(req, res, async (err: any) => {
    if (err) return next(err);
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No image file uploaded' });
      return;
    }

    const photoUrl = `/uploads/profiles/${req.file.filename}`;
    const { User } = await import('@/models/User');
    const user = await User.findByIdAndUpdate(
      req.user!.userId,
      { profilePhoto: photoUrl },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      data: {
        photoUrl,
        user: user
          ? {
              id: user._id,
              _id: user._id,
              name: user.name,
              phone: user.phone,
              email: user.email,
              role: user.role,
              profilePhoto: user.profilePhoto,
            }
          : undefined,
      },
    });
  });
});

export default router;
