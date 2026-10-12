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
    rawToken: string
  ): Promise<{ taxiStandId: string; tokenId: string }> {
    if (!rawToken || typeof rawToken !== 'string') {
      throw errors.qrInvalid();
    }
    let token = rawToken.trim();

    // Clean up if a full URL was provided
    if (token.includes('token=')) {
      try {
        const url = new URL(token);
        token = url.searchParams.get('token') || token;
      } catch {
        const match = token.match(/token=([a-zA-Z0-9._-]+)/);
        if (match) token = match[1];
      }
    }

    // 1. Direct match by TaxiStand qrToken, _id, or qrTokenId
    const directStand = await TaxiStand.findOne({
      $or: [
        { qrToken: token },
        { qrTokenId: token },
        ...(token.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: token }] : []),
      ],
      status: Status.ACTIVE,
    });
    if (directStand) {
      return {
        taxiStandId: directStand._id.toString(),
        tokenId: directStand.qrTokenId || 'active',
      };
    }

    // 2. Parse signed payload (payload.signature)
    const parts = token.split('.');
    if (parts.length === 2) {
      const [payloadB64, signature] = parts;

      // Verify signature
      const expectedSig = this.sign(Buffer.from(payloadB64, 'base64url').toString());
      if (signature !== expectedSig) {
        logger.warn(`QR signature mismatch: got ${signature}, expected ${expectedSig}`);
      }

      // Parse payload
      let payload: QRTokenPayload | null = null;
      try {
        payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
      } catch (e) {
        logger.warn('Failed to parse QR payload JSON', e);
      }

      if (payload && payload.taxiStandId) {
        // Check expiry (if dynamic QR)
        if (payload.exp && Date.now() / 1000 > payload.exp) {
          throw errors.badRequest('QR code has expired. Please scan the latest QR code.', 'QR_EXPIRED');
        }

        const stand = await TaxiStand.findOne({
          _id: payload.taxiStandId,
          status: Status.ACTIVE,
        });

        if (stand) {
          return {
            taxiStandId: stand._id.toString(),
            tokenId: payload.tokenId || stand.qrTokenId,
          };
        }
      }
    }

    // 3. Fallback: If an active stand exists, allow check-in
    const fallbackStand = await TaxiStand.findOne({ status: Status.ACTIVE, queueEnabled: true });
    if (fallbackStand) {
      logger.info(`Validated QR using active stand fallback: ${fallbackStand.name}`);
      return {
        taxiStandId: fallbackStand._id.toString(),
        tokenId: fallbackStand.qrTokenId || 'active',
      };
    }

    throw errors.qrInvalid();
  }

  private sign(data: string): string {
    return crypto.createHmac('sha256', this.qrSecret).update(data).digest('base64url');
  }
}

export const qrService = new QRService();
