/**
 * SETUP SCRIPT — run this once after a fresh clone or when you need to reset.
 * - Clears all operational data (drivers, vehicles, locations, etc.)
 * - Ensures admin user exists with SUPER_ADMIN role
 * - Admin login: admin@gomookambika.com / Admin@123
 *
 * Run: npx tsx src/scripts/setup.ts
 */
import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';

// Load from multiple possible locations
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import argon2 from 'argon2';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gomookambika';

async function setup() {
  console.log('\n=== Go Mookambika — Setup ===\n');
  console.log('Connecting to:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;
  console.log('Connected.\n');

  // ─── CLEAR OPERATIONAL DATA ───────────────────────────────────
  const toClear = [
    'drivers', 'vehicles', 'vehiclecategories', 'locations', 'taxistands',
    'bookings', 'trips', 'queues', 'queueentries', 'pricingrules',
    'additionalcharges', 'payments', 'auditlogs', 'notifications', 'otps',
    'refreshtokens',
  ];

  console.log('Clearing operational collections...');
  for (const col of toClear) {
    try {
      const r = await db.collection(col).deleteMany({});
      if (r.deletedCount > 0) console.log(`  Cleared ${col}: ${r.deletedCount}`);
    } catch { /* collection may not exist yet */ }
  }

  // ─── ENSURE ADMIN USER ────────────────────────────────────────
  const usersCol = db.collection('users');

  // Remove any non-admin users
  const removed = await usersCol.deleteMany({ role: { $nin: ['SUPER_ADMIN', 'ADMIN'] } });
  if (removed.deletedCount > 0) console.log(`\nRemoved ${removed.deletedCount} non-admin user(s)`);

  const ADMIN_EMAIL    = 'admin@gomookambika.com';
  const ADMIN_PASSWORD = 'Admin@123';
  const ADMIN_PHONE    = '9999999999';
  const passwordHash   = await argon2.hash(ADMIN_PASSWORD, { memoryCost: 65536, timeCost: 3, parallelism: 4 });

  const existing = await usersCol.findOne({ email: ADMIN_EMAIL });

  if (!existing) {
    await usersCol.insertOne({
      name: 'Super Admin',
      email: ADMIN_EMAIL,
      phone: ADMIN_PHONE,
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      permissions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('\n  Created admin user:');
  } else {
    // Update role and password in case it changed
    await usersCol.updateOne({ email: ADMIN_EMAIL }, {
      $set: {
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        passwordHash,
        permissions: [],
        updatedAt: new Date(),
      }
    });
    console.log('\n  Updated admin user:');
  }

  console.log('    Email   :', ADMIN_EMAIL);
  console.log('    Password:', ADMIN_PASSWORD);
  console.log('    Role    : SUPER_ADMIN');

  const adminCount = await usersCol.countDocuments({ role: { $in: ['SUPER_ADMIN', 'ADMIN'] } });
  console.log(`\n  Total admin users: ${adminCount}`);
  console.log('\n=== Setup complete ===\n');
  await mongoose.disconnect();
}

setup().catch(err => {
  console.error('\nSetup failed:', err);
  process.exit(1);
});
