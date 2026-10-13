import mongoose from 'mongoose';

async function updateFares() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gomookambika';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) {
    console.error('No DB');
    return;
  }

  // Update Hatchback Mini
  await db.collection('vehiclecategories').updateOne(
    { code: 'HATCHBACK' },
    {
      $set: {
        baseFare: 80,
        ratePerKm: 15,
        minimumKm: 5,
        'fares.oneWay': {
          baseFare: 80,
          ratePerKm: 15,
          minimumKm: 5,
          waitingChargePerMin: 1.5,
          nightChargeMultiplier: 1.15,
          driverAllowance: 0,
        },
        'fares.roundTrip': {
          baseFare: 160,
          ratePerKm: 14,
          minimumKm: 60,
          waitingChargePerMin: 1.5,
          nightChargeMultiplier: 1.15,
          driverAllowance: 250,
        },
        'fares.rental': {
          baseFare: 500,
          ratePerKm: 0,
          minimumKm: 0,
          baseHours: 2,
          baseKm: 20,
          extraKmRate: 15,
          extraHourRate: 120,
          waitingChargePerMin: 1.5,
          nightChargeMultiplier: 1.15,
          driverAllowance: 0,
        },
      },
    }
  );

  // Update SUV
  await db.collection('vehiclecategories').updateOne(
    { code: 'SUV' },
    {
      $set: {
        baseFare: 150,
        ratePerKm: 24,
        minimumKm: 5,
        'fares.oneWay': {
          baseFare: 150,
          ratePerKm: 24,
          minimumKm: 5,
          waitingChargePerMin: 3,
          nightChargeMultiplier: 1.2,
          driverAllowance: 0,
        },
        'fares.roundTrip': {
          baseFare: 300,
          ratePerKm: 22,
          minimumKm: 80,
          waitingChargePerMin: 3,
          nightChargeMultiplier: 1.2,
          driverAllowance: 400,
        },
        'fares.rental': {
          baseFare: 900,
          ratePerKm: 0,
          minimumKm: 0,
          baseHours: 2,
          baseKm: 20,
          extraKmRate: 24,
          extraHourRate: 200,
          waitingChargePerMin: 3,
          nightChargeMultiplier: 1.2,
          driverAllowance: 0,
        },
      },
    }
  );

  // Update Auto Rickshaw
  await db.collection('vehiclecategories').updateOne(
    { code: 'AUTO' },
    {
      $set: {
        baseFare: 50,
        ratePerKm: 13,
        minimumKm: 2,
        'fares.oneWay': {
          baseFare: 50,
          ratePerKm: 13,
          minimumKm: 2,
          waitingChargePerMin: 1.0,
          nightChargeMultiplier: 1.15,
          driverAllowance: 0,
        },
        'fares.roundTrip': {
          baseFare: 90,
          ratePerKm: 12,
          minimumKm: 20,
          waitingChargePerMin: 1.0,
          nightChargeMultiplier: 1.15,
          driverAllowance: 150,
        },
        'fares.rental': {
          baseFare: 300,
          ratePerKm: 0,
          minimumKm: 0,
          baseHours: 2,
          baseKm: 15,
          extraKmRate: 13,
          extraHourRate: 100,
          waitingChargePerMin: 1.0,
          nightChargeMultiplier: 1.15,
          driverAllowance: 0,
        },
      },
    }
  );

  console.log('Vehicle categories fares updated successfully');
  await mongoose.disconnect();
}

updateFares().catch(console.error);
