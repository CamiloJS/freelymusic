import { describe, it, expect } from 'vitest';
import { parseAudioUrlMetadata } from './urlMetadataParser';

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
