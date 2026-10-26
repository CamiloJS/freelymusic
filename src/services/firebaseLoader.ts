import type * as FirebaseService from './firebase';

/**
 * Firebase (Auth + Firestore) is by far the heaviest dependency of the app.
 * Loading it through a dynamic import keeps it out of the first paint: the
 * login screen becomes interactive immediately and the SDK is fetched in the
 * background, then reused by every context.
 */
let firebaseServicePromise: Promise<typeof FirebaseService> | null = null;

export function loadFirebaseService(): Promise<typeof FirebaseService> {
  if (!firebaseServicePromise) {
    firebaseServicePromise = import('./firebase').catch((error) => {
      firebaseServicePromise = null;
      console.warn('No se pudo cargar el servicio de Firebase:', error);
      throw error;
    });
  }
  return firebaseServicePromise;
}
