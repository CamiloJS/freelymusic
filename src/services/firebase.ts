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
import { Song, UserProfile, UserLibraryData, FirebaseConfigOptions } from '../types';
import { getStoredFirebaseConfig } from './storage';

let firebaseApp: FirebaseApp | null = null;
let db: Firestore | null = null;

export function initFirebase(config?: FirebaseConfigOptions | null): boolean {
  try {
    const finalConfig = config || getStoredFirebaseConfig() || {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    };

    if (!finalConfig.projectId || !finalConfig.apiKey) {
      console.info('Firebase is not yet configured. Operating in high-performance local/offline mode.');
      return false;
    }

    if (getApps().length === 0) {
      firebaseApp = initializeApp(finalConfig);
    } else {
      firebaseApp = getApps()[0];
    }

    db = getFirestore(firebaseApp);
    console.info('Firebase Firestore connected successfully.');
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
    const snapshot = await getDocs(collection(db, 'catalog'));
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
    await setDoc(doc(db, 'catalog', song.id), song, { merge: true });
  } catch (err) {
    console.warn('Error saving song to Firestore:', err);
  }
}

export async function deleteSongFromFirestore(songId: string): Promise<void> {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'catalog', songId));
  } catch (err) {
    console.warn('Error deleting song from Firestore:', err);
  }
}

// Firestore operations for Profiles
export async function syncProfilesFromFirestore(): Promise<UserProfile[] | null> {
  if (!db) return null;
  try {
    const snapshot = await getDocs(collection(db, 'profiles'));
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
    await setDoc(doc(db, 'profiles', profile.id), profile, { merge: true });
  } catch (err) {
    console.warn('Error saving profile to Firestore:', err);
  }
}

export async function deleteProfileFromFirestore(profileId: string): Promise<void> {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'profiles', profileId));
  } catch (err) {
    console.warn('Error deleting profile from Firestore:', err);
  }
}

// Firestore operations for User Library Data
export async function syncUserDataFromFirestore(userId: string): Promise<UserLibraryData | null> {
  if (!db) return null;
  try {
    const snapshot = await getDocs(collection(db, 'usersData'));
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
    await setDoc(doc(db, 'usersData', userId), data, { merge: true });
  } catch (err) {
    console.warn('Error saving user data to Firestore:', err);
  }
}

// Live realtime listener for catalog updates
export function subscribeToCatalogUpdates(onUpdate: (songs: Song[]) => void): (() => void) | null {
  if (!db) return null;
  try {
    const unsubscribe = onSnapshot(collection(db, 'catalog'), (snapshot) => {
      const songs: Song[] = [];
      snapshot.forEach((d) => songs.push(d.data() as Song));
      if (songs.length > 0) {
        onUpdate(songs);
      }
    });
    return unsubscribe;
  } catch {
    return null;
  }
}
