import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { Song, Playlist, Album, UserLibraryData, ArtistProfile, PlayEvent } from '../types';
import { useAuth } from './AuthContext';
import {
  getStoredCatalog,
  saveStoredCatalog,
  getStoredUserData,
  saveStoredUserData,
  getStoredDeletedSongIds,
  addStoredDeletedSongId,
  getStoredPendingSongs,
  addStoredPendingSong,
  removeStoredPendingSong,
  getStoredArtistProfiles,
  saveStoredArtistProfiles,
  saveStoredArtistProfile,
  cacheSongOffline,
  deleteSongBlob,
  getAllDownloadedSongIds,
  downloadSongFile,
  downloadPlaylistAsZip,
  normalizeSong,
  normalizeUserData,
} from '../services/storage';
import { loadFirebaseService } from '../services/firebaseLoader';

export interface DownloadingState {
  isDownloading: boolean;
  title?: string;
  progress?: number;
}

interface MusicContextType {
  catalog: Song[];
  librarySongs: Song[];
  isCatalogReady: boolean;
  addTrackToCatalog: (song: Omit<Song, 'id' | 'createdAt' | 'addedBy'>) => Song;
  addMultipleTracksToCatalog: (songs: Omit<Song, 'id' | 'createdAt' | 'addedBy'>[]) => Promise<Song[]>;
  updateCatalogTrack: (song: Song) => void;
  deleteCatalogTrack: (songId: string) => void;

  // Current user's library
  favoriteSongIds: string[];
  toggleFavorite: (songId: string) => void;
  isFavorite: (songId: string) => boolean;
  isSongInLibrary: (songId: string) => boolean;
  userFavoriteSongs: Song[];

  playlists: Playlist[];
  pinnedPlaylistIds: string[];
  isPlaylistPinned: (playlistId: string) => boolean;
  togglePlaylistPin: (playlistId: string) => void;
  savedAlbumNames: string[];
  isAlbumSaved: (albumName: string) => boolean;
  toggleSaveAlbum: (album: Album) => void;
  createPlaylist: (name: string, description?: string, coverUrl?: string) => Playlist;
  importPlaylist: (
    name: string,
    description: string,
    songIds: string[],
    coverUrl?: string
  ) => Playlist;
  updatePlaylist: (playlist: Playlist) => void;
  deletePlaylist: (playlistId: string) => void;
  addSongToPlaylist: (playlistId: string, songId: string) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;

  // Artist Profiles
  artistProfiles: ArtistProfile[];
  getArtistProfile: (artistName: string) => ArtistProfile | null;
  updateArtistProfile: (artist: ArtistProfile) => Promise<void>;
  followedArtists: string[];
  isFollowingArtist: (artistName: string) => boolean;
  toggleFollowArtist: (artistName: string) => void;

  // User Play Counts & Analytics
  recordSongPlay: (songId: string) => void;
  recordListeningTime: (songId: string, artist: string, seconds: number) => void;
  getUserSongPlayCount: (songId: string) => number;
  userPlayCounts: Record<string, number>;
  userPlayHistory: PlayEvent[];
  userTotalListenSeconds: number;
  userSongListenSeconds: Record<string, number>;
  userArtistListenSeconds: Record<string, number>;

  // Offline caching
  downloadedSongIds: string[];
  isDownloaded: (songId: string) => boolean;
  toggleDownloadSong: (song: Song) => Promise<boolean>;
  downloadSongsBatch: (songs: Song[]) => Promise<{ downloaded: number; failed: number }>;
  downloadSingleSongFile: (song: Song) => Promise<void>;
  downloadFullPlaylistZip: (
    playlist: Playlist,
    onProgress?: (percent: number, status: string) => void
  ) => Promise<void>;
  downloadingState: DownloadingState | null;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();
  const [catalog, setCatalog] = useState<Song[]>(() => getStoredCatalog());
  const [userData, setUserData] = useState<UserLibraryData>(() => getStoredUserData(currentUser.id));
  const [artistProfiles, setArtistProfiles] = useState<ArtistProfile[]>(() =>
    getStoredArtistProfiles()
  );
  const [downloadedSongIds, setDownloadedSongIds] = useState<string[]>([]);
  const [downloadingState, setDownloadingState] = useState<DownloadingState | null>(null);
  const [isCatalogReady, setIsCatalogReady] = useState<boolean>(
    () => getStoredCatalog().length > 0
  );

