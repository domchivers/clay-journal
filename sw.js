/* Service worker: NETWORK FIRST, so every open picks up the latest version straight away.
 * Each fresh copy is also kept in the cache, which is what the app runs from when offline
 * (or when the studio Wi-Fi is too slow to answer within a few seconds).
 * Only registers over HTTPS or localhost. */
const CACHE = "clay-v15";
const ASSETS = ["./", "./index.html", "./styles.css?v=15", "./i18n.js?v=15", "./supabase-config.js?v=15", "./cloud.js?v=15", "./store.js?v=15", "./app.js?v=15", "./manifest.webmanifest", "./icons/icon-192.png?v=1", "./icons/icon-180.png?v=1"];
const SLOW_MS = 4000;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;   // Supabase goes straight to the network
  const fromNet = fetch(req, { cache: "no-cache" }).then((res) => {   // no-cache: always ask the server, skip the browser's 10-minute copy
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  });
  const fromCache = () => caches.match(req, { ignoreSearch: url.pathname.endsWith("/") || url.pathname.endsWith(".html") });
  e.respondWith(new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done && r) { done = true; resolve(r); } };
    const timer = setTimeout(() => fromCache().then(finish), SLOW_MS);   // slow network: use the cached copy, the fresh one still lands in the cache
    fromNet.then((r) => { clearTimeout(timer); finish(r); })
      .catch(() => fromCache().then((r) => finish(r || Response.error())));
  }));
});
