import { Song } from '../types';

export interface MetadataCandidate {
  title: string;
  artist: string;
  album?: string;
  year?: string;
  genre?: string;
  isrc?: string;
  coverUrl?: string;
  lyricsLrc?: string;
  confidence: number;
  source: string;
  musicbrainzId?: string;
  releaseId?: string;
}

export interface EnrichmentResult {
  updated: Partial<Song>;
  candidate: MetadataCandidate | null;
  needsReview: boolean;
  note: string;
  sources: string[];
}

const MB_USER_AGENT = 'freelymusic/1.0 ( https://freelymusic.vercel.app )';
const MUSICBRAINZ_ENDPOINT = 'https://musicbrainz.org/ws/2/recording/';
const LRCLIB_ENDPOINT = 'https://lrclib.net/api';
const ITUNES_ENDPOINT = 'https://itunes.apple.com/search';

let lastMusicBrainzRequest = 0;
let musicBrainzQueue: Promise<unknown> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(feat\.?|ft\.?|featuring|with)\b.*$/i, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function primaryArtist(value: string): string {
  return normalize((value || '').split(/[,&/]|feat\.?|ft\.?/i)[0]);
}

function textMatch(a: string, b: string): boolean {
  const first = normalize(a);
  const second = normalize(b);
  return Boolean(first && second) && (first === second || first.includes(second) || second.includes(first));
}

async function fetchJsonWithRetry(
  url: string,
  options: RequestInit = {},
  attempts = 2
): Promise<Record<string, unknown>> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.status === 503 && attempt < attempts - 1) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (!response.ok) {
        throw new Error(`La fuente respondió ${response.status}`);
      }
      return (await response.json()) as Record<string, unknown>;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await sleep(1000 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No se pudo consultar la fuente.');
}

async function fetchMetadataProxy(
  params: Record<string, string>
): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`/api/metadata?${new URLSearchParams(params).toString()}`);
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('application/json')) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function musicBrainzFetch(url: string): Promise<Record<string, unknown>> {
  // MusicBrainz asks for at most one request per second per IP.
  let resolveQueue: () => void = () => undefined;
  const previous = musicBrainzQueue;
  musicBrainzQueue = new Promise<void>((resolve) => {
    resolveQueue = resolve;
  });

  await previous;
  const wait = 1100 - (Date.now() - lastMusicBrainzRequest);
  if (wait > 0) await sleep(wait);
  lastMusicBrainzRequest = Date.now();

  try {
    return await fetchJsonWithRetry(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': MB_USER_AGENT,
      },
    }, 2);
  } finally {
    resolveQueue();
  }
}

interface MusicBrainzRecording {
  id?: string;
  score?: number;
  title?: string;
  length?: number;
  'artist-credit'?: Array<{ name?: string }>;
  releases?: Array<{
    id?: string;
    title?: string;
    date?: string;
    'release-group'?: { id?: string; title?: string };
  }>;
  isrcs?: string[];
  tags?: Array<{ name?: string }>;
}

export async function searchMusicBrainz(
  title: string,
  artist: string
): Promise<MetadataCandidate[]> {
  const query = `recording:"${title.replace(/"/g, '')}" AND artist:"${artist.replace(/"/g, '')}"`;
  const url = `${MUSICBRAINZ_ENDPOINT}?query=${encodeURIComponent(query)}&fmt=json&limit=5`;

  let payload = await fetchMetadataProxy({
    source: 'musicbrainz',
    title,
    artist,
  });

  if (!payload || !Array.isArray(payload.recordings)) {
    payload = await musicBrainzFetch(url);
  }

  const recordings = (payload.recordings as MusicBrainzRecording[]) || [];

  return recordings
    .map((recording) => {
      const candidateArtist = (recording['artist-credit'] || [])
        .map((credit) => credit.name || '')
        .filter(Boolean)
        .join(', ');
      const firstRelease = (recording.releases || [])[0];
      const album = firstRelease?.title || firstRelease?.['release-group']?.title;
      const year = firstRelease?.date ? firstRelease.date.slice(0, 4) : undefined;
      const genre = recording.tags?.[0]?.name;
      const baseScore = Number(recording.score) || 0;
      const titleMatches = textMatch(recording.title || '', title);
      const artistMatches =
        textMatch(candidateArtist, artist) ||
        primaryArtist(candidateArtist) === primaryArtist(artist);

      // Do not trust a high search score if the actual title/artist differ.
      const confidence = titleMatches && artistMatches ? baseScore / 100 : baseScore / 160;

      return {
        title: recording.title || title,
        artist: candidateArtist || artist,
        album,
        year,
        genre,
        isrc: recording.isrcs?.[0],
        confidence,
        source: 'MusicBrainz',
        musicbrainzId: recording.id,
        releaseId: firstRelease?.id,
      } satisfies MetadataCandidate;
    })
    .filter((candidate) => candidate.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence);
}

