/**
 * GO MOOKAMBIKA — CLOUD & LOCAL MONGODB ADMIN SEED SCRIPT
 *
 * This script safely seeds or updates a Super Admin user into any MongoDB database,
 * including MongoDB Atlas (Cloud) or local instances, without wiping other data.
 *
 * Usage:
 *   # 1. Direct Cloud MongoDB URI argument:
 *   pnpm seed:admin "mongodb+srv://user:pass@cluster.mongodb.net/gomookambika"
 *
 *   # 2. Named flags:
 *   pnpm seed:admin --uri "mongodb+srv://..." --email admin@gomookambika.com --password Admin@123
 *
 *   # 3. Via environment variable:
 *   MONGODB_URI="mongodb+srv://..." pnpm seed:admin
 *
 *   # 4. From server directory:
 *   npx tsx src/scripts/seed-admin.ts "mongodb+srv://..."
 */

import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import argon2 from 'argon2';

// Load .env files from multiple hierarchical levels
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = 'true';
    } else if (arg.startsWith('--uri=')) {
      options.uri = arg.split('=')[1];
    } else if (arg === '--uri' || arg === '-u') {
      options.uri = args[++i];
    } else if (arg.startsWith('--email=')) {
      options.email = arg.split('=')[1];
    } else if (arg === '--email' || arg === '-e') {
      options.email = args[++i];
    } else if (arg.startsWith('--password=')) {
      options.password = arg.split('=')[1];
    } else if (arg === '--password' || arg === '-p') {
      options.password = args[++i];
    } else if (arg.startsWith('--name=')) {
      options.name = arg.split('=')[1];
    } else if (arg === '--name' || arg === '-n') {
      options.name = args[++i];
    } else if (arg.startsWith('--phone=')) {
      options.phone = arg.split('=')[1];
    } else if (arg === '--phone') {
      options.phone = args[++i];
    } else if (!arg.startsWith('-') && !options.uri) {
      // First positional argument is treated as the MongoDB URI if not already set
      if (arg.startsWith('mongodb://') || arg.startsWith('mongodb+srv://')) {
        options.uri = arg;
      }
    }
  }

  return options;
}

function printHelp() {
  console.log(`
======================================================
   Go Mookambika — Cloud & Local MongoDB Admin Seeder
======================================================

USAGE:
  pnpm seed:admin [cloud_mongodb_uri] [options]

OPTIONS:
  -u, --uri <string>       MongoDB URI (e.g. mongodb+srv://user:pass@cluster.mongodb.net/dbname)
  -e, --email <string>     Admin Email (default: admin@gomookambika.com)
  -p, --password <string>  Admin Password (default: Admin@123)
  -n, --name <string>      Admin Display Name (default: Super Admin)
      --phone <string>     Admin Phone (default: 9999999999)
  -h, --help               Display this help guide

EXAMPLES:
  # 1. Cloud MongoDB (Atlas / Remote):
  pnpm seed:admin "mongodb+srv://admin:pass@cluster0.abcde.mongodb.net/gomookambika?retryWrites=true&w=majority"

  # 2. Custom Admin Credentials:
  pnpm seed:admin --uri "mongodb+srv://..." --email manager@gomookambika.com --password "MySecretPass@123"

  # 3. Via Environment Variable (PowerShell):
  $env:MONGODB_URI="mongodb+srv://..."; pnpm seed:admin

  # 4. From Server Directory:
  cd server
  npx tsx src/scripts/seed-admin.ts "mongodb+srv://..."
======================================================
`);
}

function maskMongoUri(uri: string): string {
  try {
    return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)/, '$1******$3');
  } catch {
    return 'mongodb://***';
  }
}

const SUPER_ADMIN_PERMISSIONS = [
  'MANAGE_DRIVERS',
  'MANAGE_VEHICLES',
  'MANAGE_LOCATIONS',
  'MANAGE_FARES',
  'MANAGE_BOOKINGS',
  'MANAGE_USERS',
  'VIEW_AUDIT_LOGS',
  'SYSTEM_CONFIG',
  'booking.view',
  'booking.manage',
  'driver.view',
  'driver.manage',
  'queue.manage',
  'fare.manage',
  'settings.manage',
  'reports.view',
];

