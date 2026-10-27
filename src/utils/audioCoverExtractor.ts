/**
 * Audio Cover Art & Metadata Extractor.
 *
 * 1. Extracts embedded ID3v2 (MP3), FLAC, and MP4/M4A cover artwork directly from the audio file/stream.
 * 2. Provides multi-source automatic online cover detection (iTunes, Deezer, MusicBrainz proxy)
 *    for both individual songs and full albums.
 */

import { cleanArtistSeparators } from './urlMetadataParser';

export interface ExtractedAudioMetadata {
  coverUrl?: string;
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  lyrics?: string;
  isExplicit?: boolean;
  source: 'embedded_file' | 'online_search';
}

export interface OnlineDetectedMetadata {
  coverUrl: string | null;
  year?: string;
  genre?: string;
  isExplicit?: boolean;
  title?: string;
  artist?: string;
  album?: string;
}

const ID3_GENRES = [
  'Blues', 'Classic Rock', 'Country', 'Dance', 'Disco', 'Funk', 'Grunge', 'Hip-Hop',
  'Jazz', 'Metal', 'New Age', 'Oldies', 'Other', 'Pop', 'R&B', 'Rap',
  'Reggae', 'Rock', 'Techno', 'Industrial', 'Alternative', 'Ska', 'Death Metal', 'Pranks',
  'Soundtrack', 'Euro-Techno', 'Ambient', 'Trip-Hop', 'Vocal', 'Jazz+Funk', 'Fusion', 'Trance',
  'Classical', 'Instrumental', 'Acid', 'House', 'Game', 'Sound Clip', 'Gospel', 'Noise',
  'AlternRock', 'Bass', 'Soul', 'Punk', 'Space', 'Meditative', 'Instrumental Pop', 'Instrumental Rock',
  'Ethnic', 'Gothic', 'Darkwave', 'Techno-Industrial', 'Electronic', 'Pop-Folk', 'Eurodance', 'Dream',
  'Southern Rock', 'Comedy', 'Cult', 'Gangsta', 'Top 40', 'Christian Rap', 'Pop/Funk', 'Jungle',
  'Native American', 'Cabaret', 'New Wave', 'Psychadelic', 'Rave', 'Showtunes', 'Trailer', 'Lo-Fi',
  'Tribal', 'Acid Punk', 'Acid Jazz', 'Polka', 'Retro', 'Musical', 'Rock & Roll', 'Hard Rock',
  'Folk', 'Folk-Rock', 'National Folk', 'Swing', 'Fast Fusion', 'Bebob', 'Latin', 'Revival',
  'Celtic', 'Bluegrass', 'Avantgarde', 'Gothic Rock', 'Progressive Rock', 'Psychedelic Rock', 'Symphonic Rock', 'Slow Rock',
  'Big Band', 'Chorus', 'Easy Listening', 'Acoustic', 'Humour', 'Speech', 'Chanson', 'Opera',
  'Chamber Music', 'Sonata', 'Symphony', 'Booty Bass', 'Primus', 'Porn Groove', 'Satire', 'Slow Jam',
  'Club', 'Tango', 'Samba', 'Folklore', 'Ballad', 'Power Ballad', 'Rhythmic Soul', 'Freestyle',
  'Duet', 'Punk Rock', 'Drum Solo', 'Acapella', 'Euro-House', 'Dance Hall', 'Goa', 'Drum & Bass',
  'Club-House', 'Hardcore', 'Terror', 'Indie', 'BritPop', 'Negerpunk', 'Polsk Punk', 'Beat',
  'Christian Gangsta', 'Heavy Metal', 'Black Metal', 'Crossover', 'Contemporary Christian', 'Christian Rock',
  'Merengue', 'Salsa', 'Thrash Metal', 'Anime', 'JPop', 'Synthpop'
];

export function cleanGenreText(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  const numMatch = trimmed.match(/^\((\d+)\)$/) || trimmed.match(/^(\d+)$/);
  if (numMatch) {
    const idx = parseInt(numMatch[1], 10);
    if (idx >= 0 && idx < ID3_GENRES.length) {
      return ID3_GENRES[idx];
    }
  }
  return trimmed.replace(/^\(\d+\)\s*/, '').trim();
}

