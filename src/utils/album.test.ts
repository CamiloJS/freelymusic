import { describe, it, expect } from 'vitest';
import { Song, Album } from '../types';
import { getAlbumsFromCatalog } from './albums';

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

  it('groups tracks into a single album even if songs have guest collaborators', () => {
    const multiArtistSongs: Song[] = [
      {
        id: 's1',
        title: 'Song 1',
        artist: 'Aitana',
        album: 'CUARTO AZUL',
        coverUrl: 'https://example.com/alpha.jpg',
        audioUrl: 'https://example.com/1.mp3',
        duration: 180,
        trackNumber: 1,
        createdAt: '2026-10-26T12:00:00Z',
      },
      {
        id: 's2',
        title: 'EX EX EX',
        artist: 'Aitana, Kenia Os',
        album: 'CUARTO AZUL',
        coverUrl: 'https://example.com/alpha.jpg',
        audioUrl: 'https://example.com/2.mp3',
        duration: 190,
        trackNumber: 2,
        createdAt: '2026-10-26T12:00:00Z',
      },
      {
        id: 's3',
        title: 'Song 3',
        artist: 'Aitana',
        album: 'CUARTO AZUL',
        coverUrl: 'https://example.com/alpha.jpg',
        audioUrl: 'https://example.com/3.mp3',
        duration: 200,
        trackNumber: 3,
        createdAt: '2026-10-26T12:00:00Z',
      },
    ];

    const albums = getAlbumsFromCatalog(multiArtistSongs);
    expect(albums).toHaveLength(1);
    expect(albums[0].name).toBe('CUARTO AZUL');
    expect(albums[0].artist).toBe('Aitana');
    expect(albums[0].songs).toHaveLength(3);
    expect(albums[0].songs.map((s) => s.title)).toEqual(['Song 1', 'EX EX EX', 'Song 3']);
  });
});
