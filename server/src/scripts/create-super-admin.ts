/**
 * CREATE / RESET SUPER ADMIN USER
 *
 * Usage:
 *   npx tsx src/scripts/create-super-admin.ts [email] [password] [name] [phone]
 *
 * Default:
 *   Email    : admin@gomookambika.com
 *   Password : Admin@123
 *   Name     : Super Admin
 *   Phone    : 9999999999
 */
import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';

// Load .env from root and server
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import argon2 from 'argon2';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gomookambika';

const SUPER_ADMIN_PERMISSIONS = [
  'MANAGE_DRIVERS',
  'MANAGE_VEHICLES',
  'MANAGE_LOCATIONS',
  'MANAGE_FARES',
  'MANAGE_BOOKINGS',
  'MANAGE_USERS',
  'VIEW_AUDIT_LOGS',
  'SYSTEM_CONFIG',
];

async function main() {
  const args = process.argv.slice(2);
  const email = (args[0] || process.env.ADMIN_EMAIL || 'admin@gomookambika.com').trim().toLowerCase();
  const password = args[1] || process.env.ADMIN_PASSWORD || 'Admin@123';
  const name = args[2] || 'Super Admin';
  const phone = args[3] || '9999999999';

  console.log('\n=========================================');
  console.log('   Go Mookambika — Super Admin Setup     ');
  console.log('=========================================\n');
  console.log(`Connecting to database: ${MONGO_URI}...`);

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;
  const usersCol = db.collection('users');

  console.log(`Hashing password with Argon2id...`);
  const passwordHash = await argon2.hash(password, {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const existing = await usersCol.findOne({ email });

  if (!existing) {
    const result = await usersCol.insertOne({
      name,
      email,
      phone,
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      permissions: SUPER_ADMIN_PERMISSIONS,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`\n✅ Super Admin created successfully! (ID: ${result.insertedId})`);
  } else {
    await usersCol.updateOne(
      { _id: existing._id },
      {
        $set: {
          name: existing.name || name,
          email,
          phone: existing.phone || phone,
          passwordHash,
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
          permissions: SUPER_ADMIN_PERMISSIONS,
          updatedAt: new Date(),
        },
      }
    );
    console.log(`\n✅ Existing user updated to Super Admin! (ID: ${existing._id})`);
  }

  console.log('\n-----------------------------------------');
  console.log('  LOGIN CREDENTIALS:');
  console.log(`  Portal URL : http://admin.gomookambika.infatoz.com`);
  console.log(`  Local URL  : http://localhost:3000/login`);
  console.log(`  Email      : ${email}`);
  console.log(`  Password   : ${password}`);
  console.log(`  Role       : SUPER_ADMIN`);
  console.log(`  Status     : ACTIVE`);
  console.log('-----------------------------------------\n');

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(err => {
  console.error('\n❌ Failed to setup Super Admin:', err);
  process.exit(1);
});
