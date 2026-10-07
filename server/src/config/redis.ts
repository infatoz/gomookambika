import Redis from 'ioredis';
import { config } from './env';
import { logger } from '@/utils/logger';

let redisClient: Redis | null = null;
let redisAvailable = false;

/**
 * Returns the Redis client, or null if Redis is unavailable.
 * Callers must handle the null case gracefully (fallback to MongoDB or no-op).
 */
export function getRedis(): Redis | null {
  return redisAvailable ? redisClient : null;
}

/**
 * Returns true if Redis is currently connected and ready.
 */
export function isRedisAvailable(): boolean {
  return redisAvailable;
}

export async function connectRedis(): Promise<void> {
  try {
    const client = new Redis(config.REDIS_URL, {
      keyPrefix: config.REDIS_PREFIX,
      retryStrategy: times => {
        if (times >= 3) return null; // stop retrying — server continues without Redis
        return Math.min(times * 200, 1000);
      },
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });

    client.on('connect', () => logger.info('✅ Redis connected'));
    client.on('ready', () => { redisAvailable = true; });
    client.on('error', err => logger.warn(`Redis error: ${err.message}`));
    client.on('close', () => { redisAvailable = false; logger.warn('Redis connection closed'); });
    client.on('reconnecting', () => logger.warn('Redis reconnecting...'));
    client.on('end', () => { redisAvailable = false; logger.warn('Redis connection ended'); });

    // Try to connect with a short timeout
    await Promise.race([
      client.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis connect timeout')), 3000)
      ),
    ]);

    redisClient = client;
    redisAvailable = true;
    logger.info('✅ Redis ready');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`⚠️  Redis unavailable (${msg}). Continuing without Redis — OTP will use in-memory fallback.`);
    redisClient = null;
    redisAvailable = false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit().catch(() => {});
    redisClient = null;
    redisAvailable = false;
    logger.info('Redis disconnected gracefully');
  }
}

// ─── Redis key builders ──────────────────────────────────────
export const redisKeys = {
  otp: (phone: string, purpose: string) => `otp:${phone}:${purpose}`,
  otpAttempts: (phone: string) => `otp:attempts:${phone}`,
  otpCooldown: (phone: string) => `otp:cooldown:${phone}`,
  refreshToken: (userId: string, tokenId: string) => `rt:${userId}:${tokenId}`,
  userSession: (userId: string) => `session:${userId}`,
  fareCache: (key: string) => `fare:${key}`,
  fareLock: (bookingId: string) => `fare:lock:${bookingId}`,
  queueHeartbeat: (queueEntryId: string) => `queue:hb:${queueEntryId}`,
  driverTripOffer: (driverId: string) => `trip:offer:${driverId}`,
  tripOfferTimeout: (bookingId: string) => `trip:timeout:${bookingId}`,
  driverLocation: (driverId: string) => `driver:loc:${driverId}`,
  qrToken: (tokenId: string) => `qr:${tokenId}`,
  tripStartOTP: (tripId: string) => `trip:otp:${tripId}`,
  counter: (type: string, date: string) => `counter:${type}:${date}`,
  rateLimitOTP: (ip: string) => `rl:otp:${ip}`,
};
