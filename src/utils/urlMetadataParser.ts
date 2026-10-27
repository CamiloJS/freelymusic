/**
 * Utility to extract clean music metadata (Title, Artist(s), Track Number)
 * from direct audio URLs or filenames.
 */

export interface ParsedUrlMetadata {
  title: string;
  artists: string[];
  trackNumber?: number;
  discNumber?: number;
  year?: string;
  isExplicit?: boolean;
}

/**
 * Normalizes artist strings so multiple artists are separated by commas and never slashes.
 * E.g. "J Balvin/Bad Bunny" -> "J Balvin, Bad Bunny"
 */
export function cleanArtistSeparators(artistStr: string): string {
  if (!artistStr || typeof artistStr !== 'string') return '';
  return artistStr
    .split(/\s*[\/\\]+\s*/)
    .flatMap((part) => part.split(/\s*,\s*/))
    .map((a) => a.trim())
    .filter(Boolean)
    .join(', ');
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

  // Detect explicit flag from filename tag before stripping
  let isExplicit: boolean | undefined;
  if (
    /[\(\[\s_.-](?:explicit|dirty|uncensored|explicito|explícito)[\)\]\s_.-]?/i.test(raw) ||
    /[\(\[]\s*e\s*[\)\]]/i.test(raw)
  ) {
    isExplicit = true;
    raw = raw
      .replace(/[\(\[]\s*(?:explicit|dirty|uncensored|explicito|explícito|e)\s*[\)\]]/gi, '')
      .replace(/[\s_.-]+(?:explicit|dirty|uncensored|explicito|explícito)\b/gi, '')
      .trim();
  }

  // Detect release year from filename tag (e.g. "(2023)", "[2022]", "_2021_")
  let year: string | undefined;
  const yearMatch = raw.match(/[\(\[\s_-](19\d{2}|20\d{2})[\)\]\s_-]/);
  if (yearMatch) {
    year = yearMatch[1];
    raw = raw.replace(yearMatch[0], ' ').trim();
  }

  // If underscore replaces spaces like "Aitana_-_4to_Azul", preserve " - " separators
  // Replace "_-_" with " - ", then replace remaining single underscores with space
  raw = raw.replace(/_-_/g, ' - ').replace(/_/g, ' ');

  // Extract disc number and/or leading track number (e.g. "1-01", "2.05", "CD1-02", "01 -", "Track 01 -")
  let discNumber: number | undefined;
  let trackNumber: number | undefined;

  const explicitDiscMatch = raw.match(/^(?:cd|disc|disco)\s*([1-9])[-.]?(\d{1,3})?(?:[.\s-]+)\s*(.+)$/i);
  const implicitDiscMatch = raw.match(/^([1-9])[-.](\d{1,2})(?:[.\s-]+)\s*(.+)$/i);

  if (explicitDiscMatch) {
    discNumber = parseInt(explicitDiscMatch[1], 10);
    if (explicitDiscMatch[2]) {
      trackNumber = parseInt(explicitDiscMatch[2], 10);
    }
    raw = explicitDiscMatch[3].trim();
  } else if (implicitDiscMatch && !/^\d+-\d{3,}/.test(raw)) {
    discNumber = parseInt(implicitDiscMatch[1], 10);
    trackNumber = parseInt(implicitDiscMatch[2], 10);
    raw = implicitDiscMatch[3].trim();
  } else {
    const trackNumMatch = !/^\d+-\d{3,}/.test(raw)
      ? raw.match(/^(?:track\s*)?(\d{1,3})(?:[.\s-]+)\s*(.+)$/i)
      : null;
    if (trackNumMatch) {
      trackNumber = parseInt(trackNumMatch[1], 10);
      raw = trackNumMatch[2].trim();
    }
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
    artists: artists.map((a) => cleanArtistSeparators(a).trim()).filter(Boolean),
    trackNumber,
    discNumber,
    year,
    isExplicit,
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
    .replace(/\[\s*(?:320kbps|128kbps|flac|hq|official audio|official video|audio|video|lyrics|explicit|dirty|uncensored|explicito|explícito|e)\s*\]/gi, '')
    .replace(/\(\s*(?:official audio|official video|audio|video|lyrics|explicit|dirty|uncensored|explicito|explícito|e)\s*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
