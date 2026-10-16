import webpush from 'web-push';
import { PushSubscription, IPushSubscription } from '@/models/PushSubscription';
import { SystemSetting } from '@/models/SystemSetting';
import { logger } from '@/utils/logger';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  renotify?: boolean;
  requireInteraction?: boolean;
  vibrate?: number[];
  actions?: Array<{ action: string; title: string; icon?: string }>;
  data?: Record<string, any>;
}

class PushNotificationService {
  private initialized = false;
  private vapidPublicKey = '';
  private vapidPrivateKey = '';
  private contactEmail = 'mailto:admin@gomookambika.infatoz.com';

  constructor() {
    this.initVapid().catch((err) => {
      logger.error('Failed to initialize Web Push VAPID keys', err);
    });
  }

  /**
   * Initializes VAPID keys from environment variables or SystemSetting in MongoDB.
   * If none exist, generates new keys once and stores them in SystemSetting.
   */
  public async initVapid(): Promise<void> {
    if (this.initialized) return;

    try {
      let pubKey = process.env.VAPID_PUBLIC_KEY;
      let privKey = process.env.VAPID_PRIVATE_KEY;
      const email = process.env.VAPID_CONTACT_EMAIL || this.contactEmail;

      if (!pubKey || !privKey) {
        // Query SystemSetting
        const pubSetting = await SystemSetting.findOne({ key: 'vapidPublicKey' });
        const privSetting = await SystemSetting.findOne({ key: 'vapidPrivateKey' });

        if (pubSetting?.value && privSetting?.value) {
          pubKey = pubSetting.value as string;
          privKey = privSetting.value as string;
        } else {
          // Generate new keys
          const newKeys = webpush.generateVAPIDKeys();
          pubKey = newKeys.publicKey;
          privKey = newKeys.privateKey;

          await SystemSetting.findOneAndUpdate(
            { key: 'vapidPublicKey' },
            {
              key: 'vapidPublicKey',
              value: pubKey,
              category: 'safety',
              description: 'VAPID Public Key for Web Push Notifications',
            },
            { upsert: true, new: true }
          );

          await SystemSetting.findOneAndUpdate(
            { key: 'vapidPrivateKey' },
            {
              key: 'vapidPrivateKey',
              value: privKey,
              category: 'safety',
              description: 'VAPID Private Key for Web Push Notifications',
            },
            { upsert: true, new: true }
          );

          logger.info('Generated and saved new VAPID keys for Web Push Notifications');
        }
      }

      this.vapidPublicKey = pubKey;
      this.vapidPrivateKey = privKey;
      this.contactEmail = email;

      webpush.setVapidDetails(this.contactEmail, this.vapidPublicKey, this.vapidPrivateKey);
      this.initialized = true;
      logger.info('Web Push Notification Service initialized successfully');
    } catch (error: any) {
      logger.warn(`Could not initialize VAPID keys immediately: ${error?.message || error}`);
    }
  }

  /**
   * Returns the VAPID public key needed for client browser pushManager.subscribe()
   */
  public async getVapidPublicKey(): Promise<string> {
    if (!this.initialized || !this.vapidPublicKey) {
      await this.initVapid();
    }
    return this.vapidPublicKey;
  }

