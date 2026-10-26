import { GlobalStatsCacheEntry } from '../types';
import { loadFirebaseService } from './firebaseLoader';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOCAL_PREFIX = 'musica_global_stats_';
const LASTFM_ENDPOINT = 'https://ws.audioscrobbler.com/2.0/';
const DEEZER_ENDPOINT = 'https://api.deezer.com';

export interface GlobalStatsResult extends GlobalStatsCacheEntry {
  stale?: boolean;
}

function normalize(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cacheKey(type: 'artist' | 'track', name: string, artist?: string): string {
  const base = type === 'artist' ? name : `${artist || ''}__${name}`;
  return `${type}__${normalize(base).replace(/\s+/g, '_').slice(0, 180)}`;
}

function isFresh(fetchedAt?: string): boolean {
  if (!fetchedAt) return false;
  const timestamp = Date.parse(fetchedAt);
  return Number.isFinite(timestamp) && Date.now() - timestamp < CACHE_TTL_MS;
}

function readLocal(key: string): GlobalStatsResult | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GlobalStatsResult;
    return parsed && parsed.key === key ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocal(entry: GlobalStatsCacheEntry): void {
  try {
    localStorage.setItem(`${LOCAL_PREFIX}${entry.key}`, JSON.stringify(entry));
  } catch {
    // optional cache
  }
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`La fuente de estadísticas respondió ${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
  }
}

function asNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

async function fetchLastfmArtist(
  name: string,
  apiKey: string
): Promise<GlobalStatsCacheEntry> {
  const url = `${LASTFM_ENDPOINT}?method=artist.getinfo&artist=${encodeURIComponent(
    name
  )}&api_key=${encodeURIComponent(apiKey)}&format=json&autocorrect=1`;
  const payload = await fetchJson(url);
  const artist = payload.artist as
    | {
        name?: string;
        url?: string;
        stats?: { listeners?: string; playcount?: string };
      }
    | undefined;

  if (!artist?.stats) throw new Error('Last.fm no encontró el artista.');

  return {
    key: cacheKey('artist', name),
    type: 'artist',
    name: artist.name || name,
    source: 'last.fm',
    listeners: asNumber(artist.stats.listeners),
    playcount: asNumber(artist.stats.playcount),
    url: artist.url,
    fetchedAt: new Date().toISOString(),
    period: 'Histórico total en Last.fm',
    note: 'Last.fm no publica oyentes mensuales; se muestran oyentes y reproducciones totales.',
  };
}

async function fetchLastfmTrack(
  title: string,
  artist: string,
  apiKey: string
): Promise<GlobalStatsCacheEntry> {
  const url = `${LASTFM_ENDPOINT}?method=track.getinfo&artist=${encodeURIComponent(
    artist
  )}&track=${encodeURIComponent(title)}&api_key=${encodeURIComponent(
    apiKey
  )}&format=json&autocorrect=1`;
  const payload = await fetchJson(url);
  const track = payload.track as
    | {
        name?: string;
        url?: string;
        listeners?: string;
        playcount?: string;
        artist?: { name?: string };
      }
    | undefined;

  if (!track) throw new Error('Last.fm no encontró la canción.');

  return {
    key: cacheKey('track', title, artist),
    type: 'track',
    name: track.name || title,
    artist: track.artist?.name || artist,
    source: 'last.fm',
    listeners: asNumber(track.listeners),
    playcount: asNumber(track.playcount),
    url: track.url,
    fetchedAt: new Date().toISOString(),
    period: 'Histórico total en Last.fm',
    note: 'Datos de Last.fm; no son reproducciones de Spotify.',
  };
}

async function fetchDeezerArtist(name: string): Promise<GlobalStatsCacheEntry> {
  const payload = await fetchJson(
    `${DEEZER_ENDPOINT}/search/artist?q=${encodeURIComponent(name)}&limit=25`
  );
  const candidates = ((payload.data as Array<Record<string, unknown>>) || []).filter(
    (artist) => normalize(String(artist.name || '')) === normalize(name)
  );

  if (candidates.length === 0) {
    throw new Error('Deezer no encontró el artista.');
  }

  // Search results are not sorted by relevance/popularity. Pick the exact-name
  // candidate with the largest audience to avoid homonymous small artists.
  const best = candidates.sort(
    (a, b) => (asNumber(b.nb_fan) || 0) - (asNumber(a.nb_fan) || 0)
  )[0];

  return {
    key: cacheKey('artist', name),
    type: 'artist',
    name: String(best.name || name),
    source: 'deezer',
    fans: asNumber(best.nb_fan),
    url: typeof best.link === 'string' ? best.link : undefined,
    fetchedAt: new Date().toISOString(),
    period: 'Datos actuales de Deezer (caché semanal)',
    note: 'Deezer publica fans totales, no oyentes mensuales. La cifra no equivale a Spotify.',
  };
}

async function fetchDeezerTrack(
  title: string,
  artist: string
): Promise<GlobalStatsCacheEntry> {
  const payload = await fetchJson(
    `${DEEZER_ENDPOINT}/search?q=${encodeURIComponent(`${title} ${artist}`)}&limit=12`
  );
  const candidates = (payload.data as Array<Record<string, unknown>>) || [];

  const scored = candidates
    .map((track) => {
      const trackTitle = normalize(String(track.title || ''));
      const trackArtist = normalize(
        String((track.artist as { name?: string } | undefined)?.name || '')
      );
      const wantedTitle = normalize(title);
      const wantedArtist = normalize(artist);
      let score = 0;
      if (trackTitle === wantedTitle) score += 0.65;
      else if (trackTitle.includes(wantedTitle) || wantedTitle.includes(trackTitle)) score += 0.4;
      if (trackArtist === wantedArtist) score += 0.35;
      else if (trackArtist.includes(wantedArtist) || wantedArtist.includes(trackArtist)) score += 0.2;
      return { track, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 0.55) {
    throw new Error('Deezer no encontró una coincidencia fiable para esta canción.');
  }

  const track = best.track;
  return {
    key: cacheKey('track', title, artist),
    type: 'track',
    name: String(track.title || title),
    artist: String((track.artist as { name?: string } | undefined)?.name || artist),
    source: 'deezer',
    rank: asNumber(track.rank),
    url:
      track.id !== undefined
        ? `https://www.deezer.com/track/${String(track.id)}`
        : undefined,
    fetchedAt: new Date().toISOString(),
    period: 'Datos actuales de Deezer (caché semanal)',
    note: 'Deezer no publica el número de reproducciones; se muestra su ranking de popularidad (0-1.000.000).',
  };
}

