import mongoose from 'mongoose';
import crypto from 'crypto';
import argon2 from 'argon2';
import { Booking } from '@/models/Booking';
import { Trip } from '@/models/Trip';
import { Driver } from '@/models/Driver';
import { Vehicle } from '@/models/Vehicle';
import { QueueEntry } from '@/models/QueueEntry';
import { fareService } from './FareService';
import { mapService } from './MapService';
import { queueService } from './QueueService';
import { errors } from '@/middlewares/errorHandler';
import { logger } from '@/utils/logger';
import { getRedis, redisKeys } from '@/config/redis';
import { config } from '@/config/env';
import {
  BookingStatus,
  TripStatus,
  DriverStatus,
  QueueEntryStatus,
  QueuePolicy,
  DeclinePolicy,
  SocketEvent,
  TripOfferPayload,
  TripType,
} from '@gomookambika/types';
import type { IBooking } from '@/models/Booking';
import type { ITrip } from '@/models/Trip';
import { getIO, tryGetIO } from '@/sockets';
import { generateBookingNumber, generateTripNumber } from '@/utils/idGenerator';

export interface CreateBookingInput {
  customerId: string;
  tripType: string;
  pickupLocation: {
    latitude: number;
    longitude: number;
    address: string;
    locationId?: string;
    name?: string;
  };
  dropLocation?: {
    latitude: number;
    longitude: number;
    address: string;
    locationId?: string;
    name?: string;
  };
  scheduledAt?: Date | string;
  passengers: number;
  vehicleCategoryId: string;
  paymentOption: string;
  notes?: string;
  originTaxiStandId?: string;
  destinationTaxiStandId?: string;
}

export class BookingService {
  // ─── CREATE BOOKING ──────────────────────────────────────────

