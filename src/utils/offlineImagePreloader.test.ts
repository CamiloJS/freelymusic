import { describe, it, expect, vi, beforeEach } from 'vitest';
import { preloadSingleImage, preloadAllAppImages } from './offlineImagePreloader';
import { Song, Playlist, UserProfile } from '../types';

describe('offlineImagePreloader', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('safely handles invalid, empty, or base64 data URLs without throwing', async () => {
    await expect(preloadSingleImage('')).resolves.not.toThrow();
    await expect(preloadSingleImage('data:image/png;base64,abc')).resolves.not.toThrow();
    await expect(preloadSingleImage('blob:http://localhost/123')).resolves.not.toThrow();
    await expect(preloadSingleImage('   ')).resolves.not.toThrow();
  });

  it('preloads images from songs, playlists, and user profiles', async () => {
    const mockSongs: Song[] = [
      {
        id: 's1',
        title: 'Song 1',
        artist: 'Artist 1',
        album: 'Album 1',
        coverUrl: 'https://example.com/cover1.jpg',
        audioUrl: 'https://example.com/song1.mp3',
        duration: 180,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 's2',
        title: 'Song 2',
        artist: 'Artist 2',
        album: 'Album 2',
        coverUrl: '',
        audioUrl: 'https://example.com/song2.mp3',
        duration: 200,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const mockPlaylists: Playlist[] = [
      {
        id: 'p1',
        name: 'Playlist 1',
        coverUrl: 'https://example.com/plcover.jpg',
        userId: 'u1',
        songIds: ['s1'],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const mockUsers: UserProfile[] = [
      {
        id: 'u1',
        username: 'user1',
        displayName: 'User One',
        avatarUrl: 'https://example.com/avatar.jpg',
        role: 'member',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    await expect(
      preloadAllAppImages({
        songs: mockSongs,
        playlists: mockPlaylists,
        users: mockUsers,
      })
    ).resolves.not.toThrow();
  });
});
