import { Router } from 'express';
import { Driver } from '@/models/Driver';
import { Vehicle } from '@/models/Vehicle';
import { Trip } from '@/models/Trip';
import { authenticate, requireRoles } from '@/middlewares/auth';
import { UserRole } from '@gomookambika/types';

const router = Router();

router.use(authenticate, requireRoles(UserRole.DRIVER));

// GET /api/v1/drivers/me  (alias for /profile used by driver-pwa)
router.get('/me', async (req, res) => {
  const driver = await Driver.findOne({ userId: req.user!.userId })
    .populate('userId', 'phone email');
  res.json({ success: true, data: driver });
});

// GET /api/v1/drivers/profile
router.get('/profile', async (req, res) => {
  const driver = await Driver.findOne({ userId: req.user!.userId })
    .populate('userId', 'phone email deviceTokens')
    .populate('activeQueueEntryId');
  res.json({ success: true, data: driver });
});

// GET /api/v1/drivers/vehicle
router.get('/vehicle', async (req, res) => {
  const driver = await Driver.findOne({ userId: req.user!.userId });
  if (!driver) { res.status(404).json({ success: false, message: 'Driver not found' }); return; }
  const vehicle = await Vehicle.findOne({ assignedDriverId: driver._id }).populate('categoryId');
  res.json({ success: true, data: vehicle });
});

// GET /api/v1/drivers/trips
router.get('/trips', async (req, res) => {
  const driver = await Driver.findOne({ userId: req.user!.userId });
  if (!driver) { res.status(404).json({ success: false, message: 'Driver not found' }); return; }
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = 20;
  const trips = await Trip.find({ driverId: driver._id })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  res.json({ success: true, data: trips });
});

// GET /api/v1/drivers/earnings
router.get('/earnings', async (req, res) => {
  const driver = await Driver.findOne({ userId: req.user!.userId });
  if (!driver) { res.status(404).json({ success: false, message: 'Driver not found' }); return; }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [todayTrips, todayEarnings] = await Promise.all([
    Trip.countDocuments({ driverId: driver._id, completedAt: { $gte: today } }),
    Trip.aggregate([
      { $match: { driverId: driver._id, completedAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$finalFare.total' } } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      totalTrips: driver.totalTrips,
      totalEarnings: driver.totalEarnings,
      rating: driver.rating,
      todayTrips,
      todayEarnings: todayEarnings[0]?.total ?? 0,
    },
  });
});

export default router;