  async createBooking(input: CreateBookingInput): Promise<IBooking> {
    const {
      customerId,
      tripType,
      pickupLocation,
      dropLocation,
      vehicleCategoryId,
      paymentOption,
      scheduledAt,
      passengers,
      notes,
    } = input;

    // Resolve originTaxiStandId if not directly provided
    let originTaxiStandId = input.originTaxiStandId;
    if (!originTaxiStandId && pickupLocation.locationId) {
      try {
        const { TaxiStand } = await import('@/models/TaxiStand');
        const stand = await TaxiStand.findOne({ locationId: pickupLocation.locationId, status: 'ACTIVE' });
        if (stand) {
          originTaxiStandId = stand._id.toString();
        }
      } catch (e) {
        logger.warn('Failed to resolve originTaxiStandId from locationId', e);
      }
    }

    // Calculate route distance
    let distanceKm = 0;
    if (dropLocation) {
      const route = await mapService.route(
        { latitude: pickupLocation.latitude, longitude: pickupLocation.longitude },
        { latitude: dropLocation.latitude, longitude: dropLocation.longitude }
      );
      distanceKm = route?.distanceKm ?? mapService.haversineDistance(
        { latitude: pickupLocation.latitude, longitude: pickupLocation.longitude },
        { latitude: dropLocation.latitude, longitude: dropLocation.longitude }
      );
    }

    const isValidObjectId = (id?: string | null): boolean =>
      typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

    const { VehicleCategory } = await import('@/models/VehicleCategory');
    let category = null;
    if (isValidObjectId(vehicleCategoryId)) {
      category = await VehicleCategory.findById(vehicleCategoryId);
    }
    if (!category) {
      category = await VehicleCategory.findOne({
        $or: [
          { code: vehicleCategoryId.toUpperCase() },
          { name: new RegExp(vehicleCategoryId, 'i') },
        ],
      });
    }
    if (!category) {
      category = await VehicleCategory.findOne({ status: 'ACTIVE' }).sort({ sortOrder: 1 });
    }
    if (!category) {
      throw errors.notFound('Vehicle Category');
    }
    const resolvedCategoryId = category._id;

    // Sanitize locations so custom or invalid location IDs do not cause Mongoose CastError
    const sanitizedPickupLoc = {
      ...pickupLocation,
      locationId: isValidObjectId(pickupLocation.locationId)
        ? new mongoose.Types.ObjectId(pickupLocation.locationId)
        : undefined,
    };
    const sanitizedDropLoc = dropLocation
      ? {
          ...dropLocation,
          locationId: isValidObjectId(dropLocation.locationId)
            ? new mongoose.Types.ObjectId(dropLocation.locationId)
            : undefined,
        }
      : undefined;

    const scheduledAtDate = scheduledAt ? new Date(scheduledAt) : undefined;
    const scheduledTime = scheduledAtDate && !isNaN(scheduledAtDate.getTime()) ? scheduledAtDate.getTime() : 0;
    // Check if this booking is scheduled in advance (> 15 minutes into the future)
    const isFutureSchedule = Boolean(scheduledTime && (scheduledTime - Date.now() > 15 * 60 * 1000));
    const resolvedTripType = isFutureSchedule ? TripType.ADVANCE_BOOKING : tripType;

    // Calculate fare (server-side — authoritative)
    const { fareBreakdown, appliedRuleName, appliedRuleType } = await fareService.calculateFare({
      distanceKm,
      vehicleCategoryId: resolvedCategoryId.toString(),
      tripType: resolvedTripType as any,
      scheduledAt: scheduledAtDate ?? new Date(),
      pickupLocationId: isValidObjectId(pickupLocation.locationId) ? pickupLocation.locationId : undefined,
      dropLocationId: isValidObjectId(dropLocation?.locationId) ? dropLocation?.locationId : undefined,
    });

    const bookingNumber = await generateBookingNumber();
    const startOTP = Math.floor(100000 + Math.random() * 900000).toString();

    const normalizedPaymentOption = paymentOption === 'PAY_AT_END' ? 'CASH' : paymentOption;

    const booking = await Booking.create({
      bookingNumber,
      customerId,
      tripType: resolvedTripType,
      status: BookingStatus.CONFIRMED,
      pickupLocation: sanitizedPickupLoc,
      dropLocation: sanitizedDropLoc,
      scheduledAt: scheduledAtDate,
      passengers,
      vehicleCategoryId: resolvedCategoryId,
      originTaxiStandId: originTaxiStandId && isValidObjectId(originTaxiStandId) ? new mongoose.Types.ObjectId(originTaxiStandId) : undefined,
      destinationTaxiStandId: input.destinationTaxiStandId && isValidObjectId(input.destinationTaxiStandId) ? new mongoose.Types.ObjectId(input.destinationTaxiStandId) : undefined,
      fareSnapshot: {
        ...fareBreakdown,
        ruleName: appliedRuleName,
        ruleType: appliedRuleType,
      },
      paymentOption: normalizedPaymentOption,
      notes,
      startOTP,
    });

    logger.info(`Booking created: ${bookingNumber} for customer ${customerId}`);

    if (isFutureSchedule) {
      logger.info(
        `Booking ${bookingNumber} scheduled for ${scheduledAtDate?.toISOString()}. Driver will be assigned from stand queue on trip start date.`
      );
      const io = tryGetIO();
      if (io) {
        io.to(`customer:${customerId}`).emit(SocketEvent.BOOKING_STATUS_CHANGED, {
          bookingId: booking.id,
          status: BookingStatus.CONFIRMED,
          scheduledAt: scheduledAtDate?.toISOString(),
        });
        io.to('admin:operations').emit('booking:created', {
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
          scheduledAt: scheduledAtDate?.toISOString(),
          status: BookingStatus.CONFIRMED,
        });
      }
    } else {
      // Immediately start driver search for immediate rides (async — don't block booking response)
      setImmediate(() => {
        this.searchAndDispatch(booking.id).catch(err =>
          logger.error(`Dispatch failed for booking ${booking.id}:`, err)
        );
      });
    }

    return booking;
  }

  // ─── DISPATCH ENGINE ─────────────────────────────────────────

