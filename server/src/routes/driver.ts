import { Router } from 'express';
import { Driver } from '@/models/Driver';
import { Vehicle } from '@/models/Vehicle';
import { VehicleCategory } from '@/models/VehicleCategory';
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
  const driver = await Driver.findOne({
    $or: [{ userId: req.user!.userId }, { _id: req.user!.userId }],
  });
  if (!driver) { res.status(404).json({ success: false, message: 'Driver not found' }); return; }
  let vehicle = await Vehicle.findOne({ assignedDriverId: driver._id }).populate('categoryId');
  if (!vehicle) {
    const defaultCat = await VehicleCategory.findOne({ status: 'ACTIVE' });
    if (defaultCat) {
      const reg = `KA20 D ${driver.driverCode ? driver.driverCode.replace('DRV-', '') : '1001'}`;
      vehicle = await Vehicle.create({
        registrationNumber: reg,
        categoryId: defaultCat._id,
        brand: 'Maruti Suzuki',
        vehicleModel: 'Dzire Tour',
        color: 'White',
        fuelType: 'PETROL',
        manufacturingYear: 2023,
        seatCapacity: 4,
        luggageCapacity: 2,
        ac: true,
        ownerName: driver.name,
        assignedDriverId: driver._id,
        status: 'ACTIVE',
        documents: [],
      });
      vehicle = await Vehicle.findById(vehicle._id).populate('categoryId');
    }
  }
  res.json({ success: true, data: vehicle });
});

// GET /api/v1/drivers/trips
router.get('/trips', async (req, res) => {
  const driver = await Driver.findOne({
    $or: [{ userId: req.user!.userId }, { _id: req.user!.userId }],
  });
  if (!driver) { res.status(404).json({ success: false, message: 'Driver not found' }); return; }
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const trips = await Trip.find({
    $or: [{ driverId: driver._id }, { driverId: req.user!.userId }],
  })
    .populate('bookingId')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  res.json({ success: true, data: trips });
});

// GET /api/v1/drivers/earnings
router.get('/earnings', async (req, res) => {
  const driver = await Driver.findOne({
    $or: [{ userId: req.user!.userId }, { _id: req.user!.userId }],
  });
  if (!driver) { res.status(404).json({ success: false, message: 'Driver not found' }); return; }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(today);
  thisWeek.setDate(today.getDate() - today.getDay());
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayTrips, todayEarningsAgg, weekEarningsAgg, monthEarningsAgg] = await Promise.all([
    Trip.countDocuments({
      $or: [{ driverId: driver._id }, { driverId: req.user!.userId }],
      completedAt: { $gte: today },
    }),
    Trip.aggregate([
      {
        $match: {
          $or: [{ driverId: driver._id }, { driverId: req.user!.userId }],
          completedAt: { $gte: today },
        },
      },
      { $group: { _id: null, total: { $sum: '$finalFare.total' } } },
    ]),
    Trip.aggregate([
      {
        $match: {
          $or: [{ driverId: driver._id }, { driverId: req.user!.userId }],
          completedAt: { $gte: thisWeek },
        },
      },
      { $group: { _id: null, total: { $sum: '$finalFare.total' } } },
    ]),
    Trip.aggregate([
      {
        $match: {
          $or: [{ driverId: driver._id }, { driverId: req.user!.userId }],
          completedAt: { $gte: thisMonth },
        },
      },
      { $group: { _id: null, total: { $sum: '$finalFare.total' } } },
    ]),
  ]);

  const todayEarnings = todayEarningsAgg[0]?.total ?? 0;
  const thisWeekEarnings = weekEarningsAgg[0]?.total ?? 0;
  const thisMonthEarnings = monthEarningsAgg[0]?.total ?? 0;
  const totalTrips = driver.totalTrips || 0;
  const totalEarnings = driver.totalEarnings || thisMonthEarnings;
  const avgFare = totalTrips > 0 ? Math.round(totalEarnings / totalTrips) : 0;

  res.json({
    success: true,
    data: {
      today: todayEarnings,
      thisWeek: thisWeekEarnings,
      thisMonth: thisMonthEarnings,
      todayTrips,
      todayEarnings,
      totalTrips,
      totalEarnings,
      avgFare,
      rating: driver.rating ?? 5.0,
      currency: 'INR',
    },
  });
});

// GET /api/v1/drivers/upi - Get driver UPI details
router.get('/upi', async (req, res) => {
  const driver = await Driver.findOne({
    $or: [{ userId: req.user!.userId }, { _id: req.user!.userId }],
  });
  if (!driver) {
    res.status(404).json({ success: false, message: 'Driver not found' });
    return;
  }
  res.json({
    success: true,
    data: {
      upiId: driver.upiId || '',
      upiBeneficiaryName: driver.upiBeneficiaryName || driver.name || '',
    },
  });
});

// PATCH /api/v1/drivers/upi - Update driver UPI details
router.patch('/upi', async (req, res) => {
  const { upiId, upiBeneficiaryName } = req.body;
  if (!upiId || typeof upiId !== 'string') {
    res.status(400).json({ success: false, message: 'Please provide a valid UPI ID (e.g. name@okhdfcbank)' });
    return;
  }
  const cleanUpi = upiId.trim();
  if (!cleanUpi.includes('@') || cleanUpi.length < 5) {
    res.status(400).json({ success: false, message: 'Invalid UPI ID format. Must include @ (e.g. mobile@upi, name@okhdfcbank)' });
    return;
  }

  const driver = await Driver.findOneAndUpdate(
    { $or: [{ userId: req.user!.userId }, { _id: req.user!.userId }] },
    {
      upiId: cleanUpi,
      upiBeneficiaryName: upiBeneficiaryName ? String(upiBeneficiaryName).trim() : undefined,
    },
    { new: true }
  );

  if (!driver) {
    res.status(404).json({ success: false, message: 'Driver not found' });
    return;
  }

  res.json({
    success: true,
    message: 'UPI payment details updated successfully',
    data: {
      upiId: driver.upiId,
      upiBeneficiaryName: driver.upiBeneficiaryName || driver.name,
    },
  });
});

export default router;
