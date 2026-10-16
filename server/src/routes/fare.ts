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
    .populate('vehicleCategoryId', 'name code baseFare ratePerKm seatCapacity')
    .sort({ priority: 1, fixedPrice: 1 });

  res.json({ success: true, data: rules });
});

// Public Pricing & Tax Settings (for customer & driver app display)
router.get('/settings', async (_req, res) => {
  const { SystemSetting } = await import('@/models/SystemSetting');
  const dbSettings = await SystemSetting.find({
    key: {
      $in: [
        'taxEnabled',
        'taxPercentage',
        'taxName',
        'platformFeeEnabled',
        'platformFeeType',
        'platformFeeAmount',
        'platformFeeName',
      ],
    },
  });

  const settingsMap: Record<string, any> = {
    taxEnabled: true,
    taxPercentage: 5,
    taxName: 'GST (5%)',
    platformFeeEnabled: false,
    platformFeeType: 'FIXED',
    platformFeeAmount: 15,
    platformFeeName: 'Platform Convenience Fee',
  };

  for (const doc of dbSettings) {
    settingsMap[doc.key] = doc.value;
  }

  res.json({
    success: true,
    data: {
      taxEnabled: Boolean(settingsMap.taxEnabled),
      taxPercentage: Number(settingsMap.taxPercentage) || 0,
      taxName: String(settingsMap.taxName || 'GST'),
      platformFeeEnabled: Boolean(settingsMap.platformFeeEnabled),
      platformFeeType: settingsMap.platformFeeType === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED',
      platformFeeAmount: Number(settingsMap.platformFeeAmount) || 0,
      platformFeeName: String(settingsMap.platformFeeName || 'Platform Convenience Fee'),
    },
  });
});

export default router;
