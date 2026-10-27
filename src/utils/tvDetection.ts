/**
 * Utility to detect if the current client is running on a Smart TV
 * (Samsung Tizen, LG webOS, Android TV, Google TV, Apple TV, Fire TV, etc.)
 */

export function isSmartTV(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = (navigator.userAgent || '').toLowerCase();

  const tvTokens = [
    'smart-tv',
    'smarttv',
    'googletv',
    'appletv',
    'android tv',
    'pov_tv',
    'hbbtv',
    'netcast',
    'viera',
    'vidaa',
    'opera tv',
    'tizen',
    'webos',
    'web0s',
    'roku',
    'aftt',
    'aftm',
    'aftb',
    'bravia',
    'mitv',
    'smart_tv',
    'smartbox',
    'tvbox',
  ];

  return tvTokens.some((token) => ua.includes(token));
}

const TV_MODE_STORAGE_KEY = 'sonora_tv_mode_enabled';

export function getStoredTvMode(): boolean {
  try {
    if (typeof localStorage === 'undefined') return isSmartTV();
    const stored = localStorage.getItem(TV_MODE_STORAGE_KEY);
    if (stored !== null) {
      return stored === 'true';
    }
    return isSmartTV();
  } catch {
    return isSmartTV();
  }
}

export function setStoredTvMode(enabled: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TV_MODE_STORAGE_KEY, enabled ? 'true' : 'false');
    }
  } catch {
    // ignore
  }
}
