import { Router, Request, Response } from 'express';
import { pushNotificationService } from '@/services/PushNotificationService';
import { optionalAuth } from '@/middlewares/auth';
import { logger } from '@/utils/logger';

const router = Router();

// GET /api/v1/notifications/vapid-public-key
router.get('/vapid-public-key', async (_req: Request, res: Response) => {
  try {
    const publicKey = await pushNotificationService.getVapidPublicKey();
    res.json({
      success: true,
      data: { publicKey },
    });
  } catch (err: any) {
    logger.error('Error retrieving VAPID public key', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve public key' });
  }
});

// POST /api/v1/notifications/subscribe
router.post('/subscribe', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { subscription, role, phone, userId: bodyUserId } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      res.status(400).json({ success: false, message: 'Invalid subscription object' });
      return;
    }

    const assignedUserId = req.user?.userId || bodyUserId;
    const assignedPhone = phone || (req.user as any)?.phone;
    const assignedRole = role === 'driver' ? 'driver' : role === 'admin' ? 'admin' : 'customer';

    const saved = await pushNotificationService.registerSubscription({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      role: assignedRole,
      userId: assignedUserId,
      phone: assignedPhone,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Push notification subscription registered successfully',
      data: { id: saved._id, role: saved.role },
    });
  } catch (err: any) {
    logger.error('Error registering push subscription', err);
    res.status(500).json({ success: false, message: 'Subscription registration failed' });
  }
});

// POST /api/v1/notifications/unsubscribe
router.post('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await pushNotificationService.unregisterSubscription(endpoint);
    }
    res.json({ success: true, message: 'Push subscription removed' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to unsubscribe' });
  }
});

// POST /api/v1/notifications/test
router.post('/test', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { role = 'customer', title = 'Test Notification', body = 'Push notifications are working!' } = req.body;
    const userId = req.user?.userId || req.body.userId;

    if (role === 'driver' && userId) {
      await pushNotificationService.notifyDriverNewTrip(userId, {
        bookingId: 'test-' + Date.now(),
        pickupAddress: 'Kollur Sri Mookambika Temple',
        dropAddress: 'Kundapura Railway Station',
        estimatedFare: 650,
        distanceKm: 38.5,
      });
    } else if (userId) {
      await pushNotificationService.notifyCustomerTripUpdate(userId, {
        title,
        body,
        type: 'GENERAL',
        bookingId: 'test-' + Date.now(),
      });
    }

    res.json({ success: true, message: 'Test notification triggered' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
