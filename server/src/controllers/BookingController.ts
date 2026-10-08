import { Request, Response } from 'express';
import { bookingService } from '@/services/BookingService';
import { fareService } from '@/services/FareService';
import { mapService } from '@/services/MapService';
import { Booking } from '@/models/Booking';
import { Trip } from '@/models/Trip';
import { errors } from '@/middlewares/errorHandler';
import { TripType } from '@gomookambika/types';

export class BookingController {
  // POST /api/v1/fare/estimate
  async estimateFare(req: Request, res: Response): Promise<void> {
    const {
      pickupLatitude, pickupLongitude,
      dropLatitude, dropLongitude,
      vehicleCategoryId, tripType, scheduledAt,
      pickupLocationId, dropLocationId,
    } = req.body;

    const route = await mapService.route(
      { latitude: pickupLatitude, longitude: pickupLongitude },
      { latitude: dropLatitude, longitude: dropLongitude }
    );

    const distanceKm = route?.distanceKm ?? mapService.haversineDistance(
      { latitude: pickupLatitude, longitude: pickupLongitude },
      { latitude: dropLatitude, longitude: dropLongitude }
    );

    const { fareBreakdown, appliedRuleName, appliedRuleType, isFixedFare, ratePerKm } = await fareService.calculateFare({
      distanceKm,
      durationMinutes: route?.durationMinutes,
      vehicleCategoryId,
      tripType: tripType as TripType,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
      pickupLocationId,
      dropLocationId,
    });

    res.json({
      success: true,
      data: {
        fareBreakdown,
        appliedRule: appliedRuleName,
        appliedRuleType,
        isFixedFare,
        ratePerKm,
        routeDistanceKm: distanceKm,
        estimatedDurationMinutes: route?.durationMinutes,
        routePolyline: route?.polyline,
      },
    });
  }

  // POST /api/v1/bookings
  async createBooking(req: Request, res: Response): Promise<void> {
    const booking = await bookingService.createBooking({
      ...req.body,
      customerId: req.user!.userId,
    });

    res.status(201).json({
      success: true,
      message: 'Booking confirmed! Searching for driver...',
      data: booking,
    });
  }

