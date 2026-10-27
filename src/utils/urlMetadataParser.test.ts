import { describe, it, expect } from 'vitest';
import { parseAudioUrlMetadata, cleanArtistSeparators } from './urlMetadataParser';

describe('parseAudioUrlMetadata', () => {
  it('parses "Artist - Song.mp3" format correctly', () => {
    const res = parseAudioUrlMetadata('https://filegarden.com/xyz/Aitana%20-%204TO%20AZUL.mp3');
    expect(res.artists).toEqual(['Aitana']);
    expect(res.title).toBe('4TO AZUL');
  });

  it('parses track numbers and multiple collaborating artists', () => {
    const res = parseAudioUrlMetadata(
      'https://filegarden.com/xyz/01.%20Aitana,%20Sebastian%20Yatra%20-%20Corazon%20Sin%20Vida.mp3'
    );
    expect(res.trackNumber).toBe(1);
    expect(res.artists).toEqual(['Aitana', 'Sebastian Yatra']);
    expect(res.title).toBe('Corazon Sin Vida');
  });

  it('replaces slashes with commas in artist collaborations', () => {
    expect(cleanArtistSeparators('J Balvin/Bad Bunny')).toBe('J Balvin, Bad Bunny');
    expect(cleanArtistSeparators('J Balvin / Bad Bunny / Chencho')).toBe('J Balvin, Bad Bunny, Chencho');
    const res = parseAudioUrlMetadata('https://example.com/music/J%20Balvin%2FBad%20Bunny%20-%20LA%20CANCION.mp3');
    expect(res.artists).toEqual(['J Balvin', 'Bad Bunny']);
  });

  it('detects explicit content and release year from link', () => {
    const res = parseAudioUrlMetadata('https://example.com/Feid%20-%20CHORRITO%20PA%20LAS%20ANIMAS%20(2022)%20[Explicit].mp3');
    expect(res.artists).toEqual(['Feid']);
    expect(res.title).toBe('CHORRITO PA LAS ANIMAS');
    expect(res.year).toBe('2022');
    expect(res.isExplicit).toBe(true);
  });

  it('handles underscores in filenames', () => {
    const res = parseAudioUrlMetadata(
      'https://filegarden.com/music/Taylor_Swift_-_Cruel_Summer.mp3'
    );
    expect(res.artists).toEqual(['Taylor Swift']);
    expect(res.title).toBe('Cruel Summer');
  });

  it('handles featured artists in title', () => {
    const res = parseAudioUrlMetadata(
      'https://example.com/audio/Dua%20Lipa%20-%20Levitating%20(feat.%20DaBaby).mp3'
    );
    expect(res.artists).toEqual(['Dua Lipa', 'DaBaby']);
    expect(res.title).toBe('Levitating');
  });

  it('handles filename without artist', () => {
    const res = parseAudioUrlMetadata('https://example.com/audio/03%20-%20Midnight%20City.mp3');
    expect(res.trackNumber).toBe(3);
    expect(res.title).toBe('Midnight City');
    expect(res.artists).toEqual([]);
  });
});
