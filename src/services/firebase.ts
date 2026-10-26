import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  Firestore,
  onSnapshot
} from 'firebase/firestore';
import { getAuth, signInAnonymously, Auth } from 'firebase/auth';
import { Song, UserProfile, UserLibraryData, FirebaseConfigOptions } from '../types';
import { getStoredFirebaseConfig } from './storage';

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
    db = getFirestore(firebaseApp);

    // Authenticate anonymously so security rules permit read/write operations
    signInAnonymously(auth).catch((err) => {
      console.warn('Firebase anonymous authentication error:', err);
    });

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

// Firestore operations for Songs Catalog
export async function syncCatalogFromFirestore(): Promise<Song[] | null> {
  if (!db) return null;
  try {
    const snapshot = await getDocs(collection(db, ...BASE_PATH, 'catalog'));
    const songs: Song[] = [];
    snapshot.forEach((d) => {
      songs.push(d.data() as Song);
    });
    return songs;
  } catch (err) {
    console.warn('Error fetching catalog from Firestore:', err);
    return null;
  }
}

export async function saveSongToFirestore(song: Song): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, ...BASE_PATH, 'catalog', song.id), song, { merge: true });
  } catch (err) {
    console.warn('Error saving song to Firestore:', err);
  }
}

export async function deleteSongFromFirestore(songId: string): Promise<void> {
  if (!db) return;
  try {
    await deleteDoc(doc(db, ...BASE_PATH, 'catalog', songId));
  } catch (err) {
    console.warn('Error deleting song from Firestore:', err);
  }
}

// Firestore operations for Profiles
export async function syncProfilesFromFirestore(): Promise<UserProfile[] | null> {
  if (!db) return null;
  try {
    const snapshot = await getDocs(collection(db, ...BASE_PATH, 'profiles'));
    const profiles: UserProfile[] = [];
    snapshot.forEach((d) => {
      profiles.push(d.data() as UserProfile);
    });
    return profiles.length > 0 ? profiles : null;
  } catch (err) {
    console.warn('Error fetching profiles from Firestore:', err);
    return null;
  }
}

export async function saveProfileToFirestore(profile: UserProfile): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, ...BASE_PATH, 'profiles', profile.id), profile, { merge: true });
  } catch (err) {
    console.warn('Error saving profile to Firestore:', err);
  }
}

export async function deleteProfileFromFirestore(profileId: string): Promise<void> {
  if (!db) return;
  try {
    await deleteDoc(doc(db, ...BASE_PATH, 'profiles', profileId));
  } catch (err) {
    console.warn('Error deleting profile from Firestore:', err);
  }
}

// Realtime listener for profiles across devices
export function subscribeToProfilesUpdates(onUpdate: (profiles: UserProfile[]) => void): (() => void) | null {
  if (!db) return null;
  try {
    const unsubscribe = onSnapshot(collection(db, ...BASE_PATH, 'profiles'), (snapshot) => {
      const profiles: UserProfile[] = [];
      snapshot.forEach((d) => profiles.push(d.data() as UserProfile));
      onUpdate(profiles);
    });
    return unsubscribe;
  } catch {
    return null;
  }
}

// Firestore operations for User Library Data
export async function syncUserDataFromFirestore(userId: string): Promise<UserLibraryData | null> {
  if (!db) return null;
  try {
    const snapshot = await getDocs(collection(db, ...BASE_PATH, 'usersData'));
    let data: UserLibraryData | null = null;
    snapshot.forEach((d) => {
      if (d.id === userId) {
        data = d.data() as UserLibraryData;
      }
    });
    return data;
  } catch (err) {
    console.warn('Error syncing user data from Firestore:', err);
    return null;
  }
}

export async function saveUserDataToFirestore(userId: string, data: UserLibraryData): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, ...BASE_PATH, 'usersData', userId), data, { merge: true });
  } catch (err) {
    console.warn('Error saving user data to Firestore:', err);
  }
}

// Live realtime listener for catalog updates
export function subscribeToCatalogUpdates(onUpdate: (songs: Song[]) => void): (() => void) | null {
  if (!db) return null;
  try {
    const unsubscribe = onSnapshot(collection(db, ...BASE_PATH, 'catalog'), (snapshot) => {
      const songs: Song[] = [];
      snapshot.forEach((d) => songs.push(d.data() as Song));
      onUpdate(songs);
    });
    return unsubscribe;
  } catch {
    return null;
  }
}
