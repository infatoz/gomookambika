// Go Mookambika Captain - Background Web Push Service Worker Extension
/* eslint-disable no-restricted-globals */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || '🚖 New Trip Assigned - Go Mookambika';

    const options = {
      body: data.body || 'A new passenger ride has been assigned to you. Tap to accept.',
      icon: data.icon || '/icon-192.png',
      badge: data.badge || '/icon-192.png',
      image: data.image,
      tag: data.tag || 'trip-offer',
      renotify: data.renotify !== undefined ? data.renotify : true,
      requireInteraction: data.requireInteraction !== undefined ? data.requireInteraction : true,
      vibrate: data.vibrate || [500, 150, 500, 150, 500, 150, 800],
      data: data.data || {},
      actions: data.actions || [
        { action: 'accept', title: '✅ Accept Ride' },
        { action: 'view', title: '👀 View Details' },
      ],
    };

    event.waitUntil(
      self.registration.showNotification(title, options).then(() => {
        // Forward message to any open captain tabs to start the phone ringtone immediately
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'PUSH_NOTIFICATION_RECEIVED',
              payload: data,
            });
          });
        });
      })
    );
  } catch (err) {
    console.warn('Driver push event parsing failed:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notificationData = event.notification.data || {};
  const action = event.action;

  let targetUrl = notificationData.url || '/queue';
  if (action === 'accept' && notificationData.bookingId) {
    targetUrl = `/queue?autoAccept=${encodeURIComponent(notificationData.bookingId)}`;
  } else if (action === 'view' && notificationData.bookingId) {
    targetUrl = `/queue?offerId=${encodeURIComponent(notificationData.bookingId)}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_ACTION_CLICKED',
            action: action,
            data: notificationData,
          });
          if ('navigate' in client && targetUrl) {
            client.navigate(targetUrl).catch(() => {});
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
