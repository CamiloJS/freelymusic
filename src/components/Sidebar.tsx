import React, { useRef, useState } from 'react';
import Home from 'lucide-react/dist/esm/icons/house.mjs';
import Compass from 'lucide-react/dist/esm/icons/compass.mjs';
import Library from 'lucide-react/dist/esm/icons/library.mjs';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import Music from 'lucide-react/dist/esm/icons/eighth-notes.mjs';
import UserRound from 'lucide-react/dist/esm/icons/user-round.mjs';
import Disc from 'lucide-react/dist/esm/icons/disc.mjs';
import Search from 'lucide-react/dist/esm/icons/search.mjs';
import Settings from 'lucide-react/dist/esm/icons/settings.mjs';
import Heart from 'lucide-react/dist/esm/icons/heart.mjs';
import Pin from 'lucide-react/dist/esm/icons/pin.mjs';
import WifiOff from 'lucide-react/dist/esm/icons/wifi-off.mjs';
import ListMusic from 'lucide-react/dist/esm/icons/list-music.mjs';
import { DownloadedIcon } from './DownloadedIcon';
import { PlaylistContextMenu, PlaylistMenuState } from './PlaylistContextMenu';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { Playlist, Album } from '../types';
import { getAlbumsFromCatalog } from '../utils/albums';
import { DEFAULT_AVATAR } from '../services/storage';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onSelectPlaylist: (playlist: Playlist | 'favorites' | Album) => void;
  selectedPlaylist: Playlist | 'favorites' | Album | null;
  onOpenCreatePlaylist: () => void;
  onOpenProfileSwitcher: () => void;
  onSelectArtist: (artistName: string) => void;
  isOnline: boolean;
}

