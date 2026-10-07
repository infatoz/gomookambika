/**
 * DB RESET SCRIPT
 * Clears all collections EXCEPT admin users (role=SUPER_ADMIN / ADMIN).
 * Run: npx tsx src/scripts/reset-db.ts
 */
import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gomookambika';

async function reset() {
  console.log('\n⚡ Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;
  console.log('Connected:', MONGO_URI);

  // Collections to clear completely
  const toClear = [
    'drivers', 'vehicles', 'vehiclecategories', 'locations', 'taxistands',
    'bookings', 'trips', 'queues', 'queueentries', 'pricingrules',
    'additionalcharges', 'payments', 'auditlogs', 'notifications', 'otps',
  ];

  let cleared = 0;
  for (const col of toClear) {
    try {
      const result = await db.collection(col).deleteMany({});
      if (result.deletedCount > 0) {
        console.log(`  ✓ Cleared ${col}: ${result.deletedCount} docs`);
        cleared += result.deletedCount;
      } else {
        console.log(`  – ${col}: empty`);
      }
    } catch {
      console.log(`  ! ${col}: does not exist yet (OK)`);
    }
  }

  // Users: keep only SUPER_ADMIN and ADMIN accounts
  try {
    const usersCol = db.collection('users');
    const admins = await usersCol.find({ role: { $in: ['SUPER_ADMIN', 'ADMIN'] } }).toArray();
    console.log(`\n  Preserving ${admins.length} admin user(s):`);
    admins.forEach(a => console.log(`    - ${a.email} (${a.role})`));

    const del = await usersCol.deleteMany({ role: { $nin: ['SUPER_ADMIN', 'ADMIN'] } });
    if (del.deletedCount > 0) console.log(`  ✓ Removed ${del.deletedCount} non-admin user(s)`);
  } catch (e) {
    console.log('  ! Could not process users collection:', e);
  }

  // Refresh sessions/tokens (force re-login)
  try { await db.collection('refreshtokens').deleteMany({}); console.log('  ✓ Cleared refresh tokens'); } catch { /**/ }

  console.log(`\n✅ Reset complete. Cleared ${cleared} documents across collections.\n`);
  await mongoose.disconnect();
}

reset().catch(err => {
  console.error('Reset failed:', err);
  process.exit(1);
});
