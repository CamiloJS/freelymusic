import { ConnectDeviceType } from '../types';
import { isSmartTV } from './tvDetection';

const DEVICE_ID_KEY = 'freelymusic_connect_device_id';
const DEVICE_NAME_KEY = 'freelymusic_connect_device_name';

export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.trim()) return existing;
    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'dev_' + Math.random().toString(36).slice(2, 11) + '_' + Date.now();
    localStorage.setItem(DEVICE_ID_KEY, newId);
    return newId;
  } catch {
    return 'dev_' + Math.random().toString(36).slice(2, 11) + '_' + Date.now();
  }
}

export function detectDeviceType(): ConnectDeviceType {
  if (typeof window === 'undefined') return 'computer';
  if (isSmartTV()) return 'tv';

  const ua = navigator.userAgent || '';
  if (/iPad|Tablet/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'tablet';
  }
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) {
    return 'smartphone';
  }
  return 'computer';
}

export function detectDefaultDeviceName(type: ConnectDeviceType): string {
  const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
  if (type === 'tv') {
    if (/tizen/i.test(ua)) return 'Samsung Smart TV';
    if (/webos/i.test(ua)) return 'LG Smart TV';
    if (/vidaa/i.test(ua)) return 'Hisense Smart TV';
    if (/android tv|googletv/i.test(ua)) return 'Android TV';
    return 'Smart TV';
  }

  if (type === 'smartphone') {
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/Samsung|SM-/i.test(ua)) return 'Samsung Galaxy';
    if (/Xiaomi|Redmi/i.test(ua)) return 'Xiaomi Phone';
    if (/Pixel/i.test(ua)) return 'Google Pixel';
    if (/Android/i.test(ua)) return 'Teléfono Android';
    return 'Smartphone';
  }

  if (type === 'tablet') {
    if (/iPad/i.test(ua)) return 'iPad';
    return 'Tablet';
  }

  // Computer
  if (/Windows/i.test(ua)) return 'PC Windows';
  if (/Macintosh|Mac OS/i.test(ua)) return 'Mac';
  if (/Linux/i.test(ua)) return 'PC Linux';
  if (/CrOS/i.test(ua)) return 'Chromebook';

  return 'Navegador Web';
}

export function getStoredDeviceName(): string {
  try {
    const custom = localStorage.getItem(DEVICE_NAME_KEY);
    if (custom && custom.trim()) return custom.trim();
  } catch {}
  return detectDefaultDeviceName(detectDeviceType());
}

export function setStoredDeviceName(name: string): void {
  try {
    localStorage.setItem(DEVICE_NAME_KEY, name.trim());
  } catch {}
}