function primaryArtist(value: string): string {
  return (value || 'Artista desconocido').split(/[,&/]|feat\.?|ft\.?/i)[0].trim();
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  onSelectPlaylist,
  selectedPlaylist,
  onOpenCreatePlaylist,
  onOpenProfileSwitcher,
  onSelectArtist,
  isOnline,
}) => {
  const { currentUser } = useAuth();
  const {
    catalog,
    playlists,
    userFavoriteSongs,
    isDownloaded,
    librarySongs,
    followedArtists,
    artistProfiles,
    getArtistProfile,
    pinnedPlaylistIds,
    togglePlaylistPin,
  } = useMusic();
  const { setIsCenterLyricsOpen } = useAudio();

  const [libraryFilter, setLibraryFilter] = useState<
    'all' | 'playlists' | 'albums' | 'artists'
  >('all');
  const [isLibrarySearchOpen, setIsLibrarySearchOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [playlistMenu, setPlaylistMenu] = useState<PlaylistMenuState | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressPlaylistClickRef = useRef(false);

  const uniqueAlbums = React.useMemo(
    () => getAlbumsFromCatalog(librarySongs),
    [librarySongs]
  );

  // The Artists tab mirrors Spotify's followed artists: only artists the user
  // explicitly follows are listed, never the whole catalog.
  const libraryArtists = React.useMemo(() => {
    return followedArtists
      .map((key) => {
        const profile = getArtistProfile(key);
        const songs = catalog.filter((song) => {
          const parts = song.artist
            .split(/[,&/]|feat\.|ft\./i)
            .map((p) => p.trim().toLowerCase());
          return parts.includes(key) || song.artist.toLowerCase().includes(key);
        });
        const fallback = songs.find((song) => Boolean(song.coverUrl));
        const catalogName = fallback
          ? fallback.artist.split(/[,&/]|feat\.|ft\./i)[0].trim()
          : '';
        return {
          key,
          name: profile?.name || catalogName || (key.charAt(0).toUpperCase() + key.slice(1)),
          coverUrl: profile?.avatarUrl || fallback?.coverUrl || '',
          songs: songs.length,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, followedArtists, artistProfiles, getArtistProfile]);

  const areFavoritesDownloaded =
    userFavoriteSongs.length > 0 && userFavoriteSongs.every((song) => isDownloaded(song.id));

  const search = librarySearch.trim().toLowerCase();

  const filteredPlaylists = playlists.filter(
    (playlist) => !search || playlist.name.toLowerCase().includes(search)
  );

  const orderedPlaylists = [...filteredPlaylists].sort((a, b) => {
    const aPinned = pinnedPlaylistIds.includes(a.id) ? 0 : 1;
    const bPinned = pinnedPlaylistIds.includes(b.id) ? 0 : 1;
    return aPinned - bPinned;
  });

  const navigateToPlaylist = (playlist: Playlist) => {
    setIsCenterLyricsOpen(false);
    onSelectPlaylist(playlist);
    setCurrentTab('library');
  };

  const openPlaylistMenu = (
    event: React.MouseEvent | React.PointerEvent,
    playlist: Playlist
  ) => {
    event.preventDefault();
    event.stopPropagation();
    suppressPlaylistClickRef.current = true;
    window.setTimeout(() => {
      suppressPlaylistClickRef.current = false;
    }, 1000);
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
    navigateToPlaylist(playlist);
  };

  React.useEffect(() => () => clearLongPress(), []);

  const filteredAlbums = uniqueAlbums.filter(
    (album) =>
      !search ||
      album.name.toLowerCase().includes(search) ||
      album.artist.toLowerCase().includes(search)
  );

  const filteredArtists = libraryArtists.filter(
    (artist) => !search || artist.name.toLowerCase().includes(search)
  );

  const startPlayingFromFavorites = () => {
    if (userFavoriteSongs.length === 0) return;
    setIsCenterLyricsOpen(false);
    onSelectPlaylist('favorites');
    setCurrentTab('library');
  };

  return (
    <>
      <aside className="w-68 lg:w-76 bg-black text-neutral-300 flex flex-col h-full select-none flex-shrink-0">
        {/* Library panel */}
        <div className="flex-1 flex flex-col min-h-0 bg-neutral-950/90 rounded-2xl mx-2 my-2 border border-neutral-900/90 overflow-hidden">
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <button
              onClick={() => {
                setIsCenterLyricsOpen(false);
                setCurrentTab('library');
              }}
              className="flex items-center gap-2.5 text-neutral-300 hover:text-white font-extrabold text-sm transition-colors min-w-0"
            >
              <Library className="w-5 h-5 text-neutral-400 flex-shrink-0" />
              <span className="truncate">Tu biblioteca</span>
            </button>

            <button
              onClick={onOpenCreatePlaylist}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-bold flex-shrink-0"
              title="Crear playlist"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Crear</span>
            </button>
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {(
              [
                { id: 'playlists', label: 'Playlists' },
                { id: 'albums', label: 'Álbumes' },
                { id: 'artists', label: 'Artistas' },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                onClick={() =>
                  setLibraryFilter((previous) =>
                    previous === filter.id ? 'all' : filter.id
                  )
                }
                className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors ${
                  libraryFilter === filter.id
                    ? 'bg-white text-black'
                    : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Search is collapsed by default to keep the sidebar clean */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setIsLibrarySearchOpen((previous) => !previous)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                title="Buscar en tu biblioteca"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              {isLibrarySearchOpen && (
                <input
                  autoFocus
                  type="text"
                  value={librarySearch}
                  onChange={(event) => setLibrarySearch(event.target.value)}
                  placeholder="Buscar en tu biblioteca"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                />
              )}
            </div>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-neutral-500 flex-shrink-0">
              <ListMusic className="w-3 h-3" />
              <span>Recientes</span>
            </div>
          </div>
        </div>

        {/* Scrollable library list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {(libraryFilter === 'all' || libraryFilter === 'playlists') && (
            <div
              onClick={startPlayingFromFavorites}
              className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${
                selectedPlaylist === 'favorites' && currentTab === 'library'
                  ? 'bg-neutral-850 text-white'
                  : 'hover:bg-neutral-900/70 text-neutral-300'
              }`}
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-md">
                <Heart className="w-5 h-5 text-white fill-white" />
              </div>
              <div className="truncate flex-1">
                <span
                  className={`block font-bold text-xs truncate ${
                    selectedPlaylist === 'favorites' ? 'text-emerald-400' : 'text-white'
                  }`}
                >
                  Tus me gusta
                </span>
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 truncate mt-0.5">
                  <Pin className="w-3 h-3 text-emerald-400 fill-emerald-400 rotate-45 flex-shrink-0" />
                  {areFavoritesDownloaded && (
                    <DownloadedIcon size={12} className="flex-shrink-0" />
                  )}
                  <span className="truncate">Playlist • {currentUser?.displayName || 'Tú'}</span>
                </div>
              </div>
            </div>
          )}

          {(libraryFilter === 'all' || libraryFilter === 'playlists') &&
            orderedPlaylists.map((playlist) => {
              const isSelected =
                selectedPlaylist !== 'favorites' &&
                selectedPlaylist &&
                'id' in selectedPlaylist &&
                selectedPlaylist.id === playlist.id &&
                currentTab === 'library';
              const allDownloaded =
                playlist.songIds.length > 0 &&
                playlist.songIds.every((songId) => isDownloaded(songId));
              const isPinned = pinnedPlaylistIds.includes(playlist.id);

              return (
                <div
                  key={playlist.id}
                  onClick={() => handlePlaylistClick(playlist)}
                  onContextMenu={(event) => openPlaylistMenu(event, playlist)}
                  onPointerDown={(event) => handlePlaylistPointerDown(event, playlist)}
                  onPointerMove={handlePlaylistPointerMove}
                  onPointerUp={clearLongPress}
                  onPointerLeave={clearLongPress}
                  onPointerCancel={clearLongPress}
                  className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors group ${
                    isSelected ? 'bg-neutral-850 text-white' : 'hover:bg-neutral-900/70'
                  }`}
                  title="Clic derecho o mantener presionado para fijar"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0 shadow flex items-center justify-center">
                    {playlist.coverUrl ? (
                      <img
                        src={playlist.coverUrl}
                        alt={playlist.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Music className="w-5 h-5 text-neutral-600" />
                    )}
                  </div>
                  <div className="truncate flex-1">
                    <span
                      className={`block font-bold text-xs truncate ${
                        isSelected ? 'text-emerald-400' : 'text-white'
                      }`}
                    >
                      {playlist.name}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 truncate mt-0.5">
                      {isPinned && (
                        <Pin className="w-3 h-3 text-emerald-400 fill-emerald-400 rotate-45 flex-shrink-0" />
                      )}
                      {allDownloaded && (
                        <DownloadedIcon size={12} className="flex-shrink-0" />
                      )}
                      <span className="truncate">Playlist • {currentUser?.displayName || 'Tú'}</span>
                    </div>
                  </div>
                </div>
              );
            })}

          {(libraryFilter === 'all' || libraryFilter === 'albums') &&
            filteredAlbums.map((album) => {
              const isSelected =
                selectedPlaylist &&
                typeof selectedPlaylist === 'object' &&
                'songs' in selectedPlaylist &&
                selectedPlaylist.name.toLowerCase() === album.name.toLowerCase() &&
                currentTab === 'library';
              const allDownloaded =
                album.songs.length > 0 &&
                album.songs.every((song) => isDownloaded(song.id));

              return (
                <div
                  key={`${album.name}-${album.artist}`}
                  onClick={() => {
                    setIsCenterLyricsOpen(false);
                    onSelectPlaylist(album);
                    setCurrentTab('library');
                  }}
                  className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors group ${
                    isSelected ? 'bg-neutral-850 text-white' : 'hover:bg-neutral-900/70'
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0 shadow flex items-center justify-center">
                    {album.coverUrl ? (
                      <img
                        src={album.coverUrl}
                        alt={album.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Disc className="w-5 h-5 text-neutral-600" />
                    )}
                  </div>
                  <div className="truncate flex-1">
                    <span
                      className={`block font-bold text-xs truncate ${
                        isSelected ? 'text-emerald-400' : 'text-white'
                      }`}
                    >
                      {album.name}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 truncate mt-0.5">
                      {allDownloaded && (
                        <DownloadedIcon size={12} className="flex-shrink-0" />
                      )}
                      <span className="truncate">Álbum • {album.artist}</span>
                    </div>
                  </div>
                </div>
              );
            })}

          {(libraryFilter === 'all' || libraryFilter === 'artists') &&
            filteredArtists.map((artist) => (
              <div
                key={artist.name}
                onClick={() => {
                  setIsCenterLyricsOpen(false);
                  onSelectArtist(artist.name);
                }}
                className="flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors hover:bg-neutral-900/70"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden bg-neutral-900 flex-shrink-0 shadow flex items-center justify-center">
                  {artist.coverUrl ? (
                    <img
                      src={artist.coverUrl}
                      alt={artist.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserRound className="w-5 h-5 text-neutral-600" />
                  )}
                </div>
                <div className="truncate flex-1">
                  <span className="block font-bold text-xs text-white truncate">
                    {artist.name}
                  </span>
                  <span className="block text-[11px] text-neutral-400 truncate mt-0.5">
                    Artista
                  </span>
                </div>
              </div>
            ))}

          {libraryFilter === 'artists' && filteredArtists.length === 0 && (
            <div className="px-3 py-6 text-center">
              <p className="text-xs font-bold text-neutral-400">Aún no sigues artistas</p>
              <p className="text-[10px] text-neutral-500 mt-1">
                Abre el perfil de un artista y pulsa Seguir para verlo aquí.
              </p>
            </div>
          )}

          {librarySongs.length === 0 && libraryFilter !== 'artists' && (
            <div className="px-3 py-6 text-center">
              <p className="text-xs font-bold text-neutral-400">Tu biblioteca está vacía</p>
              <p className="text-[10px] text-neutral-500 mt-1">
                Busca música y guárdala con el corazón o en una playlist.
              </p>
            </div>
          )}
        </div>
      </div>

      </aside>

      <PlaylistContextMenu
        state={playlistMenu}
        pinned={
          playlistMenu
            ? pinnedPlaylistIds.includes(playlistMenu.playlist.id)
            : false
        }
        onClose={() => setPlaylistMenu(null)}
        onTogglePin={togglePlaylistPin}
        onPlay={navigateToPlaylist}
      />
    </>
  );
};
