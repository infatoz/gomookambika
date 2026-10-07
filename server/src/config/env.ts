import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from server directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// Also try root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  API_VERSION: z.string().default('v1'),
  FRONTEND_URLS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001,http://localhost:3002')
    .transform(s => s.split(',').map(u => u.trim())),

  // Database
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required')
    .default('mongodb://localhost:27017/gomookambika'),
  MONGODB_DB_NAME: z.string().default('gomookambika'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PREFIX: z.string().default('gm:'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').default(
    'dev-jwt-secret-must-change-in-production-please'
  ),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters').default(
    'dev-refresh-secret-must-change-in-production-please'
  ),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // OTP
  OTP_PROVIDER: z.enum(['console', 'twilio', 'msg91', 'fast2sms']).default('console'),
  OTP_API_KEY: z.string().optional(),
  OTP_SENDER_ID: z.string().default('GOMOOK'),
  OTP_EXPIRY_SECONDS: z.coerce.number().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(3),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().default(60),

  // Dev OTP
  DEV_OTP_ENABLED: z
    .string()
    .default('false')
    .transform(v => v === 'true'),
  DEV_OTP: z.string().default('123456'),

  // Payment
  PAYMENT_PROVIDER: z.enum(['razorpay', 'stripe', 'cash_only']).default('cash_only'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // Maps
  MAP_PROVIDER: z.string().default('osm'),
  GEOCODING_PROVIDER: z.enum(['nominatim']).default('nominatim'),
  GEOCODING_BASE_URL: z.string().default('https://nominatim.openstreetmap.org'),
  GEOCODING_USER_AGENT: z.string().default('GoMookambika/1.0 (contact@gomookambika.com)'),
  ROUTING_PROVIDER: z.enum(['osrm']).default('osrm'),
  ROUTING_BASE_URL: z.string().default('https://router.project-osrm.org'),

  // FCM
  FCM_PROJECT_ID: z.string().optional(),
  FCM_CLIENT_EMAIL: z.string().optional(),
  FCM_PRIVATE_KEY: z.string().optional(),

  // Storage
  STORAGE_PROVIDER: z.enum(['local', 's3', 'cloudinary']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./uploads'),

  // Queue Configuration
  QUEUE_QR_EXPIRY_SECONDS: z.coerce.number().default(0),
  QUEUE_RADIUS_METERS: z.coerce.number().default(100),
  QUEUE_HEARTBEAT_SECONDS: z.coerce.number().default(30),
  QUEUE_GRACE_PERIOD_SECONDS: z.coerce.number().default(120),
  QUEUE_MAX_MISSED_HEARTBEATS: z.coerce.number().default(3),
  QUEUE_DEFAULT_POLICY: z
    .enum(['FIFO', 'VEHICLE_CATEGORY_FIFO', 'NEAREST_ELIGIBLE', 'MANUAL_ASSIGNMENT'])
    .default('FIFO'),

  // Dispatch Configuration
  DRIVER_TRIP_ACCEPT_TIMEOUT_SECONDS: z.coerce.number().default(30),
  DRIVER_MAX_DECLINE_COUNT: z.coerce.number().default(3),
  DRIVER_DECLINE_POLICY: z
    .enum(['KEEP_POSITION', 'MOVE_TO_END', 'TEMPORARY_PAUSE', 'SUSPEND_AFTER_REPEATED_DECLINE'])
    .default('MOVE_TO_END'),
  DRIVER_PAUSE_DURATION_MINUTES: z.coerce.number().default(30),

  // ID Prefixes
  BOOKING_ID_PREFIX: z.string().default('GM'),
  TRIP_ID_PREFIX: z.string().default('TRIP'),
  PAYMENT_ID_PREFIX: z.string().default('PAY-GM'),

  // Security
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  OTP_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(3600000),
  OTP_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(5),
  BCRYPT_ROUNDS: z.coerce.number().default(12),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('debug'),

  // Swagger
  SWAGGER_ENABLED: z
    .string()
    .default('true')
    .transform(v => v === 'true'),
});

type EnvConfig = z.infer<typeof envSchema>;

function validateConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment configuration:');
    result.error.issues.forEach(issue => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }

  // Production safety checks
  if (result.data.NODE_ENV === 'production') {
    if (result.data.DEV_OTP_ENABLED) {
      console.error('❌ DEV_OTP_ENABLED must not be true in production!');
      process.exit(1);
    }
    if (result.data.JWT_SECRET.startsWith('dev-')) {
      console.error('❌ You must set a strong JWT_SECRET in production!');
      process.exit(1);
    }
  }

  return result.data;
}

export const config = validateConfig();
export type { EnvConfig };
