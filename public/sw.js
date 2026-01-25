// Kärkölän Notar Oy – Service Worker (PWA)
// Versio: päivitä CACHE_NAME kun haluat tyhjentää vanhat välimuistit

const CACHE_NAME = 'notar-app-v1';

// BASE haetaan sw:n polusta (toimii dev / ja prod /notar-app/)
function getBase() {
  const p = self.location.pathname.replace(/sw\.js.*$/, '') || '/';
  return p.endsWith('/') ? p : p + '/';
}

self.addEventListener('install', (e) => {
  const BASE = getBase();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([BASE, BASE + 'index.html', BASE + 'manifest.json'])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Ulkoiset (Firebase, Google) – ei välimuistia, selain hoitaa
  if (url.origin !== self.location.origin) return;

  // Sivunavigointi (SPA): ensin verkko, offline → välimuistin index.html
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => {
        const BASE = getBase();
        return caches.match(BASE + 'index.html').then((r) => r || caches.match(BASE));
      })
    );
    return;
  }

  // Oma alkuperä (JS, CSS, kuvat): välimuisti ensin, sitten verkko + tallennus
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        const clone = res.clone();
        if (res.ok && res.type === 'basic') {
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
