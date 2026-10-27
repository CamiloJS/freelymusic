import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  getRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  normalizeUserData,
} from './storage';

// In-memory mock for localStorage in node test environment
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

describe('recent searches storage', () => {
  beforeAll(() => {
    // @ts-ignore
    globalThis.localStorage = new LocalStorageMock();
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and retrieves up to 10 recent searches in descending order', () => {
    saveRecentSearch('Taylor Swift');
    saveRecentSearch('The Weeknd');
    saveRecentSearch('Daft Punk');

    const searches = getRecentSearches();
    expect(searches).toEqual(['Daft Punk', 'The Weeknd', 'Taylor Swift']);
  });

  it('deduplicates existing searches and bumps to top', () => {
    saveRecentSearch('Song A');
    saveRecentSearch('Song B');
    saveRecentSearch('Song A');

    const searches = getRecentSearches();
    expect(searches).toEqual(['Song A', 'Song B']);
  });

  it('limits recent searches to exactly 10', () => {
    for (let i = 1; i <= 15; i++) {
      saveRecentSearch(`Search ${i}`);
    }

    const searches = getRecentSearches();
    expect(searches).toHaveLength(10);
    expect(searches[0]).toBe('Search 15');
  });

  it('removes specific search item and clears history', () => {
    saveRecentSearch('Rock');
    saveRecentSearch('Pop');
    removeRecentSearch('Rock');

    expect(getRecentSearches()).toEqual(['Pop']);

    clearRecentSearches();
    expect(getRecentSearches()).toEqual([]);
  });
});

describe('user library normalization', () => {
  const playlist = (id: string) => ({
    id,
    name: id,
    userId: 'user-1',
    songIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  it('normalizes followed artists and removes duplicates', () => {
    const data = normalizeUserData({
      followedArtists: [' Aitana ', 'aitana', 'MARINA', ''],
    });
    expect(data.followedArtists).toEqual(['aitana', 'marina']);
  });

  it('keeps only pinned playlists that still exist', () => {
    const data = normalizeUserData({
      playlists: [playlist('pl-1'), playlist('pl-2')],
      pinnedPlaylistIds: ['pl-1', 'pl-1', 'pl-deleted', 'favorites'],
    });
    expect(data.pinnedPlaylistIds).toEqual(['pl-1']);
  });

  it('defaults the new fields to empty arrays', () => {
    const data = normalizeUserData({ favoriteSongIds: [], playlists: [] });
    expect(data.followedArtists).toEqual([]);
    expect(data.pinnedPlaylistIds).toEqual([]);
  });
});
