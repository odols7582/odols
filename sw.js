importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const CACHE_NAME = 'gaegyebu-v1';
const APP_URL = 'https://odols7582.github.io/odols/';

firebase.initializeApp({
  apiKey: "AIzaSyA8CXDhPXN-v5dXS0QP3UY-xpcrhQURyMw",
  authDomain: "ggom-922e9.firebaseapp.com",
  projectId: "ggom-922e9",
  storageBucket: "ggom-922e9.firebasestorage.app",
  messagingSenderId: "501824901436",
  appId: "1:501824901436:web:dd220698a0e2339ec20e39"
});

const messaging = firebase.messaging();

// 앱 설치시 캐시
self.addEventListener('install', function(e) {
  console.log('SW 설치됨');
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  console.log('SW 활성화됨');
  e.waitUntil(clients.claim());
});

// 백그라운드 메시지 수신
messaging.onBackgroundMessage(function(payload) {
  console.log('백그라운드 메시지:', payload);
  var title = (payload.notification && payload.notification.title) || '오소리 & 부엉이';
  var body = (payload.notification && payload.notification.body) || '새 알림이 있어요!';

  return self.registration.showNotification(title, {
    body: body,
    icon: APP_URL + 'icon-192.png',
    badge: APP_URL + 'icon-192.png',
    tag: 'gaegyebu-' + Date.now(),
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: { url: APP_URL }
  });
});

// 알림 클릭시 앱 열기
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
        return clients.openWindow(APP_URL);
      }
    })
  );
});
