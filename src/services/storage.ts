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

// LocalStorage Keys
const KEYS = {
  CATALOG: 'sonora_cloud_catalog',
  PROFILES: 'sonora_user_profiles',
  ACTIVE_USER: 'sonora_active_user_id',
  USER_DATA_PREFIX: 'sonora_userdata_',
  FIREBASE_CONFIG: 'sonora_firebase_config',
};

// Default seed data for initial setup
export const INITIAL_PROFILES: UserProfile[] = [
  {
    id: 'camilo-admin',
    username: 'camilo',
    displayName: 'Camilo Jaimes',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    role: 'admin',
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_CATALOG: Song[] = [
  {
    id: 'track-1',
    title: 'Starboy (Electronic Chill)',
    artist: 'Cyber Sound',
    album: 'Neon Horizon',
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=600&q=80',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
    duration: 147,
    genre: 'Synthwave / Lofi',
    year: '2024',
    addedBy: 'camilo-admin',
    createdAt: new Date().toISOString(),
    lyricsLrc: `[00:00.00] Sonora - Audio Stream
[00:05.50] Siente el ritmo bajo las luces de neón
[00:15.20] La música fluye en la nube personal
[00:26.80] Cada nota conecta tu espacio privado
[00:40.10] Sonora reproduce en alta definición
[00:54.30] Guardado sin conexión para cualquier lugar
[01:12.00] Siempre disponible, siempre tuyo
[01:30.00] Fin de la transmisión`,
  },
  {
    id: 'track-2',
    title: 'Midnight City Lights',
    artist: 'Luna Groove',
    album: 'Nocturnal Vibes',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=spirit-blossom-15285.mp3',
    duration: 172,
    genre: 'Chillhop',
    year: '2024',
    addedBy: 'camilo-admin',
    createdAt: new Date().toISOString(),
    lyricsLrc: `[00:00.00] Luna Groove - Midnight City Lights
[00:10.00] Caminando por la ciudad a medianoche
[00:22.50] Los reflejos dorados en el asfalto mojado
[00:35.00] Tu biblioteca personalizada te acompaña
[00:50.00] Descarga en tu celular y escucha sin límites
[01:15.00] El sonido perfecto para descansar
[01:35.00] Sonora - Tu música en todo momento`,
  },
  {
    id: 'track-3',
    title: 'Retrowave Sunset Drive',
    artist: 'VaporPulse',
    album: 'Outrun 80s',
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=600&q=80',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=electronic-future-beats-117997.mp3',
    duration: 165,
    genre: 'Retrowave',
    year: '2024',
    addedBy: 'camilo-admin',
    createdAt: new Date().toISOString(),
    lyricsLrc: `[00:00.00] VaporPulse - Sunset Drive
[00:08.00] Acelerando hacia el atardecer púrpura
[00:18.00] Los sintetizadores despiertan la nostalgia
[00:32.00] Canciones añadidas por link a la nube
[00:48.00] Crea tus playlists favoritas con carátula personalizada
[01:05.00] Sonido envolvente con letras sincronizadas
[01:25.00] Sonora Music Platform`,
  }
];

// LocalStorage Handlers
export function getStoredCatalog(): Song[] {
  try {
    const raw = localStorage.getItem(KEYS.CATALOG);
    if (!raw) {
      localStorage.setItem(KEYS.CATALOG, JSON.stringify(INITIAL_CATALOG));
      return INITIAL_CATALOG;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_CATALOG;
  }
}

export function saveStoredCatalog(songs: Song[]): void {
  localStorage.setItem(KEYS.CATALOG, JSON.stringify(songs));
}

export function getStoredProfiles(): UserProfile[] {
  try {
    const raw = localStorage.getItem(KEYS.PROFILES);
    if (!raw) {
      localStorage.setItem(KEYS.PROFILES, JSON.stringify(INITIAL_PROFILES));
      return INITIAL_PROFILES;
    }
    return JSON.parse(raw);
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
