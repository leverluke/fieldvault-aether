self.addEventListener("install", (e) => {
  e.waitUntil(caches.open("aether-1").then((c) => c.addAll(["/"])));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      if (res.ok && req.url.startsWith(self.location.origin)) {
        caches.open("aether-1").then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => hit)),
  );
});
