/**
 * Spotifree Progressive Web App Service Worker
 * Robust Cache-First strategy for App Shell (HTML, JS, CSS, icons, fonts)
 * Full offline compatibility for iOS Safari (WebKit Standalone), Android Chrome, and Windows Edge.
 */

const CACHE_NAME = 'spotifree-cache-v24';
const PWA_ICON_CACHE = 'spotifree-pwa-icons-v3';
const IMAGE_CACHE = 'spotifree-images-v1';

const PWA_ICON_PATHS = new Set([
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/icon-192.png',
  '/icon-512.png',
  '/pwa-icon-180.png',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
  '/favicon.svg',
  '/icon.svg',
  '/spotify-icon.svg',
]);

const PRECACHE_STATIC = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon.svg',
  '/spotify-icon.svg',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/icon-192.png',
  '/icon-512.png',
  '/pwa-icon-180.png',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
  '/camilo-avatar.jpg',
];

/* VITE_PRECACHE_ASSETS_START */
const VITE_BUILT_ASSETS = [];
/* VITE_PRECACHE_ASSETS_END */

// ---------------------------------------------------------------------------
// 1. INSTALL EVENT: Precache all critical resources
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Precache static assets & built assets
      const allToCache = Array.from(new Set([...PRECACHE_STATIC, ...VITE_BUILT_ASSETS]));
      await Promise.allSettled(
        allToCache.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] No se pudo precachear asset:', url, err);
          })
        )
      );

      // Also dynamically fetch and cache assets discovered from index.html
      try {
        const indexResponse = await fetch('/index.html', { cache: 'no-cache' });
        if (indexResponse.ok) {
          const html = await indexResponse.text();
          await cache.put('/index.html', new Response(html, { headers: indexResponse.headers }));
          await cache.put('/', new Response(html, { headers: indexResponse.headers }));

          // Extract script src and link href in /assets/
          const assetMatches = Array.from(
            html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)
          ).map((m) => m[1]);

          await Promise.allSettled(
            assetMatches.map((assetUrl) =>
              cache.add(assetUrl).catch((err) => {
                console.warn('[SW] No se pudo cachear asset de index.html:', assetUrl, err);
              })
            )
          );
        }
      } catch (err) {
        console.warn('[SW] No se pudo leer index.html durante install:', err);
      }
    })()
  );

  // Take control immediately
  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// 2. ACTIVATE EVENT: Clean up older caches & claim clients
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== PWA_ICON_CACHE && key !== IMAGE_CACHE) {
            console.log('[SW] Eliminando caché obsoleta:', key);
            return caches.delete(key);
          }
          return undefined;
        })
      );
      await self.clients.claim();
    })()
  );
});