  async searchAndDispatch(bookingId: string): Promise<void> {
    const booking = await Booking.findById(bookingId);
    if (!booking) return;

    // Update status to SEARCHING
    await Booking.findByIdAndUpdate(bookingId, {
      status: BookingStatus.SEARCHING_DRIVER,
    });

    // Get IO instance for real-time events
    const io = tryGetIO();
    if (io) {
      io.to(`customer:${booking.customerId}`).emit(SocketEvent.BOOKING_STATUS_CHANGED, {
        bookingId,
        status: BookingStatus.SEARCHING_DRIVER,
      });
      io.to('admin:operations').emit('booking:status:changed', {
        bookingId,
        status: BookingStatus.SEARCHING_DRIVER,
      });
    }

    // Find eligible drivers in queue
    let eligibleEntries = await queueService.getEligibleDrivers(
      booking.originTaxiStandId?.toString() ?? '',
      booking.vehicleCategoryId.toString(),
      QueuePolicy.FIFO
    );

    // If no driver found at specific origin stand, search across all active stands
    if (eligibleEntries.length === 0 && booking.originTaxiStandId) {
      eligibleEntries = await queueService.getEligibleDrivers(
        '',
        booking.vehicleCategoryId.toString(),
        QueuePolicy.FIFO
      );
    }

    if (eligibleEntries.length === 0) {
      logger.warn(`No drivers in queue for booking ${bookingId}`);
      return;
    }

    await this.offerTrip(booking, eligibleEntries[0].driverId.toString(), eligibleEntries);
  }

  private async offerTrip(
    booking: IBooking,
    driverId: string,
    allEligible: Array<{ driverId: { toString: () => string }; _id: { toString: () => string } }>
  ): Promise<void> {
    const io = tryGetIO();
    const redis = getRedis();
    const timeoutSeconds = await this.getDriverAcceptTimeoutSeconds();

    // Mark queue entry as OFFERED
    await QueueEntry.findOneAndUpdate(
      { driverId, status: QueueEntryStatus.WAITING },
      { status: QueueEntryStatus.OFFERED, tripOfferedAt: new Date() }
    );

    // Update driver status
    await Driver.findByIdAndUpdate(driverId, { status: DriverStatus.TRIP_OFFERED });

    // Store offer in Redis with timeout (best-effort)
    const offerKey = redisKeys.driverTripOffer(driverId);
    if (redis) {
      await redis.setex(offerKey, timeoutSeconds, booking.id).catch(() => {});
    }

    // Build trip offer payload
    const payload: TripOfferPayload = {
      bookingId: booking.id,
      tripId: '', // Will be created on accept
      pickupLocation: booking.pickupLocation,
      dropLocation: booking.dropLocation,
      passengers: booking.passengers,
      distanceKm: booking.fareSnapshot.distanceKm,
      estimatedFare: booking.fareSnapshot.total,
      vehicleCategory: booking.vehicleCategoryId.toString(),
      scheduledAt: booking.scheduledAt?.toISOString(),
      timeoutSeconds,
    };

    // Send offer to driver via socket rooms
    if (io) {
      io.to(`driver:${driverId}`).emit(SocketEvent.TRIP_OFFER_SENT, payload);
      io.to(`driver:${driverId}`).emit('trip:offer:sent', payload);

      // Also notify operations room
      io.to('admin:operations').emit('trip:offer:dispatched', {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        driverId,
        estimatedFare: booking.fareSnapshot?.total,
        timeoutSeconds,
      });
    }

    // Set acceptance timeout
    setTimeout(async () => {
      let stillPending = false;
      if (redis) {
        const pendingBookingId = await redis.get(offerKey).catch(() => null);
        stillPending = Boolean(pendingBookingId);
      } else {
        const offeredEntry = await QueueEntry.findOne({ driverId, status: QueueEntryStatus.OFFERED });
        stillPending = Boolean(offeredEntry);
      }
      if (stillPending) {
        // Driver didn't respond — timeout
        await this.handleDriverTimeout(booking, driverId, allEligible);
      }
    }, timeoutSeconds * 1000);

    logger.info(`Trip offer sent to driver ${driverId} for booking ${booking.id} (timeout: ${timeoutSeconds}s)`);
  }

