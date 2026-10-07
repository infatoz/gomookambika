/**
 * SEED FILE — DISABLED BY DESIGN
 *
 * This file is intentionally disabled and NOT wired to any npm script.
 * The Go Mookambika platform does not auto-seed data on startup or deployment.
 *
 * All data (vehicle categories, locations, taxi stands, drivers, admin users)
 * must be created through the Admin PWA or directly via the API.
 *
 * If you need to restore it for a fresh dev environment reset, rename this
 * file back to index.ts and run: npx tsx src/seed/index.ts
 * Do NOT add it back to package.json scripts.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import argon2 from 'argon2';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { connectMongoDB } from '../config/database';
import { connectRedis, disconnectRedis } from '../config/redis';
import { User } from '../models/User';
import { Driver } from '../models/Driver';
import { Vehicle } from '../models/Vehicle';
import { VehicleCategory } from '../models/VehicleCategory';
import { Location } from '../models/Location';
import { TaxiStand } from '../models/TaxiStand';
import { PricingRule, AdditionalCharge } from '../models/PricingRule';
import { Booking } from '../models/Booking';
import { AuditLog } from '../models/AuditLog';
import { logger } from '../utils/logger';
import { qrService } from '../services/QRService';
import {
  UserRole,
  UserStatus,
  DriverStatus,
  VehicleStatus,
  FuelType,
  LocationType,
  PriceRuleType,
  TripType,
  Status,
  ChargeType,
  CalcMethod,
  DocumentType,
} from '@gomookambika/types';

async function seed() {
  console.log('\n🌱 Starting database seed...\n');

  await connectMongoDB();
  await connectRedis(); // best-effort — seed works without Redis

  // ─── CLEAR EXISTING DATA ──────────────────────────────────
  await Promise.all([
    User.deleteMany({}),
    Driver.deleteMany({}),
    Vehicle.deleteMany({}),
    VehicleCategory.deleteMany({}),
    Location.deleteMany({}),
    TaxiStand.deleteMany({}),
    PricingRule.deleteMany({}),
    AdditionalCharge.deleteMany({}),
    Booking.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);

  console.log('✓ Cleared existing data');

  // ─── SUPER ADMIN ─────────────────────────────────────────
  const adminPasswordHash = await argon2.hash('Admin@123');
  const superAdmin = await User.create({
    phone: '+910000000000',
    name: 'Super Admin',
    email: 'admin@gomookambika.com',
    role: UserRole.SUPER_ADMIN,
    permissions: [],
    status: UserStatus.ACTIVE,
    passwordHash: adminPasswordHash,
  });

  const assocAdmin = await User.create({
    phone: '+910000000001',
    name: 'Association Admin',
    email: 'assoc@gomookambika.com',
    role: UserRole.ASSOCIATION_ADMIN,
    permissions: [
      'driver.view', 'driver.create', 'driver.edit',
      'booking.view', 'booking.create', 'booking.edit',
      'queue.view', 'queue.manage',
      'pricing.view', 'pricing.create', 'pricing.edit',
      'report.view', 'report.export',
    ],
    status: UserStatus.ACTIVE,
    passwordHash: await argon2.hash('Assoc@123'),
  });

  console.log('✓ Created admin users');

  // ─── VEHICLE CATEGORIES ──────────────────────────────────
  const [sedan, suv, innova, autoRickshaw, luxury] = await VehicleCategory.insertMany([
    {
      name: 'Sedan',
      code: 'SEDAN',
      description: 'Comfortable 4-seater sedan for city and intercity travel',
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
    },
    {
      name: 'SUV',
      code: 'SUV',
      description: 'Spacious 6-seater SUV for groups and families',
      seatCapacity: 6,
      luggageCapacity: 4,
      ac: true,
      fuelType: FuelType.DIESEL,
      baseFare: 400,
      minimumKm: 5,
      ratePerKm: 22,
      ratePerHour: 200,
      extraKmRate: 25,
      extraHourRate: 220,
      waitingChargePerMin: 2.5,
      nightChargeMultiplier: 1.1,
      status: Status.ACTIVE,
      sortOrder: 2,
    },
    {
      name: 'Innova',
      code: 'INNOVA',
      description: 'Premium 7-seater Innova for comfortable group travel',
      seatCapacity: 7,
      luggageCapacity: 5,
      ac: true,
      fuelType: FuelType.DIESEL,
      baseFare: 500,
      minimumKm: 5,
      ratePerKm: 25,
      ratePerHour: 220,
      extraKmRate: 28,
      extraHourRate: 250,
      waitingChargePerMin: 3,
      nightChargeMultiplier: 1.15,
      status: Status.ACTIVE,
      sortOrder: 3,
    },
    {
      name: 'Auto Rickshaw',
      code: 'AUTO',
      description: '3-seater auto rickshaw for short city trips',
      seatCapacity: 3,
      luggageCapacity: 1,
      ac: false,
      fuelType: FuelType.CNG,
      baseFare: 50,
      minimumKm: 2,
      ratePerKm: 12,
      extraKmRate: 14,
      waitingChargePerMin: 1,
      nightChargeMultiplier: 1.1,
      status: Status.ACTIVE,
      sortOrder: 0,
    },
    {
      name: 'Luxury',
      code: 'LUXURY',
      description: 'Premium luxury sedan for VIP travel',
      seatCapacity: 4,
      luggageCapacity: 3,
      ac: true,
      fuelType: FuelType.PETROL,
      baseFare: 600,
      minimumKm: 10,
      ratePerKm: 35,
      ratePerHour: 350,
      extraKmRate: 40,
      extraHourRate: 380,
      waitingChargePerMin: 5,
      nightChargeMultiplier: 1.2,
      status: Status.ACTIVE,
      sortOrder: 4,
    },
  ]);

  console.log('✓ Created vehicle categories');

  // ─── LOCATIONS ───────────────────────────────────────────
  const [
    mookambikaTemple,
    udupiCity,
    manipalHospital,
    mangaloreAirport,
    udupiRailway,
    mookambikaTaxiStandLoc,
  ] = await Location.insertMany([
    {
      name: 'Mookambika Temple',
      code: 'MOOKAMBIKA_TEMPLE',
      type: LocationType.TEMPLE,
      description: 'Sri Mookambika Devi Temple, Kollur',
      address: { line1: 'Kollur', city: 'Kollur', state: 'Karnataka', country: 'India' },
      geoPoint: { type: 'Point', coordinates: [74.8100, 13.8617] },
      queueRadius: 150,
      queueEnabled: true,
      bookingEnabled: true,
      qrEnabled: true,
      status: Status.ACTIVE,
    },
    {
      name: 'Udupi City',
      code: 'UDUPI_CITY',
      type: LocationType.CITY_LOCATION,
      description: 'Udupi city center',
      address: { line1: 'Car Street', city: 'Udupi', state: 'Karnataka', country: 'India' },
      geoPoint: { type: 'Point', coordinates: [74.7421, 13.3409] },
      queueRadius: 100,
      queueEnabled: true,
      bookingEnabled: true,
      qrEnabled: true,
      status: Status.ACTIVE,
    },
    {
      name: 'Manipal Hospital',
      code: 'MANIPAL_HOSPITAL',
      type: LocationType.HOTEL,
      description: 'Manipal University Hospital',
      address: { line1: 'Madhav Nagar', city: 'Manipal', state: 'Karnataka', country: 'India' },
      geoPoint: { type: 'Point', coordinates: [74.7889, 13.3528] },
      queueRadius: 100,
      queueEnabled: false,
      bookingEnabled: true,
      qrEnabled: false,
      status: Status.ACTIVE,
    },
    {
      name: 'Mangalore International Airport',
      code: 'MNG_AIRPORT',
      type: LocationType.AIRPORT,
      description: 'Mangalore International Airport, Bajpe',
      address: { line1: 'Bajpe', city: 'Mangalore', state: 'Karnataka', country: 'India' },
      geoPoint: { type: 'Point', coordinates: [74.8907, 12.9612] },
      queueRadius: 200,
      queueEnabled: true,
      bookingEnabled: true,
      qrEnabled: true,
      status: Status.ACTIVE,
    },
    {
      name: 'Udupi Railway Station',
      code: 'UDUPI_RAILWAY',
      type: LocationType.RAILWAY_STATION,
      description: 'Udupi Railway Station',
      address: { line1: 'Station Road', city: 'Udupi', state: 'Karnataka', country: 'India' },
      geoPoint: { type: 'Point', coordinates: [74.7518, 13.3380] },
      queueRadius: 100,
      queueEnabled: true,
      bookingEnabled: true,
      qrEnabled: true,
      status: Status.ACTIVE,
    },
    {
      name: 'Kollur Taxi Stand',
      code: 'KOLLUR_TAXI_STAND',
      type: LocationType.TAXI_STAND,
      description: 'Main taxi stand near Mookambika Temple, Kollur',
      address: { line1: 'Temple Road', city: 'Kollur', state: 'Karnataka', country: 'India' },
      geoPoint: { type: 'Point', coordinates: [74.8090, 13.8610] },
      queueRadius: 200,
      queueEnabled: true,
      bookingEnabled: true,
      qrEnabled: true,
      status: Status.ACTIVE,
    },
  ]);

  console.log('✓ Created locations');

  // ─── TAXI STANDS ─────────────────────────────────────────
  const createStand = async (name: string, locationId: unknown, categoryIds: unknown[]) => {
    const { token, tokenId, expiresAt } = qrService.generateQRToken('temp');
    const stand = await TaxiStand.create({
      name,
      locationId,
      queueRadius: 150,
      qrToken: token,
      qrTokenId: tokenId,
      qrExpiresAt: expiresAt,
      qrGeneratedAt: new Date(),
      qrStatus: 'ACTIVE',
      allowedVehicleCategories: categoryIds,
      queueEnabled: true,
      status: Status.ACTIVE,
      createdBy: superAdmin._id,
    });
    // Re-generate with actual stand ID
    const { token: t2, tokenId: tid2 } = qrService.generateQRToken(stand.id);
    await TaxiStand.findByIdAndUpdate(stand.id, { qrToken: t2, qrTokenId: tid2 });
    return stand;
  };

  const [kollurStand, udupiStand, mngAirportStand] = await Promise.all([
    createStand('Kollur Mookambika Stand', mookambikaTaxiStandLoc._id, [sedan._id, suv._id, innova._id]),
    createStand('Udupi City Stand', udupiCity._id, [sedan._id, suv._id, innova._id, autoRickshaw._id]),
    createStand('Mangalore Airport Stand', mangaloreAirport._id, [sedan._id, suv._id, innova._id, luxury._id]),
  ]);

  console.log('✓ Created taxi stands');

  // ─── PRICING RULES ────────────────────────────────────────

  await PricingRule.insertMany([
    // Fixed route: Mookambika → Udupi Sedan
    {
      name: 'Mookambika to Udupi - Sedan',
      ruleType: PriceRuleType.FIXED,
      priority: 1,
      vehicleCategoryId: sedan._id,
      originLocationId: mookambikaTemple._id,
      destinationLocationId: udupiCity._id,
      fixedPrice: 2500,
      status: Status.ACTIVE,
      createdBy: superAdmin._id,
    },
    // Fixed route: Mookambika → Udupi Innova
    {
      name: 'Mookambika to Udupi - Innova',
      ruleType: PriceRuleType.FIXED,
      priority: 1,
      vehicleCategoryId: innova._id,
      originLocationId: mookambikaTemple._id,
      destinationLocationId: udupiCity._id,
      fixedPrice: 3500,
      status: Status.ACTIVE,
      createdBy: superAdmin._id,
    },
    // Airport transfer - fixed
    {
      name: 'Airport Transfer - Sedan',
      ruleType: PriceRuleType.FIXED,
      priority: 2,
      vehicleCategoryId: sedan._id,
      originLocationId: mangaloreAirport._id,
      fixedPrice: 1800,
      tripType: TripType.AIRPORT_TRANSFER,
      status: Status.ACTIVE,
      createdBy: superAdmin._id,
    },
    // Per KM - Sedan default
    {
      name: 'Sedan Per KM Rate',
      ruleType: PriceRuleType.PER_KM,
      priority: 10,
      vehicleCategoryId: sedan._id,
      baseFare: 300,
      minimumKm: 5,
      ratePerKm: 18,
      status: Status.ACTIVE,
      createdBy: superAdmin._id,
    },
    // Per KM - SUV
    {
      name: 'SUV Per KM Rate',
      ruleType: PriceRuleType.PER_KM,
      priority: 10,
      vehicleCategoryId: suv._id,
      baseFare: 400,
      minimumKm: 5,
      ratePerKm: 22,
      status: Status.ACTIVE,
      createdBy: superAdmin._id,
    },
    // Per KM - Innova
    {
      name: 'Innova Per KM Rate',
      ruleType: PriceRuleType.PER_KM,
      priority: 10,
      vehicleCategoryId: innova._id,
      baseFare: 500,
      minimumKm: 5,
      ratePerKm: 25,
      status: Status.ACTIVE,
      createdBy: superAdmin._id,
    },
    // Slab pricing for outstation
    {
      name: 'Outstation Slab - Sedan',
      ruleType: PriceRuleType.SLAB,
      priority: 8,
      vehicleCategoryId: sedan._id,
      tripType: TripType.OUTSTATION,
      slabs: [
        { fromKm: 0, toKm: 50, price: 1200 },
        { fromKm: 51, toKm: 100, price: 2000 },
        { fromKm: 101, toKm: 200, price: 3500 },
        { fromKm: 201, toKm: 999, price: 5000 },
      ],
      status: Status.ACTIVE,
      createdBy: superAdmin._id,
    },
  ]);

  // ─── ADDITIONAL CHARGES ───────────────────────────────────
  await AdditionalCharge.insertMany([
    {
      chargeType: ChargeType.GST,
      name: 'GST (5%)',
      calculationMethod: CalcMethod.PERCENTAGE,
      value: 5,
      applicableTripTypes: [],
      applicableVehicleCategories: [],
      status: Status.ACTIVE,
      createdBy: superAdmin._id,
    },
    {
      chargeType: ChargeType.SERVICE_FEE,
      name: 'Platform Service Fee',
      calculationMethod: CalcMethod.FIXED,
      value: 50,
      applicableTripTypes: [],
      applicableVehicleCategories: [],
      status: Status.ACTIVE,
      createdBy: superAdmin._id,
    },
    {
      chargeType: ChargeType.WAITING,
      name: 'Waiting Charge',
      calculationMethod: CalcMethod.PER_MINUTE,
      value: 2,
      freeMinutes: 5,
      applicableTripTypes: [],
      applicableVehicleCategories: [],
      status: Status.ACTIVE,
      createdBy: superAdmin._id,
    },
    {
      chargeType: ChargeType.TOLL,
      name: 'Toll Charge',
      calculationMethod: CalcMethod.FIXED,
      value: 100,
      applicableTripTypes: [TripType.OUTSTATION, TripType.ONE_WAY],
      applicableVehicleCategories: [],
      status: Status.ACTIVE,
      createdBy: superAdmin._id,
    },
  ]);

  console.log('✓ Created pricing rules and charges');

  // ─── DRIVER USERS ────────────────────────────────────────
  const driverData = [
    { name: 'Ravi Kumar', phone: '+919876543210', license: 'KA15 20190023456' },
    { name: 'Suresh Poojary', phone: '+919876543211', license: 'KA15 20180019876' },
    { name: 'Mahesh Shetty', phone: '+919876543212', license: 'KA15 20210034567' },
    { name: 'Ganesh Naik', phone: '+919876543213', license: 'KA15 20170012345' },
    { name: 'Harish Gowda', phone: '+919876543214', license: 'KA15 20220056789' },
  ];

  const driverUsers = await User.insertMany(
    driverData.map(d => ({
      phone: d.phone,
      name: d.name,
      role: UserRole.DRIVER,
      permissions: [],
      status: UserStatus.ACTIVE,
    }))
  );

  const drivers = await Driver.insertMany(
    driverData.map((d, i) => ({
      userId: driverUsers[i]._id,
      driverCode: `DRV-${String(i + 1).padStart(5, '0')}`,
      name: d.name,
      phone: d.phone,
      address: { line1: 'Kollur', city: 'Kollur', state: 'Karnataka', country: 'India' },
      licenseNumber: d.license,
      licenseExpiry: new Date('2027-12-31'),
      joiningDate: new Date(),
      status: DriverStatus.AVAILABLE,
      rating: 4.5,
      ratingCount: 10,
      totalTrips: 50,
    }))
  );

  console.log('✓ Created drivers');

  // ─── VEHICLES ────────────────────────────────────────────
  const vehicleData = [
    { reg: 'KA15A1234', brand: 'Maruti', vehicleModel: 'Ciaz', category: sedan._id, driver: drivers[0] },
    { reg: 'KA15B5678', brand: 'Toyota', vehicleModel: 'Innova Crysta', category: innova._id, driver: drivers[1] },
    { reg: 'KA15C9012', brand: 'Mahindra', vehicleModel: 'XUV700', category: suv._id, driver: drivers[2] },
    { reg: 'KA15D3456', brand: 'Honda', vehicleModel: 'City', category: sedan._id, driver: drivers[3] },
    { reg: 'KA15E7890', brand: 'Toyota', vehicleModel: 'Innova', category: innova._id, driver: drivers[4] },
  ];

  const vehicles = await Vehicle.insertMany(
    vehicleData.map(v => ({
      registrationNumber: v.reg,
      categoryId: v.category,
      brand: v.brand,
      vehicleModel: v.vehicleModel,
      manufacturingYear: 2022,
      color: 'White',
      fuelType: FuelType.DIESEL,
      seatCapacity: v.category === sedan._id ? 4 : v.category === innova._id ? 7 : 6,
      luggageCapacity: 3,
      ac: true,
      ownerName: v.driver.name,
      assignedDriverId: v.driver._id,
      status: VehicleStatus.ACTIVE,
    }))
  );

  // Update driver → vehicle linkage
  for (let i = 0; i < drivers.length; i++) {
    await Driver.findByIdAndUpdate(drivers[i]._id, {});
  }

  console.log('✓ Created vehicles');

  // ─── SAMPLE CUSTOMERS ────────────────────────────────────
  await User.insertMany([
    { phone: '+919876543220', name: 'Priya Sharma', role: UserRole.CUSTOMER, status: UserStatus.ACTIVE },
    { phone: '+919876543221', name: 'Arjun Rao', role: UserRole.CUSTOMER, status: UserStatus.ACTIVE },
    { phone: '+919876543222', name: 'Kavya Nair', role: UserRole.CUSTOMER, status: UserStatus.ACTIVE },
  ]);

  console.log('✓ Created sample customers');

  console.log('\n✅ Seed complete!\n');
  console.log('Admin credentials:');
  console.log('  Email: admin@gomookambika.com');
  console.log('  Password: Admin@123\n');
  console.log('Driver OTP (dev): 123456');
  console.log('Customer OTP (dev): 123456\n');

  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