function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

function detectMimeTypeFromMagic(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (bytes.length >= 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'image/gif';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

function decodeText(bytes: Uint8Array, encoding: number): string {
  try {
    if (encoding === 0) {
      // ISO-8859-1 (Latin1)
      let str = '';
      for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] === 0) break;
        str += String.fromCharCode(bytes[i]);
      }
      return str.trim();
    }
    if (encoding === 1 || encoding === 2) {
      // UTF-16
      const decoder = new TextDecoder(encoding === 2 ? 'utf-16be' : 'utf-16le');
      return decoder.decode(bytes).replace(/\0.*$/g, '').trim();
    }
    if (encoding === 3) {
      // UTF-8
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(bytes).replace(/\0.*$/g, '').trim();
    }
  } catch {
    // fallback
  }
  return '';
}

/**
 * Parses ID3v2 tags (v2.2, v2.3, v2.4) from an ArrayBuffer
 */
export function parseId3(buffer: ArrayBuffer): Partial<ExtractedAudioMetadata> | null {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 10) return null;

  // Header must begin with "ID3" (0x49, 0x44, 0x33)
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return null;
  }

  const version = bytes[3]; // 2, 3, or 4
  const tagSize =
    ((bytes[6] & 0x7f) << 21) |
    ((bytes[7] & 0x7f) << 14) |
    ((bytes[8] & 0x7f) << 7) |
    (bytes[9] & 0x7f);

  const maxOffset = Math.min(bytes.length, 10 + tagSize);
  let offset = 10;
  const result: Partial<ExtractedAudioMetadata> = {};

  while (offset < maxOffset - 10) {
    let frameId = '';
    let frameSize = 0;
    let headerSize = 10;

    if (version === 2) {
      // ID3v2.2: 3-byte ID, 3-byte size
      frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2]);
      frameSize = (bytes[offset + 3] << 16) | (bytes[offset + 4] << 8) | bytes[offset + 5];
      headerSize = 6;
    } else {
      // ID3v2.3 or ID3v2.4: 4-byte ID, 4-byte size
      frameId = String.fromCharCode(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3]
      );
      if (version === 4) {
        frameSize =
          ((bytes[offset + 4] & 0x7f) << 21) |
          ((bytes[offset + 5] & 0x7f) << 14) |
          ((bytes[offset + 6] & 0x7f) << 7) |
          (bytes[offset + 7] & 0x7f);
      } else {
        frameSize =
          (bytes[offset + 4] << 24) |
          (bytes[offset + 5] << 16) |
          (bytes[offset + 6] << 8) |
          bytes[offset + 7];
      }
      headerSize = 10;
    }

    if (!frameId || frameId.charCodeAt(0) === 0 || frameSize <= 0) break;
    if (offset + headerSize + frameSize > maxOffset) break;

    const frameData = bytes.subarray(offset + headerSize, offset + headerSize + frameSize);

    // Cover Art (APIC in v2.3/v2.4 or PIC in v2.2)
    if ((frameId === 'APIC' || frameId === 'PIC') && !result.coverUrl && frameData.length > 8) {
      try {
        const encoding = frameData[0];
        let pos = 1;

        let mimeType = 'image/jpeg';
        if (version === 2) {
          // 3-byte format e.g. "JPG" or "PNG"
          const fmt = String.fromCharCode(frameData[pos], frameData[pos + 1], frameData[pos + 2]).toLowerCase();
          mimeType = fmt === 'png' ? 'image/png' : 'image/jpeg';
          pos += 3;
        } else {
          // Null-terminated MIME string
          let mime = '';
          while (pos < frameData.length && frameData[pos] !== 0) {
            mime += String.fromCharCode(frameData[pos]);
            pos++;
          }
          pos++; // Skip null
          if (mime) mimeType = mime;
        }

        pos++; // Skip picture type (1 byte)

        // Skip description (null-terminated according to encoding)
        if (encoding === 1 || encoding === 2) {
          while (pos < frameData.length - 1) {
            if (frameData[pos] === 0 && frameData[pos + 1] === 0) {
              pos += 2;
              break;
            }
            pos += 2;
          }
        } else {
          while (pos < frameData.length && frameData[pos] !== 0) {
            pos++;
          }
          pos++;
        }

        const rawImageBytes = frameData.subarray(pos);
        if (rawImageBytes.length > 32) {
          const detectedMime = detectMimeTypeFromMagic(rawImageBytes);
          const base64 = arrayBufferToBase64(rawImageBytes);
          result.coverUrl = `data:${detectedMime || mimeType};base64,${base64}`;
        }
      } catch {
        // Continue parsing remaining frames
      }
    }

    // Text Frames
    if (frameData.length > 1) {
      const encoding = frameData[0];
      const textBytes = frameData.subarray(1);

      if (frameId === 'TIT2' || frameId === 'TT2') {
        result.title = decodeText(textBytes, encoding);
      } else if (frameId === 'TPE1' || frameId === 'TP1') {
        result.artist = cleanArtistSeparators(decodeText(textBytes, encoding));
      } else if (frameId === 'TALB' || frameId === 'TAL') {
        result.album = decodeText(textBytes, encoding);
      } else if (frameId === 'TYER' || frameId === 'TDRC' || frameId === 'TYE') {
        const yr = decodeText(textBytes, encoding);
        const ym = yr.match(/\b(19\d{2}|20\d{2})\b/);
        result.year = ym ? ym[1] : yr.slice(0, 4);
      } else if (frameId === 'TCON' || frameId === 'TCO') {
        result.genre = cleanGenreText(decodeText(textBytes, encoding));
      } else if (frameId === 'USLT') {
        result.lyrics = decodeText(textBytes.subarray(4), encoding);
      } else if (frameId === 'TXXX') {
        const full = decodeText(textBytes, encoding);
        if (/itunesadvisory/i.test(full) && (/\b1\b|explicit/i.test(full))) {
          result.isExplicit = true;
        }
      }
    }

    offset += headerSize + frameSize;
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Parses FLAC metadata blocks for PICTURE (block type 6) and VORBIS_COMMENT (type 4)
 */
