import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  getRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  normalizeUserData,
  getStoredChatThreads,
  getStoredDirectMessages,
  getStoredProfiles,
  normalizeSong,
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

describe('chat threads and mock profiles cleanup', () => {
  it('returns empty array when user has not chatted with anyone', () => {
    const threads = getStoredChatThreads();
    expect(threads).toEqual([]);
  });

  it('filters out any mock threads like thread-luis or thread-jhoan', () => {
    localStorage.setItem(
      'sonora_chat_threads',
      JSON.stringify([
        { id: 'thread-jhoan', participantIds: ['jhoan-user'], displayName: 'Jhoan' },
        { id: 'thread-luis', participantIds: ['luis-david-user'], displayName: 'Luis' },
        { id: 'real-thread-1', participantIds: ['user-real'], displayName: 'Amigo Real' },
      ])
    );
    const threads = getStoredChatThreads();
    expect(threads).toHaveLength(1);
    expect(threads[0].id).toBe('real-thread-1');
  });

  it('returns empty messages for mock threads', () => {
    const msgs = getStoredDirectMessages('thread-luis');
    expect(msgs).toEqual([]);
  });

  it('filters out mock users from stored profiles', () => {
    localStorage.setItem(
      'sonora_user_profiles',
      JSON.stringify([
        { id: 'camilo-admin', username: 'camilo', displayName: 'Camilo' },
        { id: 'jhoan-user', username: 'jhoan', displayName: 'Jhoan' },
        { id: 'luis-david-user', username: 'luis', displayName: 'Luis' },
        { id: 'geraldine-user', username: 'geraldine', displayName: 'Geraldine' },
      ])
    );
    const profiles = getStoredProfiles();
    expect(profiles.some((p) => p.id === 'jhoan-user')).toBe(false);
    expect(profiles.some((p) => p.id === 'luis-david-user')).toBe(false);
    expect(profiles.some((p) => p.id === 'geraldine-user')).toBe(false);
    expect(profiles.some((p) => p.id === 'camilo-admin')).toBe(true);
  });

  it('normalizes songs by converting slashes in artist names to commas', () => {
    const song = normalizeSong({
      id: 'test-song-1',
      title: 'LA CANCION',
      artist: 'J. Balvin/Bad Bunny',
      albumArtist: 'J. Balvin/Bad Bunny',
    });
    expect(song?.artist).toBe('J. Balvin, Bad Bunny');
    expect(song?.albumArtist).toBe('J. Balvin, Bad Bunny');
  });
});
