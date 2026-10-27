/**
 * Utility to extract clean music metadata (Title, Artist(s), Track Number)
 * from direct audio URLs or filenames.
 */

export interface ParsedUrlMetadata {
  title: string;
  artists: string[];
  trackNumber?: number;
}

export function parseAudioUrlMetadata(urlOrPath: string): ParsedUrlMetadata {
  if (!urlOrPath || typeof urlOrPath !== 'string') {
    return { title: '', artists: [] };
  }

  let raw = urlOrPath.trim();

  // Extract filename portion from URL or path
  try {
    if (raw.includes('://')) {
      const parsedUrl = new URL(raw);
      raw = parsedUrl.pathname.split('/').pop() || '';
    } else {
      raw = raw.split(/[/\\]/).pop() || '';
    }
  } catch {
    raw = raw.split(/[/\\]/).pop() || '';
  }

  // Remove URL query string / hash if still present
  raw = raw.split(/[?#]/)[0];

  // Decode URI encoding (%20, etc.)
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // keep as is if malformed
  }

  // Remove audio extensions
  raw = raw.replace(/\.(mp3|wav|flac|m4a|aac|ogg|opus|wma)(\?.*)?$/i, '').trim();

  // If underscore replaces spaces like "Aitana_-_4to_Azul", preserve " - " separators
  // Replace "_-_" with " - ", then replace remaining single underscores with space
  raw = raw.replace(/_-_/g, ' - ').replace(/_/g, ' ');

  // Extract and remove leading track number (e.g. "01.", "01 -", "01 ", "Track 01 -")
  let trackNumber: number | undefined;
  const trackNumMatch = raw.match(/^(?:track\s*)?(\d{1,3})(?:[.\s-]+)\s*(.+)$/i);
  if (trackNumMatch) {
    trackNumber = parseInt(trackNumMatch[1], 10);
    raw = trackNumMatch[2].trim();
  }

  let title = '';
  let artists: string[] = [];

  // Check if string contains " - " or " – " or " — "
  const dashSeparator = /\s+[-–—]\s+/;
  if (dashSeparator.test(raw)) {
    const parts = raw.split(dashSeparator);
    const leftPart = (parts[0] || '').trim();
    const rightPart = (parts.slice(1).join(' - ') || '').trim();

    // In music naming standard: "Artist - Title"
    if (leftPart && rightPart) {
      artists = splitArtistNames(leftPart);
      title = cleanSongTitle(rightPart);
    } else {
      title = cleanSongTitle(raw);
    }
  } else {
    // If no dash separator, check if format is "Title (feat. Artist)" or just Title
    const featMatch = raw.match(/^(.+?)\s*[\(\[](?:feat\.?|ft\.?|featuring)\s+([^\)\]]+)[\)\]]\s*$/i);
    if (featMatch) {
      title = cleanSongTitle(featMatch[1]);
      artists = splitArtistNames(featMatch[2]);
    } else {
      title = cleanSongTitle(raw);
    }
  }

  // Also check if title itself has "(feat. Artist)" or "[feat. Artist]"
  const titleFeatMatch = title.match(/^(.+?)\s*[\(\[](?:feat\.?|ft\.?|featuring)\s+([^\)\]]+)[\)\]]\s*$/i);
  if (titleFeatMatch) {
    const baseTitle = titleFeatMatch[1].trim();
    const featArtists = splitArtistNames(titleFeatMatch[2]);
    title = baseTitle;
    artists = Array.from(new Set([...artists, ...featArtists]));
  }

  return {
    title: title.trim(),
    artists: artists.map((a) => a.trim()).filter(Boolean),
    trackNumber,
  };
}

/**
 * Splits multiple artists by commas, ampersands, slashes, or feat/ft
 */
export function splitArtistNames(artistStr: string): string[] {
  if (!artistStr) return [];
  return artistStr
    .split(/[,/&]|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\bwith\b/i)
    .map((a) => a.replace(/^[\s,]+|[\s,]+$/g, '').trim())
    .filter(Boolean);
}

/**
 * Cleans song title (removes extraneous bitrate / site promos like [320kbps])
 */
function cleanSongTitle(rawTitle: string): string {
  return rawTitle
    .replace(/\[\s*(?:320kbps|128kbps|flac|hq|official audio|official video|audio|video|lyrics)\s*\]/gi, '')
    .replace(/\(\s*(?:official audio|official video|audio|video|lyrics)\s*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
