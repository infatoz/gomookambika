import { Router } from 'express';
import { bookingController, tripController } from '@/controllers/BookingController';
import { authenticate, requireRoles } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { createBookingSchema } from '@gomookambika/validation';
import { UserRole } from '@gomookambika/types';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

// Customer booking routes (all authenticated users can book and access their bookings)
router.post('/', validate(createBookingSchema), bookingController.createBooking.bind(bookingController));
router.get('/', bookingController.getMyBookings.bind(bookingController));
router.get('/:id', bookingController.getBooking.bind(bookingController));
router.post('/:id/cancel', bookingController.cancelBooking.bind(bookingController));

// Trip routes (driver)
router.post('/:id/accept', requireRoles(UserRole.DRIVER), validate(z.object({ bookingId: z.string().optional() })), tripController.acceptTrip.bind(tripController));
router.post('/:id/decline', requireRoles(UserRole.DRIVER), validate(z.object({ bookingId: z.string().optional() })), tripController.declineTrip.bind(tripController));
router.post('/:id/arrived', requireRoles(UserRole.DRIVER), tripController.driverArrived.bind(tripController));
router.post('/:id/start', requireRoles(UserRole.DRIVER), validate(z.object({ otp: z.string().min(4) })), tripController.startTrip.bind(tripController));
router.post('/:id/complete', requireRoles(UserRole.DRIVER), tripController.completeTrip.bind(tripController));
router.post('/:id/rate', tripController.rateTrip.bind(tripController));

export default router;