export async function searchLyrics(
  title: string,
  artist: string,
  album?: string,
  duration?: number
): Promise<string | null> {
  const proxyParams: Record<string, string> = {
    source: 'lyrics',
    title,
    artist,
  };
  if (album) proxyParams.album = album;
  if (duration) proxyParams.duration = String(Math.round(duration));

  const proxied = await fetchMetadataProxy(proxyParams);
  if (proxied && typeof proxied.lrc === 'string' && proxied.lrc.trim()) {
    return proxied.lrc;
  }

  const params = new URLSearchParams({
    track_name: title,
    artist_name: artist,
  });
  if (album) params.set('album_name', album);
  if (duration) params.set('duration', String(Math.round(duration)));

  try {
    const exact = await fetchJsonWithRetry(`${LRCLIB_ENDPOINT}/get?${params.toString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': MB_USER_AGENT },
    }, 3);
    const synced = exact.syncedLyrics;
    if (typeof synced === 'string' && synced.trim()) return synced;
  } catch {
    // Fall back to search below.
  }

  try {
    const searchParams = new URLSearchParams({
      track_name: title,
      artist_name: artist,
    });
    const payload = await fetchJsonWithRetry(
      `${LRCLIB_ENDPOINT}/search?${searchParams.toString()}`,
      { headers: { Accept: 'application/json', 'User-Agent': MB_USER_AGENT } },
      3
    );
    const results = Array.isArray(payload) ? payload : [];
    const candidates = results
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as Record<string, unknown>).syncedLyrics === 'string'
      )
      .map((item) => {
        const trackName = String(item.trackName || '');
        const artistName = String(item.artistName || '');
        const itemDuration = Number(item.duration);
        const durationPenalty =
          duration && Number.isFinite(itemDuration)
            ? Math.min(Math.abs(itemDuration - duration), 60)
            : 30;
        return {
          lrc: String(item.syncedLyrics || ''),
          score:
            (textMatch(trackName, title) ? 1 : 0) +
            (textMatch(artistName, artist) ? 1 : 0) -
            durationPenalty / 60,
        };
      })
      .sort((a, b) => b.score - a.score);

    return candidates[0]?.lrc || null;
  } catch {
    return null;
  }
}

export async function searchCover(
  title: string,
  artist: string,
  album?: string
): Promise<string | null> {
  const query = [artist, album || title].filter(Boolean).join(' ');
  const url = `${ITUNES_ENDPOINT}?term=${encodeURIComponent(query)}&entity=album&limit=8`;

  try {
    const payload = await fetchJsonWithRetry(url, { headers: { Accept: 'application/json' } }, 2);
    const results = (payload.results as Array<Record<string, unknown>>) || [];
    const best = results
      .filter(
        (item) =>
          textMatch(String(item.artistName || ''), artist) ||
          textMatch(String(item.collectionName || ''), album || title)
      )
      .sort((a, b) => Number(b.collectionId || 0) - Number(a.collectionId || 0))[0];

    const artwork = best?.artworkUrl100;
    if (typeof artwork === 'string') {
      return artwork.replace(/\/\d+x\d+bb\./, '/600x600bb.');
    }
  } catch {
    // no cover
  }

  return null;
}

function hasMissingMetadata(song: Song): boolean {
  return (
    !song.album ||
    song.album.trim().toLowerCase() === 'sencillo' ||
    !song.coverUrl ||
    !song.lyricsLrc ||
    !song.year ||
    !song.genre ||
    song.genre.trim().toLowerCase() === 'general'
  );
}

export async function enrichSongMetadata(song: Song): Promise<EnrichmentResult> {
  const missingAlbum = !song.album || song.album.trim().toLowerCase() === 'sencillo';
  const missingCover = !song.coverUrl;
  const missingLyrics = !song.lyricsLrc?.trim();
  const missingYear = !song.year;
  const missingGenre = !song.genre || song.genre.trim().toLowerCase() === 'general';
  const missingIsrc = !song.isrc;

  if (!hasMissingMetadata(song)) {
    return {
      updated: {},
      candidate: null,
      needsReview: false,
      note: 'La canción ya tiene los metadatos principales completos.',
      sources: [],
    };
  }

  const sources: string[] = [];
  let candidates: MetadataCandidate[] = [];

  try {
    candidates = await searchMusicBrainz(song.title, song.artist);
    if (candidates.length > 0) sources.push('MusicBrainz');
  } catch (error) {
    console.warn('MusicBrainz no respondió:', error);
  }

  const best = candidates.find((candidate) => candidate.confidence >= 0.9) || null;
  const updated: Partial<Song> = {};

  if (best) {
    if (missingAlbum && best.album) updated.album = best.album;
    if (missingYear && best.year) updated.year = best.year;
    if (missingGenre && best.genre) updated.genre = best.genre;
    if (missingIsrc && best.isrc) updated.isrc = best.isrc;
  }

  if (missingCover) {
    const cover = await searchCover(
      song.title,
      song.artist,
      best?.album || (missingAlbum ? undefined : song.album)
    );
    if (cover) {
      updated.coverUrl = cover;
      sources.push('iTunes');
    }
  }

  if (missingLyrics) {
    const lyrics = await searchLyrics(
      song.title,
      song.artist,
      best?.album || song.album,
      song.duration
    );
    if (lyrics) {
      updated.lyricsLrc = lyrics;
      sources.push('LRCLIB');
    }
  }

  if (Object.keys(updated).length > 0) {
    return {
      updated,
      candidate: best || candidates[0] || null,
      needsReview: false,
      note: `Campos completados: ${Object.keys(updated).join(', ')}.`,
      sources: Array.from(new Set(sources)),
    };
  }

  if (candidates.length > 0) {
    return {
      updated: {},
      candidate: candidates[0],
      needsReview: true,
      note: 'Hay un candidato, pero no tiene confianza suficiente. Revísalo antes de aplicarlo.',
      sources: Array.from(new Set(sources)),
    };
  }

  return {
    updated: {},
    candidate: null,
    needsReview: true,
    note: 'No se encontró una coincidencia verificable. La canción queda pendiente de revisión.',
    sources: Array.from(new Set(sources)),
  };
}

export function buildManualUpdate(
  song: Song,
  candidate: MetadataCandidate
): Partial<Song> {
  const updated: Partial<Song> = {};

  if ((!song.album || song.album.trim().toLowerCase() === 'sencillo') && candidate.album) {
    updated.album = candidate.album;
  }
  if (!song.coverUrl && candidate.coverUrl) updated.coverUrl = candidate.coverUrl;
  if (!song.year && candidate.year) updated.year = candidate.year;
  if ((!song.genre || song.genre.trim().toLowerCase() === 'general') && candidate.genre) {
    updated.genre = candidate.genre;
  }
  if (!song.isrc && candidate.isrc) updated.isrc = candidate.isrc;
  if (!song.lyricsLrc && candidate.lyricsLrc) updated.lyricsLrc = candidate.lyricsLrc;

  return updated;
}

export function songNeedsEnrichment(song: Song): boolean {
  return song.needsReview === true || hasMissingMetadata(song);
}

/**
 * Searches for an official high-resolution artist portrait image across Deezer & iTunes.
 */
export async function searchArtistAvatar(artistName: string): Promise<string | null> {
  const clean = (artistName || '').trim();
  if (!clean) return null;

  try {
    const url = `https://api.deezer.com/search/artist?q=${encodeURIComponent(clean)}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (response.ok) {
      const data = await response.json();
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        const sorted = [...data.data].sort((a, b) => Number(b.nb_fan || 0) - Number(a.nb_fan || 0));
        const match = sorted.find((item) => textMatch(String(item.name || ''), clean)) || sorted[0];
        if (
          match &&
          typeof match.picture_xl === 'string' &&
          match.picture_xl &&
          !match.picture_xl.includes('/artist//')
        ) {
          return match.picture_xl;
        }
      }
    }
  } catch (err) {
    console.warn('Error buscando avatar de artista en Deezer:', clean, err);
  }

  // Fallback: iTunes album artwork for this artist
  try {
    const itunesUrl = `${ITUNES_ENDPOINT}?term=${encodeURIComponent(clean)}&entity=album&limit=3`;
    const res = await fetch(itunesUrl, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const itunesData = await res.json();
      const results = (itunesData.results as Array<Record<string, unknown>>) || [];
      if (results[0]?.artworkUrl100 && typeof results[0].artworkUrl100 === 'string') {
        return results[0].artworkUrl100.replace(/\/\d+x\d+bb\./, '/600x600bb.');
      }
    }
  } catch {
    // ignore
  }

  return null;
}