// ---------------------------------------------------------------------------
// 3. MESSAGE EVENT: Allow clients to prompt skipWaiting
// ---------------------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ---------------------------------------------------------------------------
// 4. FETCH EVENT: Cache-First for App Shell, Assets, Images, and Offline Fallback
// ---------------------------------------------------------------------------
const AUDIO_EXTENSIONS = /\.(mp3|wav|flac|m4a|aac|ogg)($|\?)/i;
const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|webp|svg|gif|avif)($|\?)/i;

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Fast bypass for media: Audio files, video files, and HTTP Range (206) requests
  // must pass directly through to browser/network without SW interference,
  // guaranteeing 100% stable playback on Android Chromium and iOS WebKit.
  if (
    request.destination === 'audio' ||
    request.destination === 'video' ||
    request.headers.get('range') ||
    AUDIO_EXTENSIONS.test(url.pathname) ||
    AUDIO_EXTENSIONS.test(url.href)
  ) {
    return;
  }

  // A. PWA Icons (Apple touch icons, Android launcher icons)
  if (PWA_ICON_PATHS.has(url.pathname)) {
    event.respondWith(
      (async () => {
        const iconCache = await caches.open(PWA_ICON_CACHE);
        const cachedIcon = await iconCache.match(url.pathname);
        if (cachedIcon) return cachedIcon;

        const mainCache = await caches.open(CACHE_NAME);
        const cachedMain = await mainCache.match(url.pathname);
        if (cachedMain) return cachedMain;

        try {
          const response = await fetch(request);
          if (response && response.ok) {
            mainCache.put(request, response.clone());
            return response;
          }
        } catch {}

        // Fallbacks if specific icon fails
        const fallback180 =
          (await mainCache.match('/apple-touch-icon.png')) ||
          (await mainCache.match('/pwa-icon-180.png'));
        if (fallback180) return fallback180;

        const fallbackSvg = await mainCache.match('/icon.svg');
        if (fallbackSvg) return fallbackSvg;

        return fetch('/icon.svg');
      })()
    );
    return;
  }

  // B. Images (Same-Origin AND Cross-Origin covers, album art, avatars, and icons)
  // Ensures 100% full visual offline support on iOS, Android, and Windows.
  const isImageRequest =
    request.destination === 'image' ||
    IMAGE_EXTENSIONS.test(url.pathname) ||
    url.hostname.includes('mzstatic.com') ||
    url.hostname.includes('dzcdn.net') ||
    url.hostname.includes('unsplash.com') ||
    url.hostname.includes('firebasestorage.googleapis.com') ||
    url.hostname.includes('filegarden.com') ||
    (request.headers.get('accept') && request.headers.get('accept').includes('image/'));

  if (isImageRequest) {
    event.respondWith(
      (async () => {
        const imageCache = await caches.open(IMAGE_CACHE);
        const cached =
          (await imageCache.match(request)) ||
          (await imageCache.match(url.href));

        if (cached) {
          // Background revalidation if online
          if (navigator.onLine) {
            fetch(request)
              .then((netRes) => {
                if (netRes && (netRes.status === 200 || netRes.type === 'opaque')) {
                  imageCache.put(request, netRes.clone());
                }
              })
              .catch(() => {});
          }
          return cached;
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            imageCache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          // If offline and image was not cached, return graceful Spotify fallback SVG
          const fallback =
            (await (await caches.open(CACHE_NAME)).match('/spotify-icon.svg')) ||
            (await (await caches.open(CACHE_NAME)).match('/icon.svg'));
          if (fallback) return fallback;

          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:#181818;"><circle cx="12" cy="12" r="10"/><path d="M8 12a4 4 0 0 1 8 0"/><path d="M6 9a7 7 0 0 1 12 0"/><path d="M10 15a2 2 0 0 1 4 0"/></svg>',
            {
              headers: {
                'Content-Type': 'image/svg+xml',
                'Cache-Control': 'public, max-age=31536000',
              },
            }
          );
        }
      })()
    );
    return;
  }

  // All other cross-origin network requests are skipped by the App Shell service worker
  if (url.origin !== self.location.origin) return;

  // B. Navigation requests (App Shell HTML): CACHE-FIRST for 100% offline support
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = (await cache.match('/index.html')) || (await cache.match('/'));

        // Background network revalidation when online
        const networkFetch = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put('/index.html', networkResponse.clone());
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => null);

        // If cached HTML is present, return it immediately: instant offline boot!
        if (cachedResponse) {
          return cachedResponse;
        }

        // If not in cache yet (initial first visit), wait for network
        const networkResponse = await networkFetch;
        if (networkResponse) return networkResponse;

        // Offline fallback if cache is empty
        return new Response(
          '<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Spotifree</title><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{background:#121212;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:20px;}</style></head><body><h1>Spotifree</h1><p>Conéctate a Internet al menos una vez para activar el modo 100% offline.</p></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      })()
    );
    return;
  }

  // C. Production Vite Assets (/assets/*): CACHE-FIRST
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          // If offline and not cached yet, try finding any cached index or fallback
          return cached || new Response('', { status: 408, statusText: 'Offline Asset Unavailable' });
        }
      })()
    );
    return;
  }

  // D. Static resources (manifest, svgs, images): Stale-While-Revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);

      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => null);

      if (cached) {
        return cached;
      }

      const networkResponse = await networkFetch;
      if (networkResponse) return networkResponse;

      return new Response('', { status: 404, statusText: 'Not Found' });
    })()
  );
});
