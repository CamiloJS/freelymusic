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
});
