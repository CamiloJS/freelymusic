/**
 * Utility for managing custom dynamic App Icons for PWA and Browser Favicons.
 */

const CUSTOM_ICON_STORAGE_KEY = 'musica_custom_app_icon';
const PWA_ICON_CACHE = 'musica-pwa-icons';
const PWA_ICON_SIZES = [180, 192, 512] as const;

async function loadIconImage(iconUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo cargar el icono'));
    image.src = iconUrl;
  });
}

function renderPwaIcon(image: HTMLImageElement, size: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) {
      reject(new Error('Canvas no disponible'));
      return;
    }

    context.clearRect(0, 0, size, size);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, size, size);
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar el PNG'))),
      'image/png',
      1
    );
  });
}

/**
 * The manifest and apple-touch-icon point to stable /pwa-icon-*.png URLs.
 * The service worker serves these responses from a dedicated cache, so the
 * icon selected by the user is the one used when installing the PWA.
 */
export async function cachePwaIcons(iconUrl: string): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;

  try {
    const image = await loadIconImage(iconUrl);
    const cache = await caches.open(PWA_ICON_CACHE);

    await Promise.all(
      PWA_ICON_SIZES.map(async (size) => {
        const blob = await renderPwaIcon(image, size);
        await cache.put(
          `/pwa-icon-${size}.png`,
          new Response(blob, {
            headers: {
              'Content-Type': 'image/png',
              // Icons can change when the user picks another artwork. Do not
              // let the browser keep an old copy when installing the PWA.
              'Cache-Control': 'no-store',
            },
          })
        );
      })
    );

    const appleTouch = document.querySelector(
      "link[rel='apple-touch-icon']"
    ) as HTMLLinkElement | null;
    if (appleTouch) {
      appleTouch.href = '/pwa-icon-180.png';
    }
  } catch (err) {
    console.warn('No se pudieron preparar los iconos de instalación:', err);
  }
}

export function getCustomAppIcon(): string | null {
  try {
    return localStorage.getItem(CUSTOM_ICON_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setCustomAppIcon(dataUrl: string): void {
  try {
    localStorage.setItem(CUSTOM_ICON_STORAGE_KEY, dataUrl);
    applyAppIcon(dataUrl);
    window.dispatchEvent(new CustomEvent('musica_icon_changed', { detail: dataUrl }));
  } catch (err) {
    console.warn('Could not save custom app icon:', err);
  }
}

export function removeCustomAppIcon(): void {
  try {
    localStorage.removeItem(CUSTOM_ICON_STORAGE_KEY);
    applyAppIcon('/icon.svg');
    window.dispatchEvent(new CustomEvent('musica_icon_changed', { detail: '/icon.svg' }));
  } catch (err) {
    console.warn('Could not remove custom app icon:', err);
  }
}

export function applyAppIcon(iconUrl: string): void {
  if (typeof document === 'undefined') return;

  // 1. Update or create standard favicon
  let favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }
  favicon.href = iconUrl;

  // 2. Update apple touch icon
  let appleTouch = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
  if (!appleTouch) {
    appleTouch = document.createElement('link');
    appleTouch.rel = 'apple-touch-icon';
    document.head.appendChild(appleTouch);
  }
  appleTouch.href = iconUrl;

  // Cache the active icon as the PWA/installed-app icon.
  void cachePwaIcons(iconUrl);
}
