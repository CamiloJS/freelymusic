import React from 'react';
import {
  Play,
  Heart,
  Plus,
  Compass,
  HardDriveDownload,
  Sparkles,
  Music,
  Flame,
  Clock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { Song, Playlist } from '../types';

interface HomeViewProps {
  onNavigate: (tab: string) => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onOpenAddToPlaylist: (song: Song) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigate,
  onSelectPlaylist,
  onOpenAddToPlaylist,
}) => {
  const { currentUser } = useAuth();
  const { catalog, userFavoriteSongs, playlists, isFavorite, toggleFavorite } = useMusic();
  const { playSong, currentSong, isPlaying } = useAudio();

  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const recentSongs = catalog.slice(0, 6);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto pb-32">
      {/* Hero Welcome Banner */}
      <div className="relative rounded-3xl overflow-hidden p-8 md:p-10 bg-gradient-to-r from-emerald-950 via-neutral-900 to-black border border-emerald-500/20 shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Sonora Cloud Studio</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            {getGreeting()}, {currentUser.displayName}
          </h1>
          <p className="mt-3 text-neutral-300 text-sm md:text-base leading-relaxed">
            Tu nube privada de música por streaming. Las canciones subidas por enlace se almacenan en tu catálogo global y puedes agregarlas a tus favoritos o descargarlas para escuchar sin conexión.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('cloud')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs tracking-wide shadow-lg shadow-emerald-500/25 transition-transform active:scale-95"
            >
              <Compass className="w-4 h-4" />
              Explorar Catálogo en la Nube
            </button>
            <button
              onClick={() => onNavigate('library')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-white font-semibold text-xs tracking-wide border border-neutral-700 transition-colors"
            >
              <Music className="w-4 h-4 text-emerald-400" />
              Ver Mi Biblioteca
            </button>
          </div>
        </div>

        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full filter blur-3xl pointer-events-none" />
      </div>

      {/* Quick Picks Grid (6 items like Spotify desktop) */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-emerald-400" />
          <span>Acceso Rápido</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recentSongs.map((song) => {
            const isCurrent = currentSong?.id === song.id;
            return (
              <div
                key={song.id}
                onClick={() => playSong(song, recentSongs)}
                className="flex items-center gap-4 bg-neutral-900/60 hover:bg-neutral-800/80 border border-neutral-800/60 rounded-xl overflow-hidden cursor-pointer group transition-all duration-200 pr-4 shadow-sm"
              >
                <div className="w-16 h-16 bg-neutral-800 flex-shrink-0 relative overflow-hidden">
                  <img
                    src={song.coverUrl}
                    alt={song.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="w-5 h-5 text-emerald-400 fill-emerald-400" />
                  </div>
                </div>

                <div className="flex-1 truncate">
                  <span
                    className={`block font-bold text-sm truncate ${
                      isCurrent ? 'text-emerald-400' : 'text-white'
                    }`}
                  >
                    {song.title}
                  </span>
                  <span className="block text-xs text-neutral-400 truncate mt-0.5">
                    {song.artist}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playSong(song, recentSongs);
                  }}
                  className="w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-105 active:scale-95 transition-all shadow-md flex-shrink-0"
                >
                  {isCurrent && isPlaying ? (
                    <span className="w-3 h-3 bg-black rounded-sm" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tus Playlists */}
      {playlists.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Tus Playlists</h2>
            <button
              onClick={() => onNavigate('library')}
              className="text-xs font-bold text-neutral-400 hover:text-emerald-400 transition-colors"
            >
              Ver todas
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {playlists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => {
                  onSelectPlaylist(pl);
                  onNavigate('library');
                }}
                className="bg-neutral-900/50 hover:bg-neutral-800/60 p-3.5 rounded-2xl border border-neutral-800/60 cursor-pointer group transition-all"
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
        </div>
      )}

      {/* Tus Canciones Favoritas */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Heart className="w-5 h-5 text-emerald-400 fill-emerald-400" />
            <span>Tus Canciones Favoritas</span>
          </h2>
          <button
            onClick={() => onNavigate('library')}
            className="text-xs font-bold text-neutral-400 hover:text-emerald-400 transition-colors"
          >
            Ver biblioteca ({userFavoriteSongs.length})
          </button>
        </div>

        {userFavoriteSongs.length === 0 ? (
          <div className="bg-neutral-900/30 border border-neutral-800/60 rounded-2xl p-8 text-center">
            <p className="text-sm text-neutral-400">
              Aún no has añadido canciones a tus favoritos.
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Ve a "Explorar la Nube" y toca el corazón en las canciones que quieras guardar en tu perfil.
            </p>
            <button
              onClick={() => onNavigate('cloud')}
              className="mt-4 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-emerald-400 font-bold text-xs tracking-wide"
            >
              Explorar Catálogo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {userFavoriteSongs.slice(0, 8).map((song) => {
              const liked = isFavorite(song.id);
              const isCurrent = currentSong?.id === song.id;
              return (
                <div
                  key={song.id}
                  onClick={() => playSong(song, userFavoriteSongs)}
                  className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/40 hover:bg-neutral-800/60 border border-neutral-800/40 group cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3 truncate">
                    <img
                      src={song.coverUrl}
                      alt={song.title}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0 shadow"
                    />
                    <div className="truncate">
                      <span
                        className={`block font-bold text-sm truncate ${
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

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(song.id);
                      }}
                      className="p-1.5 rounded-full text-emerald-400 hover:text-white"
                      title="Quitar de favoritos"
                    >
                      <Heart className="w-4 h-4 fill-emerald-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenAddToPlaylist(song);
                      }}
                      className="p-1.5 rounded-full text-neutral-500 hover:text-white"
                      title="Añadir a playlist"
                    >
                      <Plus className="w-4 h-4" />
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
};
