import React, { useRef, useState, useMemo, useEffect } from 'react';
import List from 'lucide-react/dist/esm/icons/list.mjs';
import ArrowDown from 'lucide-react/dist/esm/icons/arrow-down.mjs';
import ArrowUp from 'lucide-react/dist/esm/icons/arrow-up.mjs';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Pause from 'lucide-react/dist/esm/icons/pause.mjs';
import Heart from 'lucide-react/dist/esm/icons/heart.mjs';
import Music from 'lucide-react/dist/esm/icons/eighth-notes.mjs';
import Trash2 from 'lucide-react/dist/esm/icons/trash.mjs';
import Download from 'lucide-react/dist/esm/icons/download.mjs';
import FolderDown from 'lucide-react/dist/esm/icons/folder-down.mjs';
import Pin from 'lucide-react/dist/esm/icons/pin.mjs';
import Clock from 'lucide-react/dist/esm/icons/clock.mjs';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import Shuffle from 'lucide-react/dist/esm/icons/shuffle.mjs';
import Search from 'lucide-react/dist/esm/icons/search.mjs';
import ArrowDownCircle from 'lucide-react/dist/esm/icons/circle-arrow-down.mjs';
import PlusCircle from 'lucide-react/dist/esm/icons/circle-plus.mjs';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.mjs';
import Disc from 'lucide-react/dist/esm/icons/disc.mjs';
import UserRound from 'lucide-react/dist/esm/icons/user-round.mjs';
import Share2 from 'lucide-react/dist/esm/icons/share-2.mjs';
import MoreVertical from 'lucide-react/dist/esm/icons/ellipsis-vertical.mjs';
import MoreHorizontal from 'lucide-react/dist/esm/icons/ellipsis.mjs';
import Video from 'lucide-react/dist/esm/icons/video.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import LayoutGrid from 'lucide-react/dist/esm/icons/layout-grid.mjs';
import ArrowUpDown from 'lucide-react/dist/esm/icons/arrow-up-down.mjs';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { Playlist, Song, Album } from '../types';
import { formatTime } from '../utils/lyrics';
import { getAlbumsFromCatalog } from '../utils/albums';
import { ArtistLinks } from '../components/ArtistLinks';
import { DownloadedIcon } from '../components/DownloadedIcon';
import { SavedCheckIcon } from '../components/SavedCheckIcon';
import { PlaylistContextMenu, PlaylistMenuState } from '../components/PlaylistContextMenu';

function primaryArtistKey(artist: string): string {
  return (artist || '')
    .split(/[,&/]|feat\.|ft\./i)[0]
    .trim()
    .toLowerCase();
}

