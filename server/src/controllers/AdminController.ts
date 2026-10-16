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
import { normalizePhone } from '@/utils/phone';
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
  const limit = Math.min(1000, Math.max(1, parseInt(query.limit as string) || 20));
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
      hourlyAgg,
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
      Booking.aggregate([
        { $match: { createdAt: { $gte: today } } },
        {
          $group: {
            _id: { $hour: { date: '$createdAt', timezone: '+05:30' } },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const hourMap = new Map<number, number>();
    (hourlyAgg as Array<{ _id: number; count: number }>).forEach(h => {
      if (typeof h._id === 'number') {
        hourMap.set(h._id, h.count);
      }
    });

    const timeSlots = [6, 8, 10, 12, 14, 16, 18, 20, 22];
    const hourlyTrend = timeSlots.map(h => {
      const label = h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`;
      const bookings = (hourMap.get(h) || 0) + (hourMap.get(h + 1) || 0);
      return { time: label, bookings };
    });

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
        hourlyTrend,
      },
    });
  }

  // ─── DRIVERS ─────────────────────────────────────────────────

  async getDrivers(req: Request, res: Response): Promise<void> {
    const { page, limit, skip } = getPaginationOptions(req.query as Record<string, unknown>);

    const filter: Record<string, unknown> = {};
    const status = qStr(req.query.status);
    const search = qStr(req.query.search);
    const vehicleAssigned = qStr(req.query.vehicleAssigned);
    const taxiStandId = qStr(req.query.taxiStandId);
    const sortBy = qStr(req.query.sortBy) || 'createdAt';
    const sortOrder = qStr(req.query.sortOrder) === 'asc' ? 1 : -1;

    // Status filter
    if (status && status !== 'ALL') {
      if (status === 'ACTIVE' || status === 'ONLINE') {
        filter.status = {
          $in: [
            DriverStatus.AVAILABLE,
            DriverStatus.IN_QUEUE,
            DriverStatus.ON_TRIP,
            DriverStatus.TRIP_ACCEPTED,
            DriverStatus.TRIP_OFFERED,
          ],
        };
      } else if (status.includes(',')) {
        filter.status = { $in: status.split(',').map((s) => s.trim()) };
      } else {
        filter.status = status;
      }
    }

    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { driverCode: { $regex: search, $options: 'i' } },
        { licenseNumber: { $regex: search, $options: 'i' } },
      ];
    }

    // Vehicle Assignment filter
    if (vehicleAssigned === 'ASSIGNED') {
      const assignedIds = await Vehicle.distinct('assignedDriverId', {
        assignedDriverId: { $ne: null },
      });
      filter._id = { $in: assignedIds };
    } else if (vehicleAssigned === 'UNASSIGNED') {
      const assignedIds = await Vehicle.distinct('assignedDriverId', {
        assignedDriverId: { $ne: null },
      });
      filter._id = { $nin: assignedIds };
    }

    // Taxi stand filter
    if (taxiStandId && taxiStandId !== 'ALL') {
      if (taxiStandId === 'IN_QUEUE') {
        filter.activeQueueEntryId = { $ne: null };
      } else if (taxiStandId === 'NOT_IN_QUEUE') {
        filter.activeQueueEntryId = null;
      } else {
        const driversAtStand = await QueueEntry.distinct('driverId', {
          taxiStandId,
          status: { $in: [QueueEntryStatus.WAITING, QueueEntryStatus.OFFERED] },
        });
        filter._id = { $in: driversAtStand };
      }
    }

    const sortObj: Record<string, 1 | -1> = { [sortBy]: sortOrder };

    const [rawDrivers, total, counts] = await Promise.all([
      Driver.find(filter)
        .populate('activeQueueEntryId', 'taxiStandId position status joinedAt')
        .populate('activeTripId', 'bookingNumber status pickupLocation dropLocation')
        .skip(skip)
        .limit(limit)
        .sort(sortObj),
      Driver.countDocuments(filter),
      Driver.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Fetch assigned vehicles for these drivers
    const driverIds = rawDrivers.map((d) => d._id);
    const vehicles = await Vehicle.find({ assignedDriverId: { $in: driverIds } })
      .populate('categoryId', 'name code')
      .lean();

    const vehicleMap = new Map();
    for (const v of vehicles) {
      if (v.assignedDriverId) {
        vehicleMap.set(v.assignedDriverId.toString(), v);
      }
    }

    // Attach assignedVehicle and populate stand name
    const drivers = await Promise.all(
      rawDrivers.map(async (d) => {
        const doc = d.toObject();
        const assignedVehicle = vehicleMap.get(d._id.toString());
        if (assignedVehicle) {
          (doc as any).assignedVehicle = {
            _id: assignedVehicle._id,
            registrationNumber: assignedVehicle.registrationNumber,
            brand: assignedVehicle.brand,
            vehicleModel: assignedVehicle.vehicleModel,
            category: (assignedVehicle.categoryId as any)?.name || 'Cab',
          };
        }

        if (doc.activeQueueEntryId && typeof (doc.activeQueueEntryId as any).taxiStandId === 'string') {
          const stand = await TaxiStand.findById((doc.activeQueueEntryId as any).taxiStandId).select('name code');
          if (stand) {
            (doc.activeQueueEntryId as any).taxiStand = stand;
          }
        }

        return doc;
      })
    );

    // Compute stats map
    const statusCounts: Record<string, number> = {
      TOTAL: 0,
      AVAILABLE: 0,
      IN_QUEUE: 0,
      ON_TRIP: 0,
      OFFLINE: 0,
      SUSPENDED: 0,
    };

    counts.forEach((c: { _id: string; count: number }) => {
      statusCounts[c._id] = c.count;
      statusCounts.TOTAL += c.count;
    });

    res.json({
      success: true,
      stats: statusCounts,
      ...buildPaginatedResponse(drivers, total, page, limit),
    });
  }

  async getDriver(req: Request, res: Response): Promise<void> {
    const driver = await Driver.findById(req.params.id)
      .populate('userId', 'phone email status')
      .populate('activeQueueEntryId');
    if (!driver) throw errors.notFound('Driver');

    const doc = driver.toObject();
    const assignedVehicle = await Vehicle.findOne({ assignedDriverId: driver._id })
      .populate('categoryId', 'name code');
    if (assignedVehicle) {
      (doc as any).assignedVehicle = {
        _id: assignedVehicle._id,
        registrationNumber: assignedVehicle.registrationNumber,
        brand: assignedVehicle.brand,
        vehicleModel: assignedVehicle.vehicleModel,
        category: (assignedVehicle.categoryId as any)?.name || 'Cab',
      };
    }

    res.json({ success: true, data: doc });
  }

  async updateDriver(req: Request, res: Response): Promise<void> {
    const driver = await Driver.findById(req.params.id);
    if (!driver) throw errors.notFound('Driver');

    const data: Record<string, any> = { ...req.body };

    // 1. Phone Update & Uniqueness Validation
    if (data.phone && data.phone !== driver.phone) {
      const normalizedPhone = normalizePhone(data.phone);
      const rawDigits = data.phone.replace(/\D/g, '').slice(-10);

      // Check for conflict with another driver
      const conflictingDriver = await Driver.findOne({
        _id: { $ne: driver._id },
        $or: [
          { phone: normalizedPhone },
          { phone: data.phone },
          ...(rawDigits ? [{ phone: rawDigits }, { phone: `+91${rawDigits}` }] : []),
        ],
      });
      if (conflictingDriver) {
        throw errors.conflict('Another driver with this phone number already exists');
      }

      // Check for conflict with another user account
      if (driver.userId) {
        const conflictingUser = await User.findOne({
          _id: { $ne: driver.userId },
          $or: [
            { phone: normalizedPhone },
            { phone: data.phone },
            ...(rawDigits ? [{ phone: rawDigits }, { phone: `+91${rawDigits}` }] : []),
          ],
        });
        if (conflictingUser) {
          throw errors.conflict('Another user account with this phone number already exists');
        }
      }

      data.phone = normalizedPhone;
    }

    // 2. Synchronize linked User account (phone, name, email, status)
    if (driver.userId) {
      const userUpdates: Record<string, any> = {};
      if (data.name) userUpdates.name = data.name;
      if (data.phone) userUpdates.phone = data.phone;
      if (data.email !== undefined) userUpdates.email = data.email || undefined;
      if (data.status) {
        userUpdates.status = ['INACTIVE', 'SUSPENDED'].includes(data.status)
          ? UserStatus.INACTIVE
          : UserStatus.ACTIVE;
      }
      if (Object.keys(userUpdates).length > 0) {
        await User.findByIdAndUpdate(driver.userId, userUpdates);
      }
    }

    // 3. Normalize Date fields safely
    if (data.licenseExpiry) {
      data.licenseExpiry = new Date(data.licenseExpiry);
    } else if (data.licenseExpiry === '' || data.licenseExpiry === null) {
      delete data.licenseExpiry;
    }

    if (data.joiningDate) {
      data.joiningDate = new Date(data.joiningDate);
    } else if (data.joiningDate === '' || data.joiningDate === null) {
      delete data.joiningDate;
    }

    // 4. Sanitize Address
    if (data.address) {
      data.address = {
        line1: data.address.line1 !== undefined ? data.address.line1.trim() : (driver.address?.line1 || 'Kollur'),
        line2: data.address.line2 !== undefined ? data.address.line2.trim() : (driver.address?.line2 || ''),
        city: data.address.city !== undefined ? data.address.city.trim() : (driver.address?.city || 'Kollur'),
        state: data.address.state !== undefined ? data.address.state.trim() : (driver.address?.state || 'Karnataka'),
        pincode: data.address.pincode !== undefined ? data.address.pincode.trim() : (driver.address?.pincode || '576220'),
        country: data.address.country !== undefined ? data.address.country.trim() : (driver.address?.country || 'India'),
      };
    }

    // 5. Handle Vehicle Assignment if provided
    if ('assignedVehicleId' in data) {
      const targetVehicleId = data.assignedVehicleId;
      delete data.assignedVehicleId;

      // Unassign existing vehicles currently assigned to this driver
      await Vehicle.updateMany(
        { assignedDriverId: driver._id },
        { $unset: { assignedDriverId: 1 } }
      );

      // If a non-empty vehicle id was provided, assign this vehicle to the driver
      if (targetVehicleId && typeof targetVehicleId === 'string' && targetVehicleId.trim() !== '') {
        await Vehicle.findByIdAndUpdate(targetVehicleId, { assignedDriverId: driver._id });
      }
    }

    // 6. Update Driver Document
    const updatedDriver = await Driver.findByIdAndUpdate(driver._id, data, {
      new: true,
      runValidators: true,
    });
    if (!updatedDriver) throw errors.notFound('Driver');

    await this.logAudit(req, 'UPDATE', 'drivers', String(driver._id), updatedDriver);
    res.json({ success: true, message: 'Driver updated successfully', data: updatedDriver });
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
        { ownerName: { $regex: search, $options: 'i' } },
        { ownerPhone: { $regex: search, $options: 'i' } },
      ];
    }

    const [vehicles, total] = await Promise.all([
      Vehicle.find(filter)
        .populate('categoryId', 'name code seatCapacity luggageCapacity')
        .populate('assignedDriverId', 'name phone driverCode licenseNumber')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Vehicle.countDocuments(filter),
    ]);

    res.json({ success: true, ...buildPaginatedResponse(vehicles, total, page, limit) });
  }

  async createVehicle(req: Request, res: Response): Promise<void> {
    const data = { ...req.body };
    if (!data.assignedDriverId || data.assignedDriverId === '') {
      delete data.assignedDriverId;
    }
    if (!data.ownerPhone || data.ownerPhone === '') {
      delete data.ownerPhone;
    }
    const vehicle = await Vehicle.create(data);
    await this.logAudit(req, 'CREATE', 'vehicles', vehicle.id, vehicle);
    res.status(201).json({ success: true, message: 'Vehicle created', data: vehicle });
  }

  async updateVehicle(req: Request, res: Response): Promise<void> {
    const data = { ...req.body };
    if (data.assignedDriverId === '') {
      data.assignedDriverId = null;
    }
    if (data.ownerPhone === '') {
      data.ownerPhone = null;
    }
    const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, data, { new: true });
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
    const data = { ...req.body };
    if (data.fares?.oneWay) {
      if (data.fares.oneWay.baseFare !== undefined) data.baseFare = data.fares.oneWay.baseFare;
      if (data.fares.oneWay.ratePerKm !== undefined) data.ratePerKm = data.fares.oneWay.ratePerKm;
      if (data.fares.oneWay.minimumKm !== undefined) data.minimumKm = data.fares.oneWay.minimumKm;
      if (data.fares.oneWay.waitingChargePerMin !== undefined) data.waitingChargePerMin = data.fares.oneWay.waitingChargePerMin;
      if (data.fares.oneWay.nightChargeMultiplier !== undefined) data.nightChargeMultiplier = data.fares.oneWay.nightChargeMultiplier;
    }
    const category = await VehicleCategory.create(data);
    await this.logAudit(req, 'CREATE', 'vehicle_categories', category.id, category);
    res.status(201).json({ success: true, message: 'Vehicle category created', data: category });
  }

  async updateVehicleCategory(req: Request, res: Response): Promise<void> {
    const data = { ...req.body };
    if (data.fares?.oneWay) {
      if (data.fares.oneWay.baseFare !== undefined) data.baseFare = data.fares.oneWay.baseFare;
      if (data.fares.oneWay.ratePerKm !== undefined) data.ratePerKm = data.fares.oneWay.ratePerKm;
      if (data.fares.oneWay.minimumKm !== undefined) data.minimumKm = data.fares.oneWay.minimumKm;
      if (data.fares.oneWay.waitingChargePerMin !== undefined) data.waitingChargePerMin = data.fares.oneWay.waitingChargePerMin;
      if (data.fares.oneWay.nightChargeMultiplier !== undefined) data.nightChargeMultiplier = data.fares.oneWay.nightChargeMultiplier;
    }
    const old = await VehicleCategory.findById(req.params.id).lean();
    const category = await VehicleCategory.findByIdAndUpdate(req.params.id, data, { new: true });
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
    if (locationData.code) {
      const codeUpper = String(locationData.code).trim().toUpperCase();
      locationData.code = codeUpper;
      const existing = await Location.findOne({ code: codeUpper });
      if (existing) {
        throw errors.conflict(`A location with code "${codeUpper}" already exists. Please choose a different code.`);
      }
    }
    if (latitude !== undefined && longitude !== undefined && !isNaN(Number(latitude)) && !isNaN(Number(longitude))) {
      locationData.geoPoint = { type: 'Point', coordinates: [Number(longitude), Number(latitude)] };
    } else if (req.body.geoPoint?.coordinates?.length === 2) {
      locationData.geoPoint = {
        type: 'Point',
        coordinates: [Number(req.body.geoPoint.coordinates[0]), Number(req.body.geoPoint.coordinates[1])],
      };
    }
    const location = await Location.create(locationData);
    await this.logAudit(req, 'CREATE', 'locations', location.id, location);
    res.status(201).json({ success: true, message: 'Location created', data: location });
  }

  async updateLocation(req: Request, res: Response): Promise<void> {
    const { latitude, longitude, ...rest } = req.body as { latitude?: number; longitude?: number; [key: string]: unknown };
    const update: Record<string, unknown> = { ...rest };
    if (update.code) {
      const codeUpper = String(update.code).trim().toUpperCase();
      update.code = codeUpper;
      const existing = await Location.findOne({ code: codeUpper, _id: { $ne: req.params.id } });
      if (existing) {
        throw errors.conflict(`A location with code "${codeUpper}" already exists. Please choose a different code.`);
      }
    }
    if (latitude !== undefined && longitude !== undefined && !isNaN(Number(latitude)) && !isNaN(Number(longitude))) {
      update.geoPoint = { type: 'Point', coordinates: [Number(longitude), Number(latitude)] };
    } else if (req.body.geoPoint?.coordinates?.length === 2) {
      update.geoPoint = {
        type: 'Point',
        coordinates: [Number(req.body.geoPoint.coordinates[0]), Number(req.body.geoPoint.coordinates[1])],
      };
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
