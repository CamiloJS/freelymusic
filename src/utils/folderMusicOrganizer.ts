import JSZip from 'jszip';
import { Song } from '../types';
import { cleanArtistSeparators, splitArtistNames, parseAudioUrlMetadata } from './urlMetadataParser';
import { extractMetadataFromAudioSource, autoDetectOnlineMetadata } from './audioCoverExtractor';
import { searchLyrics } from '../services/metadataEnrichment';
import { detectAudioDuration } from './audioDuration';

export interface RawFolderItem {
  name: string;
  relativePath: string;
  file?: File;
  blob?: Blob;
  url?: string;
  size?: number;
}

export interface CandidateTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  duration: number;
  coverUrl: string;
  audioUrl: string;
  lyricsLrc: string;
  isExplicit: boolean;
  file?: File;
  blob?: Blob;
  relativePath: string;
  isDuplicate: boolean;
  selected: boolean;
  duplicateInfo?: string;
}

export interface CandidateAlbum {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  year: string;
  genre: string;
  tracks: CandidateTrack[];
}

export interface FolderAnalysisResult {
  albums: CandidateAlbum[];
  singles: CandidateTrack[];
  totalTracks: number;
  duplicateCount: number;
  newTracksCount: number;
  unsupportedCount: number;
  sourceNote?: string;
}

const AUDIO_EXT_REGEX = /\.(mp3|flac|m4a|wav|aac|ogg|opus)$/i;
const IMAGE_EXT_REGEX = /\.(jpg|jpeg|png|webp|gif)$/i;
const DEFAULT_FALLBACK_COVER =
  'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=600&q=80';

/**
 * Normalizes text for comparison (removes accents, trim, lowercase)
 */
