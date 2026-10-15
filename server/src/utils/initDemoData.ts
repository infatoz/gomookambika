import { logger } from './logger';
import { User } from '@/models/User';
import { UserRole, UserStatus } from '@gomookambika/types';
import argon2 from 'argon2';

/**
 * Ensures the primary Super Admin account exists in the system.
 * Zero dummy drivers, vehicles, locations, or demo rides are seeded.
 */
export async function ensureDefaultDemoData(): Promise<void> {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@gomookambika.com').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    const existingAdmin = await User.findOne({ email: adminEmail }).select('+passwordHash');

    if (!existingAdmin) {
      const passwordHash = await argon2.hash(adminPassword, {
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
      await User.create({
        name: 'Super Admin',
        email: adminEmail,
        phone: '9999999999',
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        permissions: [
          'MANAGE_DRIVERS',
          'MANAGE_VEHICLES',
          'MANAGE_LOCATIONS',
          'MANAGE_FARES',
          'MANAGE_BOOKINGS',
          'MANAGE_USERS',
          'VIEW_AUDIT_LOGS',
          'SYSTEM_CONFIG',
        ],
      });
      logger.info(`✅ Super Admin account ensured (${adminEmail})`);
    } else {
      let updated = false;
      if (existingAdmin.role !== UserRole.SUPER_ADMIN) {
        existingAdmin.role = UserRole.SUPER_ADMIN;
        updated = true;
      }
      if (existingAdmin.status !== UserStatus.ACTIVE) {
        existingAdmin.status = UserStatus.ACTIVE;
        updated = true;
      }
      if (!existingAdmin.passwordHash) {
        existingAdmin.passwordHash = await argon2.hash(adminPassword, {
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 4,
        });
        updated = true;
      }
      if (updated) {
        await existingAdmin.save();
        logger.info(`✅ Super Admin synchronized (${adminEmail})`);
      }
    }
  } catch (err) {
    logger.warn('Failed to ensure Super Admin on startup:', err);
  }
}
