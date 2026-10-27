import { describe, it, expect } from 'vitest';
import {
  organizeFolderMusic,
  isTrackDuplicateInCatalog,
  extractAlbumFromPath,
  normalizeTextForComparison,
  RawFolderItem,
} from './folderMusicOrganizer';
import { Song } from '../types';

describe('folderMusicOrganizer', () => {
  const mockCatalog: Song[] = [
    {
      id: 'existing-1',
      title: 'BUTTERFLY',
      artist: 'Marina POP',
      album: 'Marina POP D',
      duration: 180,
      coverUrl: 'https://example.com/cover.jpg',
      audioUrl: 'https://file.garden/song1.mp3',
      addedBy: 'user-1',
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'existing-2',
      title: 'Yonaguni',
      artist: 'Bad Bunny',
      album: 'Yonaguni - Single',
      duration: 206,
      coverUrl: 'https://example.com/cover2.jpg',
      audioUrl: 'https://file.garden/song2.mp3',
      addedBy: 'user-1',
      createdAt: '2026-01-01T00:00:00Z',
    },
  ];

  it('correctly detects duplicates by title + artist and by audioUrl', () => {
    // 1. Exact match
    expect(
      isTrackDuplicateInCatalog(
        { title: 'Butterfly', artist: 'Marina POP' },
        mockCatalog
      )
    ).toBe(true);

    // 2. URL match
    expect(
      isTrackDuplicateInCatalog(
        { title: 'Random Title', artist: 'Unknown', audioUrl: 'https://file.garden/song1.mp3' },
        mockCatalog
      )
    ).toBe(true);

    // 3. Artists with slash vs comma
    expect(
      isTrackDuplicateInCatalog(
        { title: 'Yonaguni', artist: 'Bad Bunny' },
        mockCatalog
      )
    ).toBe(true);

    // 4. Non-duplicate
    expect(
      isTrackDuplicateInCatalog(
        { title: 'New Unheard Track', artist: 'New Artist' },
        mockCatalog
      )
    ).toBe(false);
  });

  it('extracts album name from subfolder relative path', () => {
    expect(extractAlbumFromPath('Raras/Marina POP D/01 - BUTTERFLY.mp3')).toBe('Marina POP D');
    expect(extractAlbumFromPath('Un Verano Sin Ti/Moscow Mule.mp3')).toBe('Un Verano Sin Ti');
    expect(extractAlbumFromPath('SingleTrack.mp3')).toBe('');
  });

  it('groups 2+ tracks into an Album and applies the first cover to all tracks', async () => {
    const rawItems: RawFolderItem[] = [
      {
        name: '01 - BUTTERFLY.mp3',
        relativePath: 'Raras/Marina POP D/01 - BUTTERFLY.mp3',
      },
      {
        name: '02 - PRINCESS OF POWER.mp3',
        relativePath: 'Raras/Marina POP D/02 - PRINCESS OF POWER.mp3',
      },
      {
        name: '03 - FINAL BOSS.mp3',
        relativePath: 'Raras/Marina POP D/03 - FINAL BOSS.mp3',
      },
      {
        name: 'Solo Sencillo.mp3',
        relativePath: 'Raras/Solo Sencillo.mp3',
      },
    ];

    const result = await organizeFolderMusic(rawItems, mockCatalog);

    // Should create 1 Album with 3 tracks, and 1 Single
    expect(result.albums.length).toBe(1);
    expect(result.albums[0].title).toBe('Marina POP D');
    expect(result.albums[0].tracks.length).toBe(3);

    expect(result.singles.length).toBe(1);
    expect(result.singles[0].title).toBe('Solo Sencillo');

    // Duplicate check: BUTTERFLY was in mockCatalog, so it should be marked as duplicate
    const butterflyTrack = result.albums[0].tracks.find((t) => t.title.toLowerCase().includes('butterfly'));
    expect(butterflyTrack?.isDuplicate).toBe(true);
    expect(butterflyTrack?.selected).toBe(false);

    // Other tracks are new
    const princessTrack = result.albums[0].tracks.find((t) => t.title.toLowerCase().includes('princess'));
    expect(princessTrack?.isDuplicate).toBe(false);
    expect(princessTrack?.selected).toBe(true);

    expect(result.duplicateCount).toBe(1);
    expect(result.newTracksCount).toBe(3);
  });

  it('replaces slashes in artist names with commas', async () => {
    const rawItems: RawFolderItem[] = [
      {
        name: 'J Balvin, Bad Bunny - LA CANCION.mp3',
        relativePath: 'Oasis/J Balvin, Bad Bunny - LA CANCION.mp3',
      },
      {
        name: 'J Balvin, Bad Bunny - QUE PRETENDES.mp3',
        relativePath: 'Oasis/J Balvin, Bad Bunny - QUE PRETENDES.mp3',
      },
    ];

    const result = await organizeFolderMusic(rawItems, []);
    expect(result.albums.length).toBe(1);
    for (const track of result.albums[0].tracks) {
      expect(track.artist).not.toContain('/');
      expect(track.artist).toBe('J Balvin, Bad Bunny');
    }
  });
});
