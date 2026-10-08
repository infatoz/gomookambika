import mongoose from 'mongoose';
import { TaxiStand } from '@/models/TaxiStand';
import { QueueEntry, IQueueEntry } from '@/models/QueueEntry';
import { Driver } from '@/models/Driver';
import { Vehicle } from '@/models/Vehicle';
import { Location } from '@/models/Location';
import { qrService } from './QRService';
import { errors } from '@/middlewares/errorHandler';
import { logger } from '@/utils/logger';
import { getRedis, redisKeys } from '@/config/redis';
import { config } from '@/config/env';
import { Trip } from '@/models/Trip';
import {
  QueueEntryStatus,
  DriverStatus,
  VehicleStatus,
  Status,
  QueuePolicy,
  TripStatus,
} from '@gomookambika/types';

export interface JoinQueueInput {
  qrToken: string;
  driverId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface JoinQueueResult {
  queueEntryId: string;
  taxiStandId: string;
  taxiStandName: string;
  locationName: string;
  position: number;
  category: string;
}

export interface HeartbeatInput {
  queueEntryId: string;
  driverId: string;
  latitude: number;
  longitude: number;
}

export interface HeartbeatResult {
  withinRadius: boolean;
  distanceMeters: number;
  warningIssued: boolean;
}

export class QueueService {
  // ─── JOIN QUEUE ──────────────────────────────────────────────

