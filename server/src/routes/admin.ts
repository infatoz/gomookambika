import { Router } from 'express';
import { adminController } from '@/controllers/AdminController';
import { authenticate, requireRoles, requirePermission } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import {
  createDriverSchema,
  updateDriverSchema,
  createVehicleCategorySchema,
  updateVehicleCategorySchema,
  createVehicleSchema,
  updateVehicleSchema,
  createLocationSchema,
  updateLocationSchema,
  createTaxiStandSchema,
} from '@gomookambika/validation';
import { UserRole, UserStatus } from '@gomookambika/types';
import { Driver } from '@/models/Driver';
import { User } from '@/models/User';
import { errors } from '@/middlewares/errorHandler';
import { vehicleIconUpload } from '@/middlewares/upload';
import { normalizePhone } from '@/utils/phone';
import argon2 from 'argon2';

const router = Router();

// All admin routes require authentication
router.use(authenticate);

const isAdmin = requireRoles(
  UserRole.SUPER_ADMIN,
  UserRole.ASSOCIATION_ADMIN,
  UserRole.OPERATIONS_MANAGER,
  UserRole.BOOKING_MANAGER,
  UserRole.QUEUE_MANAGER,
  UserRole.FINANCE_MANAGER,
  UserRole.SUPPORT_AGENT,
  UserRole.REPORT_VIEWER
);

router.use(isAdmin);

// ─── DASHBOARD ───────────────────────────────────────────────
router.get('/dashboard', adminController.getDashboard.bind(adminController));

// ─── DRIVERS ─────────────────────────────────────────────────
router.get('/drivers', adminController.getDrivers.bind(adminController));
router.get('/drivers/:id', adminController.getDriver.bind(adminController));

router.post('/drivers', requirePermission('driver.create'), async (req, res) => {
  const { name, phone, email, address, licenseNumber, licenseExpiry, joiningDate } = req.body;

  const normalizedPhone = normalizePhone(phone);
  const rawDigits = phone ? String(phone).replace(/\D/g, '').slice(-10) : '';

  // Check if a driver with this phone already exists
  const existingDriver = await Driver.findOne({
    $or: [
      { phone: normalizedPhone },
      { phone },
      ...(rawDigits ? [{ phone: rawDigits }, { phone: `+91${rawDigits}` }] : []),
    ],
  });
  if (existingDriver) {
    throw errors.conflict('A driver with this phone number already exists');
  }

  let user = await User.findOne({
    $or: [
      { phone: normalizedPhone },
      { phone },
      ...(rawDigits ? [{ phone: rawDigits }, { phone: `+91${rawDigits}` }] : []),
    ],
  });
  let userCreatedInThisRequest = false;

  if (user) {
    // If the user already exists, verify they aren't linked to another driver
    const linkedDriver = await Driver.findOne({ userId: user._id });
    if (linkedDriver) {
      throw errors.conflict('User account is already linked to another driver');
    }
    // Reuse existing user and ensure role is DRIVER and phone is normalized
    user.role = UserRole.DRIVER;
    user.status = UserStatus.ACTIVE;
    user.phone = normalizedPhone;
    if (name) user.name = name;
    if (email) user.email = email;
    await user.save();
  } else {
    user = await User.create({ name, phone: normalizedPhone, email, role: UserRole.DRIVER, status: UserStatus.ACTIVE });
    userCreatedInThisRequest = true;
  }

  const count = await Driver.countDocuments();
  const { generateDriverCode } = await import('@/utils/idGenerator');
  const driverCode = generateDriverCode(count + 1);

  const safeAddress = {
    line1: address?.line1?.trim() || 'Kollur',
    line2: address?.line2?.trim() || '',
    city: address?.city?.trim() || 'Kollur',
    state: address?.state?.trim() || 'Karnataka',
    pincode: address?.pincode?.trim() || '576220',
    country: address?.country?.trim() || 'India',
  };

  try {
    const driver = await Driver.create({
      userId: user._id,
      driverCode,
      name,
      phone: normalizedPhone,
      email,
      address: safeAddress,
      licenseNumber: licenseNumber || `KA-${Date.now().toString().slice(-8)}`,
      licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
      joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
    });

    res.status(201).json({ success: true, message: 'Driver created', data: driver });
  } catch (err) {
    if (userCreatedInThisRequest) {
      await User.findByIdAndDelete(user._id).catch(() => {});
    }
    throw err;
  }
});

router.put('/drivers/:id', requirePermission('driver.edit'), validate(updateDriverSchema), adminController.updateDriver.bind(adminController));
router.patch('/drivers/:id/status', requirePermission('driver.edit'), adminController.updateDriverStatus.bind(adminController));
router.delete('/drivers/purge-inactive', requirePermission('driver.edit'), async (req, res) => {
  const { Trip } = await import('@/models/Trip');
  const { QueueEntry } = await import('@/models/QueueEntry');
  const { Vehicle } = await import('@/models/Vehicle');
  const { User: UserModel } = await import('@/models/User');
  const { TripStatus, QueueEntryStatus } = await import('@gomookambika/types');

  const inactiveDrivers = await Driver.find({ status: { $in: ['INACTIVE', 'SUSPENDED'] } });
  let deletedCount = 0;
  for (const driver of inactiveDrivers) {
    const hasTrip = await Trip.exists({
      driverId: driver._id,
      status: { $in: [TripStatus.DRIVER_ASSIGNED, TripStatus.DRIVER_ACCEPTED, TripStatus.TRIP_STARTED, TripStatus.TRIP_IN_PROGRESS] },
    });
    const inQueue = await QueueEntry.exists({
      driverId: driver._id,
      status: { $in: [QueueEntryStatus.WAITING, QueueEntryStatus.OFFERED, QueueEntryStatus.ASSIGNED] },
    });
    if (!hasTrip && !inQueue) {
      await Vehicle.updateMany({ assignedDriverId: driver._id }, { $unset: { assignedDriverId: 1 } });
      await Driver.findByIdAndDelete(driver._id);
      if (driver.userId) {
        await UserModel.findByIdAndDelete(driver.userId);
      }
      deletedCount++;
    }
  }
  res.json({ success: true, message: `Permanently deleted ${deletedCount} inactive driver(s)`, count: deletedCount });
});

