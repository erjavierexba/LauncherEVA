const CACHE_NAME = "horus-pwa-v1";
const APP_SHELL = [
  "/",
  "/horus.css",
  "/horus.js",
  "/manifest.webmanifest",
  "/favicon.png"
];

const FIREBASE_SDK_VERSION = "10.13.2";
const FIREBASE_CONFIG = {{FIREBASE_CONFIG_JSON}};

if (FIREBASE_CONFIG) {
  try {
    importScripts(
      `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app-compat.js`,
      `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-messaging-compat.js`
    );

    firebase.initializeApp(FIREBASE_CONFIG);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const notification = payload.notification || {};
      const title = notification.title || "EVA";
      const options = {
        body: notification.body || "Tienes una notificación pendiente",
        icon: "/favicon.png",
        badge: "/favicon.png",
        data: payload.data || {},
      };

      self.registration.showNotification(title, options);
    });
  } catch (error) {
    console.warn("[HORUS SW] Firebase Messaging no disponible", error);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow("/");
      }

      return undefined;
    })
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/load/") ||
    url.pathname.startsWith("/notifications/") ||
    url.pathname.startsWith("/push-token/")
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/")));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
