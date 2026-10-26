import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Song, Playlist, UserLibraryData } from '../types';
import { useAuth } from './AuthContext';
import {
  getStoredCatalog,
  saveStoredCatalog,
  getStoredUserData,
  saveStoredUserData,
  cacheSongOffline,
  deleteSongBlob,
  getAllDownloadedSongIds,
  downloadSongFile,
  downloadPlaylistAsZip,
} from '../services/storage';
import {
  syncCatalogFromFirestore,
  saveSongToFirestore,
  deleteSongFromFirestore,
  syncUserDataFromFirestore,
  saveUserDataToFirestore,
  subscribeToCatalogUpdates,
} from '../services/firebase';

interface MusicContextType {
  catalog: Song[];
  addTrackToCatalog: (song: Omit<Song, 'id' | 'createdAt' | 'addedBy'>) => Song;
  updateCatalogTrack: (song: Song) => void;
  deleteCatalogTrack: (songId: string) => void;

  // Current user's library
  favoriteSongIds: string[];
  toggleFavorite: (songId: string) => void;
  isFavorite: (songId: string) => boolean;
  userFavoriteSongs: Song[];

  playlists: Playlist[];
  createPlaylist: (name: string, description?: string, coverUrl?: string) => Playlist;
  updatePlaylist: (playlist: Playlist) => void;
  deletePlaylist: (playlistId: string) => void;
  addSongToPlaylist: (playlistId: string, songId: string) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;

  // Offline caching
  downloadedSongIds: string[];
  isDownloaded: (songId: string) => boolean;
  toggleDownloadSong: (song: Song) => Promise<boolean>;
  downloadSingleSongFile: (song: Song) => Promise<void>;
  downloadFullPlaylistZip: (
    playlist: Playlist,
    onProgress?: (percent: number, status: string) => void
  ) => Promise<void>;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [catalog, setCatalog] = useState<Song[]>(() => getStoredCatalog());
  const [userData, setUserData] = useState<UserLibraryData>(() => getStoredUserData(currentUser.id));
  const [downloadedSongIds, setDownloadedSongIds] = useState<string[]>([]);

  // Refresh user data when active user changes
  useEffect(() => {
    const data = getStoredUserData(currentUser.id);
    setUserData(data);

    // Sync user data from Firestore if available
    syncUserDataFromFirestore(currentUser.id).then((cloudData) => {
      if (cloudData) {
        setUserData(cloudData);
        saveStoredUserData(currentUser.id, cloudData);
      }
    });
  }, [currentUser.id]);

