import mongoose from 'mongoose';

async function seedFleet() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gomookambika';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) {
    console.error('No DB connection');
    return;
  }

  // 1. Update/Ensure image paths and specs on vehicle categories
  await db.collection('vehiclecategories').updateOne(
    { code: 'SEDAN' },
    {
      $set: {
        image: '/images/SedanComfort.png',
        icon: '/images/SedanComfort.png',
        description: 'Comfortable AC Sedan (Dzire, Etios, City) for pilgrimage & transit',
        seatCapacity: 4,
        luggageCapacity: 2,
        ac: true,
      },
    }
  );

  await db.collection('vehiclecategories').updateOne(
    { code: 'SUV' },
    {
      $set: {
        image: '/images/SuvBlackDriver.png',
        icon: '/images/SuvBlackDriver.png',
        description: 'Spacious 6-7 seater AC SUV (Innova, Ertiga) for families & groups',
        seatCapacity: 6,
        luggageCapacity: 4,
        ac: true,
      },
    }
  );

  await db.collection('vehiclecategories').updateOne(
    { code: 'HATCHBACK' },
    {
      $set: {
        image: '/images/HatchbackMini-AC.png',
        icon: '/images/HatchbackMini-AC.png',
        description: 'Affordable compact AC ride (WagonR, Swift) for up to 4 passengers',
        seatCapacity: 4,
        luggageCapacity: 2,
        ac: true,
      },
    }
  );

  await db.collection('vehiclecategories').updateOne(
    { code: 'AUTO' },
    {
      $set: {
        image: '/images/TuktukGreenYellow.png',
        icon: '/images/TuktukGreenYellow.png',
        description: 'Economical 3-wheeler Auto Rickshaw for quick temple & town trips',
        seatCapacity: 3,
        luggageCapacity: 1,
        ac: false,
      },
    }
  );

  const categories = await db.collection('vehiclecategories').find().toArray();
  const catMap = new Map<string, mongoose.Types.ObjectId>();
  for (const c of categories) {
    catMap.set(c.code, c._id as mongoose.Types.ObjectId);
  }

  // 2. Ensure representative active fleet vehicles for each category
  const vehiclesToEnsure = [
    {
      registrationNumber: 'KA20 AB 1234',
      code: 'SEDAN',
      brand: 'Maruti Suzuki',
      vehicleModel: 'Dzire Tour',
      color: 'Pearl White',
      fuelType: 'PETROL',
      manufacturingYear: 2023,
      seatCapacity: 4,
      luggageCapacity: 2,
      ac: true,
      ownerName: 'Ravi Kumar',
      status: 'ACTIVE',
    },
    {
      registrationNumber: 'KA20 AB 5566',
      code: 'SEDAN',
      brand: 'Honda',
      vehicleModel: 'City ZX',
      color: 'Alabaster Silver',
      fuelType: 'PETROL',
      manufacturingYear: 2022,
      seatCapacity: 4,
      luggageCapacity: 3,
      ac: true,
      ownerName: 'Suresh Bhat',
      status: 'ACTIVE',
    },
    {
      registrationNumber: 'KA20 M 4004',
      code: 'SUV',
      brand: 'Toyota',
      vehicleModel: 'Innova Crysta',
      color: 'Super White',
      fuelType: 'DIESEL',
      manufacturingYear: 2023,
      seatCapacity: 7,
      luggageCapacity: 4,
      ac: true,
      ownerName: 'Manjunatha Hegde',
      status: 'ACTIVE',
    },
    {
      registrationNumber: 'KA20 N 8899',
      code: 'SUV',
      brand: 'Maruti Suzuki',
      vehicleModel: 'Ertiga ZXi',
      color: 'Magma Grey',
      fuelType: 'PETROL',
      manufacturingYear: 2023,
      seatCapacity: 6,
      luggageCapacity: 3,
      ac: true,
      ownerName: 'Prashanth Shetty',
      status: 'ACTIVE',
    },
    {
      registrationNumber: 'KA20 B 7711',
      code: 'HATCHBACK',
      brand: 'Maruti Suzuki',
      vehicleModel: 'WagonR VXi',
      color: 'Superior White',
      fuelType: 'PETROL',
      manufacturingYear: 2022,
      seatCapacity: 4,
      luggageCapacity: 2,
      ac: true,
      ownerName: 'Ganesh Acharya',
      status: 'ACTIVE',
    },
    {
      registrationNumber: 'KA20 B 9922',
      code: 'HATCHBACK',
      brand: 'Maruti Suzuki',
      vehicleModel: 'Swift Dzire Tour',
      color: 'Silky Silver',
      fuelType: 'PETROL',
      manufacturingYear: 2023,
      seatCapacity: 4,
      luggageCapacity: 2,
      ac: true,
      ownerName: 'Raghavendra Rao',
      status: 'ACTIVE',
    },
    {
      registrationNumber: 'KA20 F 3344',
      code: 'AUTO',
      brand: 'Bajaj',
      vehicleModel: 'RE Compact 4S',
      color: 'Yellow / Green',
      fuelType: 'CNG',
      manufacturingYear: 2022,
      seatCapacity: 3,
      luggageCapacity: 1,
      ac: false,
      ownerName: 'Shekara Poojary',
      status: 'ACTIVE',
    },
  ];

  for (const v of vehiclesToEnsure) {
    const catId = catMap.get(v.code);
    if (!catId) continue;

    await db.collection('vehicles').updateOne(
      { registrationNumber: v.registrationNumber },
      {
        $set: {
          registrationNumber: v.registrationNumber,
          categoryId: catId,
          brand: v.brand,
          vehicleModel: v.vehicleModel,
          color: v.color,
          fuelType: v.fuelType,
          manufacturingYear: v.manufacturingYear,
          seatCapacity: v.seatCapacity,
          luggageCapacity: v.luggageCapacity,
          ac: v.ac,
          ownerName: v.ownerName,
          status: v.status,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
          documents: [],
        },
      },
      { upsert: true }
    );
  }

  console.log('✅ Vehicle categories and fleet vehicles seeded successfully');
  await mongoose.disconnect();
}

seedFleet().catch(console.error);
