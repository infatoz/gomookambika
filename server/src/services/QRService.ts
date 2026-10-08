import crypto from 'crypto';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { config } from '@/config/env';
import { getRedis, redisKeys } from '@/config/redis';
import { TaxiStand, ITaxiStand } from '@/models/TaxiStand';
import { Location } from '@/models/Location';
import { QueueEntry } from '@/models/QueueEntry';
import { Driver } from '@/models/Driver';
import { Vehicle } from '@/models/Vehicle';
import { VehicleCategory } from '@/models/VehicleCategory';
import { errors } from '@/middlewares/errorHandler';
import { logger } from '@/utils/logger';
import { QRStatus, QueueEntryStatus, DriverStatus, VehicleStatus, Status } from '@gomookambika/types';
import type { Types } from 'mongoose';

export interface QRTokenPayload {
  taxiStandId: string;
  tokenId: string;
  iat: number;
  exp?: number;
}

export interface JoinQueueInput {
  qrToken: string;
  driverId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface JoinQueueResult {
  queueEntryId: string;
  taxiStandId: string;
  taxiStandName: string;
  position: number;
  category: string;
}

export class QRService {
  private readonly qrSecret: string;

  constructor() {
    // Use JWT secret as QR signing key (or create a dedicated one)
    this.qrSecret = config.JWT_SECRET;
  }

  // ─── QR GENERATION ───────────────────────────────────────────

  generateQRToken(taxiStandId: string): { token: string; tokenId: string; expiresAt?: Date } {
    const tokenId = uuidv4();
    const iat = Math.floor(Date.now() / 1000);
    const payload: QRTokenPayload = {
      taxiStandId,
      tokenId,
      iat,
    };

    let expiresAt: Date | undefined;

    if (config.QUEUE_QR_EXPIRY_SECONDS > 0) {
      payload.exp = iat + config.QUEUE_QR_EXPIRY_SECONDS;
      expiresAt = new Date(payload.exp * 1000);
    }

    const payloadStr = JSON.stringify(payload);
    const signature = this.sign(payloadStr);
    const token = `${Buffer.from(payloadStr).toString('base64url')}.${signature}`;

    return { token, tokenId, expiresAt };
  }

  async generateQRCode(taxiStandId: string): Promise<string> {
    const { token, tokenId, expiresAt } = this.generateQRToken(taxiStandId);

    // Update taxi stand with new QR token
    await TaxiStand.findByIdAndUpdate(taxiStandId, {
      qrToken: token,
      qrTokenId: tokenId,
      qrStatus: QRStatus.ACTIVE,
      qrExpiresAt: expiresAt,
      qrGeneratedAt: new Date(),
    });

    // Store tokenId in Redis for fast lookup (best-effort)
    if (config.QUEUE_QR_EXPIRY_SECONDS > 0) {
      const redis = getRedis();
      if (redis) {
        await redis.setex(
          redisKeys.qrToken(tokenId),
          config.QUEUE_QR_EXPIRY_SECONDS,
          taxiStandId
        ).catch(() => {});
      }
    }

    // Generate QR code data URL (for admin download/display)
    const qrDataUrl = await QRCode.toDataURL(token, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 400,
    });

    return qrDataUrl;
  }

  // ─── QR VALIDATION ───────────────────────────────────────────

  async validateQRToken(
    token: string
  ): Promise<{ taxiStandId: string; tokenId: string }> {
    if (!token || typeof token !== 'string') {
      throw errors.qrInvalid();
    }
    const parts = token.split('.');
    if (parts.length !== 2) {
      throw errors.qrInvalid();
    }

    const [payloadB64, signature] = parts;

    // Verify signature
    const expectedSig = this.sign(Buffer.from(payloadB64, 'base64url').toString());
    if (signature !== expectedSig) {
      logger.warn(`QR signature mismatch: got ${signature}, expected ${expectedSig}`);
      throw errors.qrInvalid();
    }

    // Parse payload
    let payload: QRTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    } catch (e) {
      logger.warn('Failed to parse QR payload JSON', e);
      throw errors.qrInvalid();
    }

    // Check expiry (if dynamic QR)
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      throw errors.badRequest('QR code has expired. Please scan the latest QR code.', 'QR_EXPIRED');
    }

    // Verify taxi stand has this token as active
    const stand = await TaxiStand.findOne({
      _id: payload.taxiStandId,
      qrTokenId: payload.tokenId,
      qrStatus: QRStatus.ACTIVE,
    });

    if (!stand) {
      logger.warn(`Taxi stand not found with active token: standId=${payload.taxiStandId}, tokenId=${payload.tokenId}`);
      throw errors.qrInvalid();
    }

    if (stand.status !== Status.ACTIVE || !stand.queueEnabled) {
      throw errors.badRequest(
        'This taxi stand is not currently accepting queue entries',
        'STAND_INACTIVE'
      );
    }

    return {
      taxiStandId: payload.taxiStandId,
      tokenId: payload.tokenId,
    };
  }

  private sign(data: string): string {
    return crypto.createHmac('sha256', this.qrSecret).update(data).digest('base64url');
  }
}

export const qrService = new QRService();
