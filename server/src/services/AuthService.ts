import crypto from 'crypto';
import argon2 from 'argon2';
import { config } from '@/config/env';
import { getRedis, redisKeys } from '@/config/redis';
import { User } from '@/models/User';
import { OTPRecord } from '@/models/OTPRecord';
import { Driver } from '@/models/Driver';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  JWTPayload,
} from '@/middlewares/auth';
import { errors, AppError } from '@/middlewares/errorHandler';
import { logger } from '@/utils/logger';
import { UserRole, UserStatus, OTPPurpose } from '@gomookambika/types';
import type { IOTPProvider } from '@/providers/otp/IOTPProvider';
import { OTPProviderFactory } from '@/providers/otp/OTPProviderFactory';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResult {
  user: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    role: UserRole;
    profilePhoto?: string;
  };
  tokens: AuthTokens;
  isNewUser: boolean;
}

export class AuthService {
  private otpProvider: IOTPProvider;

  constructor() {
    this.otpProvider = OTPProviderFactory.create(config.OTP_PROVIDER);
  }

  // ─── OTP ─────────────────────────────────────────────────────

  async requestOTP(phone: string, purpose: OTPPurpose, ipAddress: string): Promise<void> {
    const redis = getRedis();

    // Check resend cooldown (Redis-backed, skipped if Redis unavailable)
    if (redis) {
      const cooldownKey = redisKeys.otpCooldown(phone);
      const cooldown = await redis.get(cooldownKey);
      if (cooldown) {
        const ttl = await redis.ttl(cooldownKey);
        throw errors.badRequest(
          `Please wait ${ttl} seconds before requesting another OTP`,
          'OTP_COOLDOWN',
          { retryAfterSeconds: ttl }
        );
      }
    }

    const otp = this.generateOTP();
    const otpHash = await argon2.hash(otp);

    // Invalidate any previous OTP for this phone+purpose
    await OTPRecord.updateMany(
      { phone, purpose, usedAt: null },
      { $set: { expiresAt: new Date(0) } }
    );

    // Store new OTP record in MongoDB
    await OTPRecord.create({
      phone,
      otpHash,
      purpose,
      attempts: 0,
      expiresAt: new Date(Date.now() + config.OTP_EXPIRY_SECONDS * 1000),
      ipAddress,
    });

    // Set resend cooldown in Redis (best-effort)
    if (redis) {
      await redis.setex(redisKeys.otpCooldown(phone), config.OTP_RESEND_COOLDOWN_SECONDS, '1').catch(() => {});
    }

    // Send OTP
    if (config.NODE_ENV !== 'production' && config.DEV_OTP_ENABLED) {
      logger.info(`[DEV OTP] Phone: ${phone} OTP: ${otp} Purpose: ${purpose}`);
    } else {
      await this.otpProvider.sendOTP(phone, otp);
    }

    logger.info(`OTP sent to ${phone} for purpose ${purpose}`);
  }

  async verifyOTP(
    phone: string,
    otp: string,
    purpose: OTPPurpose,
    ipAddress: string
  ): Promise<AuthResult> {
    // Use dev OTP in development
    if (config.NODE_ENV !== 'production' && config.DEV_OTP_ENABLED && otp === config.DEV_OTP) {
      return this.loginOrRegister(phone, purpose);
    }

    const record = await OTPRecord.findOne({
      phone,
      purpose,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    }).select('+otpHash');

    if (!record) {
      throw errors.badRequest('OTP has expired or is invalid', 'OTP_INVALID');
    }

    // Increment attempts before verification
    record.attempts += 1;
    await record.save();

    if (record.attempts > config.OTP_MAX_ATTEMPTS) {
      throw errors.badRequest(
        'Too many incorrect OTP attempts. Please request a new OTP.',
        'OTP_MAX_ATTEMPTS_EXCEEDED'
      );
    }

    const isValid = await argon2.verify(record.otpHash, otp);
    if (!isValid) {
      const remaining = config.OTP_MAX_ATTEMPTS - record.attempts;
      throw errors.badRequest(
        `Invalid OTP. ${remaining} attempt(s) remaining.`,
        'OTP_INCORRECT',
        { remainingAttempts: remaining }
      );
    }

    // Mark OTP as used
    record.usedAt = new Date();
    await record.save();

    return this.loginOrRegister(phone, purpose);
  }

