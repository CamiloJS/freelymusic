import {
  Song,
  SongVersion,
  SongVersionType,
  UserProfile,
  UserLibraryData,
  FirebaseConfigOptions,
  Playlist,
  ArtistProfile,
  DirectMessage,
  ChatThread,
} from '../types';
import { cleanArtistSeparators } from '../utils/urlMetadataParser';

const DB_NAME = 'sonora-audio-cache';
const DB_VERSION = 1;
const STORE_NAME = 'audio-blobs';

// IndexedDB Helper (one shared connection: opening a new one for every
// playback/read was adding latency on mobile devices).
let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB bloqueada por otra pestaña'));
  });

  dbPromise.catch(() => {
    dbPromise = null;
  });

  return dbPromise;
}

export async function storeSongBlob(songId: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(blob, songId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getSongBlob(songId: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(songId);
    request.onsuccess = () => {
      const result = request.result;
      if (result instanceof Blob) {
        if (!result.type || result.type === 'application/octet-stream') {
          resolve(new Blob([result], { type: 'audio/mpeg' }));
          return;
        }
        resolve(result);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSongBlob(songId: string): Promise<void> {
  const db = await openDB();
  const allKeys = await new Promise<string[]>((res, rej) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const st = tx.objectStore(STORE_NAME);
    const req = st.getAllKeys();
    req.onsuccess = () => res((req.result as string[]) || []);
    req.onerror = () => rej(req.error);
  });

  const matchingKeys = allKeys.filter((k) => k === songId || k.startsWith(`${songId}-`));

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    for (const key of matchingKeys) {
      store.delete(key);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getAllDownloadedSongIds(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAllKeys();
    request.onsuccess = () => {
      const keys = (request.result as string[]) || [];
      const songIds = keys.filter(
        (k) => !k.includes('-instrumental') && !k.includes('-video') && !k.includes('-version-')
      );
      resolve(songIds);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function isSongDownloaded(songId: string): Promise<boolean> {
  const blob = await getSongBlob(songId);
  return blob !== null;
}

export async function getInstrumentalBlob(songId: string, versionId?: string | null): Promise<Blob | null> {
  if (versionId) {
    const vBlob = await getSongBlob(`${songId}-version-${versionId}-instrumental`);
    if (vBlob) return vBlob;
  }
  return getSongBlob(`${songId}-instrumental`);
}

export async function getVideoBlob(songId: string, versionId?: string | null): Promise<Blob | null> {
  if (versionId) {
    const vBlob = await getSongBlob(`${songId}-version-${versionId}-video`);
    if (vBlob) return vBlob;
  }
  return getSongBlob(`${songId}-video`);
}

async function fetchMediaBlob(url: string, timeoutMs = 120000): Promise<Blob | null> {
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type || blob.type === 'application/octet-stream') {
      let mime = 'audio/mpeg';
      const lower = url.toLowerCase();
      if (lower.includes('.ogg')) mime = 'audio/ogg';
      else if (lower.includes('.wav')) mime = 'audio/wav';
      else if (lower.includes('.flac')) mime = 'audio/flac';
      else if (lower.includes('.m4a') || lower.includes('.mp4')) mime = 'audio/mp4';
      return new Blob([blob], { type: mime });
    }
    return blob;
  } catch (err) {
    console.warn('No se pudo descargar archivo multimedia para caché offline:', url, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Downloads audio file, karaoke instrumental, and music video into IndexedDB for 100% offline playback
 */
export async function cacheSongOffline(song: Song): Promise<boolean> {
  try {
    // 1. Audio principal
    const mainBlob = await fetchMediaBlob(song.audioUrl);
    if (!mainBlob) {
      console.error(`Fallo al descargar audio principal de ${song.title}`);
      return false;
    }
    await storeSongBlob(song.id, mainBlob);

    // 2. Pista karaoke / instrumental si existe
    if (song.instrumentalUrl) {
      const instBlob = await fetchMediaBlob(song.instrumentalUrl);
      if (instBlob) {
        await storeSongBlob(`${song.id}-instrumental`, instBlob);
      }
    }

    // 3. Videoclip si existe
    if (song.videoUrl) {
      const vidBlob = await fetchMediaBlob(song.videoUrl, 180000);
      if (vidBlob) {
        await storeSongBlob(`${song.id}-video`, vidBlob);
      }
    }

    // 4. Versiones alternativas y sus instrumentales/videos
    if (Array.isArray(song.versions)) {
      for (const v of song.versions) {
        if (v.audioUrl) {
          const vBlob = await fetchMediaBlob(v.audioUrl);
          if (vBlob) await storeSongBlob(`${song.id}-version-${v.id}`, vBlob);
        }
        if (v.instrumentalUrl) {
          const vInstBlob = await fetchMediaBlob(v.instrumentalUrl);
          if (vInstBlob) await storeSongBlob(`${song.id}-version-${v.id}-instrumental`, vInstBlob);
        }
        if (v.videoUrl) {
          const vVidBlob = await fetchMediaBlob(v.videoUrl, 180000);
          if (vVidBlob) await storeSongBlob(`${song.id}-version-${v.id}-video`, vVidBlob);
        }
      }
    }

    return true;
  } catch (err) {
    console.error(`Error al guardar sin conexión ${song.title}:`, err);
    return false;
  }
}

/**
 * Direct file download of a single song to the device's storage
 */
export async function downloadSongFile(song: Song): Promise<void> {
  try {
    // If we have cached blob, use it directly
    let blob = await getSongBlob(song.id);
    if (!blob) {
      const res = await fetch(song.audioUrl);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      blob = await res.blob();
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const sanitizedTitle = `${song.artist} - ${song.title}`.replace(/[\\/:*?"<>|]/g, '_');
    a.download = `${sanitizedTitle}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error('Error downloading song file:', err);
    // Fallback: direct window open link
    window.open(song.audioUrl, '_blank');
  }
}

/**
 * Downloads a playlist as a single .ZIP bundle containing all audio files & metadata
 */
export async function downloadPlaylistAsZip(
  playlist: Playlist,
  songs: Song[],
  onProgress?: (progress: number, status: string) => void
): Promise<void> {
  if (songs.length === 0) return;

  // JSZip is only needed for this action, so it is loaded on demand instead
  // of shipping ~100 KB in the initial application bundle.
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const folder = zip.folder(playlist.name.replace(/[\\/:*?"<>|]/g, '_')) || zip;

  let completed = 0;
  for (const song of songs) {
    if (onProgress) {
      onProgress(
        Math.round((completed / songs.length) * 100),
        `Descargando: ${song.title}...`
      );
    }

    try {
      let blob = await getSongBlob(song.id);
      if (!blob) {
        const res = await fetch(song.audioUrl);
        if (res.ok) {
          blob = await res.blob();
        }
      }

      if (blob) {
        const fileName = `${String(completed + 1).padStart(2, '0')}. ${song.artist} - ${song.title}.mp3`.replace(/[\\/:*?"<>|]/g, '_');
        folder.file(fileName, blob);
      }
    } catch (e) {
      console.warn(`Could not add song ${song.title} to zip:`, e);
    }
    completed++;
  }

  if (onProgress) onProgress(95, 'Generando archivo ZIP...');
  const zipBlob = await zip.generateAsync({ type: 'blob' });

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${playlist.name.replace(/[\\/:*?"<>|]/g, '_')}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  if (onProgress) onProgress(100, '¡Descarga completada!');
}

import { CAMILO_SAVED_AVATAR } from './camiloAvatar';

export const DEFAULT_AVATAR = CAMILO_SAVED_AVATAR;

// LocalStorage Keys
const KEYS = {
  CATALOG: 'sonora_cloud_catalog',
  PROFILES: 'sonora_user_profiles',
  ACTIVE_USER: 'sonora_active_user_id',
  SESSION_USER: 'sonora_session_user_id',
  RECENT_SEARCHES: 'sonora_recent_searches',
  USER_DATA_PREFIX: 'sonora_userdata_',
  FIREBASE_CONFIG: 'sonora_firebase_config',
  ARTIST_PROFILES: 'sonora_artist_profiles',
  MESSAGES: 'sonora_direct_messages',
  CHAT_THREADS: 'sonora_chat_threads',
};

// Default seed data for initial setup (uses Camilo's real uploaded photo)
export const INITIAL_PROFILES: UserProfile[] = [
  {
    id: 'camilo-admin',
    username: 'camilo',
    displayName: 'Camilo Jaimes',
    avatarUrl: CAMILO_SAVED_AVATAR,
    role: 'admin',
    pin: '2410',
    createdAt: '2026-10-26T17:05:53.257Z',
    isFavoritesPublic: true,
    shareListeningActivity: true,
    isProfilePublic: true,
    followingUserIds: [],
  },
];

export const MOCK_PROFILE_IDS = new Set([
  'jhoan-user',
  'luis-david-user',
  'geraldine-user',
  'lauris-user',
  'ana-maria-user',
]);

export const INITIAL_CATALOG: Song[] = [];

// ---------------------------------------------------------------------------
// Safe localStorage helpers
// ---------------------------------------------------------------------------

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    // QuotaExceededError or private-mode restrictions must never crash the app
    console.warn(`No se pudo guardar ${key} en localStorage:`, err);
    return false;
  }
}

function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Normalizers (protect the UI from malformed cloud/legacy data)
// ---------------------------------------------------------------------------

const VERSION_TYPES: SongVersionType[] = [
  'original',
  'cover',
  'instrumental',
  'remix',
  'live',
  'other',
];

export function normalizeSongVersion(
  raw: Partial<SongVersion> | null | undefined,
  index = 0
): SongVersion | null {
  if (!raw || typeof raw !== 'object') return null;
  const audioUrl = typeof raw.audioUrl === 'string' ? raw.audioUrl.trim() : '';
  if (!audioUrl) return null;

  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : `version-${index + 1}`;
  const duration = Number(raw.duration);
  const offset = Number(raw.instrumentalOffset);
  const type = VERSION_TYPES.includes(raw.type as SongVersionType)
    ? (raw.type as SongVersionType)
    : 'other';

  return {
    id,
    label:
      typeof raw.label === 'string' && raw.label.trim()
        ? raw.label.trim()
        : type === 'cover'
        ? 'Cover'
        : type === 'instrumental'
        ? 'Instrumental'
        : `Versión ${index + 1}`,
    type,
    audioUrl,
    duration: Number.isFinite(duration) && duration > 0 ? duration : undefined,
    lyricsLrc: typeof raw.lyricsLrc === 'string' ? raw.lyricsLrc : undefined,
    plainLyrics: typeof raw.plainLyrics === 'string' ? raw.plainLyrics : undefined,
    videoUrl: typeof raw.videoUrl === 'string' && raw.videoUrl.trim() ? raw.videoUrl.trim() : undefined,
    instrumentalUrl:
      typeof raw.instrumentalUrl === 'string' && raw.instrumentalUrl.trim()
        ? raw.instrumentalUrl.trim()
        : undefined,
    instrumentalLyricsLrc:
      typeof raw.instrumentalLyricsLrc === 'string'
        ? raw.instrumentalLyricsLrc
        : undefined,
    instrumentalOffset: Number.isFinite(offset) ? offset : undefined,
    language:
      typeof raw.language === 'string' && raw.language.trim()
        ? raw.language.trim().toLowerCase()
        : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
  };
}

export function normalizeSong(raw: Partial<Song> | null | undefined): Song | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id) return null;

  const duration = Number(raw.duration);
  const trackNumber = Number(raw.trackNumber);
  const instrumentalOffset = Number(raw.instrumentalOffset);
  const versions = Array.isArray(raw.versions)
    ? raw.versions
        .map((version, index) => normalizeSongVersion(version, index))
        .filter((version): version is SongVersion => Boolean(version))
    : [];

  return {
    id,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'Sin título',
    artist:
      typeof raw.artist === 'string' && raw.artist.trim()
        ? cleanArtistSeparators(raw.artist.trim())
        : 'Artista desconocido',
    album: typeof raw.album === 'string' && raw.album.trim() ? raw.album.trim() : 'Sencillo',
    albumArtist:
      typeof raw.albumArtist === 'string' && raw.albumArtist.trim()
        ? cleanArtistSeparators(raw.albumArtist.trim())
        : undefined,
    coverUrl: typeof raw.coverUrl === 'string' ? raw.coverUrl : '',
    audioUrl: typeof raw.audioUrl === 'string' ? raw.audioUrl : '',
    duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
    lyricsLrc: typeof raw.lyricsLrc === 'string' ? raw.lyricsLrc : undefined,
    plainLyrics: typeof raw.plainLyrics === 'string' ? raw.plainLyrics : undefined,
    genre: typeof raw.genre === 'string' && raw.genre.trim() ? raw.genre.trim() : 'General',
    year: typeof raw.year === 'string' ? raw.year : undefined,
    trackNumber:
      Number.isFinite(trackNumber) && trackNumber > 0 ? trackNumber : undefined,
    isExplicit: Boolean(raw.isExplicit),
    addedBy: typeof raw.addedBy === 'string' ? raw.addedBy : undefined,
    createdAt:
      typeof raw.createdAt === 'string' && raw.createdAt
        ? raw.createdAt
        : new Date().toISOString(),
    videoUrl:
      typeof raw.videoUrl === 'string' && raw.videoUrl.trim() ? raw.videoUrl.trim() : undefined,
    instrumentalUrl:
      typeof raw.instrumentalUrl === 'string' && raw.instrumentalUrl.trim()
        ? raw.instrumentalUrl.trim()
        : undefined,
    instrumentalLyricsLrc:
      typeof raw.instrumentalLyricsLrc === 'string' ? raw.instrumentalLyricsLrc : undefined,
    instrumentalOffset: Number.isFinite(instrumentalOffset) ? instrumentalOffset : undefined,
    versions: versions.length > 0 ? versions : undefined,
    isrc: typeof raw.isrc === 'string' && raw.isrc.trim() ? raw.isrc.trim() : undefined,
    needsReview: raw.needsReview === true ? true : undefined,
    enrichmentNote:
      typeof raw.enrichmentNote === 'string' && raw.enrichmentNote.trim()
        ? raw.enrichmentNote.trim()
        : undefined,
  };
}

function normalizePlaylist(raw: Partial<Playlist> | null | undefined): Playlist | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id) return null;

  const songIds = Array.isArray(raw.songIds)
    ? raw.songIds.filter((songId): songId is string => typeof songId === 'string' && Boolean(songId))
    : [];

  return {
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Playlist',
    description: typeof raw.description === 'string' ? raw.description : undefined,
    coverUrl: typeof raw.coverUrl === 'string' ? raw.coverUrl : undefined,
    userId: typeof raw.userId === 'string' ? raw.userId : 'user',
    isPublic: Boolean(raw.isPublic),
    songIds: Array.from(new Set(songIds)),
    createdAt:
      typeof raw.createdAt === 'string' && raw.createdAt
        ? raw.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof raw.updatedAt === 'string' && raw.updatedAt
        ? raw.updatedAt
        : new Date().toISOString(),
  };
}

export function normalizeUserData(raw: Partial<UserLibraryData> | null | undefined): UserLibraryData {
  const source = raw && typeof raw === 'object' ? raw : {};

  const favoriteSongIds = Array.isArray(source.favoriteSongIds)
    ? Array.from(
        new Set(
          source.favoriteSongIds.filter(
            (songId): songId is string => typeof songId === 'string' && Boolean(songId)
          )
        )
      )
    : [];

  const historySongIds = Array.isArray(source.historySongIds)
    ? source.historySongIds.filter(
        (songId): songId is string => typeof songId === 'string' && Boolean(songId)
      )
    : [];

  const playlists = Array.isArray(source.playlists)
    ? source.playlists
        .map((playlist) => normalizePlaylist(playlist))
        .filter(
          (playlist): playlist is Playlist =>
            Boolean(
              playlist &&
                playlist.name !== 'Favoritos de Sonora' &&
                playlist.name !== 'Favoritas de Sonora'
            )
        )
    : [];

  const followedArtists = Array.isArray(source.followedArtists)
    ? Array.from(
        new Set(
          source.followedArtists
            .filter((name): name is string => typeof name === 'string')
            .map((name) => name.trim().toLowerCase())
            .filter(Boolean)
        )
      )
    : [];

  const playlistIds = new Set(playlists.map((playlist) => playlist.id));
  const pinnedPlaylistIds = Array.isArray(source.pinnedPlaylistIds)
    ? Array.from(
        new Set(
          source.pinnedPlaylistIds.filter(
            (id): id is string => typeof id === 'string' && playlistIds.has(id)
          )
        )
      )
    : [];

  const savedAlbumNames = Array.isArray(source.savedAlbumNames)
    ? Array.from(
        new Set(
          source.savedAlbumNames
            .filter((name): name is string => typeof name === 'string')
            .map((name) => name.trim().toLowerCase())
            .filter(Boolean)
        )
      )
    : [];

  const playCounts: Record<string, number> = {};
  if (source.playCounts && typeof source.playCounts === 'object') {
    Object.entries(source.playCounts).forEach(([songId, value]) => {
      const count = Number(value);
      if (songId && Number.isFinite(count) && count > 0) {
        playCounts[songId] = Math.floor(count);
      }
    });
  }

  const playHistory = Array.isArray(source.playHistory)
    ? source.playHistory
        .filter(
          (event) =>
            event &&
            typeof event === 'object' &&
            typeof event.songId === 'string' &&
            typeof event.playedAt === 'string'
        )
        .slice(0, 200)
    : [];

  const normalizeSecondsMap = (value: unknown): Record<string, number> => {
    const result: Record<string, number> = {};
    if (value && typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([key, rawSeconds]) => {
        const seconds = Number(rawSeconds);
        if (key && Number.isFinite(seconds) && seconds > 0) {
          result[key] = Math.floor(seconds);
        }
      });
    }
    return result;
  };

  const totalListenSeconds = Number(source.totalListenSeconds);

  return {
    favoriteSongIds,
    historySongIds,
    playlists,
    followedArtists,
    pinnedPlaylistIds,
    savedAlbumNames,
    playCounts,
    playHistory,
    totalListenSeconds:
      Number.isFinite(totalListenSeconds) && totalListenSeconds > 0
        ? Math.floor(totalListenSeconds)
        : 0,
    songListenSeconds: normalizeSecondsMap(source.songListenSeconds),
    artistListenSeconds: normalizeSecondsMap(source.artistListenSeconds),
    updatedAt:
      typeof source.updatedAt === 'string' && source.updatedAt ? source.updatedAt : undefined,
  };
}

// The old bundled avatar was a 64 KB base64 string inside the JS bundle and in
// every profile document. It now lives in /public and legacy copies are migrated
// when they are read.
const LEGACY_CAMILO_AVATAR_PREFIX =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/4QK+RXhpZgAATU0AKgAAAAgAAodpAAQAAAABAAABMuocAAcAAAEMAAAAJgAAAAAc6gAAA';

export function normalizeAvatarUrl(value?: string | null): string {
  const url = typeof value === 'string' ? value.trim() : '';
  if (
    !url ||
    url.includes('photo-1534528741775-53994a69daeb') ||
    url.startsWith(LEGACY_CAMILO_AVATAR_PREFIX)
  ) {
    return CAMILO_SAVED_AVATAR;
  }
  return url;
}

export function normalizeUserProfile(
  raw: Partial<UserProfile> | null | undefined
): UserProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id) return null;

  return {
    id,
    username:
      typeof raw.username === 'string' && raw.username.trim()
        ? raw.username.trim()
        : id,
    displayName:
      typeof raw.displayName === 'string' && raw.displayName.trim()
        ? raw.displayName.trim()
        : 'Usuario',
    avatarUrl: normalizeAvatarUrl(raw.avatarUrl),
    role: raw.role === 'admin' ? 'admin' : 'member',
    pin: typeof raw.pin === 'string' && raw.pin.trim() ? raw.pin.trim() : undefined,
    createdAt:
      typeof raw.createdAt === 'string' && raw.createdAt
        ? raw.createdAt
        : new Date().toISOString(),
    isFavoritesPublic: raw.isFavoritesPublic ?? true,
    shareListeningActivity: raw.shareListeningActivity ?? true,
    isProfilePublic: raw.isProfilePublic ?? true,
    currentListeningSong: raw.currentListeningSong,
    followingUserIds: Array.isArray(raw.followingUserIds) ? raw.followingUserIds : [],
  };
}

// ---------------------------------------------------------------------------
// Catalog & profile storage
// ---------------------------------------------------------------------------

const DELETED_SONGS_KEY = 'sonora_deleted_song_ids';
const PENDING_SONGS_KEY = 'sonora_pending_songs';

export function getStoredDeletedSongIds(): Set<string> {
  try {
    const raw = safeGetItem(DELETED_SONGS_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

export function addStoredDeletedSongId(id: string): void {
  const current = getStoredDeletedSongIds();
  current.add(id);
  safeSetItem(DELETED_SONGS_KEY, JSON.stringify(Array.from(current)));
}

export function removeStoredDeletedSongId(id: string): void {
  const current = getStoredDeletedSongIds();
  if (!current.has(id)) return;
  current.delete(id);
  safeSetItem(DELETED_SONGS_KEY, JSON.stringify(Array.from(current)));
}

// Songs created while offline (or whose cloud write failed) are kept in a small
// outbox. Only these are retried against Firestore, so a stale local catalog
// can never resurrect a song that was deleted from another device.
export function getStoredPendingSongs(): Song[] {
  try {
    const raw = safeGetItem(PENDING_SONGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((song) => normalizeSong(song))
      .filter((song): song is Song => Boolean(song));
  } catch {
    return [];
  }
}

export function addStoredPendingSong(song: Song): void {
  const current = getStoredPendingSongs().filter((item) => item.id !== song.id);
  safeSetItem(PENDING_SONGS_KEY, JSON.stringify([song, ...current].slice(0, 100)));
}

export function addMultipleStoredPendingSongs(songs: Song[]): void {
  if (songs.length === 0) return;
  const newIds = new Set(songs.map((s) => s.id));
  const current = getStoredPendingSongs().filter((item) => !newIds.has(item.id));
  safeSetItem(PENDING_SONGS_KEY, JSON.stringify([...songs, ...current].slice(0, 150)));
}

export function removeStoredPendingSong(songId: string): void {
  const current = getStoredPendingSongs().filter((song) => song.id !== songId);
  safeSetItem(PENDING_SONGS_KEY, JSON.stringify(current));
}

export function getStoredCatalog(): Song[] {
  try {
    const raw = safeGetItem(KEYS.CATALOG);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const deleted = getStoredDeletedSongIds();
    return parsed
      .map((song) => normalizeSong(song))
      .filter(
        (song): song is Song =>
          song !== null &&
          song.id !== 'track-1' &&
          song.id !== 'track-2' &&
          song.id !== 'track-3' &&
          !deleted.has(song.id)
      );
  } catch {
    return [];
  }
}

export function saveStoredCatalog(songs: Song[]): void {
  const deleted = getStoredDeletedSongIds();
  const cleaned = songs
    .map((song) => normalizeSong(song))
    .filter(
      (song): song is Song =>
        song !== null &&
        song.id !== 'track-1' &&
        song.id !== 'track-2' &&
        song.id !== 'track-3' &&
        !deleted.has(song.id)
    );
  safeSetItem(KEYS.CATALOG, JSON.stringify(cleaned));
}

export function getStoredProfiles(): UserProfile[] {
  try {
    const raw = safeGetItem(KEYS.PROFILES);
    if (!raw) {
      safeSetItem(KEYS.PROFILES, JSON.stringify(INITIAL_PROFILES));
      return INITIAL_PROFILES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return INITIAL_PROFILES;
    const profiles = parsed
      .map((profile) => normalizeUserProfile(profile))
      .filter(
        (profile): profile is UserProfile =>
          profile !== null && !MOCK_PROFILE_IDS.has(profile.id)
      );

    // Clean any followed mock IDs
    for (const p of profiles) {
      if (Array.isArray(p.followingUserIds)) {
        p.followingUserIds = p.followingUserIds.filter((id) => !MOCK_PROFILE_IDS.has(id));
      }
    }

    // Ensure Camilo admin is always present
    const existingIds = new Set(profiles.map((p) => p.id));
    for (const init of INITIAL_PROFILES) {
      if (!existingIds.has(init.id)) {
        profiles.push(init);
      }
    }

    const result = profiles.length > 0 ? profiles : INITIAL_PROFILES;
    safeSetItem(KEYS.PROFILES, JSON.stringify(result));
    return result;
  } catch {
    return INITIAL_PROFILES;
  }
}

export function saveStoredProfiles(profiles: UserProfile[]): void {
  safeSetItem(KEYS.PROFILES, JSON.stringify(profiles));
}

export function getStoredActiveUserId(): string {
  return safeGetItem(KEYS.ACTIVE_USER) || 'camilo-admin';
}

export function saveStoredActiveUserId(userId: string): void {
  safeSetItem(KEYS.ACTIVE_USER, userId);
}

export function createDefaultUserData(userId: string): UserLibraryData {
  return {
    favoriteSongIds: [],
    historySongIds: [],
    followedArtists: [],
    pinnedPlaylistIds: [],
    savedAlbumNames: [],
    playlists: [],
    playCounts: {},
    playHistory: [],
    totalListenSeconds: 0,
    songListenSeconds: {},
    artistListenSeconds: {},
  };
}

export function getStoredUserData(userId: string): UserLibraryData {
  try {
    const raw = safeGetItem(`${KEYS.USER_DATA_PREFIX}${userId}`);
    if (!raw) {
      const defaultData = createDefaultUserData(userId);
      safeSetItem(`${KEYS.USER_DATA_PREFIX}${userId}`, JSON.stringify(defaultData));
      return defaultData;
    }
    return normalizeUserData(JSON.parse(raw));
  } catch {
    return createDefaultUserData(userId);
  }
}

export function saveStoredUserData(userId: string, data: UserLibraryData): void {
  safeSetItem(`${KEYS.USER_DATA_PREFIX}${userId}`, JSON.stringify(data));
}

// Artist Profiles storage
export function getStoredArtistProfiles(): ArtistProfile[] {
  try {
    const raw = safeGetItem(KEYS.ARTIST_PROFILES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (artist): artist is ArtistProfile =>
          artist &&
          typeof artist === 'object' &&
          typeof artist.name === 'string' &&
          Boolean(artist.name.trim())
      )
      .map((artist) => ({
        ...artist,
        id:
          typeof artist.id === 'string' && artist.id.trim()
            ? artist.id.trim().toLowerCase()
            : artist.name.trim().toLowerCase(),
        name: artist.name.trim(),
      }));
  } catch {
    return [];
  }
}

export function saveStoredArtistProfiles(artists: ArtistProfile[]): void {
  safeSetItem(KEYS.ARTIST_PROFILES, JSON.stringify(artists));
}

export function getStoredArtistProfile(artistName: string): ArtistProfile | null {
  const norm = artistName.trim().toLowerCase();
  const list = getStoredArtistProfiles();
  return list.find((a) => a.id === norm || a.name.trim().toLowerCase() === norm) || null;
}

export function saveStoredArtistProfile(artist: ArtistProfile): void {
  const list = getStoredArtistProfiles();
  const norm = artist.id || artist.name.trim().toLowerCase();
  const updatedArtist: ArtistProfile = {
    ...artist,
    id: norm,
    updatedAt: new Date().toISOString(),
  };
  const filtered = list.filter((a) => a.id !== norm);
  const updatedList = [...filtered, updatedArtist];
  saveStoredArtistProfiles(updatedList);
}

export function getStoredFirebaseConfig(): FirebaseConfigOptions | null {
  try {
    const raw = safeGetItem(KEYS.FIREBASE_CONFIG);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveStoredFirebaseConfig(config: FirebaseConfigOptions | null): void {
  if (config) {
    safeSetItem(KEYS.FIREBASE_CONFIG, JSON.stringify(config));
  } else {
    safeRemoveItem(KEYS.FIREBASE_CONFIG);
  }
}

// Session Lock / Authentication storage
export function getStoredActiveSessionUserId(): string | null {
  return safeGetItem(KEYS.SESSION_USER);
}

export function saveStoredActiveSessionUserId(userId: string | null): void {
  if (userId) {
    safeSetItem(KEYS.SESSION_USER, userId);
  } else {
    safeRemoveItem(KEYS.SESSION_USER);
  }
}

// Recent searches storage (max 10 recent searches)
export function getRecentSearches(): string[] {
  try {
    const raw = safeGetItem(KEYS.RECENT_SEARCHES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((term): term is string => typeof term === 'string').slice(0, 10)
      : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(term: string): string[] {
  const clean = term.trim();
  if (!clean) return getRecentSearches();

  const current = getRecentSearches();
  const filtered = current.filter((item) => item.toLowerCase() !== clean.toLowerCase());
  const updated = [clean, ...filtered].slice(0, 10);
  safeSetItem(KEYS.RECENT_SEARCHES, JSON.stringify(updated));
  return updated;
}

export function removeRecentSearch(term: string): string[] {
  const current = getRecentSearches();
  const updated = current.filter((item) => item.toLowerCase() !== term.toLowerCase());
  safeSetItem(KEYS.RECENT_SEARCHES, JSON.stringify(updated));
  return updated;
}

export function clearRecentSearches(): void {
  safeRemoveItem(KEYS.RECENT_SEARCHES);
}

// ---------------------------------------------------------------------------
// Direct Messages & Chat Threads
// ---------------------------------------------------------------------------

export const INITIAL_CHAT_THREADS: ChatThread[] = [];

export function getStoredChatThreads(): ChatThread[] {
  try {
    // Clean mock message keys from localStorage if present
    safeRemoveItem(`${KEYS.MESSAGES}_thread-jhoan`);
    safeRemoveItem(`${KEYS.MESSAGES}_thread-luis`);
    safeRemoveItem(`${KEYS.MESSAGES}_thread-geraldine`);

    const raw = safeGetItem(KEYS.CHAT_THREADS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const cleaned = parsed.filter((t) => {
      if (!t || typeof t !== 'object') return false;
      if (['thread-jhoan', 'thread-luis', 'thread-geraldine'].includes(t.id)) return false;
      if (
        Array.isArray(t.participantIds) &&
        t.participantIds.some((pid: string) => MOCK_PROFILE_IDS.has(pid))
      ) {
        return false;
      }
      return true;
    });

    if (cleaned.length !== parsed.length) {
      safeSetItem(KEYS.CHAT_THREADS, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function saveStoredChatThreads(threads: ChatThread[]): void {
  safeSetItem(KEYS.CHAT_THREADS, JSON.stringify(threads));
}

export function getStoredDirectMessages(threadId: string): DirectMessage[] {
  try {
    if (['thread-jhoan', 'thread-luis', 'thread-geraldine'].includes(threadId)) {
      return [];
    }
    const raw = safeGetItem(`${KEYS.MESSAGES}_${threadId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredDirectMessage(threadId: string, message: DirectMessage): void {
  const existing = getStoredDirectMessages(threadId);
  const updated = [...existing, message];
  safeSetItem(`${KEYS.MESSAGES}_${threadId}`, JSON.stringify(updated));

  const threads = getStoredChatThreads();
  const threadIndex = threads.findIndex((t) => t.id === threadId);
  if (threadIndex >= 0) {
    threads[threadIndex].subtitle = `Tú: ${message.text}`;
    threads[threadIndex].lastMessageTime = 'Ahora';
    saveStoredChatThreads(threads);
  }
}

