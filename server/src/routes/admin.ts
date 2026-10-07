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
import { UserRole } from '@gomookambika/types';
import { Driver } from '@/models/Driver';
import { User } from '@/models/User';
import { errors } from '@/middlewares/errorHandler';
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

  const existingUser = await User.findOne({ phone });
  if (existingUser) throw errors.conflict('User with this phone already exists');

  // Create user account
  const user = await User.create({ name, phone, email, role: UserRole.DRIVER, status: 'ACTIVE' });

  const count = await Driver.countDocuments();
  const { generateDriverCode } = await import('@/utils/idGenerator');
  const driverCode = generateDriverCode(count + 1);

  const driver = await Driver.create({
    userId: user._id,
    driverCode,
    name, phone, email,
    address,
    licenseNumber,
    licenseExpiry: new Date(licenseExpiry),
    joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
  });

  res.status(201).json({ success: true, message: 'Driver created', data: driver });
});

router.put('/drivers/:id', requirePermission('driver.edit'), validate(updateDriverSchema), adminController.updateDriver.bind(adminController));
router.patch('/drivers/:id/status', requirePermission('driver.edit'), adminController.updateDriverStatus.bind(adminController));
router.delete('/drivers/:id', requirePermission('driver.edit'), async (req, res) => {
  const driver = await Driver.findByIdAndUpdate(req.params.id, { status: 'INACTIVE' }, { new: true });
  if (!driver) throw errors.notFound('Driver');
  const { User: UserModel } = await import('@/models/User');
  await UserModel.findByIdAndUpdate(driver.userId, { status: 'INACTIVE' });
  res.json({ success: true, message: 'Driver deactivated' });
});

// ─── VEHICLES ────────────────────────────────────────────────
router.get('/vehicles', adminController.getVehicles.bind(adminController));
router.post('/vehicles', requirePermission('driver.create'), validate(createVehicleSchema), adminController.createVehicle.bind(adminController));
router.put('/vehicles/:id', requirePermission('driver.edit'), validate(updateVehicleSchema), adminController.updateVehicle.bind(adminController));
router.delete('/vehicles/:id', requirePermission('driver.edit'), async (req, res) => {
  const { Vehicle: VehicleModel } = await import('@/models/Vehicle');
  const { VehicleStatus } = await import('@gomookambika/types');
  const v = await VehicleModel.findByIdAndUpdate(req.params.id, { status: VehicleStatus.INACTIVE }, { new: true });
  if (!v) throw errors.notFound('Vehicle');
  res.json({ success: true, message: 'Vehicle deactivated' });
});

// ─── VEHICLE CATEGORIES ──────────────────────────────────────
router.get('/vehicle-categories', adminController.getVehicleCategories.bind(adminController));
router.post('/vehicle-categories', requirePermission('pricing.create'), validate(createVehicleCategorySchema), adminController.createVehicleCategory.bind(adminController));
router.put('/vehicle-categories/:id', requirePermission('pricing.edit'), validate(updateVehicleCategorySchema), adminController.updateVehicleCategory.bind(adminController));
router.delete('/vehicle-categories/:id', requirePermission('pricing.edit'), async (req, res) => {
  const { VehicleCategory: VCModel } = await import('@/models/VehicleCategory');
  const { Status } = await import('@gomookambika/types');
  const vc = await VCModel.findByIdAndUpdate(req.params.id, { status: Status.INACTIVE }, { new: true });
  if (!vc) throw errors.notFound('Vehicle category');
  res.json({ success: true, message: 'Vehicle category deactivated' });
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
router.delete('/locations/:id', requirePermission('booking.edit'), async (req, res) => {
  const { Location: LocModel } = await import('@/models/Location');
  const { Status } = await import('@gomookambika/types');
  const loc = await LocModel.findByIdAndUpdate(req.params.id, { status: Status.INACTIVE }, { new: true });
  if (!loc) throw errors.notFound('Location');
  res.json({ success: true, message: 'Location deactivated' });
});

// ─── TAXI STANDS ─────────────────────────────────────────────
router.get('/taxi-stands', adminController.getTaxiStands.bind(adminController));
router.post('/taxi-stands', requirePermission('queue.manage'), validate(createTaxiStandSchema), adminController.createTaxiStand.bind(adminController));
router.put('/taxi-stands/:id', requirePermission('queue.manage'), async (req, res) => {
  const stand = await (await import('@/models/TaxiStand')).TaxiStand.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!stand) throw errors.notFound('Taxi stand');
  res.json({ success: true, message: 'Taxi stand updated', data: stand });
});
router.delete('/taxi-stands/:id', requirePermission('queue.manage'), async (req, res) => {
  const { TaxiStand: TSModel } = await import('@/models/TaxiStand');
  const { Status } = await import('@gomookambika/types');
  const stand = await TSModel.findByIdAndUpdate(req.params.id, { status: Status.INACTIVE }, { new: true });
  if (!stand) throw errors.notFound('Taxi stand');
  res.json({ success: true, message: 'Taxi stand deactivated' });
});
router.post('/taxi-stands/:id/regenerate-qr', requirePermission('queue.manage'), adminController.regenerateQR.bind(adminController));
router.get('/taxi-stands/:id/queue', requirePermission('queue.view'), adminController.getQueueStatus.bind(adminController));


// ─── BOOKINGS (admin view) ───────────────────────────────────
router.get('/bookings', requirePermission('booking.view'), async (req, res) => {
  const { Booking } = await import('@/models/Booking');
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const [bookings, total] = await Promise.all([
    Booking.find({})
      .populate('customerId', 'name phone')
      .populate('assignedDriverId', 'name phone')
      .populate('vehicleCategoryId', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Booking.countDocuments(),
  ]);
  res.json({ success: true, data: bookings, meta: { page, limit, total } });
});

// ─── AUDIT LOGS ──────────────────────────────────────────────
router.get('/audit-logs', requirePermission('report.view'), adminController.getAuditLogs.bind(adminController));

// ─── USERS & ROLES ───────────────────────────────────────────
router.post('/users', requireRoles(UserRole.SUPER_ADMIN), adminController.createAdminUser.bind(adminController));

export default router;
