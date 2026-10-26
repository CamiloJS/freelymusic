import { Song } from '../types';

export type PlaylistProvider = 'spotify' | 'deezer' | 'apple-music' | 'text';

export interface ImportedTrack {
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  isrc?: string;
  providerId?: string;
}

export interface ImportedPlaylist {
  name: string;
  description?: string;
  provider: PlaylistProvider;
  sourceUrl?: string;
  tracks: ImportedTrack[];
}

export interface TrackMatch {
  track: ImportedTrack;
  songId?: string;
  confidence: number;
  reason: string;
}

export interface PlaylistMatchReport {
  matches: TrackMatch[];
  matched: number;
  unmatched: number;
}

function normalize(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(feat\.?|ft\.?|featuring|with)\b.*$/i, ' ')
    .replace(
      /\b(remaster(ed)?|deluxe|version|edition|official|video|audio|lyric(s)?|explicit|clean|bonus|track)\b/gi,
      ' '
    )
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function primaryArtist(value: string): string {
  return normalize((value || '').split(/[,&/]|feat\.?|ft\.?/i)[0]);
}

function bigrams(value: string): string[] {
  const clean = value.replace(/\s+/g, ' ');
  if (clean.length < 2) return [clean];
  const result: string[] = [];
  for (let index = 0; index < clean.length - 1; index += 1) {
    result.push(clean.slice(index, index + 2));
  }
  return result;
}

function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  // Never use the substring shortcut for very short strings: "m" is contained
  // in "cumpleanos" and would otherwise produce absurd matches.
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) {
    return 0.85;
  }

  const first = bigrams(a);
  const second = bigrams(b);
  const pool = [...second];

  let overlaps = 0;
  first.forEach((gram) => {
    const index = pool.indexOf(gram);
    if (index >= 0) {
      overlaps += 1;
      pool.splice(index, 1);
    }
  });

  return (2 * overlaps) / (first.length + second.length);
}

function durationScore(a?: number, b?: number): number {
  if (!a || !b) return 0;
  const difference = Math.abs(a - b);
  return Math.max(0, 1 - difference / 30);
}

function scoreCandidate(track: ImportedTrack, song: Song): number {
  if (track.isrc && song.isrc && track.isrc.toLowerCase() === song.isrc.toLowerCase()) {
    return 1;
  }

  const titleScore = diceCoefficient(normalize(track.title), normalize(song.title));
  const artistScore = track.artist
    ? Math.max(
        diceCoefficient(normalize(track.artist), normalize(song.artist)),
        diceCoefficient(primaryArtist(track.artist), primaryArtist(song.artist))
      )
    : 0;
  const albumScore =
    track.album && song.album
      ? diceCoefficient(normalize(track.album), normalize(song.album))
      : 0;
  const duration = durationScore(track.duration, song.duration);

  if (!track.artist) {
    return Math.min(0.95, titleScore * 0.88 + duration * 0.12);
  }

  return titleScore * 0.68 + artistScore * 0.25 + albumScore * 0.04 + duration * 0.03;
}

function matchOneOrientation(
  track: ImportedTrack,
  catalog: Song[]
): { song: Song; confidence: number } | null {
  let best: { song: Song; confidence: number } | null = null;

  for (const song of catalog) {
    const confidence = scoreCandidate(track, song);
    if (best === null || confidence > best.confidence) {
      best = { song, confidence };
    }
  }

  if (best === null) return null;

  const titleScore = diceCoefficient(normalize(track.title), normalize(best.song.title));
  const artistScore = track.artist
    ? Math.max(
        diceCoefficient(normalize(track.artist), normalize(best.song.artist)),
        diceCoefficient(primaryArtist(track.artist), primaryArtist(best.song.artist))
      )
    : 1;

  if (!track.isrc && (titleScore < 0.62 || artistScore < 0.4)) return null;
  if (best.confidence < 0.68) return null;
  return best;
}

export function matchTrack(track: ImportedTrack, catalog: Song[]): TrackMatch {
  const direct = matchOneOrientation(track, catalog);

  // Text imports can be written as "Title - Artist" instead of "Artist - Title".
  const swapped =
    track.artist && track.title
      ? matchOneOrientation({ ...track, title: track.artist, artist: track.title }, catalog)
      : null;

  const best =
    direct && swapped
      ? direct.confidence >= swapped.confidence
        ? direct
        : swapped
      : direct || swapped;

  if (!best) {
    return {
      track,
      confidence: 0,
      reason: 'Sin coincidencia fiable en tu catálogo',
    };
  }

  let reason = 'Coincidencia por título y artista';
  if (track.isrc && best.song.isrc && track.isrc === best.song.isrc) {
    reason = 'Coincidencia exacta por ISRC';
  } else if (best.confidence >= 0.9) {
    reason = 'Coincidencia muy alta';
  } else if (best.confidence >= 0.75) {
    reason = 'Coincidencia alta';
  }

  return {
    track,
    songId: best.song.id,
    confidence: best.confidence,
    reason,
  };
}

export function matchPlaylistTracks(
  tracks: ImportedTrack[],
  catalog: Song[]
): PlaylistMatchReport {
  const matches = tracks.map((track) => matchTrack(track, catalog));
  const matched = matches.filter((match) => Boolean(match.songId)).length;

  return {
    matches,
    matched,
    unmatched: matches.length - matched,
  };
}

