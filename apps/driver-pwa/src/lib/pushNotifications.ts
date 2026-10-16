import { api } from './api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushNotificationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Requests browser notification permission and registers push subscription with the backend
 */
export async function setupDriverPushNotifications(driverId?: string): Promise<boolean> {
  if (!isPushNotificationSupported()) {
    console.warn('Web Push Notifications are not supported in this browser.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.info('Notification permission not granted:', permission);
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    if (!registration) return false;

    // Check if subscription already exists
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Fetch VAPID public key from backend
      const res = await api.get<{ data: { publicKey: string } }>('/notifications/vapid-public-key');
      const publicKey = res.data?.publicKey;
      if (!publicKey) throw new Error('VAPID public key not received from server');

      const convertedKey = urlBase64ToUint8Array(publicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as BufferSource,
      });
    }

    // Register subscription on backend
    await api.post('/notifications/subscribe', {
      subscription: subscription.toJSON(),
      role: 'driver',
      userId: driverId,
    });

    console.info('Captain Push Notification subscription registered successfully');
    return true;
  } catch (error) {
    console.warn('Failed to setup driver push notifications:', error);
    return false;
  }
}

/**
 * Triggers an immediate local high-priority notification (used when socket receives an offer in foreground/background)
 */
export async function showDriverLocalNotification(offer: {
  bookingId: string;
  pickupAddress?: string;
  dropAddress?: string;
  estimatedFare: number;
}) {
  if (!isPushNotificationSupported() || Notification.permission !== 'granted') return;

  try {
    const reg = await navigator.serviceWorker.ready;
    const title = '🚖 NEW TRIP ASSIGNED - Go Mookambika';
    const body = `Pickup: ${offer.pickupAddress || 'Temple Area'}\nDrop: ${offer.dropAddress || 'Destination'}\nGuaranteed Fare: ₹${Math.round(offer.estimatedFare)}`;

    await (reg as any).showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `trip-offer-${offer.bookingId}`,
      renotify: true,
      requireInteraction: true,
      vibrate: [500, 150, 500, 150, 500, 150, 800],
      actions: [
        { action: 'accept', title: '✅ Accept Ride' },
        { action: 'view', title: '👀 View Details' },
      ],
      data: {
        url: `/queue?offerId=${offer.bookingId}`,
        bookingId: offer.bookingId,
      },
    });
  } catch (err) {
    console.warn('Failed to show local driver notification:', err);
  }
}
