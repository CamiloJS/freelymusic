import React, { useState } from 'react';
import {
  Play,
  Pause,
  Heart,
  Music,
  Trash2,
  Download,
  FolderDown,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Plus,
  Shuffle,
  Search,
  ArrowDownCircle,
  MoreHorizontal,
  Disc
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { Playlist, Song, Album } from '../types';
import { formatTime } from '../utils/lyrics';
import { getAlbumsFromCatalog } from '../utils/albums';

interface LibraryViewProps {
  selectedPlaylist: Playlist | 'favorites' | Album | null;
  setSelectedPlaylist: (playlist: Playlist | 'favorites' | Album | null) => void;
  onOpenCreatePlaylist: () => void;
  onOpenAddToPlaylist: (song: Song) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  selectedPlaylist,
  setSelectedPlaylist,
  onOpenCreatePlaylist,
  onOpenAddToPlaylist,
}) => {
  const { currentUser } = useAuth();
  const {
    catalog,
    userFavoriteSongs,
    playlists,
    deletePlaylist,
    removeSongFromPlaylist,
    toggleFavorite,
    isFavorite,
    isDownloaded,
    toggleDownloadSong,
    downloadFullPlaylistZip,
  } = useMusic();

  const { playSong, currentSong, isPlaying, togglePlayPause, isShuffle, toggleShuffle } = useAudio();

  const [playlistSearch, setPlaylistSearch] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<{ percent: number; status: string } | null>(null);

  const albums = React.useMemo(() => getAlbumsFromCatalog(catalog), [catalog]);

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
      for (const song of playlistSongs) {
        if (!isDownloaded(song.id)) {
          await toggleDownloadSong(song);
        }
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
        {/* Spotify Hero Banner */}
        <div
          className={`p-6 md:p-8 pt-10 flex flex-col md:flex-row items-start md:items-end gap-6 shadow-2xl relative ${
            isFavorites
              ? 'bg-gradient-to-b from-indigo-900 via-purple-950 to-neutral-950'
              : isAlbum
              ? 'bg-gradient-to-b from-blue-950 via-slate-900 to-neutral-950'
              : 'bg-gradient-to-b from-emerald-950 via-teal-950 to-neutral-950'
          }`}
        >
          {/* Cover Art Box */}
          <div className="w-48 h-48 md:w-56 md:h-56 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 flex items-center justify-center">
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
          <div className="flex-1 space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-white">
              {isFavorites ? 'Colección privada' : isAlbum ? 'Álbum' : 'Playlist pública'}
            </span>
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-none py-1">
              {sourceName}
            </h1>
            {!isFavorites && !isAlbum && playlistObj?.description && (
              <p className="text-xs text-neutral-300 line-clamp-2">
                {playlistObj.description}
              </p>
            )}

            <div className="flex items-center gap-1.5 text-xs text-neutral-300 font-semibold pt-1">
              <span className="text-white font-extrabold">
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
        <div className="p-6 md:p-8 pt-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-5">
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
                className={`p-2 rounded-full transition-colors ${
                  isShuffle ? 'text-emerald-400' : 'text-neutral-400 hover:text-white'
                }`}
                title="Aleatorio"
              >
                <Shuffle className="w-6 h-6" />
              </button>

              {/* Download All Button */}
              <button
                onClick={handleDownloadAll}
                className={`p-1.5 rounded-full transition-all ${
                  areAllDownloaded
                    ? 'text-emerald-400 hover:text-emerald-300'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title={areAllDownloaded ? 'Descargado en tu dispositivo' : 'Descargar para escuchar sin conexión'}
              >
                {areAllDownloaded ? (
                  <CheckCircle2 className="w-8 h-8 fill-emerald-500 text-black" />
                ) : (
                  <ArrowDownCircle className="w-8 h-8 hover:scale-105 active:scale-95" />
                )}
              </button>

              {/* Download ZIP bundle button */}
              <button
                onClick={handleDownloadZip}
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors"
                title="Descargar paquete completo (.ZIP) para tu computador"
              >
                <FolderDown className="w-5 h-5" />
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
                  className="p-2 rounded-xl text-neutral-400 hover:text-red-400 hover:bg-neutral-900 transition-colors"
                  title="Eliminar playlist"
                >
                  <Trash2 className="w-5 h-5" />
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

          {/* Songs Table Header (Spotify Style) */}
          <div className="border-t border-neutral-900 pt-4">
            <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-900">
              <span className="col-span-1 text-center">#</span>
              <span className="col-span-5 md:col-span-6">Título</span>
              <span className="col-span-4 md:col-span-4 hidden sm:block">Álbum</span>
              <span className="col-span-6 sm:col-span-2 md:col-span-1 text-right flex justify-end">
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
                  const liked = isFavorite(song.id);

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

                      {/* Title + Cover + Artist */}
                      <div className="col-span-5 md:col-span-6 flex items-center gap-3 truncate">
                        <img
                          src={song.coverUrl}
                          alt={song.title}
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0 shadow"
                        />
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            {song.isExplicit && (
                              <span
                                className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-neutral-600/80 text-black text-[9px] font-black flex-shrink-0 select-none leading-none"
                                title="Contenido explícito"
                              >
                                E
                              </span>
                            )}
                            <span
                              className={`block font-bold text-sm truncate ${
                                isCurrent ? 'text-emerald-400' : 'text-white'
                              }`}
                            >
                              {song.title}
                            </span>
                          </div>
                          <span className="block text-xs text-neutral-400 truncate mt-0.5">
                            {song.artist}
                          </span>
                        </div>
                      </div>

                      {/* Album */}
                      <div className="col-span-4 md:col-span-4 hidden sm:block truncate text-xs text-neutral-400">
                        {song.album}
                      </div>

                      {/* Actions & Duration */}
                      <div className="col-span-6 sm:col-span-2 md:col-span-1 flex items-center justify-end gap-2 text-xs font-mono text-neutral-400">
                        {downloaded && (
                          <span title="Descargado">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(song.id);
                          }}
                          className={`p-1 rounded-full ${liked ? 'text-emerald-400' : 'opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-white'}`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-emerald-400' : ''}`} />
                        </button>
                        <span>{formatTime(song.duration)}</span>
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
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto pb-36 animate-in fade-in select-none">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">Tu Biblioteca</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Explora tus canciones favoritas y playlists creadas.
          </p>
        </div>

        <button
          onClick={onOpenCreatePlaylist}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs shadow-lg transition-transform active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Crear Playlist</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {/* Tus me gusta card */}
        <div
          onClick={() => setSelectedPlaylist('favorites')}
          className="p-4 rounded-2xl bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-600 cursor-pointer shadow-xl hover:scale-102 transition-transform group flex flex-col justify-between aspect-square"
        >
          <Heart className="w-10 h-10 text-white fill-white" />
          <div>
            <h3 className="font-black text-xl text-white">Tus me gusta</h3>
            <p className="text-xs text-indigo-200 mt-1 font-semibold">
              {userFavoriteSongs.length} canciones favoritas
            </p>
          </div>
        </div>

        {/* User Playlists */}
        {playlists.map((pl) => (
          <div
            key={pl.id}
            onClick={() => setSelectedPlaylist(pl)}
            className="p-3.5 rounded-2xl bg-neutral-900/60 hover:bg-neutral-800/80 border border-neutral-800 cursor-pointer transition-all group"
          >
            <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-3 shadow relative flex items-center justify-center">
              {pl.coverUrl ? (
                <img src={pl.coverUrl} alt={pl.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              ) : (
                <Music className="w-12 h-12 text-neutral-600" />
              )}
            </div>
            <h3 className="font-bold text-sm text-white truncate">{pl.name}</h3>
            <p className="text-xs text-neutral-500 truncate mt-0.5">
              Playlist • {pl.songIds.length} temas
            </p>
          </div>
        ))}
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
    </div>
  );
};
