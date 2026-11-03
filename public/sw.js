/* Studio Calendar intentionally caches only public build assets. User, Firestore, API,
   and page responses are always network-only so private information is never
   persisted by the service worker. */
const CACHE = "studio-calendar-public-v5";
const OFFLINE_URL = "/offline.html";
const PUBLIC_ASSETS = [OFFLINE_URL, "/icon", "/apple-icon", "/icons/studio-calendar-v2-192.png", "/icons/studio-calendar-v2-512.png", "/icons/studio-calendar-v2-1024.png", "/icons/studio-calendar-maskable-v2.png", "/icons/studio-calendar-apple-v2.png", "/brand/studio-calendar-monogram.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PUBLIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/icon" || url.pathname === "/apple-icon" || url.pathname === "/brand/studio-calendar-monogram.svg") {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    })));
  }
});