  // GET /api/v1/bookings
  async getMyBookings(req: Request, res: Response): Promise<void> {
    const customerId = req.user!.userId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 10);
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      Booking.find({ customerId })
        .populate('vehicleCategoryId', 'name image')
        .populate('assignedDriverId', 'name phone photo rating')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Booking.countDocuments({ customerId }),
    ]);

    res.json({
      success: true,
      data: bookings,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }

  // GET /api/v1/bookings/:id
  async getBooking(req: Request, res: Response): Promise<void> {
    const booking = await Booking.findOne({
      _id: req.params.id,
      customerId: req.user!.userId,
    })
      .populate('vehicleCategoryId', 'name image seatCapacity')
      .populate('assignedDriverId', 'name phone photo rating');

    if (!booking) throw errors.notFound('Booking');
    res.json({ success: true, data: booking });
  }

  // POST /api/v1/bookings/:id/cancel
  async cancelBooking(req: Request, res: Response): Promise<void> {
    const booking = await Booking.findOne({
      _id: req.params.id,
      customerId: req.user!.userId,
    });

    if (!booking) throw errors.notFound('Booking');

    const cancellableStatuses = ['CONFIRMED', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ACCEPTED'];
    if (!cancellableStatuses.includes(booking.status)) {
      throw errors.badRequest('This booking cannot be cancelled at this stage', 'CANCELLATION_NOT_ALLOWED');
    }

    booking.status = 'CANCELLED' as any;
    booking.cancellationReason = req.body.reason;
    booking.cancelledBy = req.user!.userId as any;
    booking.cancelledAt = new Date();
    await booking.save();

    res.json({ success: true, message: 'Booking cancelled successfully', data: booking });
  }
}

export class TripController {
  private async getDriverId(userId: string): Promise<string> {
    const { Driver } = await import('@/models/Driver');
    const driver = await Driver.findOne({
      $or: [{ userId }, { _id: userId }],
    });
    return driver ? driver._id.toString() : userId;
  }

  // POST /api/v1/trips/:id/accept
  async acceptTrip(req: Request, res: Response): Promise<void> {
    const driverId = await this.getDriverId(req.user!.userId);
    const bookingId = req.body?.bookingId || req.params.id;
    const trip = await bookingService.acceptTrip(driverId, bookingId);
    res.json({ success: true, message: 'Trip accepted', data: trip });
  }

  // POST /api/v1/trips/:id/decline
  async declineTrip(req: Request, res: Response): Promise<void> {
    const driverId = await this.getDriverId(req.user!.userId);
    const bookingId = req.body?.bookingId || req.params.id;
    await bookingService.declineTrip(driverId, bookingId);
    res.json({ success: true, message: 'Trip declined' });
  }

  // POST /api/v1/trips/:id/arrived
  async driverArrived(req: Request, res: Response): Promise<void> {
    const driverId = await this.getDriverId(req.user!.userId);
    const trip = await Trip.findOneAndUpdate(
      { _id: req.params.id, $or: [{ driverId }, { driverId: req.user!.userId }], status: 'DRIVER_ACCEPTED' },
      { status: 'DRIVER_ARRIVED', driverArrivedAt: new Date() },
      { new: true }
    );
    if (!trip) throw errors.notFound('Trip');

    await Booking.findByIdAndUpdate(trip.bookingId, { status: 'DRIVER_ARRIVED' });

    const { getIO } = await import('@/sockets');
    getIO().to(`customer:${trip.customerId}`).emit('trip:status:changed', {
      tripId: trip.id,
      status: 'DRIVER_ARRIVED',
    });

    res.json({ success: true, message: 'Arrived at pickup location', data: trip });
  }

  // POST /api/v1/trips/:id/start
  async startTrip(req: Request, res: Response): Promise<void> {
    const { otp } = req.body;
    const driverId = await this.getDriverId(req.user!.userId);
    const trip = await Trip.findOne({
      _id: req.params.id,
      $or: [{ driverId }, { driverId: req.user!.userId }],
      status: 'DRIVER_ARRIVED',
    }).select('+startOTPHash');

    if (!trip) throw errors.notFound('Trip');

    // Verify OTP
    const argon2 = await import('argon2');
    const isValid = await argon2.verify(trip.startOTPHash, otp);
    if (!isValid) throw errors.badRequest('Invalid trip OTP', 'INVALID_TRIP_OTP');

    if (trip.startOTPExpiresAt < new Date()) {
      throw errors.badRequest('Trip OTP has expired. Request admin to generate new one.', 'OTP_EXPIRED');
    }

    trip.status = 'TRIP_STARTED' as any;
    trip.startedAt = new Date();
    trip.startOTPVerified = true;
    await trip.save();

    await Booking.findByIdAndUpdate(trip.bookingId, { status: 'TRIP_STARTED' });

    const { getIO } = await import('@/sockets');
    getIO().to(`customer:${trip.customerId}`).emit('trip:status:changed', {
      tripId: trip.id,
      status: 'TRIP_STARTED',
    });

    res.json({ success: true, message: 'Trip started', data: trip });
  }

  // POST /api/v1/trips/:id/complete
  async completeTrip(req: Request, res: Response): Promise<void> {
    const { actualDistanceKm, actualDurationMinutes } = req.body;
    const driverId = await this.getDriverId(req.user!.userId);
    const trip = await Trip.findOne({
      _id: req.params.id,
      $or: [{ driverId }, { driverId: req.user!.userId }],
      status: { $in: ['TRIP_STARTED', 'TRIP_IN_PROGRESS'] },
    });
    if (!trip) throw errors.notFound('Trip');

    trip.status = 'TRIP_COMPLETED' as any;
    trip.completedAt = new Date();
    trip.actualDistanceKm = actualDistanceKm;
    trip.actualDurationMinutes = actualDurationMinutes;
    await trip.save();

    await Booking.findByIdAndUpdate(trip.bookingId, { status: 'TRIP_COMPLETED' });

    // Update driver
    const { Driver } = await import('@/models/Driver');
    await Driver.findByIdAndUpdate(trip.driverId, {
      status: 'AVAILABLE',
      activeTripId: null,
      $inc: { totalTrips: 1 },
    });

    const { getIO } = await import('@/sockets');
    getIO().to(`customer:${trip.customerId}`).emit('trip:status:changed', {
      tripId: trip.id,
      status: 'TRIP_COMPLETED',
    });

    res.json({ success: true, message: 'Trip completed', data: trip });
  }

  // POST /api/v1/trips/:id/rate
  async rateTrip(req: Request, res: Response): Promise<void> {
    const { rating, comment } = req.body;
    const userId = req.user!.userId;

    const trip = await Trip.findById(req.params.id);
    if (!trip) throw errors.notFound('Trip');

    const isCustomer = trip.customerId.toString() === userId;
    const isDriver = trip.driverId.toString() === userId;

    if (isCustomer) {
      trip.driverRating = rating;
      trip.driverRatingComment = comment;
      // Update driver average rating
      const { Driver } = await import('@/models/Driver');
      const driver = await Driver.findById(trip.driverId);
      if (driver) {
        const newRatingCount = driver.ratingCount + 1;
        const newRating = (driver.rating * driver.ratingCount + rating) / newRatingCount;
        await Driver.findByIdAndUpdate(driver._id, {
          rating: Math.round(newRating * 10) / 10,
          ratingCount: newRatingCount,
        });
      }
    } else if (isDriver) {
      trip.customerRating = rating;
      trip.customerRatingComment = comment;
    } else {
      throw errors.forbidden();
    }

    await trip.save();
    res.json({ success: true, message: 'Rating submitted', data: trip });
  }
}

export const bookingController = new BookingController();
export const tripController = new TripController();
