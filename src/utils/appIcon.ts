/**
 * Utility for managing custom dynamic App Icons for PWA and Browser Favicons.
 */

const CUSTOM_ICON_STORAGE_KEY = 'musica_custom_app_icon';

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
}