router.delete('/drivers/:id', requirePermission('driver.edit'), async (req, res) => {
  const isPermanent = req.query.permanent === 'true';
  const driver = await Driver.findById(req.params.id);
  if (!driver) throw errors.notFound('Driver');

  if (isPermanent) {
    const { Trip } = await import('@/models/Trip');
    const { QueueEntry } = await import('@/models/QueueEntry');
    const { Vehicle } = await import('@/models/Vehicle');
    const { User: UserModel } = await import('@/models/User');
    const { TripStatus, QueueEntryStatus } = await import('@gomookambika/types');

    const activeTrip = await Trip.findOne({
      driverId: driver._id,
      status: { $in: [TripStatus.DRIVER_ASSIGNED, TripStatus.DRIVER_ACCEPTED, TripStatus.TRIP_STARTED, TripStatus.TRIP_IN_PROGRESS] },
    });
    if (activeTrip) {
      throw errors.badRequest('Cannot permanently delete driver with an ongoing active trip.');
    }
    const inQueue = await QueueEntry.findOne({
      driverId: driver._id,
      status: { $in: [QueueEntryStatus.WAITING, QueueEntryStatus.OFFERED, QueueEntryStatus.ASSIGNED] },
    });
    if (inQueue) {
      throw errors.badRequest('Cannot permanently delete driver while in an active queue.');
    }

    await Vehicle.updateMany({ assignedDriverId: driver._id }, { $unset: { assignedDriverId: 1 } });
    await Driver.findByIdAndDelete(driver._id);
    if (driver.userId) {
      await UserModel.findByIdAndDelete(driver.userId);
    }
    res.json({ success: true, message: 'Driver permanently deleted' });
  } else {
    driver.status = 'INACTIVE' as any;
    await driver.save();
    if (driver.userId) {
      const { User: UserModel } = await import('@/models/User');
      await UserModel.findByIdAndUpdate(driver.userId, { status: 'INACTIVE' });
    }
    res.json({ success: true, message: 'Driver deactivated' });
  }
});

// ─── VEHICLES ────────────────────────────────────────────────
router.get('/vehicles', adminController.getVehicles.bind(adminController));
router.post('/vehicles', requirePermission('driver.create'), validate(createVehicleSchema), adminController.createVehicle.bind(adminController));
router.put('/vehicles/:id', requirePermission('driver.edit'), validate(updateVehicleSchema), adminController.updateVehicle.bind(adminController));
router.patch('/vehicles/:id', requirePermission('driver.edit'), async (req, res) => {
  const { Vehicle: VehicleModel } = await import('@/models/Vehicle');
  const v = await VehicleModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!v) throw errors.notFound('Vehicle');
  res.json({ success: true, message: 'Vehicle updated', data: v });
});
router.delete('/vehicles/purge-inactive', requirePermission('driver.edit'), async (req, res) => {
  const { Vehicle: VehicleModel } = await import('@/models/Vehicle');
  const { Trip } = await import('@/models/Trip');
  const { QueueEntry } = await import('@/models/QueueEntry');
  const { VehicleStatus, TripStatus, QueueEntryStatus } = await import('@gomookambika/types');

  const inactiveVehicles = await VehicleModel.find({ status: VehicleStatus.INACTIVE });
  let deletedCount = 0;
  for (const v of inactiveVehicles) {
    const hasTrip = await Trip.exists({
      vehicleId: v._id,
      status: { $in: [TripStatus.DRIVER_ASSIGNED, TripStatus.DRIVER_ACCEPTED, TripStatus.TRIP_STARTED, TripStatus.TRIP_IN_PROGRESS] },
    });
    const inQueue = await QueueEntry.exists({
      vehicleId: v._id,
      status: { $in: [QueueEntryStatus.WAITING, QueueEntryStatus.OFFERED, QueueEntryStatus.ASSIGNED] },
    });
    if (!hasTrip && !inQueue) {
      await VehicleModel.findByIdAndDelete(v._id);
      deletedCount++;
    }
  }
  res.json({ success: true, message: `Permanently deleted ${deletedCount} inactive vehicle(s)`, count: deletedCount });
});
router.delete('/vehicles/:id', requirePermission('driver.edit'), async (req, res) => {
  const isPermanent = req.query.permanent === 'true';
  const { Vehicle: VehicleModel } = await import('@/models/Vehicle');
  const v = await VehicleModel.findById(req.params.id);
  if (!v) throw errors.notFound('Vehicle');

  if (isPermanent) {
    const { Trip } = await import('@/models/Trip');
    const { QueueEntry } = await import('@/models/QueueEntry');
    const { TripStatus, QueueEntryStatus } = await import('@gomookambika/types');

    const activeTrip = await Trip.findOne({
      vehicleId: v._id,
      status: { $in: [TripStatus.DRIVER_ASSIGNED, TripStatus.DRIVER_ACCEPTED, TripStatus.TRIP_STARTED, TripStatus.TRIP_IN_PROGRESS] },
    });
    if (activeTrip) {
      throw errors.badRequest('Cannot permanently delete vehicle with an ongoing trip.');
    }
    const inQueue = await QueueEntry.findOne({
      vehicleId: v._id,
      status: { $in: [QueueEntryStatus.WAITING, QueueEntryStatus.OFFERED, QueueEntryStatus.ASSIGNED] },
    });
    if (inQueue) {
      throw errors.badRequest('Cannot permanently delete vehicle currently waiting in queue.');
    }
    await VehicleModel.findByIdAndDelete(v._id);
    res.json({ success: true, message: 'Vehicle permanently deleted' });
  } else {
    const { VehicleStatus } = await import('@gomookambika/types');
    v.status = VehicleStatus.INACTIVE;
    await v.save();
    res.json({ success: true, message: 'Vehicle deactivated' });
  }
});