async function readCloudCache(key: string): Promise<GlobalStatsResult | null> {
  try {
    const firebase = await loadFirebaseService();
    return (await firebase.getCachedGlobalStats(key)) as GlobalStatsResult | null;
  } catch {
    return null;
  }
}

async function writeCache(entry: GlobalStatsCacheEntry): Promise<void> {
  writeLocal(entry);
  try {
    const firebase = await loadFirebaseService();
    await firebase.saveCachedGlobalStats(entry);
  } catch {
    // local cache is enough
  }
}

async function resolveCache(key: string): Promise<GlobalStatsResult | null> {
  const local = readLocal(key);
  if (local && isFresh(local.fetchedAt)) return local;

  const cloud = await readCloudCache(key);
  if (cloud && isFresh(cloud.fetchedAt)) {
    writeLocal(cloud);
    return cloud;
  }

  return local || cloud || null;
}

export async function getArtistGlobalStats(
  name: string,
  lastfmApiKey?: string
): Promise<GlobalStatsResult | null> {
  if (!name.trim()) return null;
  const key = cacheKey('artist', name);
  const cached = await resolveCache(key);
  if (cached) return cached;

  try {
    const entry = lastfmApiKey
      ? await fetchLastfmArtist(name, lastfmApiKey)
      : await fetchDeezerArtist(name);
    await writeCache(entry);
    return entry;
  } catch (primaryError) {
    // If Last.fm fails (quota/key), fall back to Deezer.
    if (lastfmApiKey) {
      try {
        const fallback = await fetchDeezerArtist(name);
        await writeCache(fallback);
        return fallback;
      } catch {
        // fall through
      }
    }

    const stale = cached || (await readCloudCache(key));
    if (stale) return { ...stale, stale: true };
    console.warn('No se pudieron obtener estadísticas del artista:', primaryError);
    return null;
  }
}

export async function getTrackGlobalStats(
  title: string,
  artist: string,
  lastfmApiKey?: string
): Promise<GlobalStatsResult | null> {
  if (!title.trim() || !artist.trim()) return null;
  const key = cacheKey('track', title, artist);
  const cached = await resolveCache(key);
  if (cached) return cached;

  try {
    const entry = lastfmApiKey
      ? await fetchLastfmTrack(title, artist, lastfmApiKey)
      : await fetchDeezerTrack(title, artist);
    await writeCache(entry);
    return entry;
  } catch (primaryError) {
    if (lastfmApiKey) {
      try {
        const fallback = await fetchDeezerTrack(title, artist);
        await writeCache(fallback);
        return fallback;
      } catch {
        // fall through
      }
    }

    const stale = cached || (await readCloudCache(key));
    if (stale) return { ...stale, stale: true };
    console.warn('No se pudieron obtener estadísticas de la canción:', primaryError);
    return null;
  }
}
