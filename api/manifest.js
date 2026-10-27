/**
 * Dynamic PWA manifest: the installed app uses the global app name configured
 * by the administrator. Icons are stable URLs served by the service worker with
 * the icon selected on this device.
 */

const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY || 'AIzaSyB-BDGpMhiNjSfGiGiGHHd6jbu5nQvoOfs';
const PROJECT_ID = 'ginadocente-unipamplona';
const SETTINGS_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/freelymusic/public/data/appSettings/global`;

let cachedName = null;
let cachedAt = 0;

async function getGlobalName() {
  if (cachedName && Date.now() - cachedAt < 5 * 60 * 1000) {
    return cachedName;
  }

  try {
    const authResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnSecureToken: true }),
      }
    );
    const auth = await authResponse.json();
    if (!auth.idToken) throw new Error('No auth token');

    const response = await fetch(SETTINGS_URL, {
      headers: { Authorization: `Bearer ${auth.idToken}` },
    });
    if (!response.ok) throw new Error(`Settings ${response.status}`);
    const payload = await response.json();
    const name = payload?.fields?.globalAppName?.stringValue;
    cachedName = typeof name === 'string' && name.trim() ? name.trim() : 'Spotifree';
    cachedAt = Date.now();
    return cachedName;
  } catch {
    return 'Spotifree';
  }
}

export default async function handler(req, res) {
  const name = await getGlobalName();

  const manifest = {
    id: '/',
    name: name || 'Spotifree',
    short_name: name || 'Spotifree',
    description:
      'Tu reproductor privado de música en la nube con letras sincronizadas, versiones, videoclips y modo sin conexión.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#121212',
    theme_color: '#1DB954',
    icons: [
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/pwa-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
  res.end(JSON.stringify(manifest));
}
