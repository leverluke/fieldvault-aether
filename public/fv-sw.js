const SHELL = "fv-shell-v1";
const TILES = "fv-tiles-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(["/apps/fieldvault/play", "/fv-manifest.webmanifest"]).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const tile = url.hostname.endsWith("arcgisonline.com") || url.hostname.endsWith("tile.openstreetmap.org");
  if (tile) {
    event.respondWith(
      caches.open(TILES).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch (err) {
          return hit || Promise.reject(err);
        }
      }),
    );
    return;
  }
  if (url.origin === self.location.origin) {
    if (
      url.pathname.startsWith("/@") ||
      url.pathname.startsWith("/src") ||
      url.pathname.startsWith("/node_modules") ||
      url.pathname.includes("vite")
    ) {
      return;
    }
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && req.url.includes("/apps/fieldvault")) {
            caches.open(SHELL).then((c) => c.put(req, res.clone())).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/apps/fieldvault/play"))),
    );
  }
});
