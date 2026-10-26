import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import {
  getStoredProfiles,
  saveStoredProfiles,
  getStoredActiveUserId,
  saveStoredActiveUserId,
  INITIAL_PROFILES,
} from '../services/storage';
import {
  syncProfilesFromFirestore,
  saveProfileToFirestore,
  deleteProfileFromFirestore,
} from '../services/firebase';

interface AuthContextType {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  isAdmin: boolean;
  switchUser: (userId: string) => void;
  createProfile: (data: { username: string; displayName: string; role: UserRole; avatarUrl?: string; pin?: string }) => UserProfile;
  updateProfile: (profile: UserProfile) => void;
  deleteProfile: (userId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => getStoredProfiles());
  const [activeUserId, setActiveUserId] = useState<string>(() => getStoredActiveUserId());

  // Firestore initial sync
  useEffect(() => {
    syncProfilesFromFirestore().then((cloudProfiles) => {
      if (cloudProfiles && cloudProfiles.length > 0) {
        setAllUsers(cloudProfiles);
        saveStoredProfiles(cloudProfiles);
      }
    });
  }, []);

  const currentUser = allUsers.find((u) => u.id === activeUserId) || allUsers[0] || INITIAL_PROFILES[0];
  const isAdmin = currentUser.role === 'admin';

  const switchUser = (userId: string) => {
    const target = allUsers.find((u) => u.id === userId);
    if (target) {
      setActiveUserId(userId);
      saveStoredActiveUserId(userId);
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
    saveProfileToFirestore(newProfile);

    return newProfile;
  };

  const updateProfile = (profile: UserProfile) => {
    const updated = allUsers.map((u) => (u.id === profile.id ? profile : u));
    setAllUsers(updated);
    saveStoredProfiles(updated);
    saveProfileToFirestore(profile);
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
    deleteProfileFromFirestore(userId);

    if (activeUserId === userId) {
      const fallback = updated[0].id;
      setActiveUserId(fallback);
      saveStoredActiveUserId(fallback);
    }
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        allUsers,
        isAdmin,
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
