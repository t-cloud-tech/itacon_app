// ITACON GRANITO - Firebase Messaging Service Worker for Web Push
// Handles background notifications when the web application tab is inactive or closed.

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Match the web FirebaseOptions in lib/firebase_options.dart
firebase.initializeApp({
  apiKey: "AIzaSyA3JVKMjjcZAl6_UkTxIhR7Mi2AbObzuLQ",
  appId: "1:889001862943:web:7c9c09c666f0d4cf55f22a",
  messagingSenderId: "889001862943",
  projectId: "itacon-app",
  authDomain: "itacon-app.firebaseapp.com",
  storageBucket: "itacon-app.firebasestorage.app"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload);
  const notificationTitle = payload.notification ? payload.notification.title : (payload.data ? payload.data.title : 'ITACON GRANITO');
  const notificationOptions = {
    body: payload.notification ? payload.notification.body : (payload.data ? payload.data.body : ''),
    icon: '/icons/Icon-192.png',
    badge: '/favicon.png',
    data: payload.data || {}
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification tap / click to focus existing window or open customer app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const clickAction = (event.notification.data && event.notification.data.click_action) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(clickAction);
      }
    })
  );
});
