import JSZip from 'jszip';
import { Song, UserProfile, UserLibraryData, FirebaseConfigOptions, Playlist } from '../types';

const DB_NAME = 'sonora-audio-cache';
const DB_VERSION = 1;
const STORE_NAME = 'audio-blobs';

// IndexedDB Helper
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
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
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSongBlob(songId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(songId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllDownloadedSongIds(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAllKeys();
    request.onsuccess = () => resolve((request.result as string[]) || []);
    request.onerror = () => reject(request.error);
  });
}

export async function isSongDownloaded(songId: string): Promise<boolean> {
  const blob = await getSongBlob(songId);
  return blob !== null;
}

/**
 * Downloads audio file and caches it inside IndexedDB for 100% offline playback
 */
export async function cacheSongOffline(song: Song): Promise<boolean> {
  try {
    const res = await fetch(song.audioUrl);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const blob = await res.blob();
    await storeSongBlob(song.id, blob);
    return true;
  } catch (err) {
    console.error(`Failed to cache song ${song.title} offline:`, err);
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
  },
];

export const INITIAL_CATALOG: Song[] = [];

const DELETED_SONGS_KEY = 'sonora_deleted_song_ids';

export function getStoredDeletedSongIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_SONGS_KEY);
    if (!raw) return new Set<string>();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set<string>();
  }
}

export function addStoredDeletedSongId(id: string): void {
  try {
    const current = getStoredDeletedSongIds();
    current.add(id);
    localStorage.setItem(DELETED_SONGS_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // ignore
  }
}

// LocalStorage Handlers
export function getStoredCatalog(): Song[] {
  try {
    const raw = localStorage.getItem(KEYS.CATALOG);
    if (!raw) {
      return [];
    }
    const parsed: Song[] = JSON.parse(raw);
    const deleted = getStoredDeletedSongIds();
    return parsed.filter(
      (s) => s.id !== 'track-1' && s.id !== 'track-2' && s.id !== 'track-3' && !deleted.has(s.id)
    );
  } catch {
    return [];
  }
}

export function saveStoredCatalog(songs: Song[]): void {
  const deleted = getStoredDeletedSongIds();
  const cleaned = songs.filter(
    (s) => s.id !== 'track-1' && s.id !== 'track-2' && s.id !== 'track-3' && !deleted.has(s.id)
  );
  localStorage.setItem(KEYS.CATALOG, JSON.stringify(cleaned));
}

export function getStoredProfiles(): UserProfile[] {
  try {
    const raw = localStorage.getItem(KEYS.PROFILES);
    if (!raw) {
      localStorage.setItem(KEYS.PROFILES, JSON.stringify(INITIAL_PROFILES));
      return INITIAL_PROFILES;
    }
    const parsed: UserProfile[] = JSON.parse(raw);
    return parsed.map((p) => {
      // If profile had the unwanted lady photo, replace with Camilo's real avatar
      if (!p.avatarUrl || p.avatarUrl.includes('photo-1534528741775-53994a69daeb')) {
        return { ...p, avatarUrl: CAMILO_SAVED_AVATAR };
      }
      return p;
    });
  } catch {
    return INITIAL_PROFILES;
  }
}

export function saveStoredProfiles(profiles: UserProfile[]): void {
  localStorage.setItem(KEYS.PROFILES, JSON.stringify(profiles));
}

export function getStoredActiveUserId(): string {
  return localStorage.getItem(KEYS.ACTIVE_USER) || 'camilo-admin';
}

export function saveStoredActiveUserId(userId: string): void {
  localStorage.setItem(KEYS.ACTIVE_USER, userId);
}

export function getStoredUserData(userId: string): UserLibraryData {
  try {
    const raw = localStorage.getItem(`${KEYS.USER_DATA_PREFIX}${userId}`);
    if (!raw) {
      const defaultData: UserLibraryData = {
        favoriteSongIds: [],
        historySongIds: [],
        playlists: [
          {
            id: `pl-${userId}-1`,
            name: 'Favoritos de Sonora',
            description: 'Mis canciones destacadas guardadas de la nube',
            coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
            userId: userId,
            songIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        ],
      };
      localStorage.setItem(`${KEYS.USER_DATA_PREFIX}${userId}`, JSON.stringify(defaultData));
      return defaultData;
    }
    return JSON.parse(raw);
  } catch {
    return {
      favoriteSongIds: [],
      historySongIds: [],
      playlists: [],
    };
  }
}

export function saveStoredUserData(userId: string, data: UserLibraryData): void {
  localStorage.setItem(`${KEYS.USER_DATA_PREFIX}${userId}`, JSON.stringify(data));
}

export function getStoredFirebaseConfig(): FirebaseConfigOptions | null {
  try {
    const raw = localStorage.getItem(KEYS.FIREBASE_CONFIG);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveStoredFirebaseConfig(config: FirebaseConfigOptions | null): void {
  if (config) {
    localStorage.setItem(KEYS.FIREBASE_CONFIG, JSON.stringify(config));
  } else {
    localStorage.removeItem(KEYS.FIREBASE_CONFIG);
  }
}

// Session Lock / Authentication storage
export function getStoredActiveSessionUserId(): string | null {
  return localStorage.getItem(KEYS.SESSION_USER);
}

export function saveStoredActiveSessionUserId(userId: string | null): void {
  if (userId) {
    localStorage.setItem(KEYS.SESSION_USER, userId);
  } else {
    localStorage.removeItem(KEYS.SESSION_USER);
  }
}

// Recent searches storage (max 10 recent searches)
export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(KEYS.RECENT_SEARCHES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
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
  try {
    localStorage.setItem(KEYS.RECENT_SEARCHES, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

export function removeRecentSearch(term: string): string[] {
  const current = getRecentSearches();
  const updated = current.filter((item) => item.toLowerCase() !== term.toLowerCase());
  try {
    localStorage.setItem(KEYS.RECENT_SEARCHES, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

export function clearRecentSearches(): void {
  localStorage.removeItem(KEYS.RECENT_SEARCHES);
}

