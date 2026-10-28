import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  getOrCreateDeviceId,
  detectDefaultDeviceName,
  getStoredDeviceName,
  setStoredDeviceName,
} from './deviceInfo';

class LocalStorageMock {
  private store: Record<string, string> = {};

  clear() {
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }
}

describe('deviceInfo utility', () => {
  beforeAll(() => {
    // @ts-ignore
    globalThis.localStorage = new LocalStorageMock();
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it('generates a stable device ID and retrieves it from localStorage', () => {
    const id1 = getOrCreateDeviceId();
    expect(typeof id1).toBe('string');
    expect(id1.length).toBeGreaterThan(5);

    const id2 = getOrCreateDeviceId();
    expect(id2).toBe(id1);
  });

  it('detects default names accurately based on device type', () => {
    expect(detectDefaultDeviceName('tv')).toContain('TV');
    expect(detectDefaultDeviceName('smartphone')).toBeDefined();
    expect(detectDefaultDeviceName('computer')).toBeDefined();
    expect(detectDefaultDeviceName('tablet')).toBe('Tablet');
  });

  it('stores and retrieves custom device names', () => {
    setStoredDeviceName('Mi Laptop de Trabajo');
    expect(getStoredDeviceName()).toBe('Mi Laptop de Trabajo');
  });
});