// ─── VEHICLE CATEGORIES ──────────────────────────────────────
router.get('/vehicle-categories', adminController.getVehicleCategories.bind(adminController));
router.post(
  '/vehicle-categories/upload-icon',
  requirePermission('pricing.create'),
  vehicleIconUpload.single('icon') as any,
  (req: any, res: any) => {
    if (!req.file) {
      throw errors.badRequest('No PNG icon file provided');
    }
    const fileUrl = `/uploads/vehicle-categories/${req.file.filename}`;
    res.json({
      success: true,
      message: 'Vehicle icon uploaded successfully',
      data: {
        url: fileUrl,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
    });
  }
);
router.post(
  '/vehicle-categories/test-fare',
  requirePermission('pricing.create'),
  async (req, res) => {
    const { fareService } = await import('@/services/FareService');
    const result = await fareService.calculateFare(req.body);
    res.json({ success: true, data: result });
  }
);
router.post('/vehicle-categories', requirePermission('pricing.create'), validate(createVehicleCategorySchema), adminController.createVehicleCategory.bind(adminController));
router.put('/vehicle-categories/:id', requirePermission('pricing.edit'), validate(updateVehicleCategorySchema), adminController.updateVehicleCategory.bind(adminController));
router.patch('/vehicle-categories/:id', requirePermission('pricing.edit'), async (req, res) => {
  const { VehicleCategory: VCModel } = await import('@/models/VehicleCategory');
  const vc = await VCModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!vc) throw errors.notFound('Vehicle category');
  res.json({ success: true, message: 'Vehicle category updated', data: vc });
});
router.delete('/vehicle-categories/purge-inactive', requirePermission('pricing.edit'), async (req, res) => {
  const { VehicleCategory: VCModel } = await import('@/models/VehicleCategory');
  const { Vehicle: VehicleModel } = await import('@/models/Vehicle');
  const { Status } = await import('@gomookambika/types');

  const inactiveCats = await VCModel.find({ status: Status.INACTIVE });
  let deletedCount = 0;
  for (const c of inactiveCats) {
    const hasVehicle = await VehicleModel.exists({ categoryId: c._id });
    if (!hasVehicle) {
      await VCModel.findByIdAndDelete(c._id);
      deletedCount++;
    }
  }
  res.json({ success: true, message: `Permanently deleted ${deletedCount} inactive category/categories`, count: deletedCount });
});
router.delete('/vehicle-categories/:id', requirePermission('pricing.edit'), async (req, res) => {
  const isPermanent = req.query.permanent === 'true';
  const { VehicleCategory: VCModel } = await import('@/models/VehicleCategory');
  const vc = await VCModel.findById(req.params.id);
  if (!vc) throw errors.notFound('Vehicle category');

  if (isPermanent) {
    const { Vehicle: VehicleModel } = await import('@/models/Vehicle');
    const assignedVehicles = await VehicleModel.countDocuments({ categoryId: vc._id });
    if (assignedVehicles > 0) {
      throw errors.badRequest(`Cannot permanently delete category: ${assignedVehicles} vehicle(s) are assigned to it. Reassign or delete them first.`);
    }
    await VCModel.findByIdAndDelete(vc._id);
    res.json({ success: true, message: 'Vehicle category permanently deleted' });
  } else {
    const { Status } = await import('@gomookambika/types');
    vc.status = Status.INACTIVE;
    await vc.save();
    res.json({ success: true, message: 'Vehicle category deactivated' });
  }
});

// ─── LOCATIONS ───────────────────────────────────────────────
router.get('/locations', adminController.getLocations.bind(adminController));
router.post('/locations', requirePermission('booking.create'), validate(createLocationSchema), adminController.createLocation.bind(adminController));
router.put('/locations/:id', requirePermission('booking.edit'), validate(updateLocationSchema), adminController.updateLocation.bind(adminController));
router.patch('/locations/:id', requirePermission('booking.edit'), async (req, res) => {
  const { Location: LocModel } = await import('@/models/Location');
  const loc = await LocModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!loc) throw errors.notFound('Location');
  res.json({ success: true, message: 'Location updated', data: loc });
});
router.delete('/locations/purge-inactive', requirePermission('booking.edit'), async (req, res) => {
  const { Location: LocModel } = await import('@/models/Location');
  const { TaxiStand: TSModel } = await import('@/models/TaxiStand');
  const { Status } = await import('@gomookambika/types');

  const inactiveLocs = await LocModel.find({ status: Status.INACTIVE });
  let deletedCount = 0;
  for (const loc of inactiveLocs) {
    const linkedStand = await TSModel.exists({ locationId: loc._id });
    if (!linkedStand) {
      await LocModel.findByIdAndDelete(loc._id);
      deletedCount++;
    }
  }
  res.json({ success: true, message: `Permanently deleted ${deletedCount} inactive location(s)`, count: deletedCount });
});
router.delete('/locations/:id', requirePermission('booking.edit'), async (req, res) => {
  const isPermanent = req.query.permanent === 'true';
  const { Location: LocModel } = await import('@/models/Location');
  const loc = await LocModel.findById(req.params.id);
  if (!loc) throw errors.notFound('Location');

  if (isPermanent) {
    const { TaxiStand: TSModel } = await import('@/models/TaxiStand');
    const linkedStand = await TSModel.findOne({ locationId: loc._id });
    if (linkedStand) {
      throw errors.badRequest(`Cannot permanently delete location: linked to taxi stand "${linkedStand.name}". Please reassign or delete the taxi stand first.`);
    }
    await LocModel.findByIdAndDelete(loc._id);
    res.json({ success: true, message: 'Location permanently deleted' });
  } else {
    const { Status } = await import('@gomookambika/types');
    loc.status = Status.INACTIVE;
    await loc.save();
    res.json({ success: true, message: 'Location deactivated' });
  }
});

