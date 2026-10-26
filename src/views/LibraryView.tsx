import React, { useState } from 'react';
import {
  Play,
  Heart,
  Music,
  Trash2,
  Download,
  FolderDown,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Plus
} from 'lucide-react';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { Playlist, Song } from '../types';
import { formatTime } from '../utils/lyrics';

interface LibraryViewProps {
  selectedPlaylist: Playlist | null;
  setSelectedPlaylist: (playlist: Playlist | null) => void;
  onOpenCreatePlaylist: () => void;
  onOpenAddToPlaylist: (song: Song) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  selectedPlaylist,
  setSelectedPlaylist,
  onOpenCreatePlaylist,
  onOpenAddToPlaylist,
}) => {
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
    downloadSingleSongFile,
    downloadFullPlaylistZip,
  } = useMusic();

  const { playSong, currentSong, isPlaying } = useAudio();

  const [activeTab, setActiveTab] = useState<'favorites' | 'playlists'>('favorites');
  const [downloadProgress, setDownloadProgress] = useState<{ percent: number; status: string } | null>(
    null
  );

  // If a playlist is actively selected, show playlist detail view
  if (selectedPlaylist) {
    const playlistSongs = selectedPlaylist.songIds
      .map((id) => catalog.find((s) => s.id === id))
      .filter((s): s is Song => Boolean(s));

    const totalSeconds = playlistSongs.reduce((acc, s) => acc + s.duration, 0);

    const handleDownloadZip = async () => {
      setDownloadProgress({ percent: 5, status: 'Iniciando descarga...' });
      await downloadFullPlaylistZip(selectedPlaylist, (percent, status) => {
        setDownloadProgress({ percent, status });
      });
      setTimeout(() => setDownloadProgress(null), 3000);
    };

    const handleCacheAllOffline = async () => {
      for (const song of playlistSongs) {
        if (!isDownloaded(song.id)) {
          await toggleDownloadSong(song);
        }
      }
    };

    return (
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto pb-32">
        <button
          onClick={() => setSelectedPlaylist(null)}
          className="flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Tu Biblioteca</span>
        </button>

        {/* Playlist Hero Banner */}
        <div className="flex flex-col md:flex-row items-start md:items-end gap-6 bg-gradient-to-b from-neutral-800/80 to-neutral-900/40 p-6 md:p-8 rounded-3xl border border-neutral-800 shadow-xl">
          <div className="w-44 h-44 md:w-56 md:h-56 rounded-2xl overflow-hidden bg-neutral-800 shadow-2xl flex-shrink-0">
            {selectedPlaylist.coverUrl ? (
              <img
                src={selectedPlaylist.coverUrl}
                alt={selectedPlaylist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-600">
                <Music className="w-16 h-16" />
              </div>
            )}
          </div>

          <div className="flex-1">
            <span className="text-xs uppercase tracking-wider font-extrabold text-emerald-400">
              PLAYLIST PRIVADA
            </span>
            <h1 className="text-3xl md:text-5xl font-black text-white mt-1">
              {selectedPlaylist.name}
            </h1>
            {selectedPlaylist.description && (
              <p className="text-sm text-neutral-400 mt-2">{selectedPlaylist.description}</p>
            )}

            <div className="flex items-center gap-2 text-xs text-neutral-400 mt-4">
              <span>{playlistSongs.length} canciones</span>
              <span>•</span>
              <span>{formatTime(totalSeconds)} de música</span>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center gap-3 mt-6">
              {playlistSongs.length > 0 && (
                <button
                  onClick={() => playSong(playlistSongs[0], playlistSongs)}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  REPRODUCIR TODO
                </button>
              )}

              {/* Download Full Playlist as .ZIP */}
              <button
                onClick={handleDownloadZip}
                className="flex items-center gap-2 px-4 py-3 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs border border-neutral-700 transition-colors"
                title="Descargar todas las canciones empaquetadas en un archivo .ZIP"
              >
                <FolderDown className="w-4 h-4 text-emerald-400" />
                Descargar Playlist (.ZIP)
              </button>

              {/* Save All for offline */}
              <button
                onClick={handleCacheAllOffline}
                className="flex items-center gap-2 px-4 py-3 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs border border-neutral-700 transition-colors"
                title="Guardar todas en el almacenamiento local para escuchar sin internet"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                Guardar Todo Offline
              </button>

              {/* Delete Playlist */}
              <button
                onClick={() => {
                  if (confirm(`¿Eliminar la playlist "${selectedPlaylist.name}"?`)) {
                    deletePlaylist(selectedPlaylist.id);
                    setSelectedPlaylist(null);
                  }
                }}
                className="p-3 rounded-full bg-neutral-800 hover:bg-red-950/60 text-neutral-400 hover:text-red-400 border border-neutral-700 transition-colors ml-auto"
                title="Eliminar playlist"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* ZIP Progress Toast */}
            {downloadProgress && (
              <div className="mt-4 p-3 bg-neutral-900 border border-emerald-500/30 rounded-xl max-w-md">
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
          </div>
        </div>

        {/* Songs in Playlist */}
        <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-3xl overflow-hidden">
          {playlistSongs.length === 0 ? (
            <div className="p-12 text-center text-neutral-500">
              <Music className="w-10 h-10 mx-auto text-neutral-600 mb-2" />
              <p className="font-semibold text-sm">Esta playlist está vacía</p>
              <p className="text-xs text-neutral-500 mt-1">
                Busca canciones en "Explorar la Nube" y añádelas con el botón '+'.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-800/40">
              {playlistSongs.map((song, idx) => {
                const isCurrent = currentSong?.id === song.id;
                const downloaded = isDownloaded(song.id);
                return (
                  <div
                    key={song.id}
                    onClick={() => playSong(song, playlistSongs)}
                    className="flex items-center justify-between p-3.5 hover:bg-neutral-800/50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 truncate">
                      <span className="text-xs font-mono text-neutral-500 w-5 text-right flex-shrink-0 group-hover:hidden">
                        {idx + 1}
                      </span>
                      <button className="w-5 text-emerald-400 flex-shrink-0 hidden group-hover:block">
                        <Play className="w-4 h-4 fill-current" />
                      </button>

                      <img
                        src={song.coverUrl}
                        alt={song.title}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0 shadow"
                      />

                      <div className="truncate">
                        <span
                          className={`block text-sm font-bold truncate ${
                            isCurrent ? 'text-emerald-400' : 'text-white'
                          }`}
                        >
                          {song.title}
                        </span>
                        <span className="block text-xs text-neutral-400 truncate mt-0.5">
                          {song.artist}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      {downloaded && (
                        <span title="Guardado sin conexión">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        </span>
                      )}

                      <span className="text-xs font-mono text-neutral-400">
                        {formatTime(song.duration)}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSongFromPlaylist(selectedPlaylist.id, song.id);
                        }}
                        className="p-1.5 text-neutral-500 hover:text-red-400 rounded-lg transition-colors"
                        title="Quitar de esta playlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main Library View (Tabs: Favorites or Playlists)
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto pb-32">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">Tu Biblioteca</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Tu colección personal de playlists y canciones favoritas guardadas de la nube.
          </p>
        </div>

        <button
          onClick={onOpenCreatePlaylist}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs tracking-wide shadow-lg shadow-emerald-500/20 transition-transform active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Nueva Playlist
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-800 pb-3">
        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'favorites'
              ? 'bg-neutral-800 text-emerald-400 shadow'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Heart className="w-4 h-4 fill-current" />
          <span>Canciones Favoritas ({userFavoriteSongs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('playlists')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'playlists'
              ? 'bg-neutral-800 text-emerald-400 shadow'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Music className="w-4 h-4" />
          <span>Mis Playlists ({playlists.length})</span>
        </button>
      </div>

      {activeTab === 'favorites' ? (
        <div>
          {userFavoriteSongs.length === 0 ? (
            <div className="p-12 text-center text-neutral-500 bg-neutral-900/30 border border-neutral-800/60 rounded-3xl">
              <Heart className="w-12 h-12 mx-auto text-neutral-600 mb-2" />
              <p className="font-bold text-base text-neutral-300">Sin canciones favoritas aún</p>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                Las canciones que agregues desde "Buscar en la Nube" aparecerán aquí aisladas en tu perfil.
              </p>
            </div>
          ) : (
            <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-3xl overflow-hidden divide-y divide-neutral-800/40">
              {userFavoriteSongs.map((song, idx) => {
                const isCurrent = currentSong?.id === song.id;
                const downloaded = isDownloaded(song.id);
                return (
                  <div
                    key={song.id}
                    onClick={() => playSong(song, userFavoriteSongs)}
                    className="flex items-center justify-between p-3.5 hover:bg-neutral-800/50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 truncate">
                      <span className="text-xs font-mono text-neutral-500 w-5 text-right flex-shrink-0 group-hover:hidden">
                        {idx + 1}
                      </span>
                      <button className="w-5 text-emerald-400 flex-shrink-0 hidden group-hover:block">
                        <Play className="w-4 h-4 fill-current" />
                      </button>

                      <img
                        src={song.coverUrl}
                        alt={song.title}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0 shadow"
                      />

                      <div className="truncate">
                        <span
                          className={`block text-sm font-bold truncate ${
                            isCurrent ? 'text-emerald-400' : 'text-white'
                          }`}
                        >
                          {song.title}
                        </span>
                        <span className="block text-xs text-neutral-400 truncate mt-0.5">
                          {song.artist}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(song.id);
                        }}
                        className="p-1.5 text-emerald-400 hover:text-white transition-colors"
                      >
                        <Heart className="w-4 h-4 fill-emerald-400" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAddToPlaylist(song);
                        }}
                        className="p-1.5 text-neutral-500 hover:text-white transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDownloadSong(song);
                        }}
                        className={`p-1.5 transition-colors ${
                          downloaded ? 'text-emerald-400' : 'text-neutral-500 hover:text-white'
                        }`}
                      >
                        {downloaded ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>

                      <span className="text-xs font-mono text-neutral-400">
                        {formatTime(song.duration)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              onClick={() => setSelectedPlaylist(pl)}
              className="bg-neutral-900/50 hover:bg-neutral-800/60 p-4 rounded-2xl border border-neutral-800/60 cursor-pointer group transition-all"
            >
              <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-3 shadow-md relative">
                {pl.coverUrl ? (
                  <img
                    src={pl.coverUrl}
                    alt={pl.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-600">
                    <Music className="w-12 h-12" />
                  </div>
                )}
              </div>

              <h3 className="font-bold text-sm text-white truncate">{pl.name}</h3>
              <p className="text-xs text-neutral-500 truncate mt-0.5">
                {pl.songIds.length} canciones
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
