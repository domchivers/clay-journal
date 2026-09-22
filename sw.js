/* Service worker: caches the app so it opens offline once installed.
 * Only registers over HTTPS or localhost. Bump CACHE and the ?v= numbers when app files change. */
const CACHE = "clay-v1";
const ASSETS = ["./", "./index.html", "./styles.css?v=1", "./i18n.js?v=1", "./supabase-config.js?v=1", "./cloud.js?v=1", "./store.js?v=1", "./app.js?v=1", "./manifest.webmanifest", "./icons/icon-192.png?v=1", "./icons/icon-180.png?v=1"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;   // Supabase goes straight to the network
  e.respondWith(caches.match(e.request, { ignoreSearch: url.pathname.endsWith("/") }).then((hit) => hit || fetch(e.request)));
});