  async joinQueue(input: JoinQueueInput): Promise<JoinQueueResult> {
    const { qrToken, driverId, latitude, longitude } = input;

    // 1. Validate QR token
    const { taxiStandId } = await qrService.validateQRToken(qrToken);

    // 2. Get taxi stand with location
    const stand = await TaxiStand.findById(taxiStandId).populate('locationId');
    if (!stand) throw errors.notFound('Taxi Stand');

    const location = stand.locationId as unknown as { geoPoint?: { coordinates?: [number, number] }; name?: string };
    const locCoords = location?.geoPoint?.coordinates;

    // 3. Validate driver
    const driver = await Driver.findOne({
      $or: [{ _id: driverId }, { userId: driverId }],
    });
    if (!driver) throw errors.notFound('Driver');
    if (driver.status === DriverStatus.SUSPENDED) {
      throw errors.badRequest('Driver account is suspended. Please contact the association.');
    }

    // Check if driver has an ongoing active trip
    const activeTrip = await Trip.findOne({
      $or: [{ driverId: driver._id }, { driverId: driver.userId }],
      status: { $in: [TripStatus.DRIVER_ACCEPTED, TripStatus.DRIVER_ARRIVED, TripStatus.TRIP_STARTED, TripStatus.TRIP_IN_PROGRESS] },
    });
    if (activeTrip) {
      throw errors.badRequest('Driver is currently on an active trip', 'DRIVER_ON_TRIP');
    }

    // Find vehicle assigned to this driver
    const assignedVehicle = await Vehicle.findOne({
      assignedDriverId: driver._id,
      status: VehicleStatus.ACTIVE,
    }).populate('categoryId');
    if (!assignedVehicle) throw errors.vehicleNotActive();

    // 5. GPS validation — check radius if coordinates are configured
    if (locCoords && locCoords.length === 2 && !isNaN(locCoords[0]) && !isNaN(locCoords[1])) {
      const distanceMeters = this.haversineDistanceMeters(
        latitude,
        longitude,
        locCoords[1], // lat
        locCoords[0]  // lng
      );

      const allowedRadius = stand.queueRadius || config.QUEUE_RADIUS_METERS;
      if (config.NODE_ENV === 'production' && distanceMeters > allowedRadius) {
        throw errors.driverOutsideRadius();
      }
    }

    // 6. Check if driver already in active queue
    const existingEntry = await QueueEntry.findOne({
      driverId: driver._id,
      status: { $in: [QueueEntryStatus.WAITING, QueueEntryStatus.OFFERED] },
    });
    if (existingEntry) {
      // If already waiting at THIS taxi stand, return existing queue entry gracefully
      if (existingEntry.taxiStandId.toString() === stand._id.toString()) {
        const catName = (assignedVehicle.categoryId as unknown as { name?: string })?.name || 'Sedan';
        logger.info(`Driver ${driverId} already in queue at ${stand.name} (position: ${existingEntry.position})`);
        return {
          queueEntryId: existingEntry._id.toString(),
          taxiStandId: stand._id.toString(),
          taxiStandName: stand.name,
          locationName: location.name || stand.name || 'Unknown',
          position: existingEntry.position,
          category: catName,
        };
      }
      // If queued at another taxi stand or stale offer, remove old entry and proceed to join here
      await QueueEntry.findByIdAndUpdate(existingEntry._id, {
        status: QueueEntryStatus.LEFT,
        leftAt: new Date(),
      });
    }

    // 7. Check vehicle category allowed at this stand
    const vehicleCategory = (assignedVehicle.categoryId as unknown as { _id: mongoose.Types.ObjectId });
    if (
      stand.allowedVehicleCategories.length > 0 &&
      !stand.allowedVehicleCategories.some(id => id.toString() === vehicleCategory._id.toString())
    ) {
      throw errors.badRequest(
        'This vehicle category is not allowed at this taxi stand',
        'VEHICLE_CATEGORY_NOT_ALLOWED'
      );
    }

    // 8. Check operating hours
    this.validateOperatingHours(stand.operatingHours);

    // 9. Check max queue size
    if (stand.maxQueueSize) {
      const currentCount = await QueueEntry.countDocuments({
        taxiStandId: stand._id,
        status: { $in: [QueueEntryStatus.WAITING, QueueEntryStatus.OFFERED] },
      });
      if (currentCount >= stand.maxQueueSize) {
        throw errors.badRequest(
          'Queue is full. Please try again later.',
          'QUEUE_FULL'
        );
      }
    }

    // 10. Determine queue position (end of queue)
    const lastEntry = await QueueEntry.findOne({
      taxiStandId: stand._id,
      status: { $in: [QueueEntryStatus.WAITING, QueueEntryStatus.OFFERED] },
    }).sort({ position: -1 });

    const nextPosition = lastEntry ? lastEntry.position + 1 : 1;

    // 11. Create queue entry (in a session for atomicity)
    // 11. Create queue entry (with transaction when supported, standalone fallback)
    let queueEntry: IQueueEntry;

    try {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          // Create queue entry
          const [entry] = await QueueEntry.create(
            [
              {
                taxiStandId: stand._id,
                driverId: driver._id,
                vehicleId: assignedVehicle._id,
                vehicleCategoryId: vehicleCategory._id,
                joinedAt: new Date(),
                position: nextPosition,
                status: QueueEntryStatus.WAITING,
                lastLocation: {
                  type: 'Point',
                  coordinates: [longitude, latitude],
                },
                lastHeartbeat: new Date(),
              },
            ],
            { session }
          );
          queueEntry = entry;

          // Update driver status
          await Driver.findByIdAndUpdate(
            driver._id,
            {
              status: DriverStatus.IN_QUEUE,
              activeQueueEntryId: entry._id,
              currentLocation: {
                type: 'Point',
                coordinates: [longitude, latitude],
              },
              lastSeen: new Date(),
            },
            { session }
          );
        });
      } finally {
        await session.endSession();
      }
    } catch (err: any) {
      if (
        err?.message?.includes('replica set member') ||
        err?.message?.includes('Transaction numbers are only allowed')
      ) {
        // Fallback for standalone MongoDB
        const [entry] = await QueueEntry.create([
          {
            taxiStandId: stand._id,
            driverId: driver._id,
            vehicleId: assignedVehicle._id,
            vehicleCategoryId: vehicleCategory._id,
            joinedAt: new Date(),
            position: nextPosition,
            status: QueueEntryStatus.WAITING,
            lastLocation: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            lastHeartbeat: new Date(),
          },
        ]);
        queueEntry = entry;

        await Driver.findByIdAndUpdate(driver._id, {
          status: DriverStatus.IN_QUEUE,
          activeQueueEntryId: entry._id,
          currentLocation: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          lastSeen: new Date(),
        });
      } else {
        throw err;
      }
    }

    // 12. Set up heartbeat monitoring key in Redis (best-effort)
    const redis = getRedis();
    if (redis) {
      await redis.setex(
        redisKeys.queueHeartbeat(queueEntry!._id.toString()),
        config.QUEUE_HEARTBEAT_SECONDS * config.QUEUE_MAX_MISSED_HEARTBEATS,
        'active'
      ).catch(() => {});
    }

    logger.info(`Driver ${driverId} joined queue at ${stand.name} (position: ${nextPosition})`);

    return {
      queueEntryId: queueEntry!._id.toString(),
      taxiStandId: stand._id.toString(),
      taxiStandName: stand.name,
      locationName: location.name || stand.name || 'Unknown',
      position: nextPosition,
      category: (assignedVehicle.categoryId as unknown as { name: string }).name || 'Unknown',
    };
  }

  // ─── LEAVE QUEUE ─────────────────────────────────────────────

  async leaveQueue(driverId: string): Promise<void> {
    const driver = await Driver.findOne({
      $or: [{ _id: driverId }, { userId: driverId }],
    });
    const targetDriverId = driver ? driver._id : driverId;

    const entry = await QueueEntry.findOne({
      $or: [{ driverId: targetDriverId }, { driverId }],
      status: { $in: [QueueEntryStatus.WAITING] },
    });

    if (!entry) {
      throw errors.notFound('Active queue entry');
    }

    try {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          // Mark entry as left
          await QueueEntry.findByIdAndUpdate(
            entry._id,
            {
              status: QueueEntryStatus.LEFT,
              leftAt: new Date(),
            },
            { session }
          );

          // Update driver status
          await Driver.findByIdAndUpdate(
            targetDriverId,
            {
              status: DriverStatus.AVAILABLE,
              activeQueueEntryId: null,
            },
            { session }
          );

          // Reorder positions for remaining drivers in queue
          await this.reorderPositions(entry.taxiStandId.toString(), entry.position, session);
        });
      } finally {
        await session.endSession();
      }
    } catch (err: any) {
      if (
        err?.message?.includes('replica set member') ||
        err?.message?.includes('Transaction numbers are only allowed')
      ) {
        await QueueEntry.findByIdAndUpdate(entry._id, {
          status: QueueEntryStatus.LEFT,
          leftAt: new Date(),
        });

        await Driver.findByIdAndUpdate(targetDriverId, {
          status: DriverStatus.AVAILABLE,
          activeQueueEntryId: null,
        });

        await this.reorderPositions(entry.taxiStandId.toString(), entry.position);
      } else {
        throw err;
      }
    }

    logger.info(`Driver ${driverId} left queue (was position ${entry.position})`);
  }

  // ─── HEARTBEAT ───────────────────────────────────────────────

  async processHeartbeat(input: HeartbeatInput): Promise<HeartbeatResult> {
    const { queueEntryId, driverId, latitude, longitude } = input;

    const driver = await Driver.findOne({
      $or: [{ _id: driverId }, { userId: driverId }],
    });
    const targetDriverId = driver ? driver._id : driverId;

    const entry = await QueueEntry.findOne({
      _id: queueEntryId,
      $or: [{ driverId: targetDriverId }, { driverId }],
      status: QueueEntryStatus.WAITING,
    });

    if (!entry) {
      throw errors.notFound('Queue entry');
    }

    const stand = await TaxiStand.findById(entry.taxiStandId).populate('locationId');
    if (!stand) throw errors.notFound('Taxi Stand');

    const location = stand.locationId as unknown as { geoPoint?: { coordinates?: [number, number] } };
    const locCoords = location?.geoPoint?.coordinates;
    const distanceMeters = (locCoords && locCoords.length === 2 && !isNaN(locCoords[0]) && !isNaN(locCoords[1]))
      ? this.haversineDistanceMeters(
          latitude,
          longitude,
          locCoords[1],
          locCoords[0]
        )
      : 0;

    const allowedRadius = stand.queueRadius || config.QUEUE_RADIUS_METERS;
    const withinRadius = distanceMeters <= allowedRadius;

    // Update heartbeat and location
    await QueueEntry.findByIdAndUpdate(queueEntryId, {
      lastHeartbeat: new Date(),
      lastLocation: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
    });

    await Driver.findByIdAndUpdate(driverId, {
      currentLocation: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
      lastSeen: new Date(),
    });

    // Refresh Redis heartbeat key (best-effort)
    const redis = getRedis();
    if (redis) {
      await redis.setex(
        redisKeys.queueHeartbeat(queueEntryId),
        config.QUEUE_HEARTBEAT_SECONDS * config.QUEUE_MAX_MISSED_HEARTBEATS,
        'active'
      ).catch(() => {});
    }

    let warningIssued = false;
    if (!withinRadius) {
      logger.warn(
        `Driver ${driverId} is ${distanceMeters.toFixed(0)}m outside radius of ${allowedRadius}m`
      );
      warningIssued = true;
    }

    return { withinRadius, distanceMeters, warningIssued };
  }

  // ─── GET ELIGIBLE DRIVERS ────────────────────────────────────

  async getEligibleDrivers(
    taxiStandId?: string,
    vehicleCategoryId?: string,
    policy: QueuePolicy = QueuePolicy.FIFO
  ): Promise<IQueueEntry[]> {
    const query: Record<string, unknown> = {
      status: QueueEntryStatus.WAITING,
    };

    if (taxiStandId && taxiStandId.trim() !== '') {
      query.taxiStandId = taxiStandId;
    }

    if (policy !== QueuePolicy.NEAREST_ELIGIBLE && vehicleCategoryId && vehicleCategoryId.trim() !== '') {
      query.vehicleCategoryId = vehicleCategoryId;
    }

    let entries = await QueueEntry.find(query).sort({ position: 1, joinedAt: 1 }).limit(10);

    // If no entries matched with specific vehicle category, fallback to any available driver at stand/queue
    if (entries.length === 0 && query.vehicleCategoryId) {
      delete query.vehicleCategoryId;
      entries = await QueueEntry.find(query).sort({ position: 1, joinedAt: 1 }).limit(10);
    }

    return entries;
  }

  // ─── INTERNAL HELPERS ────────────────────────────────────────

  private async reorderPositions(
    taxiStandId: string,
    removedPosition: number,
    session?: mongoose.ClientSession
  ): Promise<void> {
    // Decrement position of all entries that were after the removed one
    await QueueEntry.updateMany(
      {
        taxiStandId,
        position: { $gt: removedPosition },
        status: { $in: [QueueEntryStatus.WAITING, QueueEntryStatus.OFFERED] },
      },
      { $inc: { position: -1 } },
      session ? { session } : {}
    );
  }

  // Haversine formula for distance in meters
  haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dPhi = ((lat2 - lat1) * Math.PI) / 180;
    const dLambda = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private validateOperatingHours(
    operatingHours?: Array<{ dayOfWeek: number; openTime: string; closeTime: string; closed: boolean }>
  ): void {
    if (!operatingHours || operatingHours.length === 0) return;

    const now = new Date();
    const dayOfWeek = now.getDay();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const todayHours = operatingHours.find(h => h.dayOfWeek === dayOfWeek);
    if (!todayHours || todayHours.closed) {
      throw errors.badRequest(
        'This taxi stand is closed today. Please check operating hours.',
        'STAND_CLOSED'
      );
    }

    if (timeStr < todayHours.openTime || timeStr > todayHours.closeTime) {
      throw errors.badRequest(
        `This taxi stand is currently closed. Operating hours: ${todayHours.openTime} - ${todayHours.closeTime}`,
        'STAND_OUTSIDE_HOURS'
      );
    }
  }
}

export const queueService = new QueueService();
