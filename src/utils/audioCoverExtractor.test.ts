import { describe, it, expect } from 'vitest';
import {
  parseId3,
  parseFlac,
  autoDetectCover,
  autoDetectAlbumCover,
  cleanGenreText,
} from './audioCoverExtractor';

describe('audioCoverExtractor', () => {
  it('parses ID3v2.3 tags with title, artist, album and APIC cover', () => {
    // Construct a synthetic ID3v2.3 buffer
    const id3Header = [0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00]; // 128 bytes size

    // Frame 1: TIT2 (Title)
    const titleText = 'Bohemian Rhapsody';
    const titleBytes = Array.from(new TextEncoder().encode(titleText));
    const tit2Header = [
      0x54, 0x49, 0x54, 0x32, // 'TIT2'
      0x00, 0x00, 0x00, titleBytes.length + 1, // frame size
      0x00, 0x00, // flags
      0x03, // UTF-8 encoding
      ...titleBytes,
    ];

    // Frame 2: TPE1 (Artist with slash: J Balvin/Bad Bunny)
    const artistText = 'J Balvin/Bad Bunny';
    const artistBytes = Array.from(new TextEncoder().encode(artistText));
    const tpe1Header = [
      0x54, 0x50, 0x45, 0x31, // 'TPE1'
      0x00, 0x00, 0x00, artistBytes.length + 1,
      0x00, 0x00,
      0x03,
      ...artistBytes,
    ];

    // Frame 3: APIC (Attached Picture)
    // JPEG magic bytes: 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, ...
    const fakeJpeg = [
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00,
      0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00,
    ];
    const mime = Array.from(new TextEncoder().encode('image/jpeg\0'));
    const apicBody = [
      0x00, // Latin1
      ...mime,
      0x03, // Picture type: Cover (front)
      0x00, // Description (null)
      ...fakeJpeg,
    ];
    const apicHeader = [
      0x41, 0x50, 0x49, 0x43, // 'APIC'
      0x00, 0x00, 0x00, apicBody.length,
      0x00, 0x00,
      ...apicBody,
    ];

    const allBytes = new Uint8Array([
      ...id3Header,
      ...tit2Header,
      ...tpe1Header,
      ...apicHeader,
    ]);

    const result = parseId3(allBytes.buffer);
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Bohemian Rhapsody');
    expect(result?.artist).toBe('J Balvin, Bad Bunny');
    expect(result?.coverUrl).toContain('data:image/jpeg;base64,');
  });

  it('translates numeric ID3 genre to human genre name', () => {
    expect(cleanGenreText('(13)')).toBe('Pop');
    expect(cleanGenreText('(15)')).toBe('Rap');
    expect(cleanGenreText('(17)')).toBe('Rock');
    expect(cleanGenreText('Reggaeton')).toBe('Reggaeton');
  });

  it('returns null for non-ID3 buffer', () => {
    const emptyBuffer = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00]).buffer;
    expect(parseId3(emptyBuffer)).toBeNull();
  });

  it('returns null for non-FLAC buffer', () => {
    const emptyBuffer = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00]).buffer;
    expect(parseFlac(emptyBuffer)).toBeNull();
  });

  it('exports autoDetectCover and autoDetectAlbumCover as functions', () => {
    expect(typeof autoDetectCover).toBe('function');
    expect(typeof autoDetectAlbumCover).toBe('function');
  });
});