export function parseFlac(buffer: ArrayBuffer): Partial<ExtractedAudioMetadata> | null {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 8) return null;

  // Header must start with "fLaC"
  if (bytes[0] !== 0x66 || bytes[1] !== 0x4c || bytes[2] !== 0x61 || bytes[3] !== 0x43) {
    return null;
  }

  let offset = 4;
  const result: Partial<ExtractedAudioMetadata> = {};

  while (offset < bytes.length - 4) {
    const isLast = (bytes[offset] & 0x80) !== 0;
    const blockType = bytes[offset] & 0x7f;
    const blockSize = (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    offset += 4;

    if (offset + blockSize > bytes.length) break;

    // Block type 6: PICTURE
    if (blockType === 6 && !result.coverUrl && blockSize > 32) {
      try {
        const view = new DataView(buffer, offset, blockSize);
        let pos = 4; // skip picture type
        const mimeLen = view.getUint32(pos);
        pos += 4;
        let mime = '';
        for (let i = 0; i < mimeLen; i++) {
          mime += String.fromCharCode(bytes[offset + pos + i]);
        }
        pos += mimeLen;
        const descLen = view.getUint32(pos);
        pos += 4 + descLen;
        pos += 16; // width (4), height (4), color depth (4), colors (4)
        const dataLen = view.getUint32(pos);
        pos += 4;

        const rawImage = bytes.subarray(offset + pos, offset + pos + dataLen);
        if (rawImage.length > 32) {
          const detectedMime = detectMimeTypeFromMagic(rawImage);
          const base64 = arrayBufferToBase64(rawImage);
          result.coverUrl = `data:${detectedMime || mime || 'image/jpeg'};base64,${base64}`;
        }
      } catch {
        // continue
      }
    }

    // Block type 4: VORBIS_COMMENT
    if (blockType === 4 && blockSize > 8) {
      try {
        const view = new DataView(buffer, offset, blockSize);
        let pos = 0;
        const vendorLen = view.getUint32(pos, true);
        pos += 4 + vendorLen;
        if (pos + 4 <= blockSize) {
          const userCommentCount = view.getUint32(pos, true);
          pos += 4;
          const decoder = new TextDecoder('utf-8');
          for (let i = 0; i < userCommentCount && pos < blockSize - 4; i++) {
            const commentLen = view.getUint32(pos, true);
            pos += 4;
            if (pos + commentLen > blockSize) break;
            const commentStr = decoder.decode(bytes.subarray(offset + pos, offset + pos + commentLen));
            pos += commentLen;

            const eqIdx = commentStr.indexOf('=');
            if (eqIdx > 0) {
              const field = commentStr.slice(0, eqIdx).toUpperCase().trim();
              const val = commentStr.slice(eqIdx + 1).trim();

              if (field === 'TITLE' && !result.title) {
                result.title = val;
              } else if (field === 'ARTIST' && !result.artist) {
                result.artist = cleanArtistSeparators(val);
              } else if (field === 'ALBUM' && !result.album) {
                result.album = val;
              } else if ((field === 'DATE' || field === 'YEAR') && !result.year) {
                const ym = val.match(/\b(19\d{2}|20\d{2})\b/);
                result.year = ym ? ym[1] : val.slice(0, 4);
              } else if (field === 'GENRE' && !result.genre) {
                result.genre = cleanGenreText(val);
              } else if ((field === 'LYRICS' || field === 'UNSYNCEDLYRICS') && !result.lyrics) {
                result.lyrics = val;
              } else if (field === 'ITUNESADVISORY' || field === 'EXPLICIT') {
                if (val === '1' || val.toLowerCase() === 'explicit' || val.toLowerCase() === 'true') {
                  result.isExplicit = true;
                }
              }
            }
          }
        }
      } catch {
        // continue
      }
    }

    if (isLast) break;
    offset += blockSize;
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Extracts metadata and cover art from an audio URL, File, or Blob
 */
export async function extractMetadataFromAudioSource(
  source: string | Blob | File
): Promise<ExtractedAudioMetadata | null> {
  try {
    let buffer: ArrayBuffer | null = null;

    if (typeof source === 'string') {
      const url = source.trim();
      if (!url) return null;

      // Try Range request for first 512KB (typically contains all audio header tags & cover)
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      try {
        const response = await fetch(url, {
          headers: { Range: 'bytes=0-524287' },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (response.ok || response.status === 206) {
          buffer = await response.arrayBuffer();
        }
      } catch {
        clearTimeout(timer);
      }
    } else if (source instanceof Blob) {
      // Local file or blob: read first 1MB instantly
      const slice = source.slice(0, 1048576);
      buffer = await slice.arrayBuffer();
    }

    if (!buffer || buffer.byteLength < 16) {
      return null;
    }

    // 1. Try ID3 parser
    const id3Result = parseId3(buffer);
    if (id3Result) {
      return {
        ...id3Result,
        source: 'embedded_file',
      };
    }

    // 2. Try FLAC parser
    const flacResult = parseFlac(buffer);
    if (flacResult) {
      return {
        ...flacResult,
        source: 'embedded_file',
      };
    }
  } catch (error) {
    console.warn('Audio tag extraction skipped:', error);
  }

  return null;
}

/**
 * Automatically detects and fetches metadata (Cover, Year, Genre, Explicit)
 * from multi-source APIs (iTunes, Deezer, proxy) for an individual song or album.
 */
export async function autoDetectOnlineMetadata(
  title: string,
  artist: string,
  album?: string,
  isAlbum = false
): Promise<OnlineDetectedMetadata> {
  const query = [artist, album || title].filter(Boolean).join(' ').trim();
  if (!query) return { coverUrl: null };

  // 1. First attempt: proxy endpoint (server-side, avoids CORS)
  try {
    const params = new URLSearchParams({
      source: 'cover',
      title: title || '',
      artist: artist || '',
    });
    if (album) params.set('album', album);
    if (isAlbum) params.set('isAlbum', 'true');

    const response = await fetch(`/api/metadata?${params.toString()}`);
    if (response.ok) {
      const data = await response.json();
      if (data && (data.coverUrl || data.year || data.genre || data.isExplicit !== undefined)) {
        return {
          coverUrl: data.coverUrl ? String(data.coverUrl).trim() : null,
          year: data.year ? String(data.year).trim() : undefined,
          genre: data.genre ? String(data.genre).trim() : undefined,
          isExplicit: typeof data.isExplicit === 'boolean' ? data.isExplicit : undefined,
          title: data.title ? String(data.title).trim() : undefined,
          artist: data.artist ? cleanArtistSeparators(String(data.artist)) : undefined,
          album: data.album ? String(data.album).trim() : undefined,
        };
      }
    }
  } catch {
    // Continue to direct search
  }

  // 2. Direct iTunes Search API
  try {
    const itunesEntity = isAlbum ? 'album' : 'song';
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
      query
    )}&media=music&entity=${itunesEntity}&limit=6`;

    const res = await fetch(itunesUrl);
    if (res.ok) {
      const data = await res.json();
      const results = Array.isArray(data.results) ? data.results : [];
      if (results.length > 0) {
        const best = results[0];
        let coverUrl: string | null = null;
        const rawArtwork = best.artworkUrl100 || best.artworkUrl60;
        if (typeof rawArtwork === 'string') {
          coverUrl = rawArtwork.replace(/\/\d+x\d+bb\./, '/600x600bb.');
        }

        let year: string | undefined;
        if (typeof best.releaseDate === 'string') {
          year = best.releaseDate.slice(0, 4);
        }

        let genre: string | undefined;
        if (typeof best.primaryGenreName === 'string') {
          genre = best.primaryGenreName;
        }

        const isExplicit = best.trackExplicitness === 'explicit';

        return {
          coverUrl,
          year,
          genre,
          isExplicit,
          title: best.trackName || best.collectionName,
          artist: cleanArtistSeparators(best.artistName),
          album: best.collectionName,
        };
      }
    }
  } catch {
    // Continue to Deezer
  }

  // 3. Direct Deezer Search API
  try {
    const deezerEndpoint = isAlbum ? 'album' : 'track';
    const deezerUrl = `https://api.deezer.com/search/${deezerEndpoint}?q=${encodeURIComponent(
      query
    )}&limit=5`;

    const res = await fetch(deezerUrl);
    if (res.ok) {
      const data = await res.json();
      const items = Array.isArray(data.data) ? data.data : [];
      if (items.length > 0) {
        const best = items[0];
        const artwork = isAlbum
          ? best.cover_xl || best.cover_big || best.cover_medium
          : best.album?.cover_xl || best.album?.cover_big || best.album?.cover_medium;

        let year: string | undefined;
        if (typeof best.release_date === 'string') {
          year = best.release_date.slice(0, 4);
        }

        const isExplicit = !isAlbum && Boolean(best.explicit_lyrics || best.explicit_content_lyrics === 1);

        return {
          coverUrl: typeof artwork === 'string' ? artwork : null,
          year,
          isExplicit,
          title: best.title,
          artist: cleanArtistSeparators(best.artist?.name),
          album: best.album?.title,
        };
      }
    }
  } catch {
    // No cover found
  }

  return { coverUrl: null };
}

/**
 * Automatically detects and fetches high-resolution cover art (iTunes, Deezer, proxy)
 * for an individual song or album.
 */
export async function autoDetectCover(
  title: string,
  artist: string,
  album?: string,
  isAlbum = false
): Promise<string | null> {
  const meta = await autoDetectOnlineMetadata(title, artist, album, isAlbum);
  return meta.coverUrl;
}

/**
 * Convenience helper to detect high-resolution cover art for an album
 */
export async function autoDetectAlbumCover(
  albumTitle: string,
  albumArtist: string
): Promise<string | null> {
  return autoDetectCover('', albumArtist, albumTitle, true);
}