export function normalizeTextForComparison(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Checks if a candidate track already exists in the catalog
 */
export function isTrackDuplicateInCatalog(
  candidate: { title: string; artist: string; audioUrl?: string },
  catalog: Song[]
): boolean {
  if (!catalog || catalog.length === 0) return false;

  const normCandidateTitle = normalizeTextForComparison(candidate.title);
  const normCandidateArtist = normalizeTextForComparison(cleanArtistSeparators(candidate.artist));

  for (const existing of catalog) {
    if (candidate.audioUrl && existing.audioUrl && candidate.audioUrl.trim() === existing.audioUrl.trim()) {
      return true;
    }

    const normExistingTitle = normalizeTextForComparison(existing.title);
    const normExistingArtist = normalizeTextForComparison(cleanArtistSeparators(existing.artist));

    if (normCandidateTitle && normExistingTitle && normCandidateTitle === normExistingTitle) {
      if (!normCandidateArtist || !normExistingArtist) {
        return true;
      }
      if (
        normCandidateArtist === normExistingArtist ||
        normCandidateArtist.includes(normExistingArtist) ||
        normExistingArtist.includes(normCandidateArtist)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extracts folder/directory name from relativePath.
 * E.g. "Raras/Marina POP D/01 - BUTTERFLY.mp3" -> "Marina POP D"
 * E.g. "Single Song.mp3" -> ""
 */
export function extractAlbumFromPath(relativePath: string): string {
  if (!relativePath) return '';
  const parts = relativePath.split(/[/\\]+/).filter(Boolean);
  // If at least 2 parts (Folder/Song.mp3 or Root/Album/Song.mp3)
  if (parts.length >= 2) {
    // The directory containing the file is the second to last part
    const parentFolder = parts[parts.length - 2];
    // Ignore generic root folder names like "Raras", "Music", "Descargas" if deeper folder exists
    return parentFolder.trim();
  }
  return '';
}

/**
 * Unpacks a ZIP file into an array of RawFolderItem
 */
export async function unpackZipFile(zipBlobOrFile: Blob | File): Promise<RawFolderItem[]> {
  const zip = await JSZip.loadAsync(zipBlobOrFile);
  const items: RawFolderItem[] = [];

  const promises: Promise<void>[] = [];
  zip.forEach((relativePath, entry) => {
    if (entry.dir) return;

    // Skip hidden Mac OS and metadata files
    if (relativePath.includes('__MACOSX') || entry.name.startsWith('._')) return;

    promises.push(
      (async () => {
        const blob = await entry.async('blob');
        items.push({
          name: entry.name,
          relativePath,
          blob,
          size: blob.size,
        });
      })()
    );
  });

  await Promise.all(promises);
  return items;
}

/**
 * Analyzes and organizes an array of folder/zip files into Albums and Singles,
 * ensuring metadata detection, shared album covers, and duplicate prevention.
 */
export async function organizeFolderMusic(
  rawItems: RawFolderItem[],
  existingCatalog: Song[],
  onProgress?: (processed: number, total: number, currentName: string) => void
): Promise<FolderAnalysisResult> {
  const audioItems = rawItems.filter((item) => AUDIO_EXT_REGEX.test(item.name || item.relativePath));
  const imageItems = rawItems.filter((item) => IMAGE_EXT_REGEX.test(item.name || item.relativePath));
  const unsupportedCount = rawItems.length - audioItems.length - imageItems.length;

  if (audioItems.length === 0) {
    return {
      albums: [],
      singles: [],
      totalTracks: 0,
      duplicateCount: 0,
      newTracksCount: 0,
      unsupportedCount,
    };
  }

  // Pre-index folder companion images (e.g. folder.jpg, cover.jpg in directory)
  const folderImagesMap = new Map<string, string>(); // dirPath -> objectUrl
  for (const imgItem of imageItems) {
    const parts = imgItem.relativePath.split(/[/\\]+/).filter(Boolean);
    const dirKey = parts.length > 1 ? parts.slice(0, parts.length - 1).join('/') : '';
    if (imgItem.blob || imgItem.file) {
      const srcBlob = imgItem.blob || imgItem.file!;
      const url = URL.createObjectURL(srcBlob);
      if (!folderImagesMap.has(dirKey) || /cover|folder|front/i.test(imgItem.name)) {
        folderImagesMap.set(dirKey, url);
      }
    }
  }

  const processedTracks: CandidateTrack[] = [];
  let processedCount = 0;

  for (const item of audioItems) {
    processedCount++;
    onProgress?.(processedCount, audioItems.length, item.name);

    const sourceData = item.file || item.blob || item.url || '';
    const parsedUrl = parseAudioUrlMetadata(item.url || item.name);
    const folderAlbumName = extractAlbumFromPath(item.relativePath);

    let title = parsedUrl.title || item.name.replace(AUDIO_EXT_REGEX, '').trim();
    let artist = parsedUrl.artists.join(', ');
    let album = folderAlbumName;
    let year = parsedUrl.year || '2026';
    let genre = '';
    let isExplicit = Boolean(parsedUrl.isExplicit);
    let coverUrl = '';
    let lyricsLrc = '';
    let duration = 0;

    // 1. Extract embedded ID3 / FLAC metadata
    try {
      if (sourceData) {
        const extracted = await extractMetadataFromAudioSource(sourceData);
        if (extracted) {
          if (extracted.title) title = extracted.title.trim();
          if (extracted.artist) {
            const split = splitArtistNames(extracted.artist);
            artist = split.length > 0 ? split.join(', ') : cleanArtistSeparators(extracted.artist);
          }
          if (extracted.album && extracted.album.trim()) {
            album = extracted.album.trim();
          }
          if (extracted.year) year = extracted.year;
          if (extracted.genre) genre = extracted.genre;
          if (extracted.isExplicit !== undefined) isExplicit = Boolean(extracted.isExplicit);
          if (extracted.coverUrl) coverUrl = extracted.coverUrl;
          if (extracted.lyrics) lyricsLrc = extracted.lyrics;
        }
      }
    } catch {
      // non-blocking
    }

    // 2. Check for companion folder cover image if embedded was missing
    if (!coverUrl) {
      const parts = item.relativePath.split(/[/\\]+/).filter(Boolean);
      const dirKey = parts.length > 1 ? parts.slice(0, parts.length - 1).join('/') : '';
      if (folderImagesMap.has(dirKey)) {
        coverUrl = folderImagesMap.get(dirKey)!;
      }
    }

    // 3. Fallback duration detection
    try {
      if (item.url) {
        const d = await detectAudioDuration(item.url);
        if (d > 0) duration = d;
      }
    } catch {}

    // Clean artists: ensure commas, never slashes
    artist = cleanArtistSeparators(artist);

    // Clean title: remove [Explicit] tags from title text
    if (/[\(\[]\s*(?:explicit|dirty|uncensored|explicito|explícito|e)\s*[\)\]]/i.test(title)) {
      isExplicit = true;
      title = title.replace(/[\(\[]\s*(?:explicit|dirty|uncensored|explicito|explícito|e)\s*[\)\]]/gi, '').trim();
    }

    // 4. Duplicate check against existing catalog
    const isDuplicate = isTrackDuplicateInCatalog({ title, artist, audioUrl: item.url }, existingCatalog);

    processedTracks.push({
      id: `folder-track-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title,
      artist: artist || 'Artista Desconocido',
      album: album || '',
      year: year || '2026',
      genre: genre || 'Pop',
      duration: duration || 180,
      coverUrl: coverUrl || '',
      audioUrl: item.url || '',
      lyricsLrc,
      isExplicit,
      file: item.file,
      blob: item.blob,
      relativePath: item.relativePath,
      isDuplicate,
      selected: !isDuplicate,
      duplicateInfo: isDuplicate ? 'Ya existe en tu biblioteca' : undefined,
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Grouping: Albums vs Singles
  // ---------------------------------------------------------------------------
  const albumGroupsMap = new Map<string, CandidateTrack[]>();
  const singles: CandidateTrack[] = [];

  for (const track of processedTracks) {
    const rawAlbum = track.album?.trim();
    if (rawAlbum) {
      const albumKey = rawAlbum.toLowerCase();
      if (!albumGroupsMap.has(albumKey)) {
        albumGroupsMap.set(albumKey, []);
      }
      albumGroupsMap.get(albumKey)!.push(track);
    } else {
      singles.push(track);
    }
  }

  const candidateAlbums: CandidateAlbum[] = [];

  for (const [albumKey, tracks] of albumGroupsMap.entries()) {
    // If 2 or more tracks share the same album -> Treat as Album!
    if (tracks.length >= 2) {
      // Find the first track with a cover art
      const firstWithCover = tracks.find((t) => Boolean(t.coverUrl));
      const sharedCover = firstWithCover?.coverUrl || DEFAULT_FALLBACK_COVER;

      // Find the most common artist, year, genre
      const albumTitle = tracks[0].album;
      const albumArtist = tracks[0].artist;
      const albumYear = tracks.find((t) => Boolean(t.year && t.year !== '2026'))?.year || tracks[0].year || '2026';
      const albumGenre = tracks.find((t) => Boolean(t.genre && t.genre !== 'Pop'))?.genre || tracks[0].genre || 'Pop';

      // Propagate shared album cover, year, genre to ALL tracks in this album!
      for (const track of tracks) {
        track.coverUrl = sharedCover;
        if (!track.year || track.year === '2026') track.year = albumYear;
        if (!track.genre || track.genre === 'Pop') track.genre = albumGenre;
      }

      candidateAlbums.push({
        id: `album-${albumKey}-${Date.now()}`,
        title: albumTitle,
        artist: albumArtist,
        coverUrl: sharedCover,
        year: albumYear,
        genre: albumGenre,
        tracks,
      });
    } else {
      // Single track album -> Treat as Individual Song (Single)
      singles.push(...tracks);
    }
  }

  // For singles without covers, apply default cover
  for (const single of singles) {
    if (!single.coverUrl) {
      single.coverUrl = DEFAULT_FALLBACK_COVER;
    }
  }

  const duplicateCount = processedTracks.filter((t) => t.isDuplicate).length;
  const newTracksCount = processedTracks.filter((t) => !t.isDuplicate).length;

  return {
    albums: candidateAlbums,
    singles,
    totalTracks: processedTracks.length,
    duplicateCount,
    newTracksCount,
    unsupportedCount,
  };
}

/**
 * Fetches and organizes an online ZIP or folder URL.
 * Handles File Garden empty zip responses, direct ZIPs, and text/HTML containing audio links.
 */
export async function fetchAndOrganizeRemoteFolder(
  targetUrl: string,
  existingCatalog: Song[],
  onProgress?: (processed: number, total: number, currentName: string) => void
): Promise<FolderAnalysisResult> {
  const trimmed = targetUrl.trim();
  if (!trimmed) {
    throw new Error('Por favor ingresa un enlace o lista de enlaces válida.');
  }

  // 1. Check if user pasted a batch list of direct audio links (e.g. from File Garden)
  const directAudioMatches = Array.from(
    trimmed.matchAll(/https?:\/\/[^\s"'<>]+\.(?:mp3|flac|m4a|wav|aac|ogg|opus)(?:\?[^\s"'<>]*)?/gi)
  ).map((m) => m[0]);

  const uniqueDirectUrls = Array.from(new Set(directAudioMatches));
  const hasMultipleLinesOrSpaces = trimmed.includes('\n') || trimmed.includes('\r') || trimmed.includes(',');

  if (uniqueDirectUrls.length > 1 || (uniqueDirectUrls.length === 1 && hasMultipleLinesOrSpaces) || (uniqueDirectUrls.length === 1 && !trimmed.toLowerCase().endsWith('.zip'))) {
    const rawItems: RawFolderItem[] = uniqueDirectUrls.map((url) => {
      const parsed = parseAudioUrlMetadata(url);
      const filename = url.split('/').pop()?.split('?')[0] || 'song.mp3';
      const cleanName = decodeURIComponent(filename);
      return {
        name: parsed.title ? `${parsed.title}.mp3` : cleanName,
        relativePath: cleanName,
        url,
      };
    });
    return organizeFolderMusic(rawItems, existingCatalog, onProgress);
  }

  // 2. Single remote URL: check if it's a ZIP or remote directory/webpage
  const res = await fetch(trimmed);
  if (!res.ok) {
    throw new Error(`El servidor respondió con error HTTP ${res.status}: ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type') || '';
  const isZip =
    contentType.includes('application/zip') ||
    contentType.includes('application/x-zip') ||
    trimmed.toLowerCase().endsWith('.zip');

  if (isZip) {
    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength <= 22) {
      return {
        albums: [],
        singles: [],
        totalTracks: 0,
        duplicateCount: 0,
        newTracksCount: 0,
        unsupportedCount: 0,
        sourceNote:
          'El enlace de carpeta de File Garden devolvió 0 archivos porque File Garden restringe la descarga masiva de carpetas sin sesión activa en su web. ¡No te preocupes! En Sonora tus canciones se reproducen por streaming sin gastar tu 1 GB de espacio: copia los enlaces directos de tus canciones desde File Garden y pégalos aquí en la lista para organizarlas automáticamente.',
      };
    }

    const zipBlob = new Blob([arrayBuf], { type: 'application/zip' });
    const items = await unpackZipFile(zipBlob);
    return organizeFolderMusic(items, existingCatalog, onProgress);
  }

  // If not zip, check if it contains audio links in HTML or plain text response
  const text = await res.text();
  const urlMatches = Array.from(
    text.matchAll(/https?:\/\/[^\s"'<>]+\.(?:mp3|flac|m4a|wav|aac|ogg|opus)(?:\?[^\s"'<>]*)?/gi)
  ).map((m) => m[0]);

  const uniqueUrls = Array.from(new Set(urlMatches));
  if (uniqueUrls.length > 0) {
    const rawItems: RawFolderItem[] = uniqueUrls.map((url) => {
      const parsed = parseAudioUrlMetadata(url);
      const filename = url.split('/').pop()?.split('?')[0] || 'song.mp3';
      const cleanName = decodeURIComponent(filename);
      return {
        name: parsed.title ? `${parsed.title}.mp3` : cleanName,
        relativePath: cleanName,
        url,
      };
    });
    return organizeFolderMusic(rawItems, existingCatalog, onProgress);
  }

  throw new Error(
    'No se encontraron canciones en este enlace. Puedes pegar los enlaces directos (.mp3) de File Garden, uno por línea, para auto-clasificarlos por streaming sin gastar espacio en la página.'
  );
}
