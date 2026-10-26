import { describe, it, expect } from 'vitest';
import { Song, Album } from '../types';

describe('Album management & sorting', () => {
  const mockSongs: Song[] = [
    {
      id: 'song-3',
      title: 'Pista Tres',
      artist: 'Artista Test',
      album: 'Álbum Demo',
      coverUrl: 'https://example.com/cover.jpg',
      audioUrl: 'https://example.com/3.mp3',
      duration: 190,
      trackNumber: 3,
      createdAt: '2026-10-26T12:00:00Z',
    },
    {
      id: 'song-1',
      title: 'Pista Uno',
      artist: 'Artista Test',
      album: 'Álbum Demo',
      coverUrl: 'https://example.com/cover.jpg',
      audioUrl: 'https://example.com/1.mp3',
      duration: 180,
      trackNumber: 1,
      createdAt: '2026-10-26T12:00:00Z',
    },
    {
      id: 'song-2',
      title: 'Pista Dos',
      artist: 'Artista Test',
      album: 'Álbum Demo',
      coverUrl: 'https://example.com/cover.jpg',
      audioUrl: 'https://example.com/2.mp3',
      duration: 210,
      trackNumber: 2,
      createdAt: '2026-10-26T12:00:00Z',
    },
  ];

  it('sorts album tracks in ascending order by trackNumber', () => {
    const sorted = [...mockSongs].sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));
    expect(sorted.map((s) => s.trackNumber)).toEqual([1, 2, 3]);
    expect(sorted[0].title).toBe('Pista Uno');
    expect(sorted[1].title).toBe('Pista Dos');
    expect(sorted[2].title).toBe('Pista Tres');
  });

  it('correctly creates an Album structure with all songs', () => {
    const album: Album = {
      name: 'Álbum Demo',
      artist: 'Artista Test',
      coverUrl: 'https://example.com/cover.jpg',
      year: '2026',
      genre: 'Pop',
      songs: mockSongs,
    };

    expect(album.songs).toHaveLength(3);
    expect(album.name).toBe('Álbum Demo');
    const sortedTracks = [...album.songs].sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));
    expect(sortedTracks[0].trackNumber).toBe(1);
    expect(sortedTracks[2].trackNumber).toBe(3);
  });
});
