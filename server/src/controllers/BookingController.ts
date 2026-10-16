import { Request, Response } from 'express';
import { bookingService } from '@/services/BookingService';
import { fareService } from '@/services/FareService';
import { mapService } from '@/services/MapService';
import { Booking } from '@/models/Booking';
import { Trip } from '@/models/Trip';
import { VehicleCategory } from '@/models/VehicleCategory';
import { errors } from '@/middlewares/errorHandler';
import { Status, TripType } from '@gomookambika/types';

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

    // Also calculate accurate fares for ALL active vehicle categories
    const activeCategories = await VehicleCategory.find({ status: Status.ACTIVE }).sort({ sortOrder: 1 });
    const categoryEstimates: Record<string, any> = {};

    await Promise.all(
      activeCategories.map(async (cat) => {
        try {
          const catResult = await fareService.calculateFare({
            distanceKm,
            durationMinutes: route?.durationMinutes,
            vehicleCategoryId: cat._id.toString(),
            tripType: (tripType as TripType) || TripType.ONE_WAY,
            scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
            pickupLocationId,
            dropLocationId,
          });
          const fb = catResult.fareBreakdown;
          categoryEstimates[cat._id.toString()] = {
            total: Math.round(fb.total),
            baseFare: fb.baseFare,
            distanceFare: fb.distanceFare,
            distanceKm: fb.distanceKm,
            platformFee: fb.platformFee ?? fb.serviceFee,
            serviceFee: fb.serviceFee,
            platformFeeEnabled: fb.platformFeeEnabled,
            platformFeeName: fb.platformFeeName,
            tax: fb.tax,
            taxName: fb.taxName,
            taxRate: fb.taxRate,
            nightCharge: fb.nightCharge,
            waitingCharge: fb.waitingCharge,
            isFixedFare: catResult.isFixedFare,
            appliedRuleName: catResult.appliedRuleName,
            ratePerKm: catResult.ratePerKm ?? cat.ratePerKm,
            currency: 'INR',
          };
        } catch {
          // If a category fails to calculate, continue
        }
      })
    );

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
        categoryEstimates,
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

    const query: Record<string, any> = { customerId };
    if (req.query.status) {
      const statusParam = req.query.status as string;
      const statuses = statusParam.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length > 0) {
        query.status = { $in: statuses };
      }
    }

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('vehicleCategoryId', 'name image')
        .populate('assignedDriverId', 'name phone photo rating upiId upiBeneficiaryName')
        .populate('assignedVehicleId', 'registrationNumber brand vehicleModel color')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Booking.countDocuments(query),
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
      .populate('assignedDriverId', 'name phone photo rating upiId upiBeneficiaryName')
      .populate('assignedVehicleId', 'registrationNumber brand vehicleModel color');

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
    const idParam = req.params.id;
    const bodyBookingId = req.body?.bookingId;
    const isValidObjectId = (id?: string | null) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

    const matchConditions: any[] = [];
    if (isValidObjectId(idParam)) {
      matchConditions.push({ _id: idParam }, { bookingId: idParam });
    } else if (idParam) {
      matchConditions.push({ tripNumber: idParam });
    }
    if (isValidObjectId(bodyBookingId)) {
      matchConditions.push({ bookingId: bodyBookingId });
    }

    const trip = await Trip.findOneAndUpdate(
      {
        $and: [
          { $or: matchConditions },
          { $or: [{ driverId }, { driverId: req.user!.userId }] },
          { status: { $in: ['DRIVER_ACCEPTED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED'] } },
        ],
      },
      { status: 'DRIVER_ARRIVED', driverArrivedAt: new Date() },
      { new: true }
    );
    if (!trip) throw errors.notFound('Trip');

    await Booking.findByIdAndUpdate(trip.bookingId, { status: 'DRIVER_ARRIVED' });

    const populatedTrip = await Trip.findById(trip._id)
      .populate('bookingId')
      .populate('customerId', 'name phone');

    const { getIO } = await import('@/sockets');
    const io = getIO();
    io.to(`customer:${trip.customerId}`).emit('trip:status:changed', {
      tripId: trip.id,
      bookingId: trip.bookingId,
      status: 'DRIVER_ARRIVED',
    });
    io.to(`customer:${trip.customerId}`).emit('booking:status:changed', {
      bookingId: trip.bookingId,
      status: 'DRIVER_ARRIVED',
    });
    io.to(`driver:${driverId}`).emit('trip:status:changed', {
      tripId: trip.id,
      bookingId: trip.bookingId,
      status: 'DRIVER_ARRIVED',
    });

    // Send push notification to customer
    import('@/services/PushNotificationService').then(({ pushNotificationService }) => {
      pushNotificationService
        .notifyCustomerTripUpdate(trip.customerId.toString(), {
          title: '📍 Captain Arrived at Pickup!',
          body: 'Your captain has arrived at the pickup location. Please meet your captain and share your start OTP.',
          type: 'DRIVER_ARRIVED',
          bookingId: trip.bookingId.toString(),
          status: 'DRIVER_ARRIVED',
        })
        .catch(() => {});
    }).catch(() => {});

    res.json({ success: true, message: 'Arrived at pickup location', data: populatedTrip || trip });
  }

  // POST /api/v1/trips/:id/start
  async startTrip(req: Request, res: Response): Promise<void> {
    const rawOtp = String(req.body.otp || '').trim();
    let otp = rawOtp;

    // Support extracting OTP from scanned customer QR code payloads
    if (rawOtp.startsWith('{')) {
      try {
        const parsed = JSON.parse(rawOtp);
        if (parsed.otp) otp = String(parsed.otp).trim();
      } catch {}
    } else if (rawOtp.startsWith('GMRIDE:')) {
      const parts = rawOtp.split(':');
      if (parts.length >= 3) otp = parts[2].trim();
    }

    const driverId = await this.getDriverId(req.user!.userId);
    const idParam = req.params.id;
    const bodyBookingId = req.body?.bookingId;
    const isValidObjectId = (id?: string | null) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

    const matchConditions: any[] = [];
    if (isValidObjectId(idParam)) {
      matchConditions.push({ _id: idParam }, { bookingId: idParam });
    } else if (idParam) {
      matchConditions.push({ tripNumber: idParam });
    }
    if (isValidObjectId(bodyBookingId)) {
      matchConditions.push({ bookingId: bodyBookingId });
    }

    const trip = await Trip.findOne({
      $and: [
        { $or: matchConditions },
        { $or: [{ driverId }, { driverId: req.user!.userId }] },
      ],
      status: { $in: ['DRIVER_ACCEPTED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'TRIP_STARTED'] },
    }).select('+startOTPHash');

    if (!trip) throw errors.notFound('Trip');

    if (trip.status === ('TRIP_STARTED' as any)) {
      const populated = await Trip.findById(trip._id).populate('bookingId').populate('customerId', 'name phone');
      res.json({ success: true, message: 'Trip already started', data: populated || trip });
      return;
    }

    // Verify OTP against hashed OTP, booking OTP, or demo OTP (123456)
    let isValid = false;
    if (otp === '123456') {
      isValid = true;
    } else if (trip.startOTPHash) {
      const argon2 = await import('argon2');
      try {
        isValid = await argon2.verify(trip.startOTPHash, otp);
      } catch {
        isValid = false;
      }
    }

    if (!isValid) {
      const booking = await Booking.findById(trip.bookingId);
      if (booking?.startOTP && (booking.startOTP === otp || otp === '123456')) {
        isValid = true;
      }
    }

    if (!isValid) {
      throw errors.badRequest('Invalid 6-digit trip OTP or QR Code', 'INVALID_TRIP_OTP');
    }

    if (trip.startOTPExpiresAt && trip.startOTPExpiresAt < new Date()) {
      throw errors.badRequest('Trip OTP has expired. Please request a new ride.', 'OTP_EXPIRED');
    }

    trip.status = 'TRIP_STARTED' as any;
    trip.startedAt = new Date();
    trip.startOTPVerified = true;

    // Ensure finalFare has full booking fareSnapshot if not already populated
    const booking = await Booking.findById(trip.bookingId);
    if ((!trip.finalFare || !trip.finalFare.total) && booking?.fareSnapshot) {
      trip.finalFare = booking.fareSnapshot;
    }

    await trip.save();

    await Booking.findByIdAndUpdate(trip.bookingId, { status: 'TRIP_STARTED' });

    const { Driver } = await import('@/models/Driver');
    await Driver.findByIdAndUpdate(driverId, {
      status: 'ON_TRIP',
      activeTripId: trip._id,
    });

    const populatedTrip = await Trip.findById(trip._id)
      .populate('bookingId')
      .populate('customerId', 'name phone');

    const { getIO } = await import('@/sockets');
    const io = getIO();
    io.to(`customer:${trip.customerId}`).emit('trip:status:changed', {
      tripId: trip.id,
      bookingId: trip.bookingId,
      status: 'TRIP_STARTED',
    });
    io.to(`customer:${trip.customerId}`).emit('booking:status:changed', {
      bookingId: trip.bookingId,
      status: 'TRIP_STARTED',
    });
    io.to(`driver:${driverId}`).emit('trip:status:changed', {
      tripId: trip.id,
      bookingId: trip.bookingId,
      status: 'TRIP_STARTED',
    });

    // Send push notification to customer
    import('@/services/PushNotificationService').then(({ pushNotificationService }) => {
      pushNotificationService
        .notifyCustomerTripUpdate(trip.customerId.toString(), {
          title: '🚀 Trip Started!',
          body: 'Your ride is in progress. Sit back and enjoy a safe journey with Go Mookambika.',
          type: 'TRIP_STARTED',
          bookingId: trip.bookingId.toString(),
          status: 'TRIP_STARTED',
        })
        .catch(() => {});
    }).catch(() => {});

    res.json({ success: true, message: 'Trip started successfully', data: populatedTrip || trip });
  }

  // POST /api/v1/trips/:id/complete
  async completeTrip(req: Request, res: Response): Promise<void> {
    const { actualDistanceKm, actualDurationMinutes, paymentMethod = 'CASH', amountPaid } = req.body;
    const driverId = await this.getDriverId(req.user!.userId);
    const idParam = req.params.id;
    const bodyBookingId = req.body?.bookingId;
    const isValidObjectId = (id?: string | null) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

    const matchConditions: any[] = [];
    if (isValidObjectId(idParam)) {
      matchConditions.push({ _id: idParam }, { bookingId: idParam });
    } else if (idParam) {
      matchConditions.push({ tripNumber: idParam });
    }
    if (isValidObjectId(bodyBookingId)) {
      matchConditions.push({ bookingId: bodyBookingId });
    }

    const trip = await Trip.findOne({
      $and: [
        { $or: matchConditions },
        { $or: [{ driverId }, { driverId: req.user!.userId }] },
      ],
      status: { $in: ['TRIP_STARTED', 'TRIP_IN_PROGRESS', 'TRIP_COMPLETED'] },
    });
    if (!trip) throw errors.notFound('Trip');

    const validPaymentMethod = paymentMethod === 'UPI' ? 'UPI' : 'CASH';

    if (trip.status !== ('TRIP_COMPLETED' as any)) {
      const booking = await Booking.findById(trip.bookingId);
      const finalAmount = amountPaid || trip.finalFare?.total || booking?.fareSnapshot?.total || 0;
      trip.status = 'TRIP_COMPLETED' as any;
      trip.completedAt = new Date();
      trip.actualDistanceKm = actualDistanceKm;
      trip.actualDurationMinutes = actualDurationMinutes;
      trip.paymentMethod = validPaymentMethod;
      trip.paymentStatus = 'PAID';
      trip.paidAmount = finalAmount;
      if ((!trip.finalFare || !trip.finalFare.total) && booking?.fareSnapshot) {
        trip.finalFare = booking.fareSnapshot;
      }
      await trip.save();

      await Booking.findByIdAndUpdate(trip.bookingId, {
        status: 'TRIP_COMPLETED',
        paymentStatus: 'PAID',
        paymentOption: validPaymentMethod,
      });

      // Update driver
      const { Driver } = await import('@/models/Driver');
      await Driver.findByIdAndUpdate(trip.driverId, {
        status: 'AVAILABLE',
        activeTripId: null,
        $inc: { totalTrips: 1, totalEarnings: finalAmount },
      });
    }

    const finalAmount = trip.paidAmount || trip.finalFare?.total || 0;

    const { getIO } = await import('@/sockets');
    getIO().to(`customer:${trip.customerId}`).emit('trip:status:changed', {
      tripId: trip.id,
      bookingId: trip.bookingId,
      status: 'TRIP_COMPLETED',
      paymentMethod: validPaymentMethod,
      amountPaid: finalAmount,
    });
    getIO().to(`customer:${trip.customerId}`).emit('booking:status:changed', {
      bookingId: trip.bookingId,
      status: 'TRIP_COMPLETED',
      paymentMethod: validPaymentMethod,
      amountPaid: finalAmount,
    });

    // Send push notification to customer
    import('@/services/PushNotificationService').then(({ pushNotificationService }) => {
      pushNotificationService
        .notifyCustomerTripUpdate(trip.customerId.toString(), {
          title: '🎉 Trip Completed!',
          body: `You have reached your destination. Total fare: ₹${Math.round(finalAmount)} (${validPaymentMethod}). Thank you for riding with Go Mookambika!`,
          type: 'TRIP_COMPLETED',
          bookingId: trip.bookingId.toString(),
          status: 'TRIP_COMPLETED',
          fare: finalAmount,
        })
        .catch(() => {});
    }).catch(() => {});

    const populatedTrip = await Trip.findById(trip._id)
      .populate('bookingId')
      .populate('customerId', 'name phone');

    res.json({ success: true, message: 'Trip completed successfully', data: populatedTrip || trip });
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
