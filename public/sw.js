const CACHE_NAME = 'musica-cache-v5';
const PWA_ICON_CACHE = 'musica-pwa-icons';
const PWA_ICON_PATHS = new Set([
  '/pwa-icon-180.png',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
]);

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/favicon.svg',
  '/camilo-avatar.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // A single missing optional asset must not break the whole installation.
      Promise.all(
        PRECACHE_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn('No se pudo precachear', asset, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== PWA_ICON_CACHE) {
            return caches.delete(key);
          }
          return undefined;
        })
      )
    )
  );
  self.clients.claim();
});

const AUDIO_EXTENSIONS = /\.(mp3|wav|flac|m4a|aac|ogg)$/i;

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept audio (it is streamed / handled by IndexedDB) or other
  // origins (Firestore, Cloudinary, Spotify covers...). The old worker cached
  // every cross-origin response, including private API traffic.
  if (url.origin !== self.location.origin) return;
  if (AUDIO_EXTENSIONS.test(url.pathname)) return;

  // Dynamic PWA icons: the selected icon is cached as a PNG by the app and
  // served here for the manifest/apple-touch-icon. Falls back to the static
  // default files if the user has not customized the icon yet.
  if (PWA_ICON_PATHS.has(url.pathname)) {
    event.respondWith(
      caches.open(PWA_ICON_CACHE).then(async (cache) => {
        const cached = await cache.match(url.pathname);
        if (cached) return cached;

        const response = await fetch(request);
        if (
          response.ok &&
          (response.headers.get('content-type') || '').startsWith('image/')
        ) {
          return response;
        }
        return fetch('/icon.svg');
      })
    );
    return;
  }

  // HTML: network-first so a new deployment is picked up immediately, with an
  // offline fallback from the cache.
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }

  // Vite output uses content hashes, so these files are immutable: serve them
  // from the cache first. This turns repeat visits into instant loads.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Icons, manifest, screenshots...: serve cache immediately and refresh it in
  // the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
