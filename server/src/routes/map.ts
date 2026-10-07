import { Router, Request, Response } from 'express';
import { mapService } from '@/services/MapService';
import { optionalAuth } from '@/middlewares/auth';

const router = Router();

// Reverse geocoding — convert coordinates to address
router.get('/reverse-geocode', async (req: Request, res: Response) => {
  const { lat, lng } = req.query;
  const result = await mapService.reverseGeocode({
    latitude: parseFloat(lat as string),
    longitude: parseFloat(lng as string),
  });
  res.json({ success: true, data: result });
});

// Place search
router.get('/search', async (req: Request, res: Response) => {
  const { q, lat, lng } = req.query;
  const near = lat && lng ? { latitude: parseFloat(lat as string), longitude: parseFloat(lng as string) } : undefined;
  const results = await mapService.searchPlaces(q as string, near);
  res.json({ success: true, data: results });
});

// Route calculation
router.get('/route', async (req: Request, res: Response) => {
  const { fromLat, fromLng, toLat, toLng } = req.query;
  const route = await mapService.route(
    { latitude: parseFloat(fromLat as string), longitude: parseFloat(fromLng as string) },
    { latitude: parseFloat(toLat as string), longitude: parseFloat(toLng as string) }
  );
  res.json({ success: true, data: route });
});

export default router;