  /**
   * Registers or updates a client push subscription
   */
  public async registerSubscription(data: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    role: 'driver' | 'customer' | 'admin';
    userId?: string;
    phone?: string;
    userAgent?: string;
  }): Promise<IPushSubscription> {
    const updated = await PushSubscription.findOneAndUpdate(
      { endpoint: data.endpoint },
      {
        endpoint: data.endpoint,
        keys: data.keys,
        role: data.role,
        userId: data.userId,
        phone: data.phone,
        userAgent: data.userAgent,
        lastActive: new Date(),
      },
      { upsert: true, new: true }
    );
    return updated;
  }

  /**
   * Unregisters a client subscription
   */
  public async unregisterSubscription(endpoint: string): Promise<void> {
    await PushSubscription.deleteOne({ endpoint });
  }

  /**
   * Low-level method to send a push notification to a specific stored subscription
   */
  public async sendNotification(
    subDoc: IPushSubscription,
    payload: PushNotificationPayload
  ): Promise<boolean> {
    if (!this.initialized) {
      await this.initVapid();
    }

    const pushSubscription = {
      endpoint: subDoc.endpoint,
      keys: {
        p256dh: subDoc.keys.p256dh,
        auth: subDoc.keys.auth,
      },
    };

    try {
      await webpush.sendNotification(pushSubscription, JSON.stringify(payload), {
        urgency: payload.requireInteraction ? 'high' : 'normal',
      });
      return true;
    } catch (err: any) {
      // If 410 Gone or 404 Not Found, subscription is expired or unsubscribed
      if (err.statusCode === 410 || err.statusCode === 404) {
        logger.info(`Push subscription expired (status ${err.statusCode}). Removing endpoint: ${subDoc.endpoint}`);
        await PushSubscription.deleteOne({ _id: subDoc._id });
      } else {
        logger.warn(`Failed to deliver push notification: ${err?.message || err} (status: ${err?.statusCode})`);
      }
      return false;
    }
  }

  /**
   * Notifies a driver about a new trip assignment/offer with action buttons and high priority
   */
  public async notifyDriverNewTrip(
    driverId: string,
    offer: {
      bookingId: string;
      pickupAddress?: string;
      dropAddress?: string;
      estimatedFare: number;
      distanceKm?: number;
    }
  ): Promise<number> {
    const subs = await PushSubscription.find({
      role: 'driver',
      $or: [{ userId: driverId }, { userId: driverId.toString() }],
    });

    if (subs.length === 0) {
      logger.debug(`No push subscription found for driver ${driverId}`);
      return 0;
    }

    const fareText = `₹${Math.round(offer.estimatedFare || 0)}`;
    const distText = offer.distanceKm ? ` (${offer.distanceKm.toFixed(1)} km)` : '';

    const payload: PushNotificationPayload = {
      title: '🚖 NEW TRIP ASSIGNED - Go Mookambika',
      body: `Pickup: ${offer.pickupAddress || 'Temple Area'}\nDrop: ${offer.dropAddress || 'Destination'}\nGuaranteed Fare: ${fareText}${distText}`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `trip-offer-${offer.bookingId}`,
      renotify: true,
      requireInteraction: true,
      vibrate: [500, 150, 500, 150, 500, 150, 800],
      actions: [
        {
          action: 'accept',
          title: '✅ Accept Ride',
        },
        {
          action: 'view',
          title: '👀 View Details',
        },
      ],
      data: {
        url: `/queue?offerId=${offer.bookingId}`,
        type: 'TRIP_OFFER',
        bookingId: offer.bookingId,
        estimatedFare: offer.estimatedFare,
        pickup: offer.pickupAddress,
        drop: offer.dropAddress,
        timestamp: Date.now(),
      },
    };

    let delivered = 0;
    for (const sub of subs) {
      const ok = await this.sendNotification(sub, payload);
      if (ok) delivered++;
    }

    return delivered;
  }

  /**
   * Notifies customer of every update to their trip (Driver Assigned, Arrived, Trip Started, Completed, Cancelled)
   */
  public async notifyCustomerTripUpdate(
    customerIdOrPhone: string,
    update: {
      title: string;
      body: string;
      type: 'DRIVER_ASSIGNED' | 'DRIVER_ARRIVED' | 'TRIP_STARTED' | 'TRIP_COMPLETED' | 'BOOKING_CANCELLED' | 'GENERAL';
      bookingId: string;
      status?: string;
      driverName?: string;
      vehicleInfo?: string;
      fare?: number;
    }
  ): Promise<number> {
    const orQuery: any[] = [
      { userId: customerIdOrPhone },
      { userId: customerIdOrPhone.toString() },
      { phone: customerIdOrPhone },
    ];

    const subs = await PushSubscription.find({
      role: 'customer',
      $or: orQuery,
    });

    if (subs.length === 0) {
      logger.debug(`No customer push subscriptions found for ${customerIdOrPhone}`);
      return 0;
    }

    const payload: PushNotificationPayload = {
      title: update.title,
      body: update.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `trip-update-${update.bookingId}`,
      renotify: true,
      requireInteraction: update.type === 'DRIVER_ARRIVED' || update.type === 'TRIP_COMPLETED',
      vibrate: [400, 150, 400],
      data: {
        url: `/track/${update.bookingId}`,
        type: update.type,
        bookingId: update.bookingId,
        status: update.status,
        timestamp: Date.now(),
      },
    };

    let delivered = 0;
    for (const sub of subs) {
      const ok = await this.sendNotification(sub, payload);
      if (ok) delivered++;
    }

    return delivered;
  }
}

export const pushNotificationService = new PushNotificationService();
