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
      retryStrategy: () => null, // Do not spam retries if Redis is not running
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      connectTimeout: 2000,
    });

    client.on('connect', () => logger.info('✅ Redis connected'));
    client.on('ready', () => { redisAvailable = true; });
    client.on('error', () => { /* Handled in catch block */ });
    client.on('close', () => { redisAvailable = false; });
    client.on('end', () => { redisAvailable = false; });

    // Try to connect with a short 2-second timeout
    await Promise.race([
      client.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis connection timeout')), 2000)
      ),
    ]);

    redisClient = client;
    redisAvailable = true;
    logger.info('✅ Redis ready');
  } catch {
    logger.info('ℹ️  Redis not available — continuing without Redis (in-memory mode for OTP & queues).');
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