  // Sync catalog from Firestore & setup listener
  useEffect(() => {
    syncCatalogFromFirestore().then((cloudSongs) => {
      if (cloudSongs && cloudSongs.length > 0) {
        setCatalog(cloudSongs);
        saveStoredCatalog(cloudSongs);
      }
    });

    const unsubscribe = subscribeToCatalogUpdates((updatedCatalog) => {
      setCatalog(updatedCatalog);
      saveStoredCatalog(updatedCatalog);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Sync offline downloaded song IDs
  const refreshDownloadedIds = useCallback(async () => {
    try {
      const ids = await getAllDownloadedSongIds();
      setDownloadedSongIds(ids);
    } catch (e) {
      console.warn('Could not read offline storage IDs:', e);
    }
  }, []);

  useEffect(() => {
    refreshDownloadedIds();
  }, [refreshDownloadedIds]);

  // Catalog actions
  const addTrackToCatalog = (songData: Omit<Song, 'id' | 'createdAt' | 'addedBy'>): Song => {
    const newSong: Song = {
      ...songData,
      id: `song-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      addedBy: currentUser.id,
      createdAt: new Date().toISOString(),
    };

    const updated = [newSong, ...catalog];
    setCatalog(updated);
    saveStoredCatalog(updated);
    saveSongToFirestore(newSong);

    return newSong;
  };

  const updateCatalogTrack = (song: Song) => {
    const updated = catalog.map((s) => (s.id === song.id ? song : s));
    setCatalog(updated);
    saveStoredCatalog(updated);
    saveSongToFirestore(song);
  };

  const deleteCatalogTrack = (songId: string) => {
    const updated = catalog.filter((s) => s.id !== songId);
    setCatalog(updated);
    saveStoredCatalog(updated);
    deleteSongFromFirestore(songId);
    deleteSongBlob(songId);
    refreshDownloadedIds();
  };

  // User Library Favorites
  const isFavorite = useCallback(
    (songId: string) => userData.favoriteSongIds.includes(songId),
    [userData.favoriteSongIds]
  );

  const toggleFavorite = (songId: string) => {
    const isFav = userData.favoriteSongIds.includes(songId);
    const updatedFavorites = isFav
      ? userData.favoriteSongIds.filter((id) => id !== songId)
      : [...userData.favoriteSongIds, songId];

    const updatedData: UserLibraryData = {
      ...userData,
      favoriteSongIds: updatedFavorites,
    };

    setUserData(updatedData);
    saveStoredUserData(currentUser.id, updatedData);
    saveUserDataToFirestore(currentUser.id, updatedData);
  };

  const userFavoriteSongs = catalog.filter((s) => userData.favoriteSongIds.includes(s.id));

  // User Playlists
  const createPlaylist = (name: string, description = '', coverUrl = ''): Playlist => {
    const defaultCovers = [
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
    ];

    const newPlaylist: Playlist = {
      id: `pl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      description,
      coverUrl: coverUrl || defaultCovers[Math.floor(Math.random() * defaultCovers.length)],
      userId: currentUser.id,
      songIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedPlaylists = [...userData.playlists, newPlaylist];
    const updatedData = { ...userData, playlists: updatedPlaylists };
    setUserData(updatedData);
    saveStoredUserData(currentUser.id, updatedData);
    saveUserDataToFirestore(currentUser.id, updatedData);

    return newPlaylist;
  };

  const updatePlaylist = (playlist: Playlist) => {
    const updatedPlaylists = userData.playlists.map((p) =>
      p.id === playlist.id ? { ...playlist, updatedAt: new Date().toISOString() } : p
    );
    const updatedData = { ...userData, playlists: updatedPlaylists };
    setUserData(updatedData);
    saveStoredUserData(currentUser.id, updatedData);
    saveUserDataToFirestore(currentUser.id, updatedData);
  };

  const deletePlaylist = (playlistId: string) => {
    const updatedPlaylists = userData.playlists.filter((p) => p.id !== playlistId);
    const updatedData = { ...userData, playlists: updatedPlaylists };
    setUserData(updatedData);
    saveStoredUserData(currentUser.id, updatedData);
    saveUserDataToFirestore(currentUser.id, updatedData);
  };

  const addSongToPlaylist = (playlistId: string, songId: string) => {
    const targetPlaylist = userData.playlists.find((p) => p.id === playlistId);
    if (!targetPlaylist) return;
    if (targetPlaylist.songIds.includes(songId)) return;

    const updatedPlaylist = {
      ...targetPlaylist,
      songIds: [...targetPlaylist.songIds, songId],
      updatedAt: new Date().toISOString(),
    };
    updatePlaylist(updatedPlaylist);
  };

  const removeSongFromPlaylist = (playlistId: string, songId: string) => {
    const targetPlaylist = userData.playlists.find((p) => p.id === playlistId);
    if (!targetPlaylist) return;

    const updatedPlaylist = {
      ...targetPlaylist,
      songIds: targetPlaylist.songIds.filter((id) => id !== songId),
      updatedAt: new Date().toISOString(),
    };
    updatePlaylist(updatedPlaylist);
  };

  // Offline Downloads
  const isDownloaded = useCallback(
    (songId: string) => downloadedSongIds.includes(songId),
    [downloadedSongIds]
  );

  const toggleDownloadSong = async (song: Song): Promise<boolean> => {
    if (isDownloaded(song.id)) {
      await deleteSongBlob(song.id);
      await refreshDownloadedIds();
      return false;
    } else {
      const ok = await cacheSongOffline(song);
      if (ok) {
        await refreshDownloadedIds();
      }
      return ok;
    }
  };

  const downloadSingleSongFile = async (song: Song) => {
    await downloadSongFile(song);
  };

  const downloadFullPlaylistZip = async (
    playlist: Playlist,
    onProgress?: (percent: number, status: string) => void
  ) => {
    const songsInPlaylist = playlist.songIds
      .map((id) => catalog.find((s) => s.id === id))
      .filter((s): s is Song => Boolean(s));

    await downloadPlaylistAsZip(playlist, songsInPlaylist, onProgress);
  };

  return (
    <MusicContext.Provider
      value={{
        catalog,
        addTrackToCatalog,
        updateCatalogTrack,
        deleteCatalogTrack,
        favoriteSongIds: userData.favoriteSongIds,
        toggleFavorite,
        isFavorite,
        userFavoriteSongs,
        playlists: userData.playlists,
        createPlaylist,
        updatePlaylist,
        deletePlaylist,
        addSongToPlaylist,
        removeSongFromPlaylist,
        downloadedSongIds,
        isDownloaded,
        toggleDownloadSong,
        downloadSingleSongFile,
        downloadFullPlaylistZip,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) throw new Error('useMusic must be used within a MusicProvider');
  return context;
};
