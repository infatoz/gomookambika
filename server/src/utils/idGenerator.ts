import crypto from 'crypto';
import { getRedis, redisKeys } from '@/config/redis';
import { config } from '@/config/env';

// Human-readable sequential ID generator
// Format: GM-20261007-000001
// Uses Redis atomic increment per date when available; falls back to random suffix

async function getNextCounter(type: string): Promise<number> {
  const redis = getRedis();
  if (redis) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const key = redisKeys.counter(type, today);
    const count = await redis.incr(key);
    await redis.expire(key, 2 * 24 * 60 * 60);
    return count;
  }
  // Fallback: pseudo-random 6-digit number when Redis is unavailable
  // Not guaranteed to be sequential, but collision probability is low for small deployments
  return parseInt(crypto.randomBytes(3).toString('hex'), 16) % 900000 + 100000;
}

export async function generateBookingNumber(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(await getNextCounter('booking')).padStart(6, '0');
  return `${config.BOOKING_ID_PREFIX}-${today}-${seq}`;
}

export async function generateTripNumber(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(await getNextCounter('trip')).padStart(6, '0');
  return `${config.TRIP_ID_PREFIX}-${today}-${seq}`;
}

export async function generatePaymentNumber(): Promise<string> {
  const seq = String(await getNextCounter('payment')).padStart(6, '0');
  return `${config.PAYMENT_ID_PREFIX}-${seq}`;
}

export function generateDriverCode(count: number): string {
  return `DRV-${String(count).padStart(5, '0')}`;
}
