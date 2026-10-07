import { Request, Response } from 'express';
import { authService } from '@/services/AuthService';
import { OTPPurpose } from '@gomookambika/types';

export class AuthController {
  // POST /api/v1/auth/request-otp
  async requestOTP(req: Request, res: Response): Promise<void> {
    const { phone, purpose = OTPPurpose.LOGIN } = req.body;
    await authService.requestOTP(phone, purpose, req.ip ?? '');
    res.json({ success: true, message: 'OTP sent successfully' });
  }

  // POST /api/v1/auth/verify-otp
  async verifyOTP(req: Request, res: Response): Promise<void> {
    const { phone, otp, purpose = OTPPurpose.LOGIN } = req.body;
    const result = await authService.verifyOTP(phone, otp, purpose, req.ip ?? '');
    res.json({
      success: true,
      message: result.isNewUser ? 'Welcome to Go Mookambika!' : 'Login successful',
      data: result,
    });
  }

  // POST /api/v1/auth/admin/login
  async adminLogin(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;
    const result = await authService.adminLogin(email, password);
    res.json({ success: true, message: 'Login successful', data: result });
  }

  // POST /api/v1/auth/refresh
  async refreshToken(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshTokens(refreshToken);
    res.json({ success: true, message: 'Tokens refreshed', data: { tokens } });
  }

  // POST /api/v1/auth/logout
  async logout(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;
    if (req.user) {
      await authService.logout(req.user.userId, refreshToken);
    }
    res.json({ success: true, message: 'Logged out successfully' });
  }

  // GET /api/v1/auth/me
  async me(req: Request, res: Response): Promise<void> {
    res.json({ success: true, data: { user: req.user } });
  }
}

export const authController = new AuthController();
