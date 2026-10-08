import { Express } from 'express';
import authRoutes from './auth';
import driverRoutes from './driver';
import queueRoutes from './queue';
import bookingRoutes from './booking';
import fareRoutes from './fare';
import locationRoutes from './location';
import adminRoutes from './admin';
import mapRoutes from './map';
import vehicleRoutes from './vehicle';

export function setupRoutes(app: Express): void {
  const base = '/api/v1';

  app.use(`${base}/auth`, authRoutes);
  app.use(`${base}/drivers`, driverRoutes);
  app.use(`${base}/driver`, driverRoutes);
  app.use(`${base}/queues`, queueRoutes);
  app.use(`${base}/queue`, queueRoutes);
  app.use(`${base}/bookings`, bookingRoutes);
  app.use(`${base}/booking`, bookingRoutes);
  app.use(`${base}/trips`, bookingRoutes);
  app.use(`${base}/trip`, bookingRoutes);
  app.use(`${base}/fare`, fareRoutes);
  app.use(`${base}/fares`, fareRoutes);
  app.use(`${base}/locations`, locationRoutes);
  app.use(`${base}/location`, locationRoutes);
  app.use(`${base}/vehicles`, vehicleRoutes);
  app.use(`${base}/admin`, adminRoutes);
  app.use(`${base}/map`, mapRoutes);
}