  /**
   * Dynamically fetch driver acceptance time limit from SystemSetting (admin configured)
   */
  async getDriverAcceptTimeoutSeconds(): Promise<number> {
    try {
      const { SystemSetting } = await import('@/models/SystemSetting');
      const setting = await SystemSetting.findOne({ key: 'driverAcceptTimeout' });
      if (setting && typeof setting.value === 'number' && setting.value >= 5) {
        return Math.round(setting.value);
      }
      if (setting && typeof setting.value === 'string' && !isNaN(Number(setting.value))) {
        const num = Number(setting.value);
        if (num >= 5) return Math.round(num);
      }
    } catch (err) {
      logger.warn('Failed to fetch dynamic driverAcceptTimeout from DB, using fallback', err);
    }
    return config.DRIVER_TRIP_ACCEPT_TIMEOUT_SECONDS || 30;
  }

  async acceptTrip(driverId: string, bookingId: string): Promise<ITrip> {
    const redis = getRedis();
    const offerKey = redisKeys.driverTripOffer(driverId);

    // Verify offer is still valid in Redis (if Redis available)
    if (redis) {
      const pendingBookingId = await redis.get(offerKey).catch(() => null);
      if (pendingBookingId !== null && pendingBookingId !== bookingId) {
        throw errors.badRequest('Trip offer has expired or is invalid', 'OFFER_EXPIRED');
      }
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) throw errors.notFound('Booking');
    if (booking.status !== BookingStatus.SEARCHING_DRIVER) {
      throw errors.badRequest('Booking is no longer available', 'BOOKING_UNAVAILABLE');
    }

    const driver = await Driver.findById(driverId);
    if (!driver) throw errors.notFound('Driver');

    const vehicle = await Vehicle.findOne({ assignedDriverId: driver._id });
    if (!vehicle) throw errors.vehicleNotActive();

    // Clear the offer
    if (redis) {
      await redis.del(offerKey).catch(() => {});
    }

    // Generate trip start OTP (reuse booking OTP or generate new 6-digit PIN)
    const startOTP = booking.startOTP || Math.floor(100000 + Math.random() * 900000).toString();
    const startOTPHash = await argon2.hash(startOTP);
    const tripNumber = await generateTripNumber();

    let trip!: ITrip;
    try {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          // Create trip
          const [t] = await Trip.create(
            [
              {
                tripNumber,
                bookingId: booking._id,
                customerId: booking.customerId,
                driverId: driver._id,
                vehicleId: vehicle._id,
                status: TripStatus.DRIVER_ACCEPTED,
                pickupLocation: booking.pickupLocation,
                dropLocation: booking.dropLocation!,
                startOTPHash,
                startOTPExpiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
                startOTPVerified: false,
              },
            ],
            { session }
          );
          trip = t;

          // Update booking
          await Booking.findByIdAndUpdate(
            bookingId,
            {
              status: BookingStatus.DRIVER_ACCEPTED,
              assignedDriverId: driver._id,
              assignedVehicleId: vehicle._id,
              driverAssignedAt: new Date(),
              startOTP,
            },
            { session }
          );

          // Update queue entry
          await QueueEntry.findOneAndUpdate(
            { driverId: driver._id, status: QueueEntryStatus.OFFERED },
            {
              status: QueueEntryStatus.ASSIGNED,
              tripId: trip._id,
              tripAcceptedAt: new Date(),
            },
            { session }
          );

          // Update driver status
          await Driver.findByIdAndUpdate(
            driver._id,
            { status: DriverStatus.TRIP_ACCEPTED, activeTripId: trip._id },
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
        const [t] = await Trip.create([
          {
            tripNumber,
            bookingId: booking._id,
            customerId: booking.customerId,
            driverId: driver._id,
            vehicleId: vehicle._id,
            status: TripStatus.DRIVER_ACCEPTED,
            pickupLocation: booking.pickupLocation,
            dropLocation: booking.dropLocation!,
            startOTPHash,
            startOTPExpiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
            startOTPVerified: false,
          },
        ]);
        trip = t;

        await Booking.findByIdAndUpdate(bookingId, {
          status: BookingStatus.DRIVER_ACCEPTED,
          assignedDriverId: driver._id,
          assignedVehicleId: vehicle._id,
          driverAssignedAt: new Date(),
          startOTP,
        });

        await QueueEntry.findOneAndUpdate(
          { driverId: driver._id, status: QueueEntryStatus.OFFERED },
          {
            status: QueueEntryStatus.ASSIGNED,
            tripId: trip._id,
            tripAcceptedAt: new Date(),
          }
        );

        await Driver.findByIdAndUpdate(driver._id, {
          status: DriverStatus.TRIP_ACCEPTED,
          activeTripId: trip._id,
        });
      } else {
        throw err;
      }
    }

    // Store trip start OTP in Redis (best-effort)
    if (redis) {
      await redis.setex(redisKeys.tripStartOTP(trip!._id.toString()), 4 * 60 * 60, startOTP).catch(() => {});
    }

    const io = getIO();
    io.to(`customer:${booking.customerId}`).emit(SocketEvent.BOOKING_DRIVER_ASSIGNED, {
      bookingId,
      driverId,
      tripId: trip!._id,
      startOTP, // Customer receives the OTP to share with driver
    });

    io.to(`driver:${driverId}`).emit(SocketEvent.TRIP_OFFER_ACCEPTED, {
      tripId: trip!._id,
      bookingId,
    });

    logger.info(`Driver ${driverId} accepted trip ${tripNumber}`);
    return trip!;
  }