  private async loginOrRegister(phone: string, purpose: OTPPurpose): Promise<AuthResult> {
    let isNewUser = false;

    let user = await User.findOne({ phone });

    if (!user) {
      if (purpose !== OTPPurpose.LOGIN) {
        throw errors.notFound('User');
      }

      // Auto-register new customer
      user = await User.create({
        phone,
        name: `User ${phone.slice(-4)}`, // Temporary name, user can update
        role: UserRole.CUSTOMER,
        permissions: [],
        status: UserStatus.ACTIVE,
      });
      isNewUser = true;
      logger.info(`New user registered: ${phone}`);
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw errors.forbidden('Your account has been suspended. Please contact support.');
    }

    if (user.status === UserStatus.INACTIVE) {
      throw errors.forbidden('Your account is inactive. Please contact support.');
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const tokens = await this.generateTokens(user.id, user.role, user.permissions);

    return {
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        profilePhoto: user.profilePhoto,
      },
      tokens,
      isNewUser,
    };
  }

  // ─── ADMIN LOGIN ─────────────────────────────────────────────

  async adminLogin(email: string, password: string): Promise<AuthResult> {
    const user = await User.findOne({
      email: email.toLowerCase(),
      role: {
        $in: [
          UserRole.SUPER_ADMIN,
          UserRole.ASSOCIATION_ADMIN,
          UserRole.OPERATIONS_MANAGER,
          UserRole.BOOKING_MANAGER,
          UserRole.QUEUE_MANAGER,
          UserRole.FINANCE_MANAGER,
          UserRole.SUPPORT_AGENT,
          UserRole.REPORT_VIEWER,
        ],
      },
    }).select('+passwordHash');

    if (!user || !user.passwordHash) {
      // Use constant-time comparison to prevent timing attacks
      await argon2.hash('dummy-password-to-prevent-timing-attack');
      throw errors.unauthorized('Invalid email or password');
    }

    const isValid = await argon2.verify(user.passwordHash, password);
    if (!isValid) {
      throw errors.unauthorized('Invalid email or password');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw errors.forbidden('Account is not active');
    }

    user.lastLogin = new Date();
    await user.save();

    const tokens = await this.generateTokens(user.id, user.role, user.permissions);

    return {
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        profilePhoto: user.profilePhoto,
      },
      tokens,
      isNewUser: false,
    };
  }

  // ─── TOKEN MANAGEMENT ────────────────────────────────────────

  private async generateTokens(
    userId: string,
    role: UserRole,
    permissions: string[]
  ): Promise<AuthTokens> {
    const user = await User.findById(userId);
    if (!user) throw errors.notFound('User');

    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId,
      phone: user.phone,
      email: user.email,
      role,
      permissions,
    };

    const accessToken = generateAccessToken(payload);
    const tokenId = crypto.randomUUID();
    const refreshToken = generateRefreshToken({ userId, tokenId });

    // Store refresh token hash in Redis (best-effort — skip if Redis unavailable)
    const redis = getRedis();
    if (redis) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const sevenDaysInSeconds = 7 * 24 * 60 * 60;
      await redis.setex(
        redisKeys.refreshToken(userId, tokenId),
        sevenDaysInSeconds,
        tokenHash
      ).catch(() => {});
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60,
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const payload = verifyRefreshToken(refreshToken);
    const redis = getRedis();

    // Verify token hash in Redis if available (prevents replay attacks)
    if (redis) {
      const storedHash = await redis.get(redisKeys.refreshToken(payload.userId, payload.tokenId)).catch(() => null);
      if (storedHash !== null) {
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        if (storedHash !== tokenHash) {
          await this.revokeAllTokens(payload.userId);
          throw errors.unauthorized('Invalid refresh token — all sessions have been terminated');
        }
        // Revoke old token (rotation)
        await redis.del(redisKeys.refreshToken(payload.userId, payload.tokenId)).catch(() => {});
      }
    }

    const user = await User.findById(payload.userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw errors.unauthorized('User account is not active');
    }

    return this.generateTokens(payload.userId, user.role, user.permissions);
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    try {
      const payload = verifyRefreshToken(refreshToken);
      const redis = getRedis();
      if (redis) {
        await redis.del(redisKeys.refreshToken(userId, payload.tokenId)).catch(() => {});
      }
    } catch {
      // Token may already be invalid — that's fine for logout
    }
  }

  async revokeAllTokens(userId: string): Promise<void> {
    const redis = getRedis();
    if (redis) {
      const pattern = redisKeys.refreshToken(userId, '*');
      const keys = await redis.keys(pattern).catch(() => [] as string[]);
      if (keys.length > 0) {
        await redis.del(...keys).catch(() => {});
      }
    }
    logger.info(`All tokens revoked for user ${userId}`);
  }

  // ─── HELPERS ─────────────────────────────────────────────────

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });
  }
}

export const authService = new AuthService();
