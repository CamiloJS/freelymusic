import { describe, expect, it } from 'vitest';
import { Song } from '../types';
import {
  matchPlaylistTracks,
  matchTrack,
  parseTextPlaylist,
} from './playlistImport';

const catalog: Song[] = [
  {
    id: 'butterfly',
    title: 'BUTTERFLY',
    artist: 'MARINA',
    album: 'PRINCESS OF POWER (DELUXE)',
    coverUrl: '',
    audioUrl: 'https://example.com/butterfly.mp3',
    duration: 266,
    createdAt: '2026-01-01T00:00:00.000Z',
    isrc: 'GBAAA0000001',
  },
  {
    id: 'ex',
    title: 'EX EX EX',
    artist: 'Aitana, Kenia Os',
    album: 'CUARTO AZUL',
    coverUrl: '',
    audioUrl: 'https://example.com/ex.mp3',
    duration: 182,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'cielo',
    title: 'MÚSICA EN EL CIELO',
    artist: 'Aitana',
    album: 'CUARTO AZUL',
    coverUrl: '',
    audioUrl: 'https://example.com/cielo.mp3',
    duration: 231,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('playlist import matching', () => {
  it('matches title and artist ignoring case and accents', () => {
    const result = matchTrack({ title: 'Butterfly', artist: 'Marina' }, catalog);
    expect(result.songId).toBe('butterfly');
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it('matches collaborations by their primary artist', () => {
    const result = matchTrack({ title: 'EX EX EX', artist: 'Aitana' }, catalog);
    expect(result.songId).toBe('ex');
  });

  it('matches by ISRC even when the title differs', () => {
    const result = matchTrack(
      {
        title: 'A slightly different title',
        artist: 'Different Artist',
        isrc: 'GBAAA0000001',
      },
      catalog
    );
    expect(result.songId).toBe('butterfly');
    expect(result.reason).toContain('ISRC');
  });

  it('does not substitute an unmatched song with a wrong one', () => {
    const result = matchTrack(
      { title: 'CUARTO AZUL', artist: 'Aitana' },
      catalog
    );
    expect(result.songId).toBeUndefined();
    expect(result.reason).toContain('Sin coincidencia');
  });

  it('parses text playlists and deduplicates lines', () => {
    const tracks = parseTextPlaylist(`
      Aitana - MÚSICA EN EL CIELO
      Aitana - MÚSICA EN EL CIELO
      MARINA - BUTTERFLY
      1. Aitana - EX EX EX
    `);

    expect(tracks).toHaveLength(3);
    expect(tracks[0]).toEqual({ artist: 'Aitana', title: 'MÚSICA EN EL CIELO' });
    expect(tracks[2]).toEqual({ artist: 'Aitana', title: 'EX EX EX' });
  });

  it('handles title-first text imports by trying the swapped orientation', () => {
    const tracks = parseTextPlaylist('MÚSICA EN EL CIELO - Aitana');
    const report = matchPlaylistTracks(tracks, catalog);
    expect(report.matched).toBe(1);
    expect(report.matches[0].songId).toBe('cielo');
  });
});
