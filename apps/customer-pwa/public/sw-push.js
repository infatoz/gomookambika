// Go Mookambika Customer - Background Web Push Service Worker Extension
/* eslint-disable no-restricted-globals */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'Go Mookambika Ride Update';

    const options = {
      body: data.body || 'Your ride status has been updated.',
      icon: data.icon || '/icon-192.png',
      badge: data.badge || '/icon-192.png',
      image: data.image,
      tag: data.tag || 'customer-trip-update',
      renotify: data.renotify !== undefined ? data.renotify : true,
      requireInteraction: data.requireInteraction !== undefined ? data.requireInteraction : false,
      vibrate: data.vibrate || [400, 150, 400],
      data: data.data || {},
    };

    event.waitUntil(
      self.registration.showNotification(title, options).then(() => {
        // Forward message to any open customer windows to play chime and update live UI
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'CUSTOMER_PUSH_UPDATE',
              payload: data,
            });
          });
        });
      })
    );
  } catch (err) {
    console.warn('Customer push event parsing failed:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notificationData = event.notification.data || {};
  const targetUrl = notificationData.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'CUSTOMER_NOTIFICATION_CLICKED',
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
