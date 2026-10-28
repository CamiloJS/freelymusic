/**
 * Utility to detect if the current client is running on a Smart TV
 * (VIDAA OS, Hisense, Samsung Tizen, LG webOS, Android TV, Google TV, Apple TV, Fire TV, etc.)
 */

export function isUserAgentSmartTV(): boolean {
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

export function isSmartTV(): boolean {
  // URL hash or query param override (e.g. #/tv or ?tv=1)
  if (typeof window !== 'undefined') {
    const hash = (window.location.hash || '').toLowerCase();
    const search = (window.location.search || '').toLowerCase();
    if (hash.includes('/tv') || search.includes('tv=1')) {
      return true;
    }
  }

  return isUserAgentSmartTV();
}

const TV_MODE_STORAGE_KEY = 'sonora_tv_mode_enabled';

export function getStoredTvMode(): boolean {
  try {
    if (typeof window === 'undefined') return false;

    // 1. Explicit hash in URL always activates TV mode for testing
    const hash = (window.location.hash || '').toLowerCase();
    const search = (window.location.search || '').toLowerCase();
    if (hash.includes('/tv') || search.includes('tv=1')) {
      return true;
    }

    // 2. Explicit user preference
    const stored = localStorage.getItem(TV_MODE_STORAGE_KEY);
    if (stored === 'false') return false;
    if (stored === 'true') return true;

    // 3. Real Smart TV user agent detection (VIDAA OS, WebOS, Tizen, etc.)
    if (isUserAgentSmartTV()) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function setStoredTvMode(enabled: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (enabled) {
        localStorage.setItem(TV_MODE_STORAGE_KEY, 'true');
      } else {
        localStorage.setItem(TV_MODE_STORAGE_KEY, 'false');
      }
    }
  } catch {
    // ignore
  }
}