async function seedAdmin() {
  const opts = parseArgs();

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  // Determine target MongoDB URI
  const rawUri =
    opts.uri ||
    process.env.MONGODB_URI ||
    process.env.DATABASE_URL ||
    'mongodb://localhost:27017/gomookambika';

  const cleanUri = rawUri.trim().replace(/^['"]|['"]$/g, '');

  if (!cleanUri.startsWith('mongodb://') && !cleanUri.startsWith('mongodb+srv://')) {
    console.error('\n❌ ERROR: Invalid MongoDB connection string format!');
    console.error('The URI must start with "mongodb://" or "mongodb+srv://"\n');
    console.error('Example:');
    console.error('  pnpm seed:admin "mongodb+srv://admin:pass@cluster.mongodb.net/gomookambika?retryWrites=true&w=majority"\n');
    process.exit(1);
  }

  const email = (opts.email || process.env.ADMIN_EMAIL || 'admin@gomookambika.com').trim().toLowerCase();
  const password = opts.password || process.env.ADMIN_PASSWORD || 'Admin@123';
  const name = opts.name || process.env.ADMIN_NAME || 'Super Admin';
  const phone = (opts.phone || process.env.ADMIN_PHONE || '9999999999').trim();

  console.log('\n======================================================');
  console.log('   Go Mookambika — Cloud MongoDB Admin Seeder         ');
  console.log('======================================================\n');
  console.log(`Connecting to: ${maskMongoUri(cleanUri)}`);

  try {
    await mongoose.connect(cleanUri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
  } catch (connErr: any) {
    console.error('\n❌ FAILED TO CONNECT TO MONGODB:');
    console.error(connErr.message || connErr);
    console.error('\n💡 Troubleshooting Tips:');
    console.error('  1. If using MongoDB Atlas: Verify your IP is added to the IP Access List (or use 0.0.0.0/0).');
    console.error('  2. Verify your database username and password in the connection string.');
    console.error('  3. Ensure URL encoding for passwords with special characters (e.g., @ -> %40).');
    console.error('  4. Make sure your connection string includes a database name after the slash (/).\n');
    process.exit(1);
  }

  console.log('✅ Connected to MongoDB successfully.\n');

  const db = mongoose.connection.db!;
  const usersCol = db.collection('users');

  console.log(`Hashing password with Argon2id...`);
  const passwordHash = await argon2.hash(password, {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // Check if admin already exists by email or phone
  const existingByEmail = await usersCol.findOne({ email });
  const existingByPhone = await usersCol.findOne({ phone });

  let adminId: any;

  if (existingByEmail) {
    adminId = existingByEmail._id;
    await usersCol.updateOne(
      { _id: existingByEmail._id },
      {
        $set: {
          name: name || existingByEmail.name,
          email,
          phone: phone || existingByEmail.phone,
          passwordHash,
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
          permissions: SUPER_ADMIN_PERMISSIONS,
          updatedAt: new Date(),
        },
      }
    );
    console.log(`✅ Updated existing account to SUPER_ADMIN (ID: ${adminId})`);
  } else if (existingByPhone) {
    adminId = existingByPhone._id;
    await usersCol.updateOne(
      { _id: existingByPhone._id },
      {
        $set: {
          name: name || existingByPhone.name,
          email,
          phone,
          passwordHash,
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
          permissions: SUPER_ADMIN_PERMISSIONS,
          updatedAt: new Date(),
        },
      }
    );
    console.log(`✅ Updated account associated with phone ${phone} to SUPER_ADMIN (ID: ${adminId})`);
  } else {
    const insertRes = await usersCol.insertOne({
      name,
      email,
      phone,
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      permissions: SUPER_ADMIN_PERMISSIONS,
      deviceTokens: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    adminId = insertRes.insertedId;
    console.log(`✅ Created new SUPER_ADMIN user successfully! (ID: ${adminId})`);
  }

  // Ensure essential system settings exist
  const settingsCol = db.collection('systemsettings');
  const defaultSettings = [
    {
      key: 'driverAcceptTimeout',
      value: 30,
      category: 'dispatch',
      description: 'Dynamic time limit given to drivers to accept incoming trip requests',
    },
    {
      key: 'associationName',
      value: 'Sri Mookambika Tourist Taxi Drivers Association',
      category: 'association',
      description: 'Registered association trade name',
    },
    {
      key: 'supportPhone',
      value: '+91 94812 00000',
      category: 'association',
      description: 'Customer 24x7 control room phone',
    },
    {
      key: 'supportEmail',
      value: email,
      category: 'association',
      description: 'Official support & grievance email',
    },
  ];

  for (const s of defaultSettings) {
    await settingsCol.updateOne(
      { key: s.key },
      {
        $setOnInsert: {
          ...s,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }
  console.log('✅ Verified default system settings.');

  const adminCount = await usersCol.countDocuments({
    role: { $in: ['SUPER_ADMIN', 'ASSOCIATION_ADMIN'] },
  });

  console.log('\n======================================================');
  console.log('   🎉 ADMIN CREDENTIALS READY FOR LOGIN               ');
  console.log('======================================================');
  console.log(`  Database   : ${maskMongoUri(cleanUri)}`);
  console.log(`  Email      : ${email}`);
  console.log(`  Password   : ${password}`);
  console.log(`  Role       : SUPER_ADMIN`);
  console.log(`  Status     : ACTIVE`);
  console.log(`  Total Admins in DB : ${adminCount}`);
  console.log('------------------------------------------------------');
  console.log('  Admin Portal URLs:');
  console.log('  Production : http://admin.gomookambika.infatoz.com');
  console.log('  Local Dev  : http://localhost:3000');
  console.log('======================================================\n');

  await mongoose.disconnect();
  console.log('Disconnected from database. Done.\n');
  process.exit(0);
}

seedAdmin().catch(err => {
  console.error('\n❌ Unhandled error while seeding admin:', err);
  process.exit(1);
});
