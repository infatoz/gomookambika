import { Request, Response } from 'express';
import { Driver } from '@/models/Driver';
import { User } from '@/models/User';
import { Vehicle } from '@/models/Vehicle';
import { VehicleCategory } from '@/models/VehicleCategory';
import { Location } from '@/models/Location';
import { TaxiStand } from '@/models/TaxiStand';
import { QueueEntry } from '@/models/QueueEntry';
import { Booking } from '@/models/Booking';
import { Trip } from '@/models/Trip';
import { AuditLog } from '@/models/AuditLog';
import { qrService } from '@/services/QRService';
import { errors } from '@/middlewares/errorHandler';
import { logger } from '@/utils/logger';
import {
  UserRole,
  UserStatus,
  DriverStatus,
  TripStatus,
  QRStatus,
  QueueEntryStatus,
} from '@gomookambika/types';

function getPaginationOptions(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

// Helper to safely extract a single string from query param (which can be string | string[])
function qStr(val: unknown): string | undefined {
  if (!val) return undefined;
  if (Array.isArray(val)) return String(val[0]);
  return String(val);
}

function buildPaginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export class AdminController {
  // ─── DASHBOARD ───────────────────────────────────────────────

  async getDashboard(_req: Request, res: Response): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      todayBookings,
      todayRevenue,
      activeDrivers,
      driversInQueue,
      activeTrips,
      completedToday,
      cancelledToday,
      pendingPayments,
    ] = await Promise.all([
      Booking.countDocuments({ createdAt: { $gte: today } }),
      Booking.aggregate([
        { $match: { createdAt: { $gte: today }, paymentStatus: 'PAID' } },
        { $group: { _id: null, total: { $sum: '$fareSnapshot.total' } } },
      ]),
      Driver.countDocuments({ status: { $in: [DriverStatus.IN_QUEUE, DriverStatus.ON_TRIP, DriverStatus.TRIP_ACCEPTED] } }),
      Driver.countDocuments({ status: DriverStatus.IN_QUEUE }),
      Trip.countDocuments({ status: { $in: [TripStatus.TRIP_STARTED, TripStatus.TRIP_IN_PROGRESS] } }),
      Trip.countDocuments({ status: TripStatus.TRIP_COMPLETED, completedAt: { $gte: today } }),
      Booking.countDocuments({ status: 'CANCELLED', createdAt: { $gte: today } }),
      Booking.countDocuments({ paymentStatus: 'PENDING', status: { $nin: ['CANCELLED', 'EXPIRED'] } }),
    ]);

    res.json({
      success: true,
      data: {
        todayBookings,
        todayRevenue: todayRevenue[0]?.total ?? 0,
        activeDrivers,
        driversInQueue,
        activeTrips,
        completedToday,
        cancelledToday,
        pendingPayments,
      },
    });
  }

  // ─── DRIVERS ─────────────────────────────────────────────────

  async getDrivers(req: Request, res: Response): Promise<void> {
    const { page, limit, skip } = getPaginationOptions(req.query as Record<string, unknown>);

    const filter: Record<string, unknown> = {};
    const status = qStr(req.query.status);
    const search = qStr(req.query.search);
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { driverCode: { $regex: search, $options: 'i' } },
      ];
    }

    const [drivers, total] = await Promise.all([
      Driver.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Driver.countDocuments(filter),
    ]);

    res.json({
      success: true,
      ...buildPaginatedResponse(drivers, total, page, limit),
    });
  }

  async getDriver(req: Request, res: Response): Promise<void> {
    const driver = await Driver.findById(req.params.id)
      .populate('userId', 'phone email status')
      .populate('activeQueueEntryId');
    if (!driver) throw errors.notFound('Driver');
    res.json({ success: true, data: driver });
  }

  async updateDriver(req: Request, res: Response): Promise<void> {
    const driver = await Driver.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!driver) throw errors.notFound('Driver');

    await this.logAudit(req, 'UPDATE', 'drivers', String(req.params.id), driver);
    res.json({ success: true, message: 'Driver updated successfully', data: driver });
  }

  async updateDriverStatus(req: Request, res: Response): Promise<void> {
    const { status } = req.body;
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!driver) throw errors.notFound('Driver');

    await this.logAudit(req, 'UPDATE_STATUS', 'drivers', req.params.id, { status });
    res.json({ success: true, message: `Driver status updated to ${status}`, data: driver });
  }

  // ─── VEHICLES ────────────────────────────────────────────────

  async getVehicles(req: Request, res: Response): Promise<void> {
    const { page, limit, skip } = getPaginationOptions(req.query as Record<string, unknown>);

    const filter: Record<string, unknown> = {};
    const status = qStr(req.query.status);
    const categoryId = qStr(req.query.categoryId);
    const search = qStr(req.query.search);
    if (status) filter.status = status;
    if (categoryId) filter.categoryId = categoryId;
    if (search) {
      filter.$or = [
        { registrationNumber: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { vehicleModel: { $regex: search, $options: 'i' } },
      ];
    }

    const [vehicles, total] = await Promise.all([
      Vehicle.find(filter)
        .populate('categoryId', 'name code')
        .populate('assignedDriverId', 'name phone')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Vehicle.countDocuments(filter),
    ]);

    res.json({ success: true, ...buildPaginatedResponse(vehicles, total, page, limit) });
  }

  async createVehicle(req: Request, res: Response): Promise<void> {
    const vehicle = await Vehicle.create(req.body);
    await this.logAudit(req, 'CREATE', 'vehicles', vehicle.id, vehicle);
    res.status(201).json({ success: true, message: 'Vehicle created', data: vehicle });
  }

  async updateVehicle(req: Request, res: Response): Promise<void> {
    const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!vehicle) throw errors.notFound('Vehicle');
    await this.logAudit(req, 'UPDATE', 'vehicles', req.params.id, vehicle);
    res.json({ success: true, message: 'Vehicle updated', data: vehicle });
  }

  // ─── VEHICLE CATEGORIES ──────────────────────────────────────

  async getVehicleCategories(_req: Request, res: Response): Promise<void> {
    const categories = await VehicleCategory.find().sort({ sortOrder: 1, name: 1 });
    res.json({ success: true, data: categories });
  }

  async createVehicleCategory(req: Request, res: Response): Promise<void> {
    const category = await VehicleCategory.create(req.body);
    await this.logAudit(req, 'CREATE', 'vehicle_categories', category.id, category);
    res.status(201).json({ success: true, message: 'Vehicle category created', data: category });
  }

  async updateVehicleCategory(req: Request, res: Response): Promise<void> {
    const old = await VehicleCategory.findById(req.params.id).lean();
    const category = await VehicleCategory.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!category) throw errors.notFound('Vehicle Category');
    await this.logAudit(req, 'UPDATE', 'vehicle_categories', req.params.id, { old, new: category });
    res.json({ success: true, message: 'Category updated', data: category });
  }

  // ─── LOCATIONS ───────────────────────────────────────────────

  async getLocations(req: Request, res: Response): Promise<void> {
    const { page, limit, skip } = getPaginationOptions(req.query as Record<string, unknown>);

    const filter: Record<string, unknown> = {};
    const type = qStr(req.query.type);
    const status = qStr(req.query.status);
    const search = qStr(req.query.search);
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    const [locations, total] = await Promise.all([
      Location.find(filter).skip(skip).limit(limit).sort({ name: 1 }),
      Location.countDocuments(filter),
    ]);

    res.json({ success: true, ...buildPaginatedResponse(locations, total, page, limit) });
  }

  async createLocation(req: Request, res: Response): Promise<void> {
    const { latitude, longitude, ...rest } = req.body as { latitude?: number; longitude?: number; [key: string]: unknown };
    const locationData: Record<string, unknown> = { ...rest };
    if (latitude !== undefined && longitude !== undefined && !isNaN(Number(latitude)) && !isNaN(Number(longitude))) {
      locationData.geoPoint = { type: 'Point', coordinates: [Number(longitude), Number(latitude)] };
    }
    const location = await Location.create(locationData);
    await this.logAudit(req, 'CREATE', 'locations', location.id, location);
    res.status(201).json({ success: true, message: 'Location created', data: location });
  }

  async updateLocation(req: Request, res: Response): Promise<void> {
    const { latitude, longitude, ...rest } = req.body as { latitude?: number; longitude?: number; [key: string]: unknown };
    const update: Record<string, unknown> = { ...rest };
    if (latitude !== undefined && longitude !== undefined) {
      update.geoPoint = { type: 'Point', coordinates: [longitude, latitude] };
    }
    const location = await Location.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!location) throw errors.notFound('Location');
    await this.logAudit(req, 'UPDATE', 'locations', req.params.id, location);
    res.json({ success: true, message: 'Location updated', data: location });
  }

  // ─── TAXI STANDS ─────────────────────────────────────────────

  async getTaxiStands(req: Request, res: Response): Promise<void> {
    const stands = await TaxiStand.find()
      .populate('locationId', 'name code type geoPoint')
      .populate('allowedVehicleCategories', 'name code status sortOrder')
      .sort({ name: 1 });
    res.json({ success: true, data: stands });
  }

  async createTaxiStand(req: Request, res: Response): Promise<void> {
    const { token, tokenId, expiresAt } = qrService.generateQRToken('placeholder');
    const stand = await TaxiStand.create({
      ...req.body,
      createdBy: req.user?.userId,
      qrToken: token,
      qrTokenId: tokenId,
      qrExpiresAt: expiresAt,
      qrGeneratedAt: new Date(),
      qrStatus: QRStatus.ACTIVE,
    });

    // Regenerate with actual ID
    const { token: actualToken, tokenId: actualTokenId, expiresAt: actualExpiry } =
      qrService.generateQRToken(stand.id);
    await TaxiStand.findByIdAndUpdate(stand.id, {
      qrToken: actualToken,
      qrTokenId: actualTokenId,
      qrExpiresAt: actualExpiry,
    });

    await this.logAudit(req, 'CREATE', 'taxi_stands', stand.id, stand);
    res.status(201).json({ success: true, message: 'Taxi stand created', data: stand });
  }

  async regenerateQR(req: Request, res: Response): Promise<void> {
    const stand = await TaxiStand.findById(req.params.id);
    if (!stand) throw errors.notFound('Taxi Stand');

    const qrDataUrl = await qrService.generateQRCode(stand.id);
    await this.logAudit(req, 'REGENERATE_QR', 'taxi_stands', req.params.id, {});
    res.json({ success: true, message: 'QR code regenerated', data: { qrDataUrl } });
  }

  async getQueueStatus(req: Request, res: Response): Promise<void> {
    const standId = req.params.id;

    const [stand, entries] = await Promise.all([
      TaxiStand.findById(standId)
        .populate('locationId', 'name')
        .populate('allowedVehicleCategories', 'name code'),
      QueueEntry.find({
        taxiStandId: standId,
        status: { $in: [QueueEntryStatus.WAITING, QueueEntryStatus.OFFERED] },
      })
        .populate('driverId', 'name phone driverCode rating')
        .populate('vehicleId', 'registrationNumber vehicleModel brand color')
        .populate('vehicleCategoryId', 'name code')
        .sort({ position: 1 }),
    ]);

    if (!stand) throw errors.notFound('Taxi stand not found');

    // Group entries by vehicle category name
    const byCategory: Record<string, typeof entries> = {};
    for (const entry of entries) {
      const catName = (entry.vehicleCategoryId as unknown as { name: string })?.name ?? 'Unknown';
      if (!byCategory[catName]) byCategory[catName] = [];
      byCategory[catName].push(entry);
    }

    res.json({
      success: true,
      data: {
        stand,
        entries,
        byCategory,
        summary: Object.entries(byCategory).map(([category, catEntries]) => ({
          category,
          total: catEntries.length,
          waiting: catEntries.filter(e => e.status === QueueEntryStatus.WAITING).length,
          offered: catEntries.filter(e => e.status === QueueEntryStatus.OFFERED).length,
        })),
      },
    });
  }

  // ─── ADMIN USERS ─────────────────────────────────────────────

  async createAdminUser(req: Request, res: Response): Promise<void> {
    const { name, email, phone, role, password, permissions } = req.body as {
      name: string; email: string; phone: string; role: UserRole; password: string; permissions?: string[];
    };

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) throw errors.conflict('User with this email already exists');

    const { AuthService } = await import('@/services/AuthService');
    const passwordHash = await new AuthService().hashPassword(password);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      role,
      permissions: permissions ?? [],
      passwordHash,
      status: UserStatus.ACTIVE,
    });

    await this.logAudit(req, 'CREATE_ADMIN_USER', 'users', user.id, { name, email, role });
    res.status(201).json({ success: true, message: 'Admin user created', data: { id: user.id, name, email, role } });
  }

  // ─── AUDIT LOG ───────────────────────────────────────────────

  async getAuditLogs(req: Request, res: Response): Promise<void> {
    const { page, limit, skip } = getPaginationOptions(req.query as Record<string, unknown>);
    const filter: Record<string, unknown> = {};
    const module = qStr(req.query.module);
    const adminId = qStr(req.query.adminId);
    const entityId = qStr(req.query.entityId);
    if (module) filter.module = module;
    if (adminId) filter.adminId = adminId;
    if (entityId) filter.entityId = entityId;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('adminId', 'name email')
        .skip(skip)
        .limit(limit)
        .sort({ timestamp: -1 }),
      AuditLog.countDocuments(filter),
    ]);

    res.json({ success: true, ...buildPaginatedResponse(logs, total, page, limit) });
  }

  // ─── HELPERS ─────────────────────────────────────────────────

  private async logAudit(
    req: Request,
    action: string,
    module: string,
    entityId: string | string[],
    data: unknown
  ): Promise<void> {
    if (!req.user) return;
    try {
      await AuditLog.create({
        adminId: req.user.userId,
        adminName: req.user.email ?? req.user.userId,
        action,
        module,
        entityId,
        entityType: module,
        newValue: data,
        ipAddress: req.ip ?? '',
        userAgent: req.headers['user-agent'],
        timestamp: new Date(),
      });
    } catch (err) {
      logger.error('Failed to create audit log:', err);
    }
  }
}

export const adminController = new AdminController();
