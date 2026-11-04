/**
 * web_portal/public/firebase-messaging-sw.js
 *
 * ITACON Management Portal — Service Worker for Web Push Notifications (FCM)
 * Handles incoming push notifications when the portal tab is closed or backgrounded.
 */

/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA3JVKMjjcZAl6_UkTxIhR7Mi2AbObzuLQ",
  authDomain: "itacon-app.firebaseapp.com",
  projectId: "itacon-app",
  storageBucket: "itacon-app.firebasestorage.app",
  messagingSenderId: "889001862943",
  appId: "1:889001862943:web:7c9c09c666f0d4cf55f22a",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background push message:', payload);

  const title = payload.notification?.title || payload.data?.title || 'ITACON Management';
  const body = payload.notification?.body || payload.data?.body || '';
  const link = payload.data?.link || payload.fcmOptions?.link || '/notifications';

  const notificationOptions = {
    body,
    icon: '/ITACON_App_Logo.png',
    badge: '/ITACON_App_Logo.png',
    data: {
      link,
      notifId: payload.data?.notifId || '',
    },
    requireInteraction: payload.data?.priority === 'high',
    vibrate: [200, 100, 200],
  };

  return self.registration.showNotification(title, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetLink = event.notification.data?.link || '/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a portal window is already open, focus it and navigate
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetLink);
          return client.focus();
        }
      }
      // Otherwise open a new window at targetLink
      if (clients.openWindow) {
        return clients.openWindow(targetLink);
      }
    })
  );
});

