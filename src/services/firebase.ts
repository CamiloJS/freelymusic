import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  Firestore,
  onSnapshot
} from 'firebase/firestore';
import { getAuth, signInAnonymously, Auth } from 'firebase/auth';
import { Song, UserProfile, UserLibraryData, FirebaseConfigOptions, ArtistProfile } from '../types';
import {
  getStoredFirebaseConfig,
  normalizeSong,
  normalizeUserProfile,
  normalizeUserData,
} from './storage';

type Unsubscribe = () => void;
type ErrorHandler = (error: unknown) => void;

export const DEFAULT_FIREBASE_CONFIG: FirebaseConfigOptions = {
  apiKey: "AIzaSyB-BDGpMhiNjSfGiGiGHHd6jbu5nQvoOfs",
  authDomain: "ginadocente-unipamplona.firebaseapp.com",
  projectId: "ginadocente-unipamplona",
  storageBucket: "ginadocente-unipamplona.firebasestorage.app",
  messagingSenderId: "628380121872",
  appId: "1:628380121872:web:4766b1e2964b023f838395",
};

let firebaseApp: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let authReadyPromise: Promise<boolean> | null = null;

export async function ensureAuth(): Promise<boolean> {
  if (!auth) return false;
  if (auth.currentUser) return true;
  if (authReadyPromise) return authReadyPromise;

  authReadyPromise = signInAnonymously(auth)
    .then(() => true)
    .catch((err) => {
      console.warn('Firebase anonymous authentication error:', err);
      authReadyPromise = null;
      return false;
    });

  return authReadyPromise;
}

// Authorized path matching firestore.rules in ginadocente-unipamplona:
// match /artifacts/{appId} { match /public/data/{document=**} { allow read: if isAuth(); allow write: if isAuth(); } }
const BASE_PATH = ['artifacts', 'freelymusic', 'public', 'data'] as const;

export function initFirebase(config?: FirebaseConfigOptions | null): boolean {
  try {
    const finalConfig =
      config ||
      getStoredFirebaseConfig() || {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
        appId: import.meta.env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
      };

    if (!finalConfig.projectId || !finalConfig.apiKey) {
      console.info('Firebase credentials missing. Operating in local offline mode.');
      return false;
    }

    if (getApps().length === 0) {
      firebaseApp = initializeApp(finalConfig);
    } else {
      firebaseApp = getApps()[0];
    }

    auth = getAuth(firebaseApp);

    // Persistent cache: catalog, profiles and library data are available
    // immediately on the next visit (even offline) and are kept in sync in
    // the background, instead of starting from an empty screen every time.
    try {
      db = initializeFirestore(firebaseApp, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
        // Songs/profiles contain optional fields set to undefined. Without
        // this, Firestore rejects the whole write with "Unsupported field value".
        ignoreUndefinedProperties: true,
      });
    } catch {
      // HMR / repeated initialization: reuse the existing Firestore instance.
      db = getFirestore(firebaseApp);
    }

    // Authenticate anonymously so security rules permit read/write operations
    ensureAuth();

    console.info('Firebase connected with authenticated session to:', finalConfig.projectId);
    return true;
  } catch (err) {
    console.warn('Firebase initialization error, running in offline fallback:', err);
    return false;
  }
}

// Auto init on load
initFirebase();

export function isFirebaseConnected(): boolean {
  return db !== null;
}

// Listeners must be created only after anonymous auth has completed. Starting
// onSnapshot() before signInAnonymously() finishes can produce a permanent
// PERMISSION_DENIED error, leaving a new device with an empty catalog.
async function subscribeWhenReady(
  setup: () => Unsubscribe,
  onError?: ErrorHandler
): Promise<Unsubscribe | null> {
  if (!db) return null;

  const authenticated = await ensureAuth();
  if (!authenticated) return null;

  try {
    return setup();
  } catch (err) {
    console.warn('Firestore listener setup error:', err);
    onError?.(err);
    return null;
  }
}

// Firestore operations for Songs Catalog
export async function syncCatalogFromFirestore(): Promise<Song[] | null> {
  if (!db) return null;
  try {
    await ensureAuth();
    const snapshot = await getDocs(collection(db, ...BASE_PATH, 'catalog'));
    const songs: Song[] = [];
    snapshot.forEach((d) => {
      const song = normalizeSong(d.data() as Partial<Song>);
      if (song) songs.push(song);
    });
    return songs;
  } catch (err) {
    console.warn('Error fetching catalog from Firestore:', err);
    return null;
  }
}

export async function saveSongToFirestore(song: Song): Promise<boolean> {
  if (!db) return false;
  const cleanSong = normalizeSong(song);
  if (!cleanSong) return false;

  try {
    await ensureAuth();
    await setDoc(doc(db, ...BASE_PATH, 'catalog', cleanSong.id), cleanSong, { merge: true });
    return true;
  } catch (err) {
    console.warn('Error saving song to Firestore:', err);
    return false;
  }
}

