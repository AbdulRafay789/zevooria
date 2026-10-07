/* Admin Web Push service worker */
self.addEventListener('push', (event) => {
  let title = 'Zevooria Ops';
  let body = 'New notification';
  let url = '/orders';
  try {
    const data = event.data ? event.data.json() : null;
    if (data?.title) title = data.title;
    if (data?.body) body = data.body;
    if (data?.url) url = data.url;
  } catch {
    // keep defaults
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/orders';
  event.waitUntil(clients.openWindow(url));
});
