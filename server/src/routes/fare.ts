import { Router } from 'express';
import { bookingController } from '@/controllers/BookingController';
import { optionalAuth } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { fareEstimateSchema } from '@gomookambika/validation';

const router = Router();

// Fare estimate is available to both authenticated and guest users
router.post('/estimate', optionalAuth, validate(fareEstimateSchema), bookingController.estimateFare.bind(bookingController));

// Active fixed fare routes (for customer booking suggestions & quick fare selection)
router.get('/fixed-routes', async (_req, res) => {
  const { PricingRule } = await import('@/models/PricingRule');
  const { PriceRuleType, Status } = await import('@gomookambika/types');
  const rules = await PricingRule.find({
    status: Status.ACTIVE,
    ruleType: { $in: [PriceRuleType.FIXED, PriceRuleType.LOCATION_TO_LOCATION] },
  })
    .populate('originLocationId', 'name type address geoPoint')
    .populate('destinationLocationId', 'name type address geoPoint')
    .populate('vehicleCategoryId', 'name code')
    .sort({ priority: 1, fixedPrice: 1 });

  res.json({ success: true, data: rules });
});

export default router;
