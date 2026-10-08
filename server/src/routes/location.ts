import { Router, Request, Response } from 'express';
import { Location } from '@/models/Location';
import { mapService } from '@/services/MapService';
import { optionalAuth } from '@/middlewares/auth';
import { Status } from '@gomookambika/types';

const router = Router();

// Public location search (for customer pickup/destination selection)
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  const { search, type, lat, lng } = req.query;
  const filter: Record<string, unknown> = { status: Status.ACTIVE, bookingEnabled: true };
  if (type) filter.type = type;
  if (search) filter.$or = [
    { name: { $regex: search, $options: 'i' } },
    { 'address.city': { $regex: search, $options: 'i' } },
  ];

  const locations = await Location.find(filter).limit(20).sort({ name: 1 });
  res.json({ success: true, data: locations });
});

// Active taxi stands list (for drivers and stand check-in)
router.get('/stands', async (_req: Request, res: Response) => {
  const { TaxiStand } = await import('@/models/TaxiStand');
  const stands = await TaxiStand.find({ status: Status.ACTIVE })
    .select('_id name qrToken locationId status queueRadius')
    .sort({ name: 1 });
  res.json({ success: true, data: stands });
});

router.get('/:id', async (req: Request, res: Response) => {
  const location = await Location.findOne({ _id: req.params.id, status: Status.ACTIVE });
  if (!location) { res.status(404).json({ success: false, message: 'Location not found' }); return; }
  res.json({ success: true, data: location });
});

export default router;
