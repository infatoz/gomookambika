import crypto from 'crypto';
import argon2 from 'argon2';
import { config } from '@/config/env';
import { getRedis, redisKeys } from '@/config/redis';
import { User } from '@/models/User';
import { OTPRecord } from '@/models/OTPRecord';
import { Driver } from '@/models/Driver';
import { Vehicle } from '@/models/Vehicle';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  JWTPayload,
} from '@/middlewares/auth';
import { errors, AppError } from '@/middlewares/errorHandler';
import { logger } from '@/utils/logger';
import { normalizePhone } from '@/utils/phone';
import { UserRole, UserStatus, OTPPurpose, DriverStatus } from '@gomookambika/types';
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

  async requestOTP(phone: string, purpose: OTPPurpose, ipAddress: string, role?: string): Promise<void> {
    const normalizedPhone = normalizePhone(phone);
    const rawDigits = phone.replace(/\D/g, '').slice(-10);

    // Requirement: Only the driver who assigned the vehicle can log into captain/driver app
    if (role === 'DRIVER') {
      const driver = await Driver.findOne({
        $or: [
          { phone: normalizedPhone },
          { phone },
          { phone: rawDigits },
          { phone: `+91${rawDigits}` },
        ],
      });

      if (!driver) {
        throw errors.forbidden(
          'This mobile number is not registered as an authorized captain. Please contact the association administrator.',
          'DRIVER_NOT_REGISTERED'
        );
      }

      const vehicle = await Vehicle.findOne({
        $or: [
          { assignedDriverId: driver._id },
          { assignedDriverId: driver.userId },
        ],
      });

      if (!vehicle) {
        throw errors.forbidden(
          'No vehicle is currently assigned to your captain account. Only drivers with an assigned vehicle can log in. Please contact the association administrator to assign a vehicle.',
          'NO_VEHICLE_ASSIGNED'
        );
      }
    }

    const redis = getRedis();

    // Check resend cooldown (Redis-backed, skipped if Redis unavailable)
    if (redis) {
      const cooldownKey = redisKeys.otpCooldown(normalizedPhone);
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
      { phone: { $in: [normalizedPhone, phone] }, purpose, usedAt: null },
      { $set: { expiresAt: new Date(0) } }
    );

    // Store new OTP record in MongoDB
    await OTPRecord.create({
      phone: normalizedPhone,
      otpHash,
      purpose,
      attempts: 0,
      expiresAt: new Date(Date.now() + config.OTP_EXPIRY_SECONDS * 1000),
      ipAddress,
    });

    // Set resend cooldown in Redis (best-effort)
    if (redis) {
      await redis.setex(redisKeys.otpCooldown(normalizedPhone), config.OTP_RESEND_COOLDOWN_SECONDS, '1').catch(() => {});
    }

    // Send OTP
    if (config.DEV_OTP_ENABLED || config.OTP_PROVIDER === 'console' || config.NODE_ENV !== 'production') {
      logger.info(`[OTP] Phone: ${normalizedPhone} OTP: ${otp} (Demo OTP 123456 is also accepted) Purpose: ${purpose}`);
    }
    if (config.OTP_PROVIDER !== 'console') {
      try {
        await this.otpProvider.sendOTP(normalizedPhone, otp);
      } catch (err) {
        logger.warn(`Failed to send SMS OTP to ${normalizedPhone} via ${config.OTP_PROVIDER}:`, err);
        // Do not throw so users can still proceed with demo OTP 123456
      }
    }

    logger.info(`OTP request processed for ${normalizedPhone} (purpose: ${purpose})`);
  }

  async verifyOTP(
    phone: string,
    otp: string,
    purpose: OTPPurpose,
    ipAddress: string,
    requestedRole?: string
  ): Promise<AuthResult> {
    const normalizedPhone = normalizePhone(phone);

    // Demo OTP: Always accept '123456' (or configured DEV_OTP) for instant login across driver & customer apps
    const isDemoOTP = otp === '123456' || (config.DEV_OTP && otp === config.DEV_OTP);
    if (isDemoOTP) {
      logger.info(`[DEMO OTP] Phone: ${normalizedPhone} verified successfully with demo OTP 123456`);
      return this.loginOrRegister(normalizedPhone, purpose, requestedRole);
    }

    const record = await OTPRecord.findOne({
      phone: { $in: [normalizedPhone, phone] },
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

    return this.loginOrRegister(normalizedPhone, purpose, requestedRole);
  }

  private async loginOrRegister(phone: string, purpose: OTPPurpose, requestedRole?: string): Promise<AuthResult> {
    let isNewUser = false;
    const normalizedPhone = normalizePhone(phone);
    const rawDigits = phone.replace(/\D/g, '').slice(-10);

    let user = await User.findOne({
      $or: [
        { phone: normalizedPhone },
        { phone },
        { phone: rawDigits },
        { phone: `+91${rawDigits}` },
      ],
    });

    // Check if there is an existing driver registered with this phone
    let driver = await Driver.findOne({
      $or: [
        { phone: normalizedPhone },
        { phone },
        { phone: rawDigits },
        { phone: `+91${rawDigits}` },
      ],
    });

    // Requirement: Only the driver who assigned the vehicle can log into captain/driver app
    if (requestedRole === 'DRIVER') {
      if (!driver) {
        throw errors.forbidden(
          'This mobile number is not registered as an authorized captain. Please contact the association administrator.',
          'DRIVER_NOT_REGISTERED'
        );
      }

      const assignedVehicle = await Vehicle.findOne({
        $or: [
          { assignedDriverId: driver._id },
          { assignedDriverId: driver.userId },
        ],
      });

      if (!assignedVehicle) {
        throw errors.forbidden(
          'No vehicle is currently assigned to your captain account. Only drivers with an assigned vehicle can log in. Please contact the association administrator to assign a vehicle.',
          'NO_VEHICLE_ASSIGNED'
        );
      }
    }

    if (driver) {
      if (user) {
        // Ensure user has DRIVER role if not admin/super-admin
        if (user.role !== UserRole.DRIVER && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ASSOCIATION_ADMIN) {
          user.role = UserRole.DRIVER;
        }
        if (driver.userId?.toString() !== user._id.toString()) {
          driver.userId = user._id;
        }
        if (driver.phone !== normalizedPhone) {
          driver.phone = normalizedPhone;
        }
        await driver.save();
      } else {
        // Driver exists in DB but User account not yet created: auto-create with DRIVER role
        user = await User.create({
          phone: normalizedPhone,
          name: driver.name,
          role: UserRole.DRIVER,
          permissions: [],
          status: UserStatus.ACTIVE,
        });
        driver.userId = user._id;
        if (driver.phone !== normalizedPhone) {
          driver.phone = normalizedPhone;
        }
        await driver.save();
      }
    }

    if (!user) {
      if (purpose !== OTPPurpose.LOGIN) {
        throw errors.notFound('User');
      }

      // Auto-register new customer
      user = await User.create({
        phone: normalizedPhone,
        name: `User ${normalizedPhone.slice(-4)}`,
        role: UserRole.CUSTOMER,
        permissions: [],
        status: UserStatus.ACTIVE,
      });
      isNewUser = true;
      logger.info(`New user registered: ${normalizedPhone}`);
    }

    if (user.phone !== normalizedPhone) {
      user.phone = normalizedPhone;
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
