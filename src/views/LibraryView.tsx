import React, { useRef, useState } from 'react';
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
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  selectedPlaylist,
  setSelectedPlaylist,
  onOpenCreatePlaylist,
  onOpenAddToPlaylist,
  onOpenImportPlaylist,
  onSelectArtist,
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

  const { playSong, currentSong, isPlaying, togglePlayPause, isShuffle, toggleShuffle } = useAudio();

  const [playlistSearch, setPlaylistSearch] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<{ percent: number; status: string } | null>(null);
  const [downloadMessage, setDownloadMessage] = useState('');
  const [playlistMenu, setPlaylistMenu] = useState<PlaylistMenuState | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressPlaylistClickRef = useRef(false);

  const albums = React.useMemo(() => getAlbumsFromCatalog(librarySongs), [librarySongs]);

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
      if (playlistSongs.length === 0) return;
      if (isThisPlaylistPlaying) {
        togglePlayPause();
      } else {
        playSong(playlistSongs[0], playlistSongs, {
          type: sourceType,
          name: sourceName,
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
        {/* Spotify Hero Banner: the ambient light comes from the cover. */}
        <div className="relative overflow-hidden p-5 md:p-8 pt-6 md:pt-10 flex flex-col md:flex-row items-start md:items-end gap-5 md:gap-6 shadow-2xl">
          {heroCover ? (
            <>
              <div
                className="absolute inset-0 bg-cover bg-center scale-125 blur-3xl opacity-60 saturate-150"
                style={{ backgroundImage: `url(${heroCover})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-neutral-950/55 to-neutral-950" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-900 via-purple-950 to-neutral-950" />
          )}

          {/* Cover Art Box */}
          <div className="relative z-10 w-52 h-52 sm:w-56 sm:h-56 md:w-56 md:h-56 self-center md:self-auto rounded-xl md:rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 flex items-center justify-center">
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
          <div className="relative z-10 flex-1 min-w-0 space-y-2">
            <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider text-white">
              {isFavorites ? 'Colección privada' : isAlbum ? 'Álbum' : 'Playlist pública'}
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-white tracking-tight leading-none py-1 break-words">
              {sourceName}
            </h1>
            {!isFavorites && !isAlbum && playlistObj?.description && (
              <p className="text-xs text-neutral-300 line-clamp-2">
                {playlistObj.description}
              </p>
            )}

            <div className="flex items-center gap-2 text-xs text-neutral-300 font-semibold pt-1">
              {isAlbum && albumObj && (
                (() => {
                  const artistProfile = getArtistProfile(albumObj.artist);
                  const artistAvatar = artistProfile?.avatarUrl;
                  return artistAvatar ? (
                    <img
                      src={artistAvatar}
                      alt={albumObj.artist}
                      className="w-6 h-6 rounded-full object-cover shadow"
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
              <span>{playlistSongs.length} canciones</span>
              <span>•</span>
              <span className="text-neutral-400">{formatTime(totalSeconds)}</span>
            </div>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="p-5 md:p-8 pt-4 md:pt-6 space-y-5 md:space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 md:gap-5">
              {/* Big Circular Green Play Button */}
              <button
                onClick={handlePlayAll}
                className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
                title={isThisPlaylistPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isThisPlaylistPlaying ? (
                  <Pause className="w-6 h-6 fill-black" />
                ) : (
                  <Play className="w-6 h-6 fill-black ml-1" />
                )}
              </button>

              {/* Shuffle Button */}
              <button
                onClick={toggleShuffle}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-90 ${
                  isShuffle ? 'text-emerald-400' : 'text-neutral-400 hover:text-white'
                }`}
                title="Aleatorio"
              >
                <Shuffle className="w-5 h-5" />
              </button>

              {/* Add Album to Library Button (Exact Spotify Style) */}
              {isAlbum && albumObj && (
                <button
                  onClick={() => toggleSaveAlbum(albumObj)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-90"
                  title={
                    isAlbumSaved(albumObj.name)
                      ? 'Guardado en tu biblioteca (clic para quitar)'
                      : 'Guardar álbum en tu biblioteca'
                  }
                >
                  {isAlbumSaved(albumObj.name) ? (
                    <SavedCheckIcon size={32} />
                  ) : (
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 32 32"
                      fill="none"
                      className="text-neutral-400 hover:text-white"
                    >
                      <circle cx="16" cy="16" r="14.5" stroke="currentColor" strokeWidth="1.8" />
                      <path
                        d="M16 10v12M10 16h12"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </button>
              )}

              {/* Download All Button (Spotify Style 32px circle) */}
              <button
                onClick={handleDownloadAll}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-90"
                title={areAllDownloaded ? 'Descargado en tu dispositivo' : 'Descargar para escuchar sin conexión'}
              >
                {areAllDownloaded ? (
                  <DownloadedIcon size={32} />
                ) : (
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 32 32"
                    fill="none"
                    className="text-neutral-400 hover:text-white"
                  >
                    <circle cx="16" cy="16" r="14.5" stroke="currentColor" strokeWidth="1.8" />
                    <path
                      d="M16 9v11M11.5 15.5 16 20l4.5-4.5M11 23h10"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>

              {/* Download ZIP bundle button */}
              <button
                onClick={handleDownloadZip}
                className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-white border border-neutral-700/80 hover:border-neutral-400 bg-neutral-900/60 hover:bg-neutral-800 transition-all hover:scale-105 active:scale-90"
                title="Descargar paquete completo (.ZIP) para tu computador"
              >
                <FolderDown className="w-4 h-4" />
              </button>

              {/* Delete Playlist (only if custom playlist) */}
              {!isFavorites && !isAlbum && playlistObj && (
                <button
                  onClick={() => {
                    if (confirm(`¿Eliminar la playlist "${playlistObj.name}"?`)) {
                      deletePlaylist(playlistObj.id);
                      setSelectedPlaylist(null);
                    }
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-red-400 border border-neutral-800 hover:border-red-500/40 bg-neutral-900/60 hover:bg-red-950/20 transition-all hover:scale-105 active:scale-90"
                  title="Eliminar playlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* In-playlist Search Filter */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={playlistSearch}
                onChange={(e) => setPlaylistSearch(e.target.value)}
                placeholder="Buscar en la lista..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded-full pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Download Progress Toast */}
          {downloadProgress && (
            <div className="p-3 bg-neutral-900 border border-emerald-500/30 rounded-2xl max-w-md">
              <div className="flex justify-between text-xs font-bold text-white mb-1">
                <span>{downloadProgress.status}</span>
                <span>{downloadProgress.percent}%</span>
              </div>
              <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-300"
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

          {/* Songs Table Header (Spotify Style) */}
          <div className="border-t border-neutral-900 pt-4">
            <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-900">
              <span className="col-span-1 text-center">#</span>
              <span className="col-span-7 sm:col-span-5 md:col-span-6">Título</span>
              <span className="col-span-4 md:col-span-4 hidden sm:block">
                {isAlbum ? 'Reproducciones' : 'Álbum'}
              </span>
              <span className="col-span-4 sm:col-span-2 md:col-span-1 text-right flex justify-end">
                <Clock className="w-4 h-4" />
              </span>
            </div>

            {/* Songs Rows */}
            <div className="divide-y divide-neutral-900/60 mt-1">
              {filteredSongs.length === 0 ? (
                <div className="p-12 text-center text-neutral-500">
                  <p className="text-sm font-bold">No se encontraron canciones</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Ve a "Explorar la Nube" para añadir canciones a tus playlists.
                  </p>
                </div>
              ) : (
                filteredSongs.map((song, idx) => {
                  const isCurrent = currentSong?.id === song.id;
                  const downloaded = isDownloaded(song.id);
                  const isSaved = isFavorite(song.id) || isSongInLibrary(song.id);
                  const playCount = getUserSongPlayCount(song.id);

                  return (
                    <div
                      key={song.id}
                      onClick={() =>
                        playSong(song, playlistSongs, {
                          type: sourceType,
                          name: sourceName,
                        })
                      }
                      className="grid grid-cols-12 gap-4 px-4 py-2.5 rounded-xl hover:bg-neutral-900/70 items-center cursor-pointer group transition-colors"
                    >
                      {/* # or Play button */}
                      <div className="col-span-1 flex items-center justify-center">
                        <span className="text-xs font-mono text-neutral-500 group-hover:hidden">
                          {song.trackNumber || idx + 1}
                        </span>
                        <button className="hidden group-hover:block text-white">
                          {isCurrent && isPlaying ? (
                            <Pause className="w-4 h-4 fill-white" />
                          ) : (
                            <Play className="w-4 h-4 fill-white ml-0.5" />
                          )}
                        </button>
                      </div>

                      {/* Title + Artist. Album rows omit the repeated cover. */}
                      <div className="col-span-7 sm:col-span-5 md:col-span-6 flex items-center gap-3 min-w-0 truncate">
                        {!isAlbum && (
                          <img
                            src={song.coverUrl}
                            alt={song.title}
                            loading="lazy"
                            decoding="async"
                            className="w-10 h-10 rounded-lg object-cover flex-shrink-0 shadow"
                          />
                        )}
                        <div className="min-w-0 flex-1 truncate">
                          <span
                            className={`block font-bold text-sm truncate ${
                              isCurrent ? 'text-emerald-400' : 'text-white'
                            }`}
                          >
                            {song.title}
                          </span>
                          <div className="flex items-center gap-1.5 text-xs text-neutral-400 truncate mt-0.5">
                            {downloaded && (
                              <span title="Descargado" className="flex-shrink-0">
                                <DownloadedIcon size={12} />
                              </span>
                            )}
                            {song.isExplicit && (
                              <span
                                className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-neutral-600/80 text-black text-[9px] font-black flex-shrink-0 select-none leading-none"
                                title="Contenido explícito"
                              >
                                E
                              </span>
                            )}
                            <ArtistLinks artists={song.artist} onSelectArtist={onSelectArtist} />
                          </div>
                        </div>
                      </div>

                      {/* Album / Reproducciones */}
                      <div className="col-span-4 md:col-span-4 hidden sm:block truncate text-xs text-neutral-400 font-mono">
                        {isAlbum ? (
                          <span
                            className="font-medium text-neutral-300"
                            title="Tus reproducciones para esta pista"
                          >
                            {playCount > 0
                              ? new Intl.NumberFormat('es-CO').format(playCount)
                              : '0'}
                          </span>
                        ) : (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              const targetAlbum = albums.find(
                                (a) => a.name.trim().toLowerCase() === song.album?.trim().toLowerCase()
                              );
                              if (targetAlbum) {
                                setSelectedPlaylist(targetAlbum);
                              }
                            }}
                            className={
                              song.album && song.album.trim().toLowerCase() !== 'sencillo'
                                ? 'hover:underline hover:text-white cursor-pointer font-sans'
                                : 'font-sans'
                            }
                            title={song.album ? `Abrir álbum ${song.album}` : undefined}
                          >
                            {song.album || 'Sencillo'}
                          </span>
                        )}
                      </div>

                      {/* Actions & Duration */}
                      <div className="col-span-4 sm:col-span-2 md:col-span-1 flex items-center justify-end gap-2.5 text-xs font-mono text-neutral-400">
                        {/* Spotify Saved Chulito Verde or Plus */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(song.id);
                          }}
                          className={`p-1 rounded-full transition-transform active:scale-90 ${
                            isSaved
                              ? 'hover:scale-110'
                              : 'opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-white hover:scale-110'
                          }`}
                          title={isSaved ? 'Guardada en tu biblioteca / favoritos (clic para quitar)' : 'Añadir a Tus me gusta'}
                        >
                          {isSaved ? (
                            <SavedCheckIcon size={16} />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                        </button>
                        <span className="min-w-[36px] text-right">{formatTime(song.duration)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback if no playlist is selected: Grid of user playlists
  return (
    <>
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto pb-36 animate-in fade-in select-none">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black text-white">Tu Biblioteca</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Explora tus canciones favoritas y playlists creadas.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {onOpenImportPlaylist && (
            <button
              onClick={onOpenImportPlaylist}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-emerald-300 font-extrabold text-[11px] sm:text-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Importar</span>
            </button>
          )}
          <button
            onClick={onOpenCreatePlaylist}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-[11px] sm:text-xs shadow-lg transition-transform active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
            <span>Crear</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {/* Tus me gusta card */}
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
            <p className="text-xs text-indigo-200 mt-1 font-semibold">
              {userFavoriteSongs.length} canciones favoritas
            </p>
          </div>
        </div>

        {/* User Playlists */}
        {orderedPlaylists.map((pl) => {
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
                  <img src={pl.coverUrl} alt={pl.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
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

      {/* Álbumes Section */}
      {albums.length > 0 && (
        <div className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <Disc className="w-6 h-6 text-emerald-400" />
                <span>Tus Álbumes</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Álbumes completos con todas sus pistas unificadas (incluyendo colaboraciones).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {albums.map((alb) => (
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

      {/* Followed artists */}
      {followedArtistCards.length > 0 && (
        <div className="pt-6 space-y-4">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <UserRound className="w-6 h-6 text-emerald-400" />
              <span>Artistas que sigues</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Solo aparecen los artistas que sigues.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {followedArtistCards.map((artist) => (
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