interface LibraryViewProps {
  selectedPlaylist: Playlist | 'favorites' | Album | null;
  setSelectedPlaylist: (playlist: Playlist | 'favorites' | Album | null) => void;
  onOpenCreatePlaylist: () => void;
  onOpenAddToPlaylist: (song: Song) => void;
  onOpenImportPlaylist?: () => void;
  onSelectArtist?: (artistName: string) => void;
  onOpenProfileSwitcher?: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  selectedPlaylist,
  setSelectedPlaylist,
  onOpenCreatePlaylist,
  onOpenAddToPlaylist,
  onOpenImportPlaylist,
  onSelectArtist,
  onOpenProfileSwitcher,
}) => {
  const { currentUser } = useAuth();
  const {
    catalog,
    librarySongs,
    userFavoriteSongs,
    playlists,
    pinnedPlaylistIds,
    togglePlaylistPin,
    followedArtists,
    artistProfiles,
    getArtistProfile,
    deletePlaylist,
    toggleFavorite,
    isFavorite,
    isSongInLibrary,
    isDownloaded,
    downloadFullPlaylistZip,
    downloadSongsBatch,
    getUserSongPlayCount,
    isAlbumSaved,
    toggleSaveAlbum,
  } = useMusic();

  const { playSong, currentSong, isPlaying, togglePlayPause, isShuffle, toggleShuffle, openVideo } = useAudio();

  const [trackMenuSong, setTrackMenuSong] = useState<Song | null>(null);
  const [isPlaylistOptionsOpen, setIsPlaylistOptionsOpen] = useState(false);
  const [playlistSearch, setPlaylistSearch] = useState('');
  const [playlistSortBy, setPlaylistSortBy] = useState<'custom' | 'title' | 'artist' | 'album'>('custom');
  const [playlistSortDir, setPlaylistSortDir] = useState<'asc' | 'desc'>('desc');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setIsSortMenuOpen(false);
      }
    };
    if (isSortMenuOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [isSortMenuOpen]);
  const [downloadProgress, setDownloadProgress] = useState<{ percent: number; status: string } | null>(null);
  const [downloadMessage, setDownloadMessage] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [playlistMenu, setPlaylistMenu] = useState<PlaylistMenuState | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressPlaylistClickRef = useRef(false);

  const albums = React.useMemo(() => getAlbumsFromCatalog(librarySongs), [librarySongs]);

  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    try {
      const saved = localStorage.getItem('sonora_library_view_mode');
      return saved === 'grid' ? 'grid' : 'list';
    } catch {
      return 'list';
    }
  });

  const [libraryFilterChip, setLibraryFilterChip] = useState<
    'all' | 'Playlists' | 'Álbumes' | 'Artistas' | 'Eventos' | 'Descargado'
  >('all');
  const [isLibrarySearchOpen, setIsLibrarySearchOpen] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [librarySortBy, setLibrarySortBy] = useState<'recent' | 'az' | 'creator'>('recent');

  const toggleViewMode = () => {
    setViewMode((prev) => {
      const next = prev === 'list' ? 'grid' : 'list';
      try {
        localStorage.setItem('sonora_library_view_mode', next);
      } catch {}
      return next;
    });
  };

  const cycleLibrarySort = () => {
    setLibrarySortBy((prev) => {
      if (prev === 'recent') return 'az';
      if (prev === 'az') return 'creator';
      return 'recent';
    });
  };

  const librarySortLabel = {
    recent: 'Recientes',
    az: 'Alfabético',
    creator: 'Creador',
  }[librarySortBy];

  const orderedPlaylists = React.useMemo(
    () =>
      [...playlists].sort((a, b) => {
        const aPinned = pinnedPlaylistIds.includes(a.id) ? 0 : 1;
        const bPinned = pinnedPlaylistIds.includes(b.id) ? 0 : 1;
        return aPinned - bPinned;
      }),
    [playlists, pinnedPlaylistIds]
  );

  const followedArtistCards = React.useMemo(
    () =>
      followedArtists
        .map((key) => {
          const profile = getArtistProfile(key);
          const songs = catalog.filter((song) => {
            const parts = song.artist
              .split(/[,&/]|feat\.|ft\./i)
              .map((p) => p.trim().toLowerCase());
            return parts.includes(key) || song.artist.toLowerCase().includes(key);
          });
          const firstWithCover = songs.find((song) => Boolean(song.coverUrl));
          const catalogName = firstWithCover
            ? firstWithCover.artist.split(/[,&/]|feat\.|ft\./i)[0].trim()
            : '';
          return {
            key,
            name: profile?.name || catalogName || (key.charAt(0).toUpperCase() + key.slice(1)),
            coverUrl: profile?.avatarUrl || firstWithCover?.coverUrl || '',
            songs: songs.length,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [catalog, followedArtists, artistProfiles, getArtistProfile]
  );

  const openPlaylistMenu = (
    event: React.MouseEvent | React.PointerEvent,
    playlist: Playlist
  ) => {
    event.preventDefault();
    event.stopPropagation();
    suppressPlaylistClickRef.current = true;
    window.setTimeout(() => {
      suppressPlaylistClickRef.current = false;
    }, 300);
    setPlaylistMenu({ playlist, x: event.clientX, y: event.clientY });
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  };

  const handlePlaylistPointerDown = (
    event: React.PointerEvent,
    playlist: Playlist
  ) => {
    if (event.pointerType === 'mouse') return;
    longPressStartRef.current = { x: event.clientX, y: event.clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      openPlaylistMenu(event, playlist);
      longPressTimerRef.current = null;
    }, 550);
  };

  const handlePlaylistPointerMove = (event: React.PointerEvent) => {
    const start = longPressStartRef.current;
    if (!start) return;
    if (
      Math.abs(event.clientX - start.x) > 10 ||
      Math.abs(event.clientY - start.y) > 10
    ) {
      clearLongPress();
    }
  };

  const handlePlaylistClick = (playlist: Playlist) => {
    if (suppressPlaylistClickRef.current) {
      suppressPlaylistClickRef.current = false;
      return;
    }
    setSelectedPlaylist(playlist);
  };

  React.useEffect(() => () => clearLongPress(), []);

  // If a playlist, album, or 'favorites' is selected, show Spotify-style Hero Detail
  if (selectedPlaylist) {
    const isFavorites = selectedPlaylist === 'favorites';
    const isAlbum = Boolean(
      selectedPlaylist && typeof selectedPlaylist === 'object' && 'songs' in selectedPlaylist
    );
    const albumObj = isAlbum ? (selectedPlaylist as Album) : null;
    const playlistObj = !isFavorites && !isAlbum ? (selectedPlaylist as Playlist) : null;

    const playlistSongs: Song[] = isFavorites
      ? userFavoriteSongs
      : isAlbum && albumObj
      ? [...albumObj.songs].sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0))
      : playlistObj?.songIds
          .map((id) => catalog.find((s) => s.id === id))
          .filter((s): s is Song => Boolean(s)) || [];

    const totalSeconds = playlistSongs.reduce((acc, s) => acc + (s?.duration || 0), 0);
    const areAllDownloaded = playlistSongs.length > 0 && playlistSongs.every((s) => isDownloaded(s.id));

    const filteredSongs = playlistSongs.filter((song) => {
      if (!playlistSearch) return true;
      const q = playlistSearch.toLowerCase();
      return (
        song.title.toLowerCase().includes(q) ||
        song.artist.toLowerCase().includes(q) ||
        song.album.toLowerCase().includes(q)
      );
    });

    const sortedAndFilteredSongs = (() => {
      if (isAlbum) return filteredSongs;

      const items = [...filteredSongs];
      const dirMultiplier = playlistSortDir === 'asc' ? 1 : -1;

      if (playlistSortBy === 'title') {
        items.sort(
          (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) * dirMultiplier
        );
      } else if (playlistSortBy === 'artist') {
        items.sort(
          (a, b) => a.artist.localeCompare(b.artist, undefined, { sensitivity: 'base' }) * dirMultiplier
        );
      } else if (playlistSortBy === 'album') {
        items.sort(
          (a, b) =>
            (a.album || '').localeCompare(b.album || '', undefined, { sensitivity: 'base' }) *
            dirMultiplier
        );
      } else if (playlistSortBy === 'custom') {
        if (playlistSortDir === 'desc') {
          items.reverse();
        }
      }

      return items;
    })();

    const sortLabels: Record<'custom' | 'title' | 'artist' | 'album', string> = {
      custom: 'Agregado recientemente',
      title: 'Título',
      artist: 'Artista',
      album: 'Álbum',
    };

    const handleToggleSortOption = (option: 'custom' | 'title' | 'artist' | 'album') => {
      if (playlistSortBy === option) {
        setPlaylistSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setPlaylistSortBy(option);
        setPlaylistSortDir(option === 'custom' ? 'desc' : 'asc');
      }
    };

    const isThisPlaylistPlaying =
      playlistSongs.length > 0 && playlistSongs.some((s) => s.id === currentSong?.id) && isPlaying;

    const sourceName = isFavorites
      ? 'Tus me gusta'
      : isAlbum && albumObj
      ? albumObj.name
      : playlistObj?.name || 'Playlist';

    const sourceType = isFavorites ? 'favorites' : isAlbum ? 'album' : 'playlist';

    // Ambient light for the hero, taken from the artwork itself.
    const heroCover = isFavorites
      ? null
      : (isAlbum ? albumObj?.coverUrl : playlistObj?.coverUrl) || playlistSongs[0]?.coverUrl;

    const handlePlayAll = () => {
      if (sortedAndFilteredSongs.length === 0) return;
      if (isThisPlaylistPlaying) {
        togglePlayPause();
      } else {
        playSong(sortedAndFilteredSongs[0], sortedAndFilteredSongs, {
          type: sourceType,
          name: sourceName,
          id: isFavorites ? 'favorites' : isAlbum ? albumObj?.name : playlistObj?.id,
        });
      }
    };

    const handleDownloadAll = async () => {
      setDownloadMessage('');
      const result = await downloadSongsBatch(playlistSongs);
      if (result.failed > 0) {
        setDownloadMessage(
          `${result.downloaded} descargadas. ${result.failed} no se pudieron guardar; revisa su enlace.`
        );
        setTimeout(() => setDownloadMessage(''), 6000);
      }
    };

    const handleDownloadZip = async () => {
      if (isFavorites || isAlbum) {
        const dummyPl: Playlist = {
          id: isAlbum ? `album-${albumObj?.name}` : 'favorites',
          name: sourceName,
          userId: currentUser?.id || 'user',
          songIds: playlistSongs.map((s) => s.id),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await downloadFullPlaylistZip(dummyPl, (percent, status) => {
          setDownloadProgress({ percent, status });
        });
      } else if (playlistObj) {
        await downloadFullPlaylistZip(playlistObj, (percent, status) => {
          setDownloadProgress({ percent, status });
        });
      }
      setTimeout(() => setDownloadProgress(null), 3000);
    };

    return (
      <div className="flex-1 overflow-y-auto pb-36 animate-in fade-in duration-200 select-none">
        {/* Spotify Hero Banner: dynamic gradient taking predominant cover color fading to #121212 */}
        <div className="relative overflow-hidden p-5 sm:p-6 md:p-8 pt-6 sm:pt-8 md:pt-10 flex flex-col md:flex-row items-center md:items-end gap-5 md:gap-6 text-center md:text-left shadow-2xl playlist-hero-container">
          {heroCover ? (
            <>
              <div
                className="absolute inset-0 bg-cover bg-center scale-125 blur-3xl opacity-60 saturate-150 playlist-hero-art"
                style={{ backgroundImage: `url(${heroCover})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-[#121212]/70 to-[#121212] playlist-hero-overlay" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-900 via-purple-950 to-[#121212] playlist-hero-default-bg" />
          )}

          {/* Cover Art Box: Centered, prominent */}
          <div className="relative z-10 w-48 h-48 sm:w-56 sm:h-56 md:w-56 md:h-56 self-center rounded-xl md:rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 flex items-center justify-center">
            {isFavorites ? (
              <div className="w-full h-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-2xl">
                <Heart className="w-24 h-24 text-white fill-white" />
              </div>
            ) : isAlbum && albumObj?.coverUrl ? (
              <img
                src={albumObj.coverUrl}
                alt={albumObj.name}
                className="w-full h-full object-cover"
              />
            ) : playlistObj?.coverUrl ? (
              <img
                src={playlistObj.coverUrl}
                alt={playlistObj.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-neutral-900 flex items-center justify-center text-neutral-600">
                <Music className="w-20 h-20" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="relative z-10 flex-1 min-w-0 space-y-2 flex flex-col items-center md:items-start text-center md:text-left">
            <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider text-[#b3b3b3]">
              {isFavorites
                ? 'Colección privada'
                : isAlbum
                ? 'Álbum'
                : playlistObj?.isPublic
                ? 'Playlist pública'
                : 'Playlist privada'}
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight py-0.5 break-words">
              {sourceName}
            </h1>
            {!isFavorites && !isAlbum && playlistObj?.description && (
              <p className="text-xs text-[#b3b3b3] line-clamp-2 max-w-lg">
                {playlistObj.description}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs text-[#b3b3b3] font-semibold pt-1">
              {isAlbum && albumObj && (
                (() => {
                  const artistProfile = getArtistProfile(albumObj.artist);
                  const artistAvatar = artistProfile?.avatarUrl;
                  return artistAvatar ? (
                    <img
                      src={artistAvatar}
                      alt={albumObj.artist}
                      className="w-5 h-5 rounded-full object-cover shadow"
                    />
                  ) : null;
                })()
              )}
              <span
                onClick={() => onSelectArtist?.(isAlbum ? albumObj?.artist || '' : currentUser?.displayName || '')}
                className="text-white font-extrabold hover:underline cursor-pointer"
              >
                {isAlbum ? albumObj?.artist : currentUser?.displayName || 'Tú'}
              </span>
              {isAlbum && albumObj?.year && (
                <>
                  <span>•</span>
                  <span>{albumObj.year}</span>
                </>
              )}
              <span>•</span>
              <span>{playlistSongs.length} {playlistSongs.length === 1 ? 'canción' : 'canciones'}</span>
              <span>•</span>
              <span className="text-neutral-400">{formatTime(totalSeconds)}</span>
            </div>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="p-4 sm:p-6 md:p-8 pt-3 md:pt-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left Actions: Add (+), Download, Options (...) */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Add / Save to Library */}
              {isAlbum && albumObj ? (
                <button
                  onClick={() => toggleSaveAlbum(albumObj)}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 text-[#b3b3b3] hover:text-white"
                  title={
                    isAlbumSaved(albumObj.name)
                      ? 'Guardado en tu biblioteca (clic para quitar)'
                      : 'Guardar álbum en tu biblioteca'
                  }
                >
                  {isAlbumSaved(albumObj.name) ? (
                    <SavedCheckIcon size={28} />
                  ) : (
                    <PlusCircle className="w-7 h-7" />
                  )}
                </button>
              ) : !isFavorites && playlistObj ? (
                <button
                  onClick={() => togglePlaylistPin(playlistObj.id)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
                    pinnedPlaylistIds.includes(playlistObj.id)
                      ? 'text-[#1DB954]'
                      : 'text-[#b3b3b3] hover:text-white'
                  }`}
                  title={pinnedPlaylistIds.includes(playlistObj.id) ? 'Fijada en biblioteca' : 'Fijar playlist'}
                >
                  <Pin className="w-5 h-5 fill-current" />
                </button>
              ) : null}

              {/* Download All Button (Spotify Circle Arrow Down) */}
              <button
                onClick={handleDownloadAll}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 text-[#b3b3b3] hover:text-white"
                title={areAllDownloaded ? 'Descargado en tu dispositivo' : 'Descargar para escuchar sin conexión'}
              >
                {areAllDownloaded ? (
                  <DownloadedIcon size={28} />
                ) : (
                  <ArrowDownCircle className="w-7 h-7" />
                )}
              </button>

              {/* Playlist Options (Three dots) */}
              <button
                onClick={(e) => {
                  if (playlistObj) {
                    openPlaylistMenu(e, playlistObj);
                  } else {
                    setIsPlaylistOptionsOpen(true);
                  }
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 text-[#b3b3b3] hover:text-white"
                title="Más opciones"
              >
                <MoreHorizontal className="w-6 h-6" />
              </button>
            </div>

            {/* Right Action Controls: Shuffle + Circular Green Play Button */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Shuffle Button */}
              <button
                onClick={toggleShuffle}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-90 ${
                  isShuffle ? 'text-[#1DB954]' : 'text-[#b3b3b3] hover:text-white'
                }`}
                title="Aleatorio"
              >
                <Shuffle className="w-5 h-5" />
              </button>

              {/* Big Circular Green Play Button at the Right */}
              <button
                onClick={handlePlayAll}
                className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all flex-shrink-0"
                title={isThisPlaylistPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isThisPlaylistPlaying ? (
                  <Pause className="w-6 h-6 fill-black" />
                ) : (
                  <Play className="w-6 h-6 fill-black ml-0.5" />
                )}
              </button>
            </div>
          </div>

          {/* Search in playlist & Sort Dropdown */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                value={playlistSearch}
                onChange={(e) => setPlaylistSearch(e.target.value)}
                placeholder="Buscar en la lista..."
                className="w-full bg-[#181818] border border-[#282828] rounded-full pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#727272] focus:outline-none focus:border-[#1DB954]"
              />
            </div>

            {!isAlbum && (
              <div ref={sortMenuRef} className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsSortMenuOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-neutral-300 hover:text-white transition-all bg-[#181818] hover:bg-[#242424] border border-[#282828] select-none shadow-sm"
                  title="Ordenar canciones"
                >
                  <span className="text-[11px] truncate max-w-[120px]">
                    {sortLabels[playlistSortBy]}
                  </span>
                  {playlistSortDir === 'desc' ? (
                    <ArrowDown className="w-3 h-3 text-[#1DB954] flex-shrink-0" />
                  ) : (
                    <ArrowUp className="w-3 h-3 text-[#1DB954] flex-shrink-0" />
                  )}
                  <List className="w-3.5 h-3.5 text-neutral-400 ml-0.5 flex-shrink-0" />
                </button>

                {isSortMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 p-2 rounded-2xl bg-[#181818]/95 border border-[#282828] shadow-2xl backdrop-blur-xl z-40 select-none animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-400 border-b border-[#282828] mb-1">
                      Clasificar por
                    </div>
                    {(['title', 'custom', 'artist', 'album'] as const).map((option) => {
                      const isSelected = playlistSortBy === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleToggleSortOption(option)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors text-left ${
                            isSelected
                              ? 'text-[#1DB954] font-extrabold bg-[#242424]'
                              : 'text-neutral-300 hover:text-white hover:bg-[#242424]/40'
                          }`}
                        >
                          <span>{sortLabels[option]}</span>
                          {isSelected && (
                            <span className="flex items-center gap-1 text-[#1DB954] font-black">
                              {playlistSortDir === 'desc' ? (
                                <ArrowDown className="w-3.5 h-3.5" />
                              ) : (
                                <ArrowUp className="w-3.5 h-3.5" />
                              )}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Download Progress Toast */}
          {downloadProgress && (
            <div className="p-3 bg-[#181818] border border-[#1DB954]/30 rounded-2xl max-w-md">
              <div className="flex justify-between text-xs font-bold text-white mb-1">
                <span>{downloadProgress.status}</span>
                <span>{downloadProgress.percent}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#282828] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1DB954] transition-all duration-300"
                  style={{ width: `${downloadProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {downloadMessage && (
            <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-2xl max-w-md text-[11px] font-semibold text-amber-200">
              {downloadMessage}
            </div>
          )}

          {/* Vertical Tracklist */}
          <div className="border-t border-[#282828] pt-3">
            {/* Desktop header */}
            <div className="hidden md:flex items-center gap-4 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-[#b3b3b3] border-b border-[#282828]/60">
              <span className="w-8 text-center">#</span>
              <span className="flex-1 min-w-0">Título</span>
              {!isAlbum && <span className="w-48">Álbum</span>}
              {isAlbum && <span className="w-28">Reproducciones</span>}
              <span className="w-12 text-right">
                <Clock className="w-3.5 h-3.5 inline" />
              </span>
              <span className="w-16"></span>
            </div>

            {/* Song rows */}
            <div className="divide-y divide-[#282828]/40 mt-1">
              {sortedAndFilteredSongs.length === 0 ? (
                <div className="p-12 text-center text-neutral-500">
                  <p className="text-sm font-bold">No se encontraron canciones</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Ve a "Buscar" para añadir canciones a tus playlists.
                  </p>
                </div>
              ) : (
                sortedAndFilteredSongs.map((song, idx) => {
                  const isCurrent = currentSong?.id === song.id;
                  const downloaded = isDownloaded(song.id);
                  const isSaved = isFavorite(song.id) || isSongInLibrary(song.id);
                  const playCount = getUserSongPlayCount(song.id);

                  return (
                    <div
                      key={song.id}
                      onClick={() =>
                        playSong(song, sortedAndFilteredSongs, {
                          type: sourceType,
                          name: sourceName,
                          id: isFavorites ? 'favorites' : isAlbum ? albumObj?.name : playlistObj?.id,
                        })
                      }
                      className="flex items-center gap-3 px-2 sm:px-3 py-2.5 rounded-xl hover:bg-[#181818] active:bg-[#242424] cursor-pointer group transition-colors"
                    >
                      {/* Index (album) or Artwork Thumbnail (playlist) */}
                      {isAlbum ? (
                        <div className="w-8 flex items-center justify-center flex-shrink-0">
                          {isCurrent && isPlaying ? (
                            <div className="flex items-end gap-0.5 h-3.5">
                              <span className="w-0.5 bg-[#1DB954] rounded-full animate-eq-1" />
                              <span className="w-0.5 bg-[#1DB954] rounded-full animate-eq-2" />
                              <span className="w-0.5 bg-[#1DB954] rounded-full animate-eq-3" />
                            </div>
                          ) : (
                            <span className={`text-xs font-mono ${isCurrent ? 'text-[#1DB954] font-bold' : 'text-neutral-500'}`}>
                              {song.trackNumber || idx + 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="relative w-11 h-11 flex-shrink-0 rounded-md overflow-hidden bg-neutral-800 shadow">
                          <img
                            src={song.coverUrl}
                            alt={song.title}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                          {isCurrent && isPlaying && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <div className="flex items-end gap-0.5 h-3.5">
                                <span className="w-0.5 bg-[#1DB954] rounded-full animate-eq-1" />
                                <span className="w-0.5 bg-[#1DB954] rounded-full animate-eq-2" />
                                <span className="w-0.5 bg-[#1DB954] rounded-full animate-eq-3" />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Title + Artist info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`block font-medium text-sm truncate ${isCurrent ? 'text-[#1DB954] font-bold' : 'text-white'}`}>
                            {song.title}
                          </span>
                          {!isAlbum && isCurrent && isPlaying && (
                            <div className="flex items-end gap-0.5 h-3.5 flex-shrink-0 md:hidden">
                              <span className="w-0.5 bg-[#1DB954] rounded-full animate-eq-1" />
                              <span className="w-0.5 bg-[#1DB954] rounded-full animate-eq-2" />
                              <span className="w-0.5 bg-[#1DB954] rounded-full animate-eq-3" />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-[#b3b3b3] truncate mt-0.5">
                          {downloaded && (
                            <span title="Descargado" className="flex-shrink-0">
                              <DownloadedIcon size={12} />
                            </span>
                          )}
                          {song.isExplicit && (
                            <span
                              className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-[#3e3e3e] text-white text-[9px] font-black flex-shrink-0 select-none leading-none"
                              title="Contenido explícito"
                            >
                              E
                            </span>
                          )}
                          {song.videoUrl && (
                            <span
                              className="inline-flex items-center justify-center px-1 py-0.2 rounded bg-[#282828] text-neutral-300 text-[9px] font-bold flex-shrink-0 select-none"
                              title="Tiene videoclip musical"
                            >
                              Video
                            </span>
                          )}
                          <ArtistLinks artists={song.artist} onSelectArtist={onSelectArtist} />
                        </div>
                      </div>

                      {/* Desktop Album column */}
                      {!isAlbum && (
                        <div className="hidden md:block w-48 truncate text-xs text-[#b3b3b3]">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              const targetAlbum = albums.find(
                                (a) => a.name.trim().toLowerCase() === song.album?.trim().toLowerCase()
                              );
                              if (targetAlbum) setSelectedPlaylist(targetAlbum);
                            }}
                            className={song.album && song.album.trim().toLowerCase() !== 'sencillo' ? 'hover:underline hover:text-white cursor-pointer' : ''}
                          >
                            {song.album || 'Sencillo'}
                          </span>
                        </div>
                      )}

                      {/* Desktop Play count for album */}
                      {isAlbum && (
                        <div className="hidden md:block w-28 text-xs font-mono text-neutral-400">
                          {playCount > 0 ? new Intl.NumberFormat('es-CO').format(playCount) : '0'}
                        </div>
                      )}

                      {/* Duration */}
                      <span className="hidden sm:block text-xs font-mono text-neutral-400 min-w-[36px] text-right">
                        {formatTime(song.duration)}
                      </span>

                      {/* Quick Like / Saved */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(song.id);
                        }}
                        className={`p-1.5 rounded-full transition-transform active:scale-90 ${
                          isSaved
                            ? 'hover:scale-110'
                            : 'opacity-0 md:group-hover:opacity-100 text-neutral-400 hover:text-white'
                        }`}
                        title={isSaved ? 'Guardada en tus me gusta' : 'Añadir a tus me gusta'}
                      >
                        {isSaved ? <SavedCheckIcon size={18} /> : <Plus className="w-4 h-4" />}
                      </button>

                      {/* Three Dots Context Menu Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTrackMenuSong(song);
                        }}
                        className="p-1.5 rounded-full text-[#b3b3b3] hover:text-white hover:bg-neutral-800/60 transition-colors"
                        title="Más opciones de la canción"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Track Context Menu Bottom Sheet */}
        {trackMenuSong && (
          <div
            className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200 select-none"
            onClick={() => setTrackMenuSong(null)}
          >
            <div
              className="bg-[#181818] border border-[#282828] rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 pb-8 sm:pb-6 shadow-2xl relative animate-in slide-in-from-bottom duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3.5 pb-4 border-b border-[#282828]">
                <img
                  src={trackMenuSong.coverUrl}
                  alt={trackMenuSong.title}
                  className="w-13 h-13 rounded-lg object-cover shadow"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-white text-base truncate">
                    {trackMenuSong.title}
                  </h3>
                  <p className="text-xs text-[#b3b3b3] truncate mt-0.5">
                    {trackMenuSong.artist}
                  </p>
                </div>
                <button
                  onClick={() => setTrackMenuSong(null)}
                  className="p-1.5 rounded-full text-[#b3b3b3] hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-2 space-y-1">
                {/* Me gusta */}
                <button
                  onClick={() => {
                    toggleFavorite(trackMenuSong.id);
                    setTrackMenuSong(null);
                  }}
                  className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-semibold text-white hover:bg-[#242424] active:bg-[#282828] transition-colors text-left"
                >
                  {isFavorite(trackMenuSong.id) ? (
                    <>
                      <SavedCheckIcon size={20} />
                      <span>Quitar de Tus me gusta</span>
                    </>
                  ) : (
                    <>
                      <Heart className="w-5 h-5 text-[#b3b3b3]" />
                      <span>Añadir a Tus me gusta</span>
                    </>
                  )}
                </button>

                {/* Añadir a playlist */}
                <button
                  onClick={() => {
                    const s = trackMenuSong;
                    setTrackMenuSong(null);
                    onOpenAddToPlaylist(s);
                  }}
                  className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-semibold text-white hover:bg-[#242424] active:bg-[#282828] transition-colors text-left"
                >
                  <PlusCircle className="w-5 h-5 text-[#b3b3b3]" />
                  <span>Añadir a playlist</span>
                </button>

                {/* Descargar */}
                <button
                  onClick={async () => {
                    const s = trackMenuSong;
                    setTrackMenuSong(null);
                    await downloadSongsBatch([s]);
                  }}
                  className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-semibold text-white hover:bg-[#242424] active:bg-[#282828] transition-colors text-left"
                >
                  <ArrowDownCircle className="w-5 h-5 text-[#b3b3b3]" />
                  <span>
                    {isDownloaded(trackMenuSong.id)
                      ? 'Descargada en dispositivo'
                      : 'Descargar canción'}
                  </span>
                </button>

                {/* Ver videoclip si existe */}
                {trackMenuSong.videoUrl && (
                  <button
                    onClick={() => {
                      const s = trackMenuSong;
                      setTrackMenuSong(null);
                      if (currentSong?.id !== s.id) {
                        playSong(s, [s]);
                      }
                      openVideo();
                    }}
                    className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-semibold text-white hover:bg-[#242424] active:bg-[#282828] transition-colors text-left"
                  >
                    <Video className="w-5 h-5 text-[#1DB954]" />
                    <span>Ver videoclip musical</span>
                  </button>
                )}

                {/* Ir al álbum */}
                {trackMenuSong.album && trackMenuSong.album.trim().toLowerCase() !== 'sencillo' && (
                  <button
                    onClick={() => {
                      const targetAlbum = albums.find(
                        (a) => a.name.trim().toLowerCase() === trackMenuSong.album?.trim().toLowerCase()
                      );
                      setTrackMenuSong(null);
                      if (targetAlbum) {
                        setSelectedPlaylist(targetAlbum);
                      }
                    }}
                    className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-semibold text-white hover:bg-[#242424] active:bg-[#282828] transition-colors text-left"
                  >
                    <Disc className="w-5 h-5 text-[#b3b3b3]" />
                    <span>Ir al álbum ({trackMenuSong.album})</span>
                  </button>
                )}

                {/* Compartir canción */}
                <button
                  onClick={() => {
                    const songUrl = `${window.location.origin}/#/track/${trackMenuSong.id}`;
                    navigator.clipboard.writeText(songUrl);
                    setCopySuccess(true);
                    setTrackMenuSong(null);
                    setTimeout(() => setCopySuccess(false), 2500);
                  }}
                  className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-semibold text-white hover:bg-[#242424] active:bg-[#282828] transition-colors text-left"
                >
                  <Share2 className="w-5 h-5 text-[#b3b3b3]" />
                  <span>Compartir canción</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Playlist/Album Options Menu Modal */}
        {isPlaylistOptionsOpen && (
          <div
            className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200 select-none"
            onClick={() => setIsPlaylistOptionsOpen(false)}
          >
            <div
              className="bg-[#181818] border border-[#282828] rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 pb-8 sm:pb-6 shadow-2xl relative animate-in slide-in-from-bottom duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3.5 pb-4 border-b border-[#282828]">
                <div className="w-12 h-12 rounded-lg bg-neutral-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {heroCover ? (
                    <img src={heroCover} alt={sourceName} className="w-full h-full object-cover" />
                  ) : (
                    <Music className="w-6 h-6 text-neutral-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-white text-base truncate">{sourceName}</h3>
                  <p className="text-xs text-[#b3b3b3] truncate mt-0.5">
                    {playlistSongs.length} canciones
                  </p>
                </div>
                <button
                  onClick={() => setIsPlaylistOptionsOpen(false)}
                  className="p-1.5 rounded-full text-[#b3b3b3] hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-2 space-y-1">
                {/* Descargar ZIP */}
                <button
                  onClick={() => {
                    setIsPlaylistOptionsOpen(false);
                    handleDownloadZip();
                  }}
                  className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-semibold text-white hover:bg-[#242424] active:bg-[#282828] transition-colors text-left"
                >
                  <FolderDown className="w-5 h-5 text-[#b3b3b3]" />
                  <span>Descargar paquete completo (.ZIP)</span>
                </button>

                {/* Compartir enlace */}
                <button
                  onClick={() => {
                    setIsPlaylistOptionsOpen(false);
                    navigator.clipboard.writeText(window.location.href);
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2500);
                  }}
                  className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-semibold text-white hover:bg-[#242424] active:bg-[#282828] transition-colors text-left"
                >
                  <Share2 className="w-5 h-5 text-[#b3b3b3]" />
                  <span>Compartir enlace</span>
                </button>

                {/* Delete Playlist (only if custom playlist) */}
                {!isFavorites && !isAlbum && playlistObj && (
                  <button
                    onClick={() => {
                      setIsPlaylistOptionsOpen(false);
                      if (confirm(`¿Eliminar la playlist "${playlistObj.name}"?`)) {
                        deletePlaylist(playlistObj.id);
                        setSelectedPlaylist(null);
                      }
                    }}
                    className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-950/30 transition-colors text-left"
                  >
                    <Trash2 className="w-5 h-5 text-red-400" />
                    <span>Eliminar playlist</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PlaylistContextMenu for right click / long press */}
        <PlaylistContextMenu
          state={playlistMenu}
          pinned={
            playlistMenu
              ? pinnedPlaylistIds.includes(playlistMenu.playlist.id)
              : false
          }
          onClose={() => setPlaylistMenu(null)}
          onTogglePin={togglePlaylistPin}
          onPlay={(playlist) => setSelectedPlaylist(playlist)}
        />
      </div>
    );
  }

  // Fallback if no playlist is selected: Spotify Tu Biblioteca (Mobile-First 1:1 List View & Grid View)
  const q = librarySearchQuery.trim().toLowerCase();

  const showFavorites =
    (libraryFilterChip === 'all' ||
      libraryFilterChip === 'Playlists' ||
      (libraryFilterChip === 'Descargado' &&
        userFavoriteSongs.some((s) => isDownloaded(s.id)))) &&
    (!q ||
      'tus me gusta'.includes(q) ||
      'favoritos'.includes(q) ||
      'me gusta'.includes(q));

  const favoritesIsPlaying =
    isPlaying && userFavoriteSongs.some((s) => s.id === currentSong?.id);
  const favoritesDownloaded =
    userFavoriteSongs.length > 0 &&
    userFavoriteSongs.some((s) => isDownloaded(s.id));

  const filteredPlaylists = (
    libraryFilterChip === 'Álbumes' ||
    libraryFilterChip === 'Artistas' ||
    libraryFilterChip === 'Eventos'
      ? []
      : orderedPlaylists.filter((pl) => {
          if (q && !pl.name.toLowerCase().includes(q)) return false;
          if (libraryFilterChip === 'Descargado') {
            return (
              pl.songIds.length > 0 &&
              pl.songIds.some((id) => isDownloaded(id))
            );
          }
          return true;
        })
  ).sort((a, b) => {
    const aPinned = pinnedPlaylistIds.includes(a.id) ? 0 : 1;
    const bPinned = pinnedPlaylistIds.includes(b.id) ? 0 : 1;
    if (aPinned !== bPinned) return aPinned - bPinned;
    if (librarySortBy === 'az') return a.name.localeCompare(b.name);
    return 0;
  });

  const filteredAlbums = (
    libraryFilterChip === 'Playlists' ||
    libraryFilterChip === 'Artistas' ||
    libraryFilterChip === 'Eventos'
      ? []
      : albums.filter((alb) => {
          if (
            q &&
            !alb.name.toLowerCase().includes(q) &&
            !alb.artist.toLowerCase().includes(q)
          ) {
            return false;
          }
          if (libraryFilterChip === 'Descargado') {
            return (
              alb.songs.length > 0 &&
              alb.songs.some((s) => isDownloaded(s.id))
            );
          }
          return true;
        })
  ).sort((a, b) => {
    if (librarySortBy === 'az') return a.name.localeCompare(b.name);
    if (librarySortBy === 'creator') return a.artist.localeCompare(b.artist);
    return 0;
  });

  const filteredArtists = (
    libraryFilterChip === 'Playlists' ||
    libraryFilterChip === 'Álbumes' ||
    libraryFilterChip === 'Eventos' ||
    libraryFilterChip === 'Descargado'
      ? []
      : followedArtistCards.filter((art) => {
          if (q && !art.name.toLowerCase().includes(q)) return false;
          return true;
        })
  ).sort((a, b) => a.name.localeCompare(b.name));

  const isFilterEmpty =
    !showFavorites &&
    filteredPlaylists.length === 0 &&
    filteredAlbums.length === 0 &&
    filteredArtists.length === 0;

  return (
    <>
      <div className="px-4 py-3 sm:px-6 md:px-8 space-y-3 max-w-7xl mx-auto pb-36 animate-in fade-in select-none">
        {/* Header Superior: Avatar + Título + Búsqueda + Añadir (+) */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3 min-w-0">
            {/* User Profile Avatar */}
            <button
              type="button"
              onClick={onOpenProfileSwitcher}
              className="w-9 h-9 rounded-full overflow-hidden bg-[#242424] border border-white/10 flex items-center justify-center text-white text-xs font-bold active:scale-95 transition-transform flex-shrink-0"
              title="Cambiar perfil"
            >
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.displayName || 'Perfil'}
                  className="w-full h-full object-cover"
                />
              ) : (
                (currentUser?.displayName || 'C').charAt(0).toUpperCase()
              )}
            </button>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">
              Tu biblioteca
            </h1>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Search Button */}
            <button
              type="button"
              onClick={() => setIsLibrarySearchOpen((prev) => !prev)}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
                isLibrarySearchOpen
                  ? 'text-[#1DB954] bg-white/10'
                  : 'text-neutral-300 hover:text-white hover:bg-white/5'
              }`}
              title="Buscar en la biblioteca"
              aria-label="Buscar en la biblioteca"
            >
              <Search className="w-5 h-5 sm:w-5 sm:h-5" />
            </button>

            {/* Import Button (Desktop / larger screens) */}
            {onOpenImportPlaylist && (
              <button
                type="button"
                onClick={onOpenImportPlaylist}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#242424] hover:bg-[#2c2c2c] text-emerald-400 font-bold text-xs transition-colors"
                title="Importar playlist"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Importar</span>
              </button>
            )}

            {/* Add / Create Playlist Button (+) */}
            <button
              type="button"
              onClick={onOpenCreatePlaylist}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/5 transition-colors active:scale-95"
              title="Crear playlist"
              aria-label="Crear playlist"
            >
              <Plus className="w-6 h-6 stroke-[2.2]" />
            </button>
          </div>
        </div>

        {/* Expandable Search Input */}
        {isLibrarySearchOpen && (
          <div className="relative animate-in fade-in duration-150 pt-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={librarySearchQuery}
              onChange={(e) => setLibrarySearchQuery(e.target.value)}
              placeholder="Buscar en tu biblioteca..."
              className="w-full bg-[#242424] border border-[#333333] rounded-full pl-9 pr-9 py-2 text-xs sm:text-sm text-white placeholder-neutral-400 focus:outline-none focus:border-[#1DB954]"
            />
            {librarySearchQuery && (
              <button
                type="button"
                onClick={() => setLibrarySearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Chips de filtro horizontales (Playlists, Álbumes, Artistas, Eventos, Descargado) */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {(
            ['Playlists', 'Álbumes', 'Artistas', 'Eventos', 'Descargado'] as const
          ).map((chip) => {
            const isActive = libraryFilterChip === chip;
            return (
              <button
                key={chip}
                type="button"
                onClick={() =>
                  setLibraryFilterChip(isActive ? 'all' : chip)
                }
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 active:scale-95 ${
                  isActive
                    ? 'bg-[#1DB954] text-black shadow-md'
                    : 'bg-[#242424] text-white hover:bg-[#2c2c2c]'
                }`}
              >
                {chip}
              </button>
            );
          })}
        </div>

        {/* Fila de ordenamiento: Recientes (con icono) + Alternar vista cuadrícula/lista */}
        <div className="flex items-center justify-between py-1 text-xs text-neutral-300">
          <button
            type="button"
            onClick={cycleLibrarySort}
            className="flex items-center gap-1.5 font-bold hover:text-white transition-colors active:scale-95"
            title="Cambiar ordenación"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-neutral-300" />
            <span className="text-[13px]">{librarySortLabel}</span>
          </button>

          <button
            type="button"
            onClick={toggleViewMode}
            className="p-1.5 rounded-full hover:text-white hover:bg-white/5 transition-colors active:scale-95 text-neutral-300"
            title={
              viewMode === 'list'
                ? 'Cambiar a vista de cuadrícula'
                : 'Cambiar a vista de lista'
            }
            aria-label="Alternar vista cuadrícula o lista"
          >
            {viewMode === 'list' ? (
              <LayoutGrid className="w-4 h-4" />
            ) : (
              <List className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Empty States */}
        {libraryFilterChip === 'Eventos' ? (
          <div className="py-16 text-center space-y-2">
            <h3 className="text-base font-bold text-white">No tienes eventos guardados</h3>
            <p className="text-xs text-neutral-400 max-w-xs mx-auto">
              Los eventos y conciertos guardados de tus artistas favoritos aparecerán aquí.
            </p>
          </div>
        ) : isFilterEmpty ? (
          <div className="py-16 text-center space-y-2">
            <h3 className="text-base font-bold text-white">No se encontraron resultados</h3>
            <p className="text-xs text-neutral-400 max-w-xs mx-auto">
              Prueba buscando otro término o desmarca los filtros aplicados.
            </p>
          </div>
        ) : viewMode === 'list' ? (
          /* =======================================================
             VISTA DE LISTA EXACTA (Spotify Mobile 1:1)
             - Portada cuadrada 64x64 px (rounded-[4px])
             - Pinned item 1: Tus me gusta con degradado azul-violeta
             - Título en negrita y subtítulo en gris con pin / descargado
             ======================================================= */
          <div className="space-y-0.5 divide-y divide-transparent">
            {/* Elemento anclado 1: Tus me gusta */}
            {showFavorites && (
              <div
                onClick={() => setSelectedPlaylist('favorites')}
                className="flex items-center gap-3.5 py-2 px-1 hover:bg-[#282828]/50 active:bg-[#282828] rounded-xl cursor-pointer select-none transition-colors group"
              >
                <div className="w-16 h-16 rounded-[4px] bg-gradient-to-br from-[#4f46e5] via-[#6366f1] to-[#a855f7] flex items-center justify-center flex-shrink-0 shadow-md">
                  <Heart className="w-7 h-7 text-white fill-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3
                    className={`text-[15px] sm:text-base font-semibold truncate ${
                      favoritesIsPlaying ? 'text-[#1DB954]' : 'text-white'
                    }`}
                  >
                    Tus me gusta
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-[#B3B3B3] mt-0.5 truncate">
                    <span title="Fijada" className="text-[#1DB954] flex-shrink-0">
                      <Pin className="w-3.5 h-3.5 fill-current rotate-45" />
                    </span>
                    {favoritesDownloaded && (
                      <span title="Descargado" className="flex-shrink-0">
                        <DownloadedIcon size={14} />
                      </span>
                    )}
                    <span className="truncate">
                      Playlist • {currentUser?.displayName || 'Camilo Jaimes'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Playlists de usuario */}
            {filteredPlaylists.map((pl) => {
              const isPinned = pinnedPlaylistIds.includes(pl.id);
              const isThisPlaying =
                isPlaying && pl.songIds.includes(currentSong?.id || '');
              const allDownloaded =
                pl.songIds.length > 0 &&
                pl.songIds.every((id) => isDownloaded(id));

              return (
                <div
                  key={pl.id}
                  onClick={() => handlePlaylistClick(pl)}
                  onContextMenu={(event) => openPlaylistMenu(event, pl)}
                  onPointerDown={(event) => handlePlaylistPointerDown(event, pl)}
                  onPointerMove={handlePlaylistPointerMove}
                  onPointerUp={clearLongPress}
                  onPointerLeave={clearLongPress}
                  onPointerCancel={clearLongPress}
                  className="flex items-center gap-3.5 py-2 px-1 hover:bg-[#282828]/50 active:bg-[#282828] rounded-xl cursor-pointer select-none transition-colors group"
                >
                  <div className="w-16 h-16 rounded-[4px] overflow-hidden bg-[#242424] flex items-center justify-center flex-shrink-0 shadow-md">
                    {pl.coverUrl ? (
                      <img
                        src={pl.coverUrl}
                        alt={pl.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Music className="w-7 h-7 text-neutral-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3
                      className={`text-[15px] sm:text-base font-semibold truncate ${
                        isThisPlaying ? 'text-[#1DB954]' : 'text-white'
                      }`}
                    >
                      {pl.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-[#B3B3B3] mt-0.5 truncate">
                      {isPinned && (
                        <span title="Fijada" className="text-[#1DB954] flex-shrink-0">
                          <Pin className="w-3.5 h-3.5 fill-current rotate-45" />
                        </span>
                      )}
                      {allDownloaded && (
                        <span title="Descargado" className="flex-shrink-0">
                          <DownloadedIcon size={14} />
                        </span>
                      )}
                      <span className="truncate">
                        Playlist • {currentUser?.displayName || 'Sonora'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Álbumes */}
            {filteredAlbums.map((alb) => {
              const isThisPlaying =
                isPlaying && alb.songs.some((s) => s.id === currentSong?.id);
              const allDownloaded =
                alb.songs.length > 0 &&
                alb.songs.every((s) => isDownloaded(s.id));

              return (
                <div
                  key={alb.name}
                  onClick={() => setSelectedPlaylist(alb)}
                  className="flex items-center gap-3.5 py-2 px-1 hover:bg-[#282828]/50 active:bg-[#282828] rounded-xl cursor-pointer select-none transition-colors group"
                >
                  <div className="w-16 h-16 rounded-[4px] overflow-hidden bg-[#242424] flex items-center justify-center flex-shrink-0 shadow-md">
                    {alb.coverUrl ? (
                      <img
                        src={alb.coverUrl}
                        alt={alb.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Disc className="w-7 h-7 text-neutral-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3
                      className={`text-[15px] sm:text-base font-semibold truncate ${
                        isThisPlaying ? 'text-[#1DB954]' : 'text-white'
                      }`}
                    >
                      {alb.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-[#B3B3B3] mt-0.5 truncate">
                      {allDownloaded && (
                        <span title="Descargado" className="flex-shrink-0">
                          <DownloadedIcon size={14} />
                        </span>
                      )}
                      <span className="truncate">Álbum • {alb.artist}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Artistas que sigues */}
            {filteredArtists.map((art) => (
              <div
                key={art.key}
                onClick={() => onSelectArtist?.(art.name)}
                className="flex items-center gap-3.5 py-2 px-1 hover:bg-[#282828]/50 active:bg-[#282828] rounded-xl cursor-pointer select-none transition-colors group"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden bg-[#242424] flex items-center justify-center flex-shrink-0 shadow-md">
                  {art.coverUrl ? (
                    <img
                      src={art.coverUrl}
                      alt={art.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserRound className="w-7 h-7 text-neutral-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] sm:text-base font-semibold text-white truncate">
                    {art.name}
                  </h3>
                  <div className="text-xs text-[#B3B3B3] mt-0.5 truncate">
                    Artista
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* =======================================================
             VISTA DE CUADRÍCULA (Grid View Toggle)
             ======================================================= */
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {/* Tus me gusta card */}
              {showFavorites && (
                <div
                  onClick={() => setSelectedPlaylist('favorites')}
                  className="p-4 rounded-2xl bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-600 cursor-pointer shadow-xl hover:scale-102 transition-transform group flex flex-col justify-between aspect-square"
                >
                  <Heart className="w-10 h-10 text-white fill-white" />
                  <div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="font-black text-base sm:text-xl leading-tight text-white truncate min-w-0">
                        Tus me gusta
                      </h3>
                      <span title="Fijada siempre" className="flex-shrink-0">
                        <Pin className="w-4 h-4 text-white fill-white rotate-45" />
                      </span>
                    </div>
                    <p className="text-xs text-indigo-200 mt-1 font-semibold truncate">
                      Playlist • {currentUser?.displayName || 'Camilo Jaimes'}
                    </p>
                  </div>
                </div>
              )}

              {/* User Playlists */}
              {filteredPlaylists.map((pl) => {
                const isPinned = pinnedPlaylistIds.includes(pl.id);
                return (
                  <div
                    key={pl.id}
                    onClick={() => handlePlaylistClick(pl)}
                    onContextMenu={(event) => openPlaylistMenu(event, pl)}
                    onPointerDown={(event) => handlePlaylistPointerDown(event, pl)}
                    onPointerMove={handlePlaylistPointerMove}
                    onPointerUp={clearLongPress}
                    onPointerLeave={clearLongPress}
                    onPointerCancel={clearLongPress}
                    title="Clic derecho o mantener presionado para fijar"
                    className="p-3.5 rounded-2xl bg-neutral-900/60 hover:bg-neutral-800/80 border border-neutral-800 cursor-pointer transition-all group"
                  >
                    <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-3 shadow relative flex items-center justify-center">
                      {pl.coverUrl ? (
                        <img
                          src={pl.coverUrl}
                          alt={pl.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <Music className="w-12 h-12 text-neutral-600" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="font-bold text-sm text-white truncate">{pl.name}</h3>
                      {isPinned && (
                        <span title="Fijada" className="flex-shrink-0">
                          <Pin className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400 rotate-45" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 truncate mt-0.5">
                      Playlist • {pl.songIds.length} temas
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Álbumes en Cuadrícula */}
            {filteredAlbums.length > 0 && (
              <div className="space-y-3 pt-2">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Disc className="w-5 h-5 text-emerald-400" />
                  <span>Álbumes</span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredAlbums.map((alb) => (
                    <div
                      key={alb.name}
                      onClick={() => setSelectedPlaylist(alb)}
                      className="p-3.5 rounded-2xl bg-neutral-900/60 hover:bg-neutral-800/80 border border-neutral-800 cursor-pointer transition-all group"
                    >
                      <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-3 shadow relative flex items-center justify-center">
                        {alb.coverUrl ? (
                          <img
                            src={alb.coverUrl}
                            alt={alb.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <Disc className="w-12 h-12 text-neutral-600" />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-8 h-8 text-emerald-400 fill-emerald-400 drop-shadow-lg" />
                        </div>
                      </div>
                      <h3 className="font-bold text-sm text-white truncate">{alb.name}</h3>
                      <p className="text-xs text-emerald-400 font-semibold truncate mt-0.5">
                        {alb.artist}
                      </p>
                      <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                        {alb.year ? `${alb.year} • ` : ''}{alb.songs.length} pistas
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Artistas en Cuadrícula */}
            {filteredArtists.length > 0 && (
              <div className="space-y-3 pt-2">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserRound className="w-5 h-5 text-emerald-400" />
                  <span>Artistas que sigues</span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredArtists.map((artist) => (
                    <div
                      key={artist.key}
                      onClick={() => onSelectArtist?.(artist.name)}
                      className="p-3.5 rounded-2xl bg-neutral-900/60 hover:bg-neutral-800/80 border border-neutral-800 cursor-pointer transition-all group text-center"
                    >
                      <div className="w-full aspect-square rounded-full overflow-hidden bg-neutral-800 mb-3 shadow relative flex items-center justify-center mx-auto">
                        {artist.coverUrl ? (
                          <img
                            src={artist.coverUrl}
                            alt={artist.name}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <UserRound className="w-12 h-12 text-neutral-600" />
                        )}
                      </div>
                      <h3 className="font-bold text-sm text-white truncate">{artist.name}</h3>
                      <p className="text-xs text-neutral-500 truncate mt-0.5">
                        {artist.songs === 1 ? '1 canción' : `${artist.songs} canciones`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <PlaylistContextMenu
        state={playlistMenu}
        pinned={
          playlistMenu
            ? pinnedPlaylistIds.includes(playlistMenu.playlist.id)
            : false
        }
        onClose={() => setPlaylistMenu(null)}
        onTogglePin={togglePlaylistPin}
        onPlay={(playlist) => setSelectedPlaylist(playlist)}
      />
    </>
  );
};
