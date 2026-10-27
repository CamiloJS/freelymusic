/**
 * Utility to detect if the current client is running on a Smart TV
 * (Samsung Tizen, LG webOS, Android TV, Google TV, Apple TV, Fire TV, etc.)
 */

export function isSmartTV(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = (navigator.userAgent || '').toLowerCase();

  // URL hash or query param override (e.g. #/tv or ?tv=1)
  if (typeof window !== 'undefined') {
    const hash = (window.location.hash || '').toLowerCase();
    const search = (window.location.search || '').toLowerCase();
    if (hash.includes('/tv') || search.includes('tv=1')) {
      return true;
    }
  }

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
    'hisense',
    'vidaaos',
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
    'dtv',
    'tsbnet',
    'crkey',
    'large screen',
    'aquos',
    'philipstv',
    'tpvision',
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
