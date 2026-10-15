import { logger } from './logger';
import { User } from '@/models/User';
import { Driver } from '@/models/Driver';
import { Vehicle } from '@/models/Vehicle';
import { VehicleCategory } from '@/models/VehicleCategory';
import { Location } from '@/models/Location';
import { TaxiStand } from '@/models/TaxiStand';
import { qrService } from '@/services/QRService';
import { UserRole, UserStatus, DriverStatus, FuelType, LocationType, Status, QRStatus } from '@gomookambika/types';
import argon2 from 'argon2';

export async function ensureDefaultDemoData(): Promise<void> {
  try {
    // 1. Super Admin User
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
      logger.info(`✅ Default Super Admin ensured (${adminEmail})`);
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
        logger.info(`✅ Default Super Admin status/role synchronized (${adminEmail})`);
      }
    }

    // 2. Default Vehicle Categories
    let sedanCat = await VehicleCategory.findOne({ code: 'SEDAN' });
    if (!sedanCat) {
      sedanCat = await VehicleCategory.create({
        name: 'Sedan',
        code: 'SEDAN',
        description: 'Comfortable 4-seater sedan for temple and local travel',
        seatCapacity: 4,
        luggageCapacity: 2,
        ac: true,
        fuelType: FuelType.PETROL,
        baseFare: 300,
        minimumKm: 5,
        ratePerKm: 18,
        ratePerHour: 150,
        extraKmRate: 20,
        extraHourRate: 180,
        waitingChargePerMin: 2,
        nightChargeMultiplier: 1.1,
        status: Status.ACTIVE,
        sortOrder: 1,
      });
      logger.info('✅ Default Sedan category ensured');
    }

    let suvCat = await VehicleCategory.findOne({ code: 'SUV' });
    if (!suvCat) {
      await VehicleCategory.create({
        name: 'SUV',
        code: 'SUV',
        description: 'Spacious 6-seater SUV for families and groups',
        seatCapacity: 6,
        luggageCapacity: 4,
        ac: true,
        fuelType: FuelType.DIESEL,
        baseFare: 450,
        minimumKm: 5,
        ratePerKm: 22,
        ratePerHour: 200,
        extraKmRate: 25,
        extraHourRate: 220,
        waitingChargePerMin: 3,
        nightChargeMultiplier: 1.15,
        status: Status.ACTIVE,
        sortOrder: 2,
      });
      logger.info('✅ Default SUV category ensured');
    }

    let hatchCat = await VehicleCategory.findOne({ code: 'HATCHBACK' });
    if (!hatchCat) {
      await VehicleCategory.create({
        name: 'Hatchback Mini',
        code: 'HATCHBACK',
        description: 'Affordable and compact AC ride for up to 4 passengers',
        seatCapacity: 4,
        luggageCapacity: 2,
        ac: true,
        fuelType: FuelType.PETROL,
        baseFare: 200,
        minimumKm: 5,
        ratePerKm: 15,
        ratePerHour: 120,
        extraKmRate: 16,
        extraHourRate: 140,
        waitingChargePerMin: 1.5,
        nightChargeMultiplier: 1.1,
        status: Status.ACTIVE,
        sortOrder: 0,
      });
      logger.info('✅ Default Hatchback category ensured');
    }

    let autoCat = await VehicleCategory.findOne({ code: 'AUTO' });
    if (!autoCat) {
      await VehicleCategory.create({
        name: 'Auto Rickshaw',
        code: 'AUTO',
        description: 'Quick & economical 3-wheeler for local temple trips',
        seatCapacity: 3,
        luggageCapacity: 1,
        ac: false,
        fuelType: FuelType.CNG,
        baseFare: 50,
        minimumKm: 2,
        ratePerKm: 12,
        ratePerHour: 80,
        extraKmRate: 13,
        extraHourRate: 100,
        waitingChargePerMin: 1,
        nightChargeMultiplier: 1.1,
        status: Status.ACTIVE,
        sortOrder: -1,
      });
      logger.info('✅ Default Auto category ensured');
    }

    // 3. Demo Driver 1 (+919876543210)
    const driverPhone = '+919876543210';
    let driverUser = await User.findOne({ phone: driverPhone });
    if (!driverUser) {
      driverUser = await User.create({
        name: 'Ravi Kumar',
        phone: driverPhone,
        email: 'ravi.driver@gomookambika.com',
        role: UserRole.DRIVER,
        status: UserStatus.ACTIVE,
        permissions: [],
      });
      logger.info('✅ Default Demo Driver user ensured (9876543210)');
    } else if (driverUser.role !== UserRole.DRIVER && driverUser.role !== UserRole.SUPER_ADMIN) {
      driverUser.role = UserRole.DRIVER;
      await driverUser.save();
    }

    let driver = await Driver.findOne({ phone: driverPhone });
    if (!driver) {
      driver = await Driver.create({
        userId: driverUser._id,
        driverCode: 'DRV-001',
        name: 'Ravi Kumar',
        phone: driverPhone,
        email: 'ravi.driver@gomookambika.com',
        licenseNumber: 'KA20 20180012345',
        licenseExpiry: new Date(Date.now() + 365 * 24 * 3600 * 1000 * 5),
        joiningDate: new Date(),
        status: DriverStatus.AVAILABLE,
        rating: 4.9,
        ratingCount: 128,
        totalTrips: 342,
        totalEarnings: 85000,
        address: {
          line1: 'Near Temple Road',
          city: 'Kollur',
          state: 'Karnataka',
          country: 'India',
        },
        documents: [],
      });
      logger.info('✅ Default Demo Driver profile ensured (DRV-001)');
    }

    // Vehicle for driver
    const vehicle = await Vehicle.findOne({ assignedDriverId: driver._id });
    if (!vehicle && sedanCat) {
      await Vehicle.create({
        registrationNumber: 'KA20 AB 1234',
        categoryId: sedanCat._id,
        brand: 'Maruti Suzuki',
        vehicleModel: 'Dzire Tour',
        color: 'White',
        fuelType: FuelType.PETROL,
        manufacturingYear: 2022,
        seatCapacity: 4,
        luggageCapacity: 2,
        ac: true,
        ownerName: 'Ravi Kumar',
        assignedDriverId: driver._id,
        status: Status.ACTIVE,
        documents: [],
      });
      logger.info('✅ Default vehicle assigned to Demo Driver (KA20 AB 1234)');
    }

    // 4. Default Locations
    const locCount = await Location.countDocuments();
    let defaultLoc = await Location.findOne({ status: Status.ACTIVE });
    if (locCount === 0 || !defaultLoc) {
      defaultLoc = await Location.create({
        name: 'Sri Mookambika Temple',
        code: 'TEMPLE_KOLLUR',
        type: LocationType.TEMPLE,
        description: 'Main Temple Entrance, Kollur',
        address: { line1: 'Temple Road', city: 'Kollur', state: 'Karnataka', country: 'India', postalCode: '576220' },
        geoPoint: { type: 'Point', coordinates: [74.8100, 13.8617] },
        queueRadius: 5000,
        queueEnabled: true,
        status: Status.ACTIVE,
      });
      logger.info('✅ Default locations ensured');
    }

    // 5. Default Taxi Stand with Active QR Code
    const standCount = await TaxiStand.countDocuments();
    if (standCount === 0 && defaultLoc && existingAdmin) {
      const standDoc = new TaxiStand({
        name: 'Kollur Mookambika Temple Stand',
        locationId: defaultLoc._id,
        queueRadius: 5000,
        status: Status.ACTIVE,
        queueEnabled: true,
        allowedVehicleCategories: sedanCat ? [sedanCat._id] : [],
        createdBy: existingAdmin._id,
      });
      const { token, tokenId } = qrService.generateQRToken(standDoc._id.toString());
      standDoc.qrToken = token;
      standDoc.qrTokenId = tokenId;
      standDoc.qrStatus = QRStatus.ACTIVE;
      standDoc.qrGeneratedAt = new Date();
      await standDoc.save();
      logger.info('✅ Default Taxi Stand created with active QR code');
    }
  } catch (err) {
    logger.warn('Failed to ensure default demo data on startup:', err);
  }
}