export async function saveSongsToFirestore(songs: Song[]): Promise<boolean> {
  const cleanSongs = songs
    .map((song) => normalizeSong(song))
    .filter((song): song is Song => Boolean(song));
  if (!db || cleanSongs.length === 0) return false;

  try {
    await ensureAuth();
    const batch = writeBatch(db);
    cleanSongs.forEach((song) => {
      batch.set(doc(db!, ...BASE_PATH, 'catalog', song.id), song, { merge: true });
    });
    await batch.commit();
    return true;
  } catch (err) {
    console.warn('Error saving songs batch to Firestore:', err);
    return false;
  }
}

export async function deleteSongFromFirestore(songId: string): Promise<boolean> {
  if (!db) return false;
  try {
    await ensureAuth();
    await deleteDoc(doc(db, ...BASE_PATH, 'catalog', songId));
    return true;
  } catch (err) {
    console.warn('Error deleting song from Firestore:', err);
    return false;
  }
}

// Firestore operations for Profiles
export async function syncProfilesFromFirestore(): Promise<UserProfile[] | null> {
  if (!db) return null;
  try {
    await ensureAuth();
    const snapshot = await getDocs(collection(db, ...BASE_PATH, 'profiles'));
    const profiles: UserProfile[] = [];
    snapshot.forEach((d) => {
      const raw = d.data() as Partial<UserProfile>;
      const profile = normalizeUserProfile(raw);
      if (!profile) return;

      profiles.push(profile);

      // One-time migration of the old 64 KB base64 avatar to the public asset.
      // This keeps future profile syncs small for every device.
      if (typeof raw.avatarUrl === 'string' && raw.avatarUrl !== profile.avatarUrl) {
        void setDoc(doc(db!, ...BASE_PATH, 'profiles', profile.id), profile, {
          merge: true,
        }).catch((err) => console.warn('No se pudo migrar el avatar del perfil:', err));
      }
    });
    return profiles.length > 0 ? profiles : null;
  } catch (err) {
    console.warn('Error fetching profiles from Firestore:', err);
    return null;
  }
}

export async function saveProfileToFirestore(profile: UserProfile): Promise<void> {
  if (!db) return;
  const cleanProfile = normalizeUserProfile(profile);
  if (!cleanProfile) return;

  try {
    await ensureAuth();
    await setDoc(doc(db, ...BASE_PATH, 'profiles', cleanProfile.id), cleanProfile, { merge: true });
  } catch (err) {
    console.warn('Error saving profile to Firestore:', err);
  }
}

export async function deleteProfileFromFirestore(profileId: string): Promise<void> {
  if (!db) return;
  try {
    await ensureAuth();
    await deleteDoc(doc(db, ...BASE_PATH, 'profiles', profileId));
  } catch (err) {
    console.warn('Error deleting profile from Firestore:', err);
  }
}

// Realtime listener for profiles across devices
export function subscribeToProfilesUpdates(
  onUpdate: (profiles: UserProfile[]) => void,
  onError?: ErrorHandler
): Promise<Unsubscribe | null> {
  return subscribeWhenReady(() => {
    if (!db) return () => undefined;
    return onSnapshot(
      collection(db, ...BASE_PATH, 'profiles'),
      (snapshot) => {
        const profiles: UserProfile[] = [];
        snapshot.forEach((d) => {
          const raw = d.data() as Partial<UserProfile>;
          const profile = normalizeUserProfile(raw);
          if (!profile) return;
          profiles.push(profile);

          if (typeof raw.avatarUrl === 'string' && raw.avatarUrl !== profile.avatarUrl) {
            void setDoc(doc(db!, ...BASE_PATH, 'profiles', profile.id), profile, {
              merge: true,
            }).catch((err) => console.warn('No se pudo migrar el avatar del perfil:', err));
          }
        });
        onUpdate(profiles);
      },
      (err) => onError?.(err)
    );
  }, onError);
}

// Firestore operations for User Library Data
export async function syncUserDataFromFirestore(userId: string): Promise<UserLibraryData | null> {
  if (!db) return null;
  try {
    await ensureAuth();
    // Read only this user's document. The old code downloaded the whole
    // usersData collection and filtered it in the browser.
    const snapshot = await getDoc(doc(db, ...BASE_PATH, 'usersData', userId));
    if (!snapshot.exists()) return null;
    return normalizeUserData(snapshot.data() as Partial<UserLibraryData>);
  } catch (err) {
    console.warn('Error syncing user data from Firestore:', err);
    return null;
  }
}

