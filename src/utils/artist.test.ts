import { describe, it, expect } from 'vitest';
import { Song, ArtistProfile } from '../types';

describe('Artist profiles and personal play tracking', () => {
  it('correctly normalizes artist identifier', () => {
    const rawName = '  Aitana  ';
    const norm = rawName.trim().toLowerCase();
    expect(norm).toBe('aitana');
  });

  it('filters catalog songs for an artist including collaborations', () => {
    const catalog: Song[] = [
      {
        id: '1',
        title: 'HOY ES TU CUMPLEAÑOS',
        artist: 'Aitana',
        album: 'CUARTO AZUL',
        coverUrl: '',
        audioUrl: '',
        duration: 200,
        createdAt: '',
      },
      {
        id: '2',
        title: 'EX EX EX',
        artist: 'Aitana, Kenia Os',
        album: 'CUARTO AZUL',
        coverUrl: '',
        audioUrl: '',
        duration: 180,
        createdAt: '',
      },
      {
        id: '3',
        title: 'OTRA CANCIÓN',
        artist: 'Kenia Os',
        album: 'PINK',
        coverUrl: '',
        audioUrl: '',
        duration: 190,
        createdAt: '',
      },
    ];

    const q = 'aitana';
    const aitanaSongs = catalog.filter((song) => {
      const parts = song.artist.split(/[,&/]|feat\.|ft\./i).map((p) => p.trim().toLowerCase());
      return parts.includes(q) || song.artist.toLowerCase().includes(q);
    });

    expect(aitanaSongs).toHaveLength(2);
    expect(aitanaSongs.map((s) => s.title)).toEqual(['HOY ES TU CUMPLEAÑOS', 'EX EX EX']);
  });

  it('tracks user personal play counts correctly', () => {
    const playCounts: Record<string, number> = {
      'song-1': 3,
      'song-2': 1,
    };

    const countSong1 = playCounts['song-1'] || 0;
    const countSong3 = playCounts['song-3'] || 0;

    expect(countSong1).toBe(3);
    expect(countSong3).toBe(0);
  });

  it('matches artist aliases and variations (e.g. J Balvin vs J. Balvin)', () => {
    const aliases = new Set(['j balvin', 'jbalvin', 'j. balvin']);
    const songs: Song[] = [
      {
        id: '1',
        title: 'Mi Gente',
        artist: 'J Balvin, Willy William',
        album: 'Vibras',
        coverUrl: '',
        audioUrl: '',
        duration: 180,
        createdAt: '',
      },
      {
        id: '2',
        title: '6 AM',
        artist: 'J. Balvin, Farruko',
        album: 'La Familia',
        coverUrl: '',
        audioUrl: '',
        duration: 190,
        createdAt: '',
      },
      {
        id: '3',
        title: 'Dákiti',
        artist: 'Bad Bunny, Jhayco',
        album: 'El Último Tour Del Mundo',
        coverUrl: '',
        audioUrl: '',
        duration: 200,
        createdAt: '',
      },
    ];

    const matchedSongs = songs.filter((song) => {
      const parts = song.artist.split(/[,&/]|feat\.|ft\./i).map((p) => p.trim().toLowerCase());
      return parts.some((p) => aliases.has(p) || aliases.has(p.replace(/[\s._-]+/g, '')));
    });

    expect(matchedSongs).toHaveLength(2);
    expect(matchedSongs.map((s) => s.title)).toEqual(['Mi Gente', '6 AM']);
  });

  it('separates own albums from collaborative featured albums (También aparece en)', () => {
    const artistName = 'Bad Bunny';
    const aliases = new Set(['bad bunny', 'badbunny']);

    const albums = [
      {
        name: 'Un Verano Sin Ti',
        artist: 'Bad Bunny',
        songs: [
          { title: 'Moscow Mule', artist: 'Bad Bunny' },
          { title: 'Tarot', artist: 'Bad Bunny, Jhayco' },
        ],
      },
      {
        name: 'Vibras',
        artist: 'J Balvin',
        songs: [
          { title: 'Si Tu Novio Te Deja Sola', artist: 'J Balvin, Bad Bunny' },
          { title: 'Mi Gente', artist: 'J Balvin, Willy William' },
        ],
      },
    ];

    const ownAlbums: string[] = [];
    const featuredAlbums: string[] = [];

    albums.forEach((alb) => {
      const albArtistNorm = alb.artist.trim().toLowerCase();
      const isDirectOwner = aliases.has(albArtistNorm);
      const primaryCount = alb.songs.filter((s) => {
        const first = s.artist.split(/[,&/]|feat\.|ft\./i)[0].trim().toLowerCase();
        return aliases.has(first);
      }).length;
      const isMajority = primaryCount / alb.songs.length >= 0.5;

      if (isDirectOwner || isMajority) {
        ownAlbums.push(alb.name);
      } else {
        featuredAlbums.push(alb.name);
      }
    });

    expect(ownAlbums).toEqual(['Un Verano Sin Ti']);
    expect(featuredAlbums).toEqual(['Vibras']);
  });
});
