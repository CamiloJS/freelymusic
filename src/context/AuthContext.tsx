import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import {
  getStoredProfiles,
  saveStoredProfiles,
  getStoredActiveUserId,
  saveStoredActiveUserId,
  getStoredActiveSessionUserId,
  saveStoredActiveSessionUserId,
  INITIAL_PROFILES,
} from '../services/storage';
import { loadFirebaseService } from '../services/firebaseLoader';

interface AuthContextType {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  isAdmin: boolean;
  isAuthenticated: boolean;
  login: (userId: string, pin?: string) => { success: boolean; error?: string };
  loginWithCredentials: (username: string, pin: string) => { success: boolean; error?: string };
  logout: () => void;
  switchUser: (userId: string) => void;
  createProfile: (data: { username: string; displayName: string; role: UserRole; avatarUrl?: string; pin?: string }) => UserProfile;
  updateProfile: (profile: UserProfile) => void;
  deleteProfile: (userId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => getStoredProfiles());
  const [activeUserId, setActiveUserId] = useState<string>(() => {
    return getStoredActiveSessionUserId() || getStoredActiveUserId() || 'camilo-admin';
  });
  
  // Track if this browser/device is currently authenticated
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(getStoredActiveSessionUserId());
  });

  // Firestore initial sync & live updates
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    const localProfiles = getStoredProfiles();

    loadFirebaseService()
      .then(async (firebase) => {
        const cloudProfiles = await firebase.syncProfilesFromFirestore();
        if (cancelled) return;

        if (cloudProfiles && cloudProfiles.length > 0) {
          setAllUsers(cloudProfiles);
          saveStoredProfiles(cloudProfiles);
        } else {
          // First time initializing Firestore database with profiles
          for (const profile of localProfiles) {
            await firebase.saveProfileToFirestore(profile);
          }
        }
      })
      .catch((err) => console.warn('No se pudieron cargar los perfiles:', err));

    loadFirebaseService()
      .then((firebase) =>
        firebase.subscribeToProfilesUpdates(
          (cloudProfiles) => {
            if (cancelled) return;
            if (cloudProfiles && cloudProfiles.length > 0) {
              setAllUsers(cloudProfiles);
              saveStoredProfiles(cloudProfiles);
            }
          },
          (err) => console.warn('No se pudieron sincronizar los perfiles:', err)
        )
      )
      .then((unsub) => {
        if (cancelled) {
          unsub?.();
        } else {
          unsubscribe = unsub;
        }
      })
      .catch((err) => console.warn('No se pudo escuchar los perfiles:', err));

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const currentUser = allUsers.find((u) => u.id === activeUserId) || allUsers[0] || INITIAL_PROFILES[0];
  const isAdmin = currentUser.role === 'admin';

  const login = (userId: string, pin?: string): { success: boolean; error?: string } => {
    const target = allUsers.find((u) => u.id === userId);
    if (!target) {
      return { success: false, error: 'Perfil no encontrado.' };
    }

    // Check PIN requirement strictly (default pin for Camilo is 2410)
    const requiredPin = target.pin || (target.id === 'camilo-admin' ? '2410' : undefined);
    if (requiredPin && requiredPin.trim() !== '') {
      if (!pin || pin.trim() !== requiredPin.trim()) {
        return { success: false, error: 'PIN incorrecto. Intenta de nuevo.' };
      }
    }

    setActiveUserId(target.id);
    saveStoredActiveUserId(target.id);
    saveStoredActiveSessionUserId(target.id);
    setIsAuthenticated(true);
    return { success: true };
  };

  const loginWithCredentials = (
    usernameInput: string,
    pinInput: string
  ): { success: boolean; error?: string } => {
    const trimmed = usernameInput.trim().toLowerCase();
    if (!trimmed) {
      return { success: false, error: 'Por favor ingresa tu nombre de usuario.' };
    }

    const target = allUsers.find(
      (u) =>
        u.username.toLowerCase() === trimmed ||
        u.displayName.toLowerCase() === trimmed ||
        (u.id === 'camilo-admin' && (trimmed === 'camilo' || trimmed === 'camilo jaimes'))
    );

    if (!target) {
      return { success: false, error: 'Usuario o contraseña incorrectos.' };
    }

    const requiredPin = target.pin || (target.id === 'camilo-admin' ? '2410' : undefined);
    if (requiredPin && requiredPin.trim() !== '') {
      if (!pinInput || pinInput.trim() !== requiredPin.trim()) {
        return { success: false, error: 'Usuario o contraseña incorrectos.' };
      }
    }

    setActiveUserId(target.id);
    saveStoredActiveUserId(target.id);
    saveStoredActiveSessionUserId(target.id);
    setIsAuthenticated(true);
    return { success: true };
  };

  const logout = () => {
    saveStoredActiveSessionUserId(null);
    setIsAuthenticated(false);
  };

  const switchUser = (userId: string) => {
    const target = allUsers.find((u) => u.id === userId);
    if (target) {
      setActiveUserId(userId);
      saveStoredActiveUserId(userId);
      saveStoredActiveSessionUserId(userId);
    }
  };

  const createProfile = (data: {
    username: string;
    displayName: string;
    role: UserRole;
    avatarUrl?: string;
    pin?: string;
  }): UserProfile => {
    if (!isAdmin) {
      throw new Error('Solo los administradores pueden crear nuevos perfiles.');
    }

    const defaultAvatars = [
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    ];

    const randomAvatar = defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];

    const newProfile: UserProfile = {
      id: `user-${Date.now()}`,
      username: data.username.toLowerCase().replace(/\s+/g, '_'),
      displayName: data.displayName,
      avatarUrl: data.avatarUrl || randomAvatar,
      role: data.role,
      pin: data.pin || undefined,
      createdAt: new Date().toISOString(),
    };

    const updated = [...allUsers, newProfile];
    setAllUsers(updated);
    saveStoredProfiles(updated);
    void loadFirebaseService()
      .then((firebase) => firebase.saveProfileToFirestore(newProfile))
      .catch((err) => console.warn('No se pudo guardar el perfil en la nube:', err));

    return newProfile;
  };

  const updateProfile = (profile: UserProfile) => {
    const updated = allUsers.map((u) => (u.id === profile.id ? profile : u));
    setAllUsers(updated);
    saveStoredProfiles(updated);
    void loadFirebaseService()
      .then((firebase) => firebase.saveProfileToFirestore(profile))
      .catch((err) => console.warn('No se pudo actualizar el perfil en la nube:', err));
  };

  const deleteProfile = (userId: string): boolean => {
    if (!isAdmin) return false;
    if (allUsers.length <= 1) {
      alert('No puedes eliminar el único perfil existente.');
      return false;
    }

    const updated = allUsers.filter((u) => u.id !== userId);
    setAllUsers(updated);
    saveStoredProfiles(updated);
    void loadFirebaseService()
      .then((firebase) => firebase.deleteProfileFromFirestore(userId))
      .catch((err) => console.warn('No se pudo borrar el perfil de la nube:', err));

    if (activeUserId === userId) {
      const fallback = updated[0].id;
      setActiveUserId(fallback);
      saveStoredActiveUserId(fallback);
      saveStoredActiveSessionUserId(fallback);
    }
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        allUsers,
        isAdmin,
        isAuthenticated,
        login,
        loginWithCredentials,
        logout,
        switchUser,
        createProfile,
        updateProfile,
        deleteProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
