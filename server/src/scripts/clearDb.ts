import path from 'path';
import { config as dotenvConfig } from 'dotenv';

// Load .env from workspace root
dotenvConfig({ path: path.resolve(process.cwd(), '../.env') });
dotenvConfig({ path: path.resolve(process.cwd(), '../../.env') });

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/gomookambika';

async function clearAll() {
  console.log('\n🗑️  Clearing all data from:', MONGODB_URI, '\n');
  await mongoose.connect(MONGODB_URI);

  const db = mongoose.connection.db!;
  const collections = await db.listCollections().toArray();

  if (collections.length === 0) {
    console.log('Database is already empty.');
  } else {
    for (const col of collections) {
      const result = await db.collection(col.name).deleteMany({});
      console.log(`  ✓ ${col.name.padEnd(20)} — ${result.deletedCount} documents removed`);
    }
  }

  await mongoose.disconnect();
  console.log('\n✅ Database cleared successfully.\n');
  process.exit(0);
}

clearAll().catch(err => {
  console.error('❌ Failed to clear database:', err.message);
  process.exit(1);
});