export function parseTextPlaylist(text: string): ImportedTrack[] {
  const seen = new Set<string>();
  const tracks: ImportedTrack[] = [];

  text.split(/\r?\n/).forEach((rawLine) => {
    let line = rawLine.trim();
    if (!line || /^#|^\/\//.test(line)) return;

    line = line.replace(/^\d+[.)\-\s]+/, '').trim();
    line = line.replace(/^[-*•]\s*/, '').trim();
    if (!line) return;

    const parts = line.split(/\s+[-–—]\s+|\t+/).map((part) => part.trim()).filter(Boolean);
    let title = '';
    let artist = '';

    if (parts.length >= 2) {
      artist = parts[0];
      title = parts.slice(1).join(' - ');
    } else {
      title = line;
    }

    const key = `${normalize(title)}|${normalize(artist)}`;
    if (seen.has(key)) return;
    seen.add(key);

    tracks.push({ title, artist });
  });

  return tracks;
}

export function detectPlaylistProvider(url: string): PlaylistProvider {
  if (/open\.spotify\.com|spotify:playlist:/i.test(url)) return 'spotify';
  if (/deezer\.com/i.test(url)) return 'deezer';
  if (/music\.apple\.com/i.test(url)) return 'apple-music';
  return 'text';
}

function normalizeServerPlaylist(
  provider: PlaylistProvider,
  data: Record<string, unknown>,
  sourceUrl: string
): ImportedPlaylist {
  const tracks = Array.isArray(data.tracks) ? data.tracks : [];

  return {
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'Playlist importada',
    description: typeof data.description === 'string' ? data.description : undefined,
    provider,
    sourceUrl,
    tracks: tracks
      .map((track) => {
        const item = track as Record<string, unknown>;
        return {
          title: String(item.title || '').trim(),
          artist: String(item.artist || '').trim(),
          album: typeof item.album === 'string' ? item.album : undefined,
          duration: Number.isFinite(Number(item.duration)) ? Number(item.duration) : undefined,
          isrc: typeof item.isrc === 'string' ? item.isrc : undefined,
          providerId: typeof item.providerId === 'string' ? item.providerId : undefined,
        };
      })
      .filter((track) => track.title),
  };
}

async function fetchServerPlaylist(
  provider: PlaylistProvider,
  url: string,
  appleMusicToken?: string
): Promise<ImportedPlaylist> {
  const response = await fetch('/api/import-playlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, url, appleMusicToken }),
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      'El servicio de importación no está disponible en este entorno. Para Spotify/Apple necesita el endpoint /api/import-playlist desplegado en Vercel.'
    );
  }

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || 'No se pudo importar la playlist.');
  }

  return normalizeServerPlaylist(provider, payload, url);
}

function extractDeezerPlaylistId(url: string): string | null {
  const match = url.match(/playlist\/(\d+)/i) || url.match(/^(\d+)$/);
  return match ? match[1] : null;
}

async function fetchDeezerPlaylist(url: string): Promise<ImportedPlaylist> {
  const id = extractDeezerPlaylistId(url);
  if (!id) {
    throw new Error('El enlace de Deezer no contiene un ID de playlist válido.');
  }

  const response = await fetch(`https://api.deezer.com/playlist/${id}`);
  if (!response.ok) {
    throw new Error('Deezer no devolvió la playlist. Revisa que sea pública.');
  }

  const payload = await response.json();
  if (payload?.error) {
    throw new Error(payload.error.message || 'Deezer no encontró la playlist.');
  }

  const tracks: ImportedTrack[] = [];
  let nextUrl: string | null = payload?.tracks?.next || null;
  let page = 0;

  const pushTracks = (items: Array<Record<string, unknown>>) => {
    items.forEach((item) => {
      const artist = item.artist as { name?: string } | undefined;
      const album = item.album as { title?: string } | undefined;
      if (!item.title) return;
      tracks.push({
        title: String(item.title),
        artist: String(artist?.name || ''),
        album: album?.title ? String(album.title) : undefined,
        duration: Number.isFinite(Number(item.duration)) ? Number(item.duration) : undefined,
        isrc: typeof item.isrc === 'string' ? item.isrc : undefined,
        providerId: item.id !== undefined ? String(item.id) : undefined,
      });
    });
  };

  pushTracks((payload?.tracks?.data as Array<Record<string, unknown>>) || []);

  while (nextUrl && page < 4) {
    const nextResponse = await fetch(nextUrl);
    if (!nextResponse.ok) break;
    const nextPayload = await nextResponse.json();
    pushTracks((nextPayload?.data as Array<Record<string, unknown>>) || []);
    nextUrl = nextPayload?.next || null;
    page += 1;
  }

  return {
    name: payload?.title || 'Playlist de Deezer',
    description: payload?.description || undefined,
    provider: 'deezer',
    sourceUrl: url,
    tracks,
  };
}

export async function importPlaylistFromUrl(
  url: string,
  appleMusicToken?: string
): Promise<ImportedPlaylist> {
  const provider = detectPlaylistProvider(url);
  if (provider === 'text') {
    throw new Error('Pega una lista de canciones o usa un enlace de Spotify, Deezer o Apple Music.');
  }

  if (provider === 'deezer') {
    // Deezer's public endpoint is inconsistent with CORS, so use the same
    // serverless proxy that also supports Spotify/Apple. If the app is running
    // without functions (local preview), try the public endpoint directly.
    try {
      return await fetchServerPlaylist('deezer', url);
    } catch (serverError) {
      try {
        return await fetchDeezerPlaylist(url);
      } catch {
        throw serverError;
      }
    }
  }

  return fetchServerPlaylist(provider, url, appleMusicToken);
}

export function playlistProviderLabel(provider: PlaylistProvider): string {
  switch (provider) {
    case 'spotify':
      return 'Spotify';
    case 'deezer':
      return 'Deezer';
    case 'apple-music':
      return 'Apple Music';
    default:
      return 'Texto';
  }
}