  async declineTrip(driverId: string, bookingId: string): Promise<void> {
    const redis = getRedis();
    if (redis) {
      const offerKey = redisKeys.driverTripOffer(driverId);
      await redis.del(offerKey).catch(() => {});
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return;

    // Update queue entry with decline
    const queueEntry = await QueueEntry.findOneAndUpdate(
      { driverId, status: QueueEntryStatus.OFFERED },
      {
        status: QueueEntryStatus.WAITING,
        tripDeclinedAt: new Date(),
        $inc: { declineCount: 1 },
      },
      { new: true }
    );

    // Reset driver status back to IN_QUEUE
    await Driver.findByIdAndUpdate(driverId, { status: DriverStatus.IN_QUEUE });

    // Apply decline policy
    await this.applyDeclinePolicy(driverId, queueEntry?.declineCount ?? 1);

    // Try next driver
    const eligibleEntries = await queueService.getEligibleDrivers(
      booking.originTaxiStandId?.toString() ?? '',
      booking.vehicleCategoryId.toString()
    );

    const nextDriver = eligibleEntries.find(e => e.driverId.toString() !== driverId);
    if (nextDriver) {
      await this.offerTrip(booking, nextDriver.driverId.toString(), eligibleEntries);
    }
  }

  private async applyDeclinePolicy(driverId: string, declineCount: number): Promise<void> {
    const policy = config.DRIVER_DECLINE_POLICY as DeclinePolicy;

    switch (policy) {
      case DeclinePolicy.KEEP_POSITION:
        // Nothing to do — driver keeps position
        break;

      case DeclinePolicy.MOVE_TO_END: {
        const entry = await QueueEntry.findOne({
          driverId,
          status: QueueEntryStatus.WAITING,
        });
        if (entry) {
          const lastEntry = await QueueEntry.findOne({
            taxiStandId: entry.taxiStandId,
            status: QueueEntryStatus.WAITING,
          }).sort({ position: -1 });
          await QueueEntry.findByIdAndUpdate(entry._id, {
            position: (lastEntry?.position ?? 0) + 1,
          });
        }
        break;
      }

      case DeclinePolicy.SUSPEND_AFTER_REPEATED_DECLINE:
        if (declineCount >= config.DRIVER_MAX_DECLINE_COUNT) {
          await Driver.findByIdAndUpdate(driverId, { status: DriverStatus.SUSPENDED });
          await QueueEntry.findOneAndUpdate(
            { driverId, status: QueueEntryStatus.WAITING },
            { status: QueueEntryStatus.REMOVED, removalReason: 'Suspended after repeated declines' }
          );
          logger.warn(`Driver ${driverId} suspended after ${declineCount} declines`);
        }
        break;
    }
  }

  private async handleDriverTimeout(
    booking: IBooking,
    driverId: string,
    remaining: Array<{ driverId: { toString: () => string }; _id: { toString: () => string } }>
  ): Promise<void> {
    const io = getIO();
    io.to(`driver:${driverId}`).emit(SocketEvent.TRIP_OFFER_TIMEOUT, { bookingId: booking.id });

    await Driver.findByIdAndUpdate(driverId, { status: DriverStatus.IN_QUEUE });
    await QueueEntry.findOneAndUpdate(
      { driverId, status: QueueEntryStatus.OFFERED },
      { status: QueueEntryStatus.WAITING, tripDeclinedAt: new Date(), $inc: { declineCount: 1 } }
    );

    const nextDriverEntry = remaining.find(e => e.driverId.toString() !== driverId);
    if (nextDriverEntry) {
      await this.offerTrip(booking, nextDriverEntry.driverId.toString(), remaining);
    }
  }

  // ─── SCHEDULED BOOKINGS DISPATCHER ──────────────────────────
  async dispatchScheduledBookings(): Promise<void> {
    const lookaheadMinutes = 15;
    const cutoff = new Date(Date.now() + lookaheadMinutes * 60 * 1000);

    try {
      // Find confirmed or searching scheduled bookings whose scheduledAt is due (<= now + 15 mins)
      // and that do not have an assigned driver yet
      const dueBookings = await Booking.find({
        status: { $in: [BookingStatus.CONFIRMED, BookingStatus.SEARCHING_DRIVER] },
        scheduledAt: { $exists: true, $ne: null, $lte: cutoff },
        assignedDriverId: { $exists: false },
      }).sort({ scheduledAt: 1 });

      if (dueBookings.length > 0) {
        logger.info(`Found ${dueBookings.length} due scheduled booking(s) ready for queue assignment.`);
      }

      for (const booking of dueBookings) {
        // Prevent repeated rapid-fire dispatch attempts if already currently in active offer window (< 35s)
        if (
          booking.status === BookingStatus.SEARCHING_DRIVER &&
          Date.now() - new Date(booking.updatedAt).getTime() < 35 * 1000
        ) {
          continue;
        }

        logger.info(
          `Assigning queued driver for scheduled booking ${booking.bookingNumber} (Trip time: ${booking.scheduledAt?.toISOString()})`
        );

        await this.searchAndDispatch(booking.id).catch(err => {
          logger.error(`Failed to dispatch scheduled booking ${booking.bookingNumber}:`, err);
        });
      }
    } catch (err) {
      logger.error('Error querying scheduled bookings for dispatch:', err);
    }
  }

  initScheduledBookingDispatcher(): NodeJS.Timeout {
    logger.info('Initializing scheduled booking background dispatcher (checks every 30s)...');

    // Initial check after 5 seconds
    setTimeout(() => {
      this.dispatchScheduledBookings().catch(err =>
        logger.error('Initial scheduled booking dispatch check error:', err)
      );
    }, 5000);

    // Periodic check every 30 seconds
    const interval = setInterval(() => {
      this.dispatchScheduledBookings().catch(err =>
        logger.error('Periodic scheduled booking dispatch error:', err)
      );
    }, 30 * 1000);

    return interval;
  }
}

export const bookingService = new BookingService();
