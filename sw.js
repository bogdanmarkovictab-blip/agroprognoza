// Agroprognoza service worker: aplikacija radi i bez signala (prikazuje poslednju preuzetu prognozu)
const SHELL = "ap-shell-v3";
const DATA = "ap-data-v1";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== DATA).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isData = url.hostname.endsWith("open-meteo.com");
  const isOwn = url.origin === location.origin;
  if (isData || isOwn) {
    // prvo mreža (sveži podaci), a bez signala poslednja sačuvana verzija
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(isData ? DATA : SHELL).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || (isOwn ? caches.match("index.html") : Response.error()))));
  } else {
    // fontovi i biblioteka grafikona: iz keša ako postoje
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); return res;
    })));
  }
});
