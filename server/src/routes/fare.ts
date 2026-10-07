import { Router } from 'express';
import { bookingController } from '@/controllers/BookingController';
import { optionalAuth } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { fareEstimateSchema } from '@gomookambika/validation';

const router = Router();

// Fare estimate is available to both authenticated and guest users
router.post('/estimate', optionalAuth, validate(fareEstimateSchema), bookingController.estimateFare.bind(bookingController));

export default router;