export async function saveUserDataToFirestore(userId: string, data: UserLibraryData): Promise<void> {
  if (!db) return;
  try {
    await ensureAuth();
    const cleanData = normalizeUserData(data);
    await setDoc(doc(db, ...BASE_PATH, 'usersData', userId), cleanData, { merge: true });
  } catch (err) {
    console.warn('Error saving user data to Firestore:', err);
  }
}

export function subscribeToUserDataUpdates(
  userId: string,
  onUpdate: (data: UserLibraryData) => void,
  onError?: ErrorHandler
): Promise<Unsubscribe | null> {
  return subscribeWhenReady(() => {
    if (!db) return () => undefined;
    return onSnapshot(
      doc(db, ...BASE_PATH, 'usersData', userId),
      (snapshot) => {
        if (!snapshot.exists()) return;
        onUpdate(normalizeUserData(snapshot.data() as Partial<UserLibraryData>));
      },
      (err) => onError?.(err)
    );
  }, onError);
}

// Live realtime listener for catalog updates
export function subscribeToCatalogUpdates(
  onUpdate: (songs: Song[]) => void,
  onError?: ErrorHandler
): Promise<Unsubscribe | null> {
  return subscribeWhenReady(() => {
    if (!db) return () => undefined;
    return onSnapshot(
      collection(db, ...BASE_PATH, 'catalog'),
      (snapshot) => {
        const songs: Song[] = [];
        snapshot.forEach((d) => {
          const song = normalizeSong(d.data() as Partial<Song>);
          if (song) songs.push(song);
        });
        onUpdate(songs);
      },
      (err) => onError?.(err)
    );
  }, onError);
}

// Global App Customization Settings (App Name & Admin Icon Gallery)
export interface GlobalAppSettings {
  globalAppName?: string;
  globalIcons?: string[];
}

export async function syncGlobalSettingsFromFirestore(): Promise<GlobalAppSettings | null> {
  if (!db) return null;
  try {
    await ensureAuth();
    const snap = await getDoc(doc(db, ...BASE_PATH, 'appSettings', 'global'));
    if (snap.exists()) {
      return snap.data() as GlobalAppSettings;
    }
    return null;
  } catch (err) {
    console.warn('Error fetching global settings from Firestore:', err);
    return null;
  }
}

export async function saveGlobalSettingsToFirestore(settings: GlobalAppSettings): Promise<void> {
  if (!db) return;
  try {
    await ensureAuth();
    await setDoc(doc(db, ...BASE_PATH, 'appSettings', 'global'), settings, { merge: true });
  } catch (err) {
    console.warn('Error saving global settings to Firestore:', err);
  }
}

export function subscribeToGlobalSettingsUpdates(
  onUpdate: (settings: GlobalAppSettings) => void,
  onError?: ErrorHandler
): Promise<Unsubscribe | null> {
  return subscribeWhenReady(() => {
    if (!db) return () => undefined;
    return onSnapshot(
      doc(db, ...BASE_PATH, 'appSettings', 'global'),
      (snap) => {
        if (snap.exists()) {
          onUpdate(snap.data() as GlobalAppSettings);
        }
      },
      (err) => onError?.(err)
    );
  }, onError);
}

// Artist Profiles Firestore Operations
export async function syncArtistProfilesFromFirestore(): Promise<ArtistProfile[] | null> {
  if (!db) return null;
  try {
    await ensureAuth();
    const snapshot = await getDocs(collection(db, ...BASE_PATH, 'artists'));
    const artists: ArtistProfile[] = [];
    snapshot.forEach((d) => {
      artists.push(d.data() as ArtistProfile);
    });
    return artists;
  } catch (err) {
    console.warn('Error fetching artist profiles from Firestore:', err);
    return null;
  }
}

export async function saveArtistProfileToFirestore(artist: ArtistProfile): Promise<void> {
  if (!db) return;
  try {
    await ensureAuth();
    const artistId = artist.id || artist.name.trim().toLowerCase();
    await setDoc(doc(db, ...BASE_PATH, 'artists', artistId), { ...artist, id: artistId }, { merge: true });
  } catch (err) {
    console.warn('Error saving artist profile to Firestore:', err);
  }
}

export function subscribeToArtistProfilesUpdates(
  onUpdate: (artists: ArtistProfile[]) => void,
  onError?: ErrorHandler
): Promise<Unsubscribe | null> {
  return subscribeWhenReady(() => {
    if (!db) return () => undefined;
    return onSnapshot(
      collection(db, ...BASE_PATH, 'artists'),
      (snapshot) => {
        const artists: ArtistProfile[] = [];
        snapshot.forEach((d) => artists.push(d.data() as ArtistProfile));
        onUpdate(artists);
      },
      (err) => onError?.(err)
    );
  }, onError);
}
