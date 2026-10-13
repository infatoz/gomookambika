import { Router, Request, Response } from 'express';
import { VehicleCategory } from '@/models/VehicleCategory';
import { Vehicle } from '@/models/Vehicle';
import { Status } from '@gomookambika/types';

const router = Router();

/**
 * Public endpoint to fetch active vehicle categories with fare rates and available platform vehicles
 * GET /api/v1/vehicles/categories
 */
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await VehicleCategory.find({ status: Status.ACTIVE })
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    const enriched = await Promise.all(
      categories.map(async (cat) => {
        const vehicles = await Vehicle.find({
          categoryId: cat._id,
          status: { $in: ['ACTIVE', 'AVAILABLE', 'ON_DUTY'] },
        })
          .select('registrationNumber brand vehicleModel color fuelType seatCapacity luggageCapacity ac status')
          .lean();

        const modelNames = Array.from(
          new Set(vehicles.map((v) => `${v.brand} ${v.vehicleModel}`.trim()).filter(Boolean))
        );

        return {
          ...cat,
          vehicleCount: vehicles.length,
          popularModels: modelNames,
          vehicles: vehicles.map((v) => ({
            registrationNumber: v.registrationNumber,
            brand: v.brand,
            vehicleModel: v.vehicleModel,
            color: v.color,
            fuelType: v.fuelType,
            seatCapacity: v.seatCapacity,
            luggageCapacity: v.luggageCapacity,
            ac: v.ac,
          })),
        };
      })
    );

    res.json({ success: true, data: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch vehicle categories' });
  }
});

/**
 * Public endpoint to show available vehicles grouped by vehicle type
 * GET /api/v1/vehicles/by-type
 */
router.get('/by-type', async (_req: Request, res: Response) => {
  try {
    const categories = await VehicleCategory.find({ status: Status.ACTIVE })
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    const grouped = await Promise.all(
      categories.map(async (cat) => {
        const vehicles = await Vehicle.find({
          categoryId: cat._id,
          status: { $in: ['ACTIVE', 'AVAILABLE', 'ON_DUTY'] },
        })
          .populate('assignedDriverId', 'name rating totalTrips')
          .lean();

        return {
          category: {
            _id: cat._id,
            name: cat.name,
            code: cat.code,
            description: cat.description,
            image: cat.image || cat.icon,
            icon: cat.icon || cat.image,
            seatCapacity: cat.seatCapacity,
            luggageCapacity: cat.luggageCapacity,
            ac: cat.ac,
            baseFare: cat.baseFare,
            ratePerKm: cat.ratePerKm,
            ratePerHour: cat.ratePerHour,
            fares: cat.fares,
          },
          vehicleCount: vehicles.length,
          vehicles: vehicles.map((v) => ({
            _id: v._id,
            registrationNumber: v.registrationNumber,
            brand: v.brand,
            vehicleModel: v.vehicleModel,
            color: v.color,
            fuelType: v.fuelType,
            manufacturingYear: v.manufacturingYear,
            seatCapacity: v.seatCapacity,
            luggageCapacity: v.luggageCapacity,
            ac: v.ac,
            driver: v.assignedDriverId,
          })),
        };
      })
    );

    res.json({ success: true, data: grouped });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch vehicles by type' });
  }
});

export default router;
