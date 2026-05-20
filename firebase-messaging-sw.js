importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA8CXDhPXN-v5dXS0QP3UY-xpcrhQURyMw",
  authDomain: "ggom-922e9.firebaseapp.com",
  projectId: "ggom-922e9",
  storageBucket: "ggom-922e9.firebasestorage.app",
  messagingSenderId: "501824901436",
  appId: "1:501824901436:web:dd220698a0e2339ec20e39"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  var title = (payload.notification && payload.notification.title) || '오소리 & 부엉이';
  var body = (payload.notification && payload.notification.body) || '새 알림이 있어요!';
  self.registration.showNotification(title, {
    body: body,
    icon: 'https://odols7582.github.io/odols/icon-192.png',
    badge: 'https://odols7582.github.io/odols/icon-192.png',
    tag: 'gaegyebu-' + Date.now(),
    vibrate: [200, 100, 200],
    data: { url: 'https://odols7582.github.io/odols/' }
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf('odols7582.github.io/odols') !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('https://odols7582.github.io/odols/');
      }
    })
  );
});