// ─── TAXI STANDS ─────────────────────────────────────────────
router.get('/taxi-stands', adminController.getTaxiStands.bind(adminController));
router.post('/taxi-stands', requirePermission('queue.manage'), validate(createTaxiStandSchema), adminController.createTaxiStand.bind(adminController));
router.put('/taxi-stands/:id', requirePermission('queue.manage'), async (req, res) => {
  const stand = await (await import('@/models/TaxiStand')).TaxiStand.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!stand) throw errors.notFound('Taxi stand');
  res.json({ success: true, message: 'Taxi stand updated', data: stand });
});
router.patch('/taxi-stands/:id', requirePermission('queue.manage'), async (req, res) => {
  const stand = await (await import('@/models/TaxiStand')).TaxiStand.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!stand) throw errors.notFound('Taxi stand');
  res.json({ success: true, message: 'Taxi stand updated', data: stand });
});
router.delete('/taxi-stands/purge-inactive', requirePermission('queue.manage'), async (req, res) => {
  const { TaxiStand: TSModel } = await import('@/models/TaxiStand');
  const { QueueEntry } = await import('@/models/QueueEntry');
  const { Status, QueueEntryStatus } = await import('@gomookambika/types');

  const inactiveStands = await TSModel.find({ status: Status.INACTIVE });
  let deletedCount = 0;
  for (const stand of inactiveStands) {
    const inQueue = await QueueEntry.exists({
      taxiStandId: stand._id,
      status: { $in: [QueueEntryStatus.WAITING, QueueEntryStatus.OFFERED, QueueEntryStatus.ASSIGNED] },
    });
    if (!inQueue) {
      await TSModel.findByIdAndDelete(stand._id);
      deletedCount++;
    }
  }
  res.json({ success: true, message: `Permanently deleted ${deletedCount} inactive taxi stand(s)`, count: deletedCount });
});
router.delete('/taxi-stands/:id', requirePermission('queue.manage'), async (req, res) => {
  const isPermanent = req.query.permanent === 'true';
  const { TaxiStand: TSModel } = await import('@/models/TaxiStand');
  const stand = await TSModel.findById(req.params.id);
  if (!stand) throw errors.notFound('Taxi stand');

  if (isPermanent) {
    const { QueueEntry } = await import('@/models/QueueEntry');
    const { QueueEntryStatus } = await import('@gomookambika/types');
    const inQueue = await QueueEntry.findOne({
      taxiStandId: stand._id,
      status: { $in: [QueueEntryStatus.WAITING, QueueEntryStatus.OFFERED, QueueEntryStatus.ASSIGNED] },
    });
    if (inQueue) {
      throw errors.badRequest('Cannot permanently delete taxi stand with active queue entries.');
    }
    await TSModel.findByIdAndDelete(stand._id);
    res.json({ success: true, message: 'Taxi stand permanently deleted' });
  } else {
    const { Status } = await import('@gomookambika/types');
    stand.status = Status.INACTIVE;
    await stand.save();
    res.json({ success: true, message: 'Taxi stand deactivated' });
  }
});
router.post('/taxi-stands/:id/regenerate-qr', requirePermission('queue.manage'), adminController.regenerateQR.bind(adminController));
router.get('/taxi-stands/:id/queue', requirePermission('queue.view'), adminController.getQueueStatus.bind(adminController));


router.delete('/taxi-stands/:id/queue/:entryId', requirePermission('queue.manage'), async (req, res) => {
  const { QueueEntry } = await import('@/models/QueueEntry');
  const { Driver } = await import('@/models/Driver');
  const { DriverStatus, QueueEntryStatus } = await import('@gomookambika/types');
  const entry = await QueueEntry.findById(req.params.entryId);
  if (!entry) throw errors.notFound('Queue entry');

  const oldPos = entry.position;
  const standId = entry.taxiStandId;

  entry.status = QueueEntryStatus.REMOVED;
  entry.leftAt = new Date();
  entry.removalReason = 'ADMIN_REMOVAL';
  await entry.save();

  await Driver.findByIdAndUpdate(entry.driverId, {
    status: DriverStatus.AVAILABLE,
    activeQueueEntryId: null,
  });

  // Reorder positions for remaining drivers in queue
  await QueueEntry.updateMany(
    {
      taxiStandId: standId,
      status: QueueEntryStatus.WAITING,
      position: { $gt: oldPos },
    },
    { $inc: { position: -1 } }
  );

  res.json({ success: true, message: 'Driver removed from queue' });
});