  const userDataRef = useRef(userData);
  const userSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    userDataRef.current = userData;
  }, [userData]);

  // Persist local changes immediately and coalesce cloud writes so actions
  // such as "favorite + add to playlist" do not fire several document writes.
  const scheduleUserDataSave = useCallback((userId: string, data: UserLibraryData) => {
    if (userSaveTimerRef.current) {
      clearTimeout(userSaveTimerRef.current);
    }
    userSaveTimerRef.current = setTimeout(() => {
      userSaveTimerRef.current = null;
      void loadFirebaseService()
        .then((firebase) => firebase.saveUserDataToFirestore(userId, data))
        .catch((err) => console.warn('No se pudo guardar la biblioteca en la nube:', err));
    }, 700);
  }, []);

  const mutateUserData = useCallback(
    (updater: (previous: UserLibraryData) => UserLibraryData) => {
      const previous = userDataRef.current;
      const next = normalizeUserData({
        ...updater(previous),
        updatedAt: new Date().toISOString(),
      });

      userDataRef.current = next;
      setUserData(next);
      saveStoredUserData(currentUser.id, next);
      scheduleUserDataSave(currentUser.id, next);
    },
    [currentUser.id, scheduleUserDataSave]
  );

  // Keep this user's library in sync across devices. Local (unflushed) data
  // wins when it has a newer updatedAt, so an offline edit is never lost.
  useEffect(() => {
    // Library data is private: do not read it from the cloud until the user
    // has actually unlocked this device.
    if (!isAuthenticated) return;

    const local = getStoredUserData(currentUser.id);
    userDataRef.current = local;
    setUserData(local);

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const applyCloudData = (cloudRaw: UserLibraryData) => {
      const cloud = normalizeUserData(cloudRaw);
      const currentLocal = userDataRef.current;

      if (cloud.updatedAt && cloud.updatedAt === currentLocal.updatedAt) {
        return;
      }

      const cloudTime = Date.parse(cloud.updatedAt || '') || 0;
      const localTime = Date.parse(currentLocal.updatedAt || '') || 0;

      if (!cloud.updatedAt || cloudTime >= localTime) {
        userDataRef.current = cloud;
        setUserData(cloud);
        saveStoredUserData(currentUser.id, cloud);
      } else {
        void loadFirebaseService()
          .then((firebase) => firebase.saveUserDataToFirestore(currentUser.id, currentLocal))
          .catch((err) => console.warn('No se pudo subir la biblioteca local:', err));
      }
    };

    loadFirebaseService()
      .then((firebase) =>
        firebase.subscribeToUserDataUpdates(currentUser.id, applyCloudData, (err) => {
          console.warn('No se pudo sincronizar la biblioteca del usuario:', err);
        })
      )
      .then((unsub) => {
        if (cancelled) {
          unsub?.();
        } else {
          unsubscribe = unsub;
        }
      })
      .catch((err) => console.warn('No se pudo escuchar la biblioteca del usuario:', err));

    return () => {
      cancelled = true;
      unsubscribe?.();

      if (userSaveTimerRef.current) {
        clearTimeout(userSaveTimerRef.current);
        userSaveTimerRef.current = null;
        void loadFirebaseService()
          .then((firebase) =>
            firebase.saveUserDataToFirestore(currentUser.id, userDataRef.current)
          )
          .catch((err) => console.warn('No se pudo guardar la biblioteca al salir:', err));
      }
    };
  }, [currentUser.id, isAuthenticated]);

  // Catalog: one realtime listener is the single source of truth. Local songs
  // are only kept in a small outbox, so a deleted track can never be
  // resurrected by another device's stale cache.
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    const readyTimer = setTimeout(() => setIsCatalogReady(true), 5000);

    const applyCatalog = (cloudSongs: Song[]) => {
      const deletedIds = getStoredDeletedSongIds();
      const pendingSongs = getStoredPendingSongs();
      const map = new Map<string, Song>();

      cloudSongs.forEach((song) => {
        if (!deletedIds.has(song.id)) map.set(song.id, song);
      });

      // Pending songs (new or edited while offline) take precedence locally.
      pendingSongs.forEach((song) => {
        if (!deletedIds.has(song.id)) map.set(song.id, song);
      });

      const merged = Array.from(map.values());
      setCatalog(merged);
      saveStoredCatalog(merged);
      setIsCatalogReady(true);
      clearTimeout(readyTimer);

      // Retry the outbox outside of the state updater.
      pendingSongs.forEach((song) => {
        if (deletedIds.has(song.id)) {
          removeStoredPendingSong(song.id);
          return;
        }
        void loadFirebaseService()
          .then((firebase) => firebase.saveSongToFirestore(song))
          .then((ok) => {
            if (ok) removeStoredPendingSong(song.id);
          })
          .catch((err) => console.warn('No se pudo reintentar una canción pendiente:', err));
      });
    };

    loadFirebaseService()
      .then((firebase) =>
        firebase.subscribeToCatalogUpdates(applyCatalog, (err) => {
          console.warn('No se pudo sincronizar el catálogo:', err);
          setIsCatalogReady(true);
        })
      )
      .then((unsub) => {
        if (cancelled) {
          unsub?.();
        } else {
          unsubscribe = unsub;
        }
      })
      .catch((err) => {
        console.warn('No se pudo escuchar el catálogo:', err);
        setIsCatalogReady(true);
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
      clearTimeout(readyTimer);
    };
  }, [isAuthenticated]);

  // Artist profiles (realtime)
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    loadFirebaseService()
      .then((firebase) =>
        firebase.subscribeToArtistProfilesUpdates(
          (cloudArtists) => {
            setArtistProfiles(cloudArtists);
            saveStoredArtistProfiles(cloudArtists);
          },
          (err) => console.warn('No se pudieron sincronizar los artistas:', err)
        )
      )
      .then((unsub) => {
        if (cancelled) {
          unsub?.();
        } else {
          unsubscribe = unsub;
        }
      })
      .catch((err) => console.warn('No se pudo escuchar los artistas:', err));

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [isAuthenticated]);

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

    const cleanSong = normalizeSong(newSong);
    if (!cleanSong) {
      throw new Error('No se pudo crear la canción: datos inválidos.');
    }

    addStoredPendingSong(cleanSong);
    setCatalog((previous) => {
      const updated = [cleanSong, ...previous.filter((song) => song.id !== cleanSong.id)];
      saveStoredCatalog(updated);
      return updated;
    });

    void loadFirebaseService()
      .then((firebase) => firebase.saveSongToFirestore(cleanSong))
      .then((ok) => {
        if (ok) removeStoredPendingSong(cleanSong.id);
      })
      .catch((err) => console.warn('La canción quedó pendiente de sincronizar:', err));

    return cleanSong;
  };

  const addMultipleTracksToCatalog = async (
    songsData: Omit<Song, 'id' | 'createdAt' | 'addedBy'>[]
  ): Promise<Song[]> => {
    const now = Date.now();
    const newSongs: Song[] = songsData
      .map((songData, idx) => {
        const song: Song = {
          ...songData,
          id: `song-${now}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
          addedBy: currentUser.id,
          createdAt: new Date(now + idx).toISOString(),
        };
        return normalizeSong(song);
      })
      .filter((song): song is Song => Boolean(song));

    if (newSongs.length === 0) return [];

    newSongs.forEach((song) => addStoredPendingSong(song));

    setCatalog((previous) => {
      const existing = new Set(previous.map((song) => song.id));
      const updated = [...newSongs.filter((song) => !existing.has(song.id)), ...previous];
      saveStoredCatalog(updated);
      return updated;
    });

    // One batch instead of N sequential round-trips.
    try {
      const firebase = await loadFirebaseService();
      const saved = await firebase.saveSongsToFirestore(newSongs);
      if (saved) {
        newSongs.forEach((song) => removeStoredPendingSong(song.id));
      }
    } catch (err) {
      console.warn('El álbum quedó pendiente de sincronizar:', err);
    }

    return newSongs;
  };

  const updateCatalogTrack = (song: Song) => {
    const cleanSong = normalizeSong(song);
    if (!cleanSong) return;

    addStoredPendingSong(cleanSong);
    setCatalog((previous) => {
      const updated = previous.map((item) => (item.id === cleanSong.id ? cleanSong : item));
      saveStoredCatalog(updated);
      return updated;
    });

    void loadFirebaseService()
      .then((firebase) => firebase.saveSongToFirestore(cleanSong))
      .then((ok) => {
        if (ok) removeStoredPendingSong(cleanSong.id);
      })
      .catch((err) => console.warn('La edición quedó pendiente de sincronizar:', err));
  };

  const deleteCatalogTrack = (songId: string) => {
    addStoredDeletedSongId(songId);
    removeStoredPendingSong(songId);

    setCatalog((previous) => {
      const updated = previous.filter((song) => song.id !== songId);
      saveStoredCatalog(updated);
      return updated;
    });

    void loadFirebaseService()
      .then((firebase) => firebase.deleteSongFromFirestore(songId))
      .catch((err) => console.warn('No se pudo borrar la canción de la nube:', err));
    void deleteSongBlob(songId).catch((err) =>
      console.warn('No se pudo borrar el audio local:', err)
    );
    refreshDownloadedIds();

    // Remove dangling references so playlists/favorites do not keep growing
    // with IDs of songs that no longer exist.
    mutateUserData((previous) => ({
      ...previous,
      favoriteSongIds: previous.favoriteSongIds.filter((id) => id !== songId),
      historySongIds: previous.historySongIds.filter((id) => id !== songId),
      playlists: previous.playlists.map((playlist) => ({
        ...playlist,
        songIds: playlist.songIds.filter((id) => id !== songId),
      })),
      playCounts: Object.fromEntries(
        Object.entries(previous.playCounts || {}).filter(([id]) => id !== songId)
      ),
      playHistory: (previous.playHistory || []).filter((event) => event.songId !== songId),
    }));
  };

  // User Library Favorites (with defensive fallback)
  const isFavorite = useCallback(
    (songId: string) => (userData?.favoriteSongIds || []).includes(songId),
    [userData?.favoriteSongIds]
  );

  const toggleFavorite = (songId: string) => {
    mutateUserData((previous) => {
      const currentFavorites = previous.favoriteSongIds || [];
      const nextFavorites = currentFavorites.includes(songId)
        ? currentFavorites.filter((id) => id !== songId)
        : [...currentFavorites, songId];

      return { ...previous, favoriteSongIds: nextFavorites };
    });
  };

  const userFavoriteSongs = useMemo(
    () =>
      (catalog || []).filter((song) => (userData?.favoriteSongIds || []).includes(song.id)),
    [catalog, userData?.favoriteSongIds]
  );

  // The personal library is what the user explicitly saved: favorites,
  // playlists, and saved albums. The global catalog stays hidden in search.
  const librarySongIds = useMemo(() => {
    const ids = new Set<string>(userData.favoriteSongIds || []);
    (userData.playlists || []).forEach((playlist) => {
      playlist.songIds.forEach((songId) => ids.add(songId));
    });
    const savedAlbums = new Set(
      (userData.savedAlbumNames || []).map((n) => n.trim().toLowerCase())
    );
    if (savedAlbums.size > 0) {
      catalog.forEach((song) => {
        if (song.album && savedAlbums.has(song.album.trim().toLowerCase())) {
          ids.add(song.id);
        }
      });
    }
    return ids;
  }, [userData.favoriteSongIds, userData.playlists, userData.savedAlbumNames, catalog]);

  const librarySongs = useMemo(
    () => catalog.filter((song) => librarySongIds.has(song.id)),
    [catalog, librarySongIds]
  );

  const isSongInLibrary = useCallback(
    (songId: string) => librarySongIds.has(songId),
    [librarySongIds]
  );

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

    mutateUserData((previous) => ({
      ...previous,
      playlists: [...previous.playlists, newPlaylist],
    }));

    return newPlaylist;
  };

  const importPlaylist = (
    name: string,
    description: string,
    songIds: string[],
    coverUrl?: string
  ): Playlist => {
    const catalogIds = new Set(catalog.map((song) => song.id));
    const uniqueIds = Array.from(new Set(songIds.filter((id) => catalogIds.has(id))));
    const firstSong = catalog.find((song) => song.id === uniqueIds[0]);

    const newPlaylist: Playlist = {
      id: `pl-imported-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim() || 'Playlist importada',
      description: description.trim() || undefined,
      coverUrl:
        coverUrl ||
        firstSong?.coverUrl ||
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
      userId: currentUser.id,
      songIds: uniqueIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mutateUserData((previous) => ({
      ...previous,
      playlists: [...previous.playlists, newPlaylist],
    }));

    return newPlaylist;
  };

  const updatePlaylist = (playlist: Playlist) => {
    mutateUserData((previous) => ({
      ...previous,
      playlists: previous.playlists.map((item) =>
        item.id === playlist.id
          ? { ...playlist, updatedAt: new Date().toISOString() }
          : item
      ),
    }));
  };

  const deletePlaylist = (playlistId: string) => {
    mutateUserData((previous) => ({
      ...previous,
      playlists: previous.playlists.filter((playlist) => playlist.id !== playlistId),
      pinnedPlaylistIds: (previous.pinnedPlaylistIds || []).filter(
        (id) => id !== playlistId
      ),
    }));
  };

  const isPlaylistPinned = useCallback(
    (playlistId: string) =>
      playlistId !== 'favorites' &&
      (userData?.pinnedPlaylistIds || []).includes(playlistId),
    [userData?.pinnedPlaylistIds]
  );

  const togglePlaylistPin = (playlistId: string) => {
    if (!playlistId || playlistId === 'favorites') return;
    mutateUserData((previous) => {
      const current = previous.pinnedPlaylistIds || [];
      return {
        ...previous,
        pinnedPlaylistIds: current.includes(playlistId)
          ? current.filter((id) => id !== playlistId)
          : [...current, playlistId],
      };
    });
  };

  const addSongToPlaylist = (playlistId: string, songId: string) => {
    mutateUserData((previous) => ({
      ...previous,
      playlists: previous.playlists.map((playlist) =>
        playlist.id === playlistId && !playlist.songIds.includes(songId)
          ? {
              ...playlist,
              songIds: [...playlist.songIds, songId],
              updatedAt: new Date().toISOString(),
            }
          : playlist
      ),
    }));
  };

  const removeSongFromPlaylist = (playlistId: string, songId: string) => {
    mutateUserData((previous) => ({
      ...previous,
      playlists: previous.playlists.map((playlist) =>
        playlist.id === playlistId
          ? {
              ...playlist,
              songIds: playlist.songIds.filter((id) => id !== songId),
              updatedAt: new Date().toISOString(),
            }
          : playlist
      ),
    }));
  };

  // Offline Downloads
  const isDownloaded = useCallback(
    (songId: string) => downloadedSongIds.includes(songId),
    [downloadedSongIds]
  );

  const toggleDownloadSong = async (song: Song): Promise<boolean> => {
    try {
      if (isDownloaded(song.id)) {
        await deleteSongBlob(song.id);
        await refreshDownloadedIds();
        return false;
      }

      setDownloadingState({ isDownloading: true, title: song.title });
      const ok = await cacheSongOffline(song);
      if (ok) {
        await refreshDownloadedIds();
      }
      setTimeout(() => setDownloadingState(null), 1500);
      return ok;
    } catch (err) {
      console.warn('No se pudo actualizar la descarga offline:', err);
      setTimeout(() => setDownloadingState(null), 1500);
      return false;
    }
  };

  const downloadSongsBatch = async (
    songs: Song[]
  ): Promise<{ downloaded: number; failed: number }> => {
    const uniqueSongs = songs.filter(
      (song, index, array) => array.findIndex((item) => item.id === song.id) === index
    );
    const pending = uniqueSongs.filter((song) => !isDownloaded(song.id));

    if (pending.length === 0) {
      setDownloadingState({
        isDownloading: true,
        title: 'Todas las canciones ya están descargadas',
        progress: 100,
      });
      setTimeout(() => setDownloadingState(null), 2500);
      return { downloaded: 0, failed: 0 };
    }

    setDownloadingState({
      isDownloading: true,
      title: `Preparando ${pending.length} canciones...`,
      progress: 0,
    });

    let downloaded = 0;
    let failed = 0;

    for (let index = 0; index < pending.length; index += 1) {
      const song = pending[index];
      const baseProgress = Math.round((index / pending.length) * 100);

      setDownloadingState({
        isDownloading: true,
        title: `${song.title} (${index + 1}/${pending.length})`,
        progress: baseProgress,
      });

      try {
        const ok = await cacheSongOffline(song);
        if (ok) {
          downloaded += 1;
        } else {
          failed += 1;
        }
      } catch (err) {
        console.warn(`No se pudo descargar ${song.title}:`, err);
        failed += 1;
      }

      setDownloadingState({
        isDownloading: true,
        title: `${song.title} (${index + 1}/${pending.length})`,
        progress: Math.round(((index + 1) / pending.length) * 100),
      });
    }

    await refreshDownloadedIds();

    setDownloadingState({
      isDownloading: true,
      title:
        failed > 0
          ? `Descarga terminada: ${downloaded} correctas, ${failed} con error`
          : 'Descarga completada',
      progress: 100,
    });
    setTimeout(() => setDownloadingState(null), 3500);

    return { downloaded, failed };
  };

  const downloadSingleSongFile = async (song: Song) => {
    setDownloadingState({ isDownloading: true, title: song.title });
    await downloadSongFile(song);
    setTimeout(() => setDownloadingState(null), 1500);
  };

  const downloadFullPlaylistZip = async (
    playlist: Playlist,
    onProgress?: (percent: number, status: string) => void
  ) => {
    const songsInPlaylist = playlist.songIds
      .map((id) => catalog.find((song) => song.id === id))
      .filter((song): song is Song => Boolean(song));

    setDownloadingState({ isDownloading: true, title: playlist.name, progress: 5 });

    await downloadPlaylistAsZip(playlist, songsInPlaylist, (percent, status) => {
      setDownloadingState({
        isDownloading: true,
        title: `${playlist.name} (${percent}%)`,
        progress: percent,
      });
      if (onProgress) onProgress(percent, status);
    });

    setTimeout(() => setDownloadingState(null), 2500);
  };

  // Artist Profiles Actions
  const getArtistProfile = useCallback(
    (artistName: string): ArtistProfile | null => {
      const norm = artistName.trim().toLowerCase();
      return (
        artistProfiles.find(
          (artist) => artist.id === norm || artist.name.trim().toLowerCase() === norm
        ) || null
      );
    },
    [artistProfiles]
  );

  const isFollowingArtist = useCallback(
    (artistName: string) =>
      (userData?.followedArtists || []).includes(artistName.trim().toLowerCase()),
    [userData?.followedArtists]
  );

  const toggleFollowArtist = (artistName: string) => {
    const key = artistName.trim().toLowerCase();
    if (!key) return;
    mutateUserData((previous) => {
      const current = previous.followedArtists || [];
      return {
        ...previous,
        followedArtists: current.includes(key)
          ? current.filter((name) => name !== key)
          : [...current, key],
      };
    });
  };

  const isAlbumSaved = useCallback(
    (albumName: string) => {
      const norm = albumName.trim().toLowerCase();
      if (!norm) return false;
      const isExplicitlySaved = (userData?.savedAlbumNames || []).includes(norm);
      if (isExplicitlySaved) return true;
      const albumSongs = catalog.filter(
        (s) => s.album && s.album.trim().toLowerCase() === norm
      );
      if (albumSongs.length === 0) return false;
      return albumSongs.every((s) => librarySongIds.has(s.id));
    },
    [userData?.savedAlbumNames, catalog, librarySongIds]
  );

  const toggleSaveAlbum = (album: Album) => {
    const norm = album.name.trim().toLowerCase();
    if (!norm) return;
    const currentlySaved = (userData?.savedAlbumNames || []).includes(norm);
    mutateUserData((previous) => {
      const current = previous.savedAlbumNames || [];
      const updated = currentlySaved
        ? current.filter((item) => item !== norm)
        : [...current, norm];
      return {
        ...previous,
        savedAlbumNames: updated,
      };
    });
  };

  const updateArtistProfile = async (artist: ArtistProfile) => {
    const norm = artist.id || artist.name.trim().toLowerCase();
    const updated: ArtistProfile = {
      ...artist,
      id: norm,
      updatedAt: new Date().toISOString(),
    };

    setArtistProfiles((previous) => {
      const filtered = previous.filter((item) => item.id !== norm);
      const next = [...filtered, updated];
      saveStoredArtistProfiles(next);
      return next;
    });

    saveStoredArtistProfile(updated);
    const firebase = await loadFirebaseService();
    await firebase.saveArtistProfileToFirestore(updated);
  };

  // User Play Counts & Analytics Actions
  const recordSongPlay = useCallback(
    (songId: string) => {
      mutateUserData((previous) => {
        const currentCount = previous.playCounts?.[songId] || 0;
        const updatedCounts = {
          ...(previous.playCounts || {}),
          [songId]: currentCount + 1,
        };
        const updatedHistory = [
          { songId, playedAt: new Date().toISOString() },
          ...(previous.playHistory || []),
        ].slice(0, 200);

        return {
          ...previous,
          playCounts: updatedCounts,
          playHistory: updatedHistory,
        };
      });
    },
    [mutateUserData]
  );

  const recordListeningTime = useCallback(
    (songId: string, artist: string, seconds: number) => {
      const safeSeconds = Math.floor(Number(seconds));
      if (!songId || !Number.isFinite(safeSeconds) || safeSeconds < 1) return;

      const primaryArtist =
        (artist || 'Artista desconocido')
          .split(/[,&/]|feat\.|ft\./i)[0]
          .trim() || 'Artista desconocido';

      mutateUserData((previous) => ({
        ...previous,
        totalListenSeconds: (previous.totalListenSeconds || 0) + safeSeconds,
        songListenSeconds: {
          ...(previous.songListenSeconds || {}),
          [songId]: (previous.songListenSeconds?.[songId] || 0) + safeSeconds,
        },
        artistListenSeconds: {
          ...(previous.artistListenSeconds || {}),
          [primaryArtist]:
            (previous.artistListenSeconds?.[primaryArtist] || 0) + safeSeconds,
        },
      }));
    },
    [mutateUserData]
  );

  const getUserSongPlayCount = useCallback(
    (songId: string): number => {
      return userData?.playCounts?.[songId] || 0;
    },
    [userData?.playCounts]
  );

  return (
    <MusicContext.Provider
      value={{
        catalog,
        librarySongs,
        isCatalogReady,
        addTrackToCatalog,
        addMultipleTracksToCatalog,
        updateCatalogTrack,
        deleteCatalogTrack,
        favoriteSongIds: userData.favoriteSongIds,
        toggleFavorite,
        isFavorite,
        isSongInLibrary,
        userFavoriteSongs,
        playlists: userData.playlists,
        pinnedPlaylistIds: userData.pinnedPlaylistIds || [],
        isPlaylistPinned,
        togglePlaylistPin,
        savedAlbumNames: userData.savedAlbumNames || [],
        isAlbumSaved,
        toggleSaveAlbum,
        createPlaylist,
        importPlaylist,
        updatePlaylist,
        deletePlaylist,
        addSongToPlaylist,
        removeSongFromPlaylist,
        artistProfiles,
        getArtistProfile,
        updateArtistProfile,
        followedArtists: userData.followedArtists || [],
        isFollowingArtist,
        toggleFollowArtist,
        recordSongPlay,
        recordListeningTime,
        getUserSongPlayCount,
        userPlayCounts: userData.playCounts || {},
        userPlayHistory: userData.playHistory || [],
        userTotalListenSeconds: userData.totalListenSeconds || 0,
        userSongListenSeconds: userData.songListenSeconds || {},
        userArtistListenSeconds: userData.artistListenSeconds || {},
        downloadedSongIds,
        isDownloaded,
        toggleDownloadSong,
        downloadSongsBatch,
        downloadSingleSongFile,
        downloadFullPlaylistZip,
        downloadingState,
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
