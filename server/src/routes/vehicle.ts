import { Router, Request, Response } from 'express';
import { VehicleCategory } from '@/models/VehicleCategory';
import { Status } from '@gomookambika/types';

const router = Router();

/**
 * Public endpoint to fetch active vehicle categories with fare rates
 * GET /api/v1/vehicles/categories
 */
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await VehicleCategory.find({ status: Status.ACTIVE })
      .sort({ sortOrder: 1, name: 1 });
    res.json({ success: true, data: categories });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch vehicle categories' });
  }
});

export default router;