// ─── BOOKINGS (admin view) ───────────────────────────────────
router.get('/bookings/stats', requirePermission('booking.view'), async (_req, res) => {
  const { Booking } = await import('@/models/Booking');
  const [total, live, completed, cancelled, revenueAgg] = await Promise.all([
    Booking.countDocuments({}),
    Booking.countDocuments({
      status: { $in: ['CONFIRMED', 'DRIVER_ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'TRIP_STARTED'] },
    }),
    Booking.countDocuments({ status: 'COMPLETED' }),
    Booking.countDocuments({ status: { $in: ['CANCELLED', 'EXPIRED'] } }),
    Booking.aggregate([
      { $match: { paymentStatus: 'PAID' } },
      { $group: { _id: null, total: { $sum: '$fareSnapshot.total' } } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      total,
      live,
      completed,
      cancelled,
      totalRevenue: revenueAgg[0]?.total ?? 0,
    },
  });
});

router.get('/bookings', requirePermission('booking.view'), async (req, res) => {
  const { Booking } = await import('@/models/Booking');
  const { User } = await import('@/models/User');

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const search = req.query.search ? String(req.query.search).trim() : '';
  const status = req.query.status ? String(req.query.status).trim() : '';
  const tripType = req.query.tripType ? String(req.query.tripType).trim() : '';
  const paymentStatus = req.query.paymentStatus ? String(req.query.paymentStatus).trim() : '';
  const vehicleCategoryId = req.query.vehicleCategoryId ? String(req.query.vehicleCategoryId).trim() : '';

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (tripType) filter.tripType = tripType;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (vehicleCategoryId) filter.vehicleCategoryId = vehicleCategoryId;

  if (search) {
    const matchingUsers = await User.find({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ],
    }).select('_id');
    const userIds = matchingUsers.map(u => u._id);

    filter.$or = [
      { bookingNumber: { $regex: search, $options: 'i' } },
      { 'pickupLocation.address': { $regex: search, $options: 'i' } },
      { 'dropLocation.address': { $regex: search, $options: 'i' } },
      { customerId: { $in: userIds } },
    ];
  }

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('customerId', 'name phone email')
      .populate('assignedDriverId', 'name phone driverCode rating')
      .populate('assignedVehicleId', 'registrationNumber brand vehicleModel color manufacturingYear')
      .populate('vehicleCategoryId', 'name code icon baseFare ratePerKm')
      .populate('originTaxiStandId', 'name')
      .populate('destinationTaxiStandId', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Booking.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: bookings,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

router.get('/bookings/:id', requirePermission('booking.view'), async (req, res) => {
  const { Booking } = await import('@/models/Booking');
  const booking = await Booking.findById(req.params.id)
    .populate('customerId', 'name phone email')
    .populate('assignedDriverId', 'name phone driverCode rating')
    .populate('assignedVehicleId', 'registrationNumber brand vehicleModel color manufacturingYear')
    .populate('vehicleCategoryId', 'name code icon baseFare ratePerKm')
    .populate('originTaxiStandId', 'name')
    .populate('destinationTaxiStandId', 'name');

  if (!booking) throw errors.notFound('Booking');
  res.json({ success: true, data: booking });
});

// POST /admin/bookings - Dispatch new booking to queue driver
router.post('/bookings', requirePermission('booking.view'), async (req, res) => {
  const { User } = await import('@/models/User');
  const { Booking } = await import('@/models/Booking');
  const { bookingService } = await import('@/services/BookingService');

  const {
    customerName,
    customerPhone,
    customerEmail,
    tripType = 'ONE_WAY',
    originTaxiStandId,
    destinationTaxiStandId,
    pickupLocation,
    dropLocation,
    vehicleCategoryId,
    passengers = 1,
    paymentOption = 'CASH',
    notes,
    scheduledAt,
  } = req.body;

  if (!customerPhone || !pickupLocation || !vehicleCategoryId) {
    throw errors.badRequest('Customer phone, pickup location, and vehicle category are required');
  }

  // Normalize phone number
  const cleanPhone = String(customerPhone).replace(/\D/g, '').slice(-10);
  if (cleanPhone.length < 10) {
    throw errors.badRequest('Please enter a valid 10-digit mobile number');
  }
  const formattedPhone = `+91${cleanPhone}`;

  // Find or create customer
  let customer = await User.findOne({ phone: formattedPhone });
  if (!customer) {
    customer = await User.create({
      name: customerName?.trim() || `Customer ${cleanPhone.slice(-4)}`,
      phone: formattedPhone,
      email: customerEmail || `customer_${cleanPhone}@gomookambika.com`,
      role: UserRole.CUSTOMER,
      isPhoneVerified: true,
      status: 'ACTIVE',
    });
  } else if (customerName && customerName.trim() && customer.name !== customerName.trim()) {
    customer.name = customerName.trim();
    await customer.save();
  }

  const booking = await bookingService.createBooking({
    customerId: customer._id.toString(),
    tripType,
    pickupLocation,
    dropLocation,
    vehicleCategoryId,
    originTaxiStandId: originTaxiStandId || undefined,
    destinationTaxiStandId: destinationTaxiStandId || undefined,
    passengers: Number(passengers) || 1,
    paymentOption,
    notes,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
  });

  // Populate references for the response
  const populatedBooking = await Booking.findById(booking._id)
    .populate('customerId', 'name phone email')
    .populate('assignedDriverId', 'name phone driverCode rating')
    .populate('assignedVehicleId', 'registrationNumber brand vehicleModel')
    .populate('vehicleCategoryId', 'name code icon baseFare ratePerKm')
    .populate('originTaxiStandId', 'name')
    .populate('destinationTaxiStandId', 'name');

  res.status(201).json({
    success: true,
    message: 'Booking created successfully and dispatched to queue!',
    data: populatedBooking,
  });
});

// ─── AUDIT LOGS ──────────────────────────────────────────────
router.get('/audit-logs', requirePermission('report.view'), adminController.getAuditLogs.bind(adminController));

// ─── USERS & ROLES ───────────────────────────────────────────
router.post('/users', requireRoles(UserRole.SUPER_ADMIN), adminController.createAdminUser.bind(adminController));

// ─── SYSTEM SETTINGS ─────────────────────────────────────────
const DEFAULT_SYSTEM_SETTINGS: Record<string, unknown> = {
  // Association Profile
  platformName: 'Go Mookambika Tourist Taxi Association',
  registrationNumber: 'KA-UD-TA-2024-089',
  supportPhone: '+91 94812 00000',
  supportEmail: 'support@gomookambika.com',
  officeAddress: 'Car Street, Near Mookambika Temple, Kollur, Udupi Dist, Karnataka - 576220',
  operatingRegion: 'Kollur, Byndoor & Coastal Karnataka',

  // Queue Operations
  defaultQueueRadius: 150,
  heartbeatInterval: 30,
  heartbeatGracePeriod: 120,
  maxMissedHeartbeats: 3,
  queuePolicy: 'FIFO',
  allowAutoQueueExitOnDrift: true,

  // Dispatch & Trip Allocation
  driverAcceptTimeout: 30,
  maxDeclineCount: 3,
  declinePenaltyPolicy: 'MOVE_TO_END',
  driverPauseDurationMinutes: 15,
  autoCancelUnassignedMinutes: 15,
  advanceBookingMaxDays: 30,

  // Safety & Passenger Policy
  requireRideStartOTP: true,
  emergencySosContact: '+91 94812 00000',
  lostAndFoundHelpline: '+91 94812 00001',
  nightTravelAdvisory: 'Certified hill-route drivers with 24x7 control room tracking on all ghat and night journeys.',
};

router.get('/settings', async (_req, res) => {
  const { SystemSetting } = await import('@/models/SystemSetting');
  const dbSettings = await SystemSetting.find();
  const merged: Record<string, unknown> = { ...DEFAULT_SYSTEM_SETTINGS };
  for (const doc of dbSettings) {
    merged[doc.key] = doc.value;
  }
  res.json({ success: true, data: merged });
});

router.put('/settings', requireRoles(UserRole.SUPER_ADMIN, UserRole.ASSOCIATION_ADMIN), async (req, res) => {
  const { SystemSetting } = await import('@/models/SystemSetting');
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    throw errors.badRequest('Invalid settings payload');
  }

  const categoryMap: Record<string, 'association' | 'queue' | 'dispatch' | 'safety'> = {
    platformName: 'association',
    registrationNumber: 'association',
    supportPhone: 'association',
    supportEmail: 'association',
    officeAddress: 'association',
    operatingRegion: 'association',
    defaultQueueRadius: 'queue',
    heartbeatInterval: 'queue',
    heartbeatGracePeriod: 'queue',
    maxMissedHeartbeats: 'queue',
    queuePolicy: 'queue',
    allowAutoQueueExitOnDrift: 'queue',
    driverAcceptTimeout: 'dispatch',
    maxDeclineCount: 'dispatch',
    declinePenaltyPolicy: 'dispatch',
    driverPauseDurationMinutes: 'dispatch',
    autoCancelUnassignedMinutes: 'dispatch',
    advanceBookingMaxDays: 'dispatch',
    requireRideStartOTP: 'safety',
    emergencySosContact: 'safety',
    lostAndFoundHelpline: 'safety',
    nightTravelAdvisory: 'safety',
  };

  const ops = Object.entries(updates).map(([key, value]) => {
    const category = categoryMap[key] || 'association';
    return SystemSetting.findOneAndUpdate(
      { key },
      { key, value, category, updatedBy: (req as any).user?.userId },
      { upsert: true, new: true }
    );
  });

  await Promise.all(ops);

  const dbSettings = await SystemSetting.find();
  const merged: Record<string, unknown> = { ...DEFAULT_SYSTEM_SETTINGS };
  for (const doc of dbSettings) {
    merged[doc.key] = doc.value;
  }

  res.json({ success: true, message: 'Settings saved successfully', data: merged });
});

// ─── FIXED ROUTE FARES & PRICING RULES ────────────────────────
router.get('/pricing-rules', async (req, res) => {
  const { PricingRule } = await import('@/models/PricingRule');
  const { search, ruleType, vehicleCategoryId, status, page = 1, limit = 50 } = req.query;

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (ruleType) filter.ruleType = ruleType;
  if (vehicleCategoryId) filter.vehicleCategoryId = vehicleCategoryId;
  if (search) {
    filter.$or = [
      { name: { $regex: search as string, $options: 'i' } },
      { description: { $regex: search as string, $options: 'i' } },
    ];
  }

  const p = Math.max(1, Number(page));
  const l = Math.min(100, Math.max(1, Number(limit)));

  const [rules, total] = await Promise.all([
    PricingRule.find(filter)
      .populate('originLocationId', 'name type address')
      .populate('destinationLocationId', 'name type address')
      .populate('vehicleCategoryId', 'name code')
      .sort({ priority: 1, createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l),
    PricingRule.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: rules,
    pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) },
  });
});

router.get('/pricing-rules/:id', async (req, res) => {
  const { PricingRule } = await import('@/models/PricingRule');
  const rule = await PricingRule.findById(req.params.id)
    .populate('originLocationId', 'name type address geoPoint')
    .populate('destinationLocationId', 'name type address geoPoint')
    .populate('vehicleCategoryId', 'name code');
  if (!rule) throw errors.notFound('Pricing rule');
  res.json({ success: true, data: rule });
});

router.post('/pricing-rules', async (req, res) => {
  const { PricingRule } = await import('@/models/PricingRule');
  const {
    name,
    ruleType = 'FIXED',
    priority = 50,
    vehicleCategoryId,
    originLocationId,
    destinationLocationId,
    isBidirectional = true,
    tripType,
    fixedPrice,
    baseFare,
    minimumKm,
    ratePerKm,
    includedKm,
    extraKmRate,
    description,
    status = 'ACTIVE',
  } = req.body;

  if (!name?.trim()) throw errors.badRequest('Route or rule name is required');
  if (ruleType === 'FIXED' || ruleType === 'LOCATION_TO_LOCATION') {
    if (fixedPrice === undefined || fixedPrice === null || Number(fixedPrice) < 0) {
      throw errors.badRequest('Fixed price amount is required for fixed fare rules');
    }
  }

  const rule = await PricingRule.create({
    name: name.trim(),
    ruleType,
    priority: Number(priority) || 50,
    vehicleCategoryId: vehicleCategoryId || undefined,
    originLocationId: originLocationId || undefined,
    destinationLocationId: destinationLocationId || undefined,
    isBidirectional: isBidirectional !== false,
    tripType: tripType || undefined,
    fixedPrice: fixedPrice !== undefined ? Number(fixedPrice) : undefined,
    baseFare: baseFare !== undefined ? Number(baseFare) : undefined,
    minimumKm: minimumKm !== undefined ? Number(minimumKm) : undefined,
    ratePerKm: ratePerKm !== undefined ? Number(ratePerKm) : undefined,
    includedKm: includedKm !== undefined ? Number(includedKm) : undefined,
    extraKmRate: extraKmRate !== undefined ? Number(extraKmRate) : undefined,
    description: description?.trim() || undefined,
    status,
    createdBy: (req as any).user?.userId,
  });

  const populated = await PricingRule.findById(rule._id)
    .populate('originLocationId', 'name type address')
    .populate('destinationLocationId', 'name type address')
    .populate('vehicleCategoryId', 'name code');

  res.status(201).json({ success: true, message: 'Pricing rule created successfully', data: populated });
});

router.put('/pricing-rules/:id', async (req, res) => {
  const { PricingRule } = await import('@/models/PricingRule');
  const rule = await PricingRule.findById(req.params.id);
  if (!rule) throw errors.notFound('Pricing rule');

  const {
    name,
    ruleType,
    priority,
    vehicleCategoryId,
    originLocationId,
    destinationLocationId,
    isBidirectional,
    tripType,
    fixedPrice,
    baseFare,
    minimumKm,
    ratePerKm,
    includedKm,
    extraKmRate,
    description,
    status,
  } = req.body;

  if (name !== undefined) rule.name = name.trim();
  if (ruleType !== undefined) rule.ruleType = ruleType;
  if (priority !== undefined) rule.priority = Number(priority);
  rule.vehicleCategoryId = vehicleCategoryId || undefined;
  rule.originLocationId = originLocationId || undefined;
  rule.destinationLocationId = destinationLocationId || undefined;
  if (isBidirectional !== undefined) rule.isBidirectional = Boolean(isBidirectional);
  if (tripType !== undefined) rule.tripType = tripType || undefined;
  if (fixedPrice !== undefined) rule.fixedPrice = fixedPrice !== '' ? Number(fixedPrice) : undefined;
  if (baseFare !== undefined) rule.baseFare = baseFare !== '' ? Number(baseFare) : undefined;
  if (minimumKm !== undefined) rule.minimumKm = minimumKm !== '' ? Number(minimumKm) : undefined;
  if (ratePerKm !== undefined) rule.ratePerKm = ratePerKm !== '' ? Number(ratePerKm) : undefined;
  if (includedKm !== undefined) rule.includedKm = includedKm !== '' ? Number(includedKm) : undefined;
  if (extraKmRate !== undefined) rule.extraKmRate = extraKmRate !== '' ? Number(extraKmRate) : undefined;
  if (description !== undefined) rule.description = description?.trim() || undefined;
  if (status !== undefined) rule.status = status;

  await rule.save();

  const populated = await PricingRule.findById(rule._id)
    .populate('originLocationId', 'name type address')
    .populate('destinationLocationId', 'name type address')
    .populate('vehicleCategoryId', 'name code');

  res.json({ success: true, message: 'Pricing rule updated successfully', data: populated });
});

router.patch('/pricing-rules/:id/status', async (req, res) => {
  const { PricingRule } = await import('@/models/PricingRule');
  const { status } = req.body;
  const rule = await PricingRule.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  )
    .populate('originLocationId', 'name type address')
    .populate('destinationLocationId', 'name type address')
    .populate('vehicleCategoryId', 'name code');

  if (!rule) throw errors.notFound('Pricing rule');
  res.json({ success: true, message: `Status updated to ${status}`, data: rule });
});

router.delete('/pricing-rules/:id', async (req, res) => {
  const { PricingRule } = await import('@/models/PricingRule');
  const rule = await PricingRule.findByIdAndDelete(req.params.id);
  if (!rule) throw errors.notFound('Pricing rule');
  res.json({ success: true, message: 'Pricing rule deleted successfully' });
});

router.post('/pricing-rules/seed-defaults', async (req, res) => {
  const { PricingRule } = await import('@/models/PricingRule');
  const { Location } = await import('@/models/Location');
  const { VehicleCategory } = await import('@/models/VehicleCategory');

  // Find or create default locations
  let kollurTemple = await Location.findOne({ $or: [{ code: 'KOLLUR_SRI_MOOKAMBIK' }, { name: { $regex: /kollur.*mookambika/i } }] });
  if (!kollurTemple) {
    kollurTemple = await Location.create({
      name: 'Kollur Sri Mookambika Temple',
      code: 'LOC-KOLLUR-TEMPLE',
      type: 'TAXI_STAND',
      address: { line1: 'Temple Car Street', city: 'Kollur', state: 'Karnataka', pincode: '576220', country: 'India' },
      geoPoint: { type: 'Point', coordinates: [74.8135, 13.8647] },
      status: 'ACTIVE',
      bookingEnabled: true,
      createdBy: (req as any).user?.userId,
    });
  }

  let byndoorStation = await Location.findOne({ $or: [{ code: 'MOOKAMBIKA_ROAD' }, { code: 'LOC-BYNDOOR-STN' }, { name: { $regex: /byndoor/i } }] });
  if (!byndoorStation) {
    byndoorStation = await Location.create({
      name: 'Mookambika Road Byndoor (Railway Station)',
      code: 'LOC-BYNDOOR-STN',
      type: 'TAXI_STAND',
      address: { line1: 'Railway Station Road', city: 'Byndoor', state: 'Karnataka', pincode: '576214', country: 'India' },
      geoPoint: { type: 'Point', coordinates: [74.6369, 13.8741] },
      status: 'ACTIVE',
      bookingEnabled: true,
      createdBy: (req as any).user?.userId,
    });
  }

  let udupiKrishna = await Location.findOne({ name: { $regex: /udupi/i } });
  if (!udupiKrishna) {
    udupiKrishna = await Location.create({
      name: 'Udupi Sri Krishna Matha',
      code: 'LOC-UDUPI-MATHA',
      type: 'TEMPLE',
      address: { line1: 'Car Street', city: 'Udupi', state: 'Karnataka', pincode: '576101', country: 'India' },
      geoPoint: { type: 'Point', coordinates: [74.7525, 13.3409] },
      status: 'ACTIVE',
      bookingEnabled: true,
      createdBy: (req as any).user?.userId,
    });
  }

  let mangaloreAirport = await Location.findOne({ name: { $regex: /mangalore.*airport/i } });
  if (!mangaloreAirport) {
    mangaloreAirport = await Location.create({
      name: 'Mangalore International Airport (IXE)',
      code: 'LOC-IXE-AIRPORT',
      type: 'AIRPORT',
      address: { line1: 'Kenjar', city: 'Mangalore', state: 'Karnataka', pincode: '574142', country: 'India' },
      geoPoint: { type: 'Point', coordinates: [74.8900, 12.9613] },
      status: 'ACTIVE',
      bookingEnabled: true,
      createdBy: (req as any).user?.userId,
    });
  }

  let murudeshwar = await Location.findOne({ name: { $regex: /murudeshwar/i } });
  if (!murudeshwar) {
    murudeshwar = await Location.create({
      name: 'Murudeshwar Temple & Beach',
      code: 'LOC-MURUDESHWAR',
      type: 'TOURIST_LOCATION',
      address: { line1: 'Bhatkal Taluk', city: 'Murudeshwar', state: 'Karnataka', pincode: '581350', country: 'India' },
      geoPoint: { type: 'Point', coordinates: [74.4849, 14.0941] },
      status: 'ACTIVE',
      bookingEnabled: true,
      createdBy: (req as any).user?.userId,
    });
  }

  // Get active vehicle categories
  const categories = await VehicleCategory.find({ status: 'ACTIVE' });
  const sedanCat = categories.find(c => c.code === 'SEDAN') || categories[0];

  const defaultRoutes = [
    {
      name: 'Kollur Temple ⇄ Byndoor Station',
      originLocationId: kollurTemple._id,
      destinationLocationId: byndoorStation._id,
      vehicleCategoryId: sedanCat?._id,
      fixedPrice: 800,
      includedKm: 32,
      extraKmRate: 18,
      isBidirectional: true,
      ruleType: 'FIXED',
      priority: 10,
      description: 'Fixed taxi fare between Kollur Temple and Byndoor Railway Station',
    },
    {
      name: 'Kollur Temple ⇄ Udupi Krishna Matha',
      originLocationId: kollurTemple._id,
      destinationLocationId: udupiKrishna._id,
      vehicleCategoryId: sedanCat?._id,
      fixedPrice: 2200,
      includedKm: 80,
      extraKmRate: 18,
      isBidirectional: true,
      ruleType: 'FIXED',
      priority: 20,
      description: 'Direct pilgrimage route between Kollur and Udupi',
    },
    {
      name: 'Kollur Temple ⇄ Mangalore Airport (IXE)',
      originLocationId: kollurTemple._id,
      destinationLocationId: mangaloreAirport._id,
      vehicleCategoryId: sedanCat?._id,
      fixedPrice: 3800,
      includedKm: 135,
      extraKmRate: 20,
      isBidirectional: true,
      ruleType: 'FIXED',
      priority: 15,
      description: 'Airport transfer fixed package rate',
    },
    {
      name: 'Kollur Temple ⇄ Murudeshwar Temple',
      originLocationId: kollurTemple._id,
      destinationLocationId: murudeshwar._id,
      vehicleCategoryId: sedanCat?._id,
      fixedPrice: 1900,
      includedKm: 65,
      extraKmRate: 18,
      isBidirectional: true,
      ruleType: 'FIXED',
      priority: 25,
      description: 'Coastal temple tour between Kollur and Murudeshwar',
    },
  ];

  let createdCount = 0;
  for (const r of defaultRoutes) {
    const existing = await PricingRule.findOne({
      originLocationId: r.originLocationId,
      destinationLocationId: r.destinationLocationId,
    });
    if (!existing) {
      await PricingRule.create({
        ...r,
        status: 'ACTIVE',
        createdBy: (req as any).user?.userId,
      });
      createdCount++;
    }
  }

  const allRules = await PricingRule.find()
    .populate('originLocationId', 'name type address')
    .populate('destinationLocationId', 'name type address')
    .populate('vehicleCategoryId', 'name code');

  res.json({
    success: true,
    message: `Default fixed routes seeded successfully (${createdCount} added)`,
    data: allRules,
  });
});

export default router;
