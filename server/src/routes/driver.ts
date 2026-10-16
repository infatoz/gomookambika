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
  const driver = await Driver.findOne({
    $or: [{ userId: req.user!.userId }, { _id: req.user!.userId }],
  }).populate('userId', 'phone email');
  if (!driver) { res.status(404).json({ success: false, message: 'Driver not found' }); return; }
  
  const vehicle = await Vehicle.findOne({
    $or: [{ assignedDriverId: driver._id }, { assignedDriverId: driver.userId }],
  }).populate('categoryId');

  if (!vehicle) {
    res.status(403).json({
      success: false,
      code: 'NO_VEHICLE_ASSIGNED',
      message: 'No vehicle is currently assigned to your captain account. Only drivers with an assigned vehicle can log in. Please contact the association administrator.',
    });
    return;
  }

  const doc = driver.toObject();
  (doc as any).vehicle = vehicle;
  res.json({ success: true, data: doc });
});

// GET /api/v1/drivers/profile
router.get('/profile', async (req, res) => {
  const driver = await Driver.findOne({
    $or: [{ userId: req.user!.userId }, { _id: req.user!.userId }],
  })
    .populate('userId', 'phone email deviceTokens')
    .populate('activeQueueEntryId');
  if (!driver) { res.status(404).json({ success: false, message: 'Driver not found' }); return; }

  const vehicle = await Vehicle.findOne({
    $or: [{ assignedDriverId: driver._id }, { assignedDriverId: driver.userId }],
  }).populate('categoryId');

  const doc = driver.toObject();
  if (vehicle) {
    (doc as any).vehicle = vehicle;
  }
  res.json({ success: true, data: doc });
});

// GET /api/v1/drivers/vehicle
router.get('/vehicle', async (req, res) => {
  const driver = await Driver.findOne({
    $or: [{ userId: req.user!.userId }, { _id: req.user!.userId }],
  });
  if (!driver) { res.status(404).json({ success: false, message: 'Driver not found' }); return; }
  
  const vehicle = await Vehicle.findOne({
    $or: [{ assignedDriverId: driver._id }, { assignedDriverId: driver.userId }],
  }).populate('categoryId');

  if (!vehicle) {
    res.status(404).json({
      success: false,
      code: 'NO_VEHICLE_ASSIGNED',
      message: 'No vehicle is currently assigned to your captain account. Please contact the association administrator to assign a vehicle.',
    });
    return;
  }

  const vObj = vehicle.toObject ? vehicle.toObject() : { ...vehicle };
  if (!vObj.ownerPhone && vObj.ownerName === driver.name) {
    vObj.ownerPhone = driver.phone;
  }
  res.json({ success: true, data: vObj });
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

// GET /api/v1/drivers/association & /api/v1/drivers/settings
router.get(['/association', '/settings'], async (_req, res) => {
  const { SystemSetting } = await import('@/models/SystemSetting');
  const dbSettings = await SystemSetting.find();
  const settingsMap: Record<string, any> = {
    platformName: 'Go Mookambika Tourist Taxi Association',
    registrationNumber: 'KA-UD-TA-2024-089',
    supportPhone: '+91 94812 00000',
    supportEmail: 'support@gomookambika.com',
    officeAddress: 'Car Street, Near Mookambika Temple, Kollur, Udupi Dist, Karnataka - 576220',
    operatingRegion: 'Kollur, Byndoor & Coastal Karnataka',
    emergencySosContact: '+91 94812 00000',
    lostAndFoundHelpline: '+91 94812 00001',
    nightTravelAdvisory: 'Certified hill-route drivers with 24x7 control room tracking on all ghat and night journeys.',
  };
  for (const doc of dbSettings) {
    if (doc.value !== undefined && doc.value !== null && doc.value !== '') {
      settingsMap[doc.key] = doc.value;
    }
  }
  res.json({ success: true, data: settingsMap });
});

export default router;
