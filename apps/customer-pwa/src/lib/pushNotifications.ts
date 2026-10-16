import { api, AuthState } from './api';

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
 * Requests browser notification permission and registers push subscription with backend
 */
export async function setupCustomerPushNotifications(auth?: AuthState): Promise<boolean> {
  if (!isPushNotificationSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;
    if (!registration) return false;

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const res = await api.get<{ data: { publicKey: string } }>('/notifications/vapid-public-key');
      const publicKey = res.data?.publicKey;
      if (!publicKey) throw new Error('VAPID public key missing');

      const convertedKey = urlBase64ToUint8Array(publicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as BufferSource,
      });
    }

    await api.post(
      '/notifications/subscribe',
      {
        subscription: subscription.toJSON(),
        role: 'customer',
        userId: auth?.user?.phone,
        phone: auth?.user?.phone,
      },
      auth
    );

    console.info('Customer Push Notification subscription registered');
    return true;
  } catch (error) {
    console.warn('Customer push registration notice:', error);
    return false;
  }
}

/**
 * Shows an instant local browser notification for customer trip updates
 */
export async function showCustomerLocalNotification(title: string, body: string, bookingId?: string) {
  if (!isPushNotificationSupported() || Notification.permission !== 'granted') return;

  try {
    const reg = await navigator.serviceWorker.ready;
    await (reg as any).showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: bookingId ? `trip-${bookingId}` : 'customer-trip-update',
      renotify: true,
      vibrate: [400, 150, 400],
      data: {
        url: '/',
        bookingId,
      },
    });
  } catch (err) {
    console.warn('Failed to show local customer notification:', err);
  }
}
