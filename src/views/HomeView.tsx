import React, { useMemo } from 'react';
import {
  Play,
  Heart,
  Plus,
  Sparkles,
  Music,
  Clock,
  Compass,
  Radio,
  Disc,
  Flame,
  Shuffle
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

  // AI-Driven Recommendations based on user favorites & catalog genres
  const { aiRecommendations, genreMixes, topGenreName } = useMemo(() => {
    if (!catalog || catalog.length === 0) {
      return { aiRecommendations: [], genreMixes: [], topGenreName: 'Música' };
    }

    // Calculate genre affinities from user favorites
    const genreScore: Record<string, number> = {};
    (userFavoriteSongs || []).forEach((s) => {
      const g = s?.genre || 'General';
      genreScore[g] = (genreScore[g] || 0) + 2;
    });

    // Also factor catalog genres
    (catalog || []).forEach((s) => {
      const g = s?.genre || 'General';
      genreScore[g] = (genreScore[g] || 0) + 0.5;
    });

    const sortedGenres = Object.keys(genreScore).sort(
      (a, b) => genreScore[b] - genreScore[a]
    );

    const primaryGenre = sortedGenres[0] || 'General';

    // AI recommended tracks (blended selection prioritizing favored genres)
    const scoredSongs = [...catalog].sort((a, b) => {
      const idA = String(a?.id || '');
      const idB = String(b?.id || '');
      const scoreA = (genreScore[a?.genre || 'General'] || 1) + Math.sin(idA.length);
      const scoreB = (genreScore[b?.genre || 'General'] || 1) + Math.cos(idB.length);
      return scoreB - scoreA;
    });

    const recommendations = scoredSongs.slice(0, 10);

    // Group top genres for dedicated "Mix IA" cards
    const mixes: { genre: string; songs: Song[] }[] = [];
    sortedGenres.slice(0, 3).forEach((g) => {
      const gSongs = catalog.filter((s) => (s?.genre || 'General') === g);
      if (gSongs.length > 0) {
        mixes.push({ genre: g, songs: gSongs.slice(0, 6) });
      }
    });

    return {
      aiRecommendations: recommendations,
      genreMixes: mixes,
      topGenreName: primaryGenre,
    };
  }, [catalog, userFavoriteSongs]);

  const recentSongs = catalog.slice(0, 6);

  return (
    <div className="p-6 md:p-8 space-y-9 max-w-7xl mx-auto pb-32">
      {/* AI Smart Mix Spotlight Header (NO welcome text or banners) */}
      <div className="bg-gradient-to-r from-emerald-950/70 via-neutral-900 to-black p-6 rounded-3xl border border-emerald-500/20 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Recomendación Inteligente IA</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Mix IA personalizado · {topGenreName}
          </h1>
          <p className="text-neutral-400 text-xs md:text-sm">
            Generado automáticamente con base en tus géneros favoritos y el repositorio en la nube.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {aiRecommendations.length > 0 && (
            <button
              onClick={() => playSong(aiRecommendations[0], aiRecommendations)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs tracking-wide shadow-lg shadow-emerald-500/25 transition-transform active:scale-95"
            >
              <Play className="w-4 h-4 fill-black" />
              Reproducir Mix IA
            </button>
          )}
          <button
            onClick={() => onNavigate('cloud')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-semibold text-xs border border-neutral-800 transition-colors"
          >
            <Compass className="w-4 h-4 text-emerald-400" />
            Explorar Repositorio
          </button>
        </div>
      </div>

      {/* Quick Picks Grid (6 items) */}
      <div>
        <h2 className="text-lg md:text-xl font-bold text-white mb-4 flex items-center gap-2">
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

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playSong(song, recentSongs);
                  }}
                  className="w-9 h-9 rounded-full bg-emerald-500 text-black flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-105 active:scale-95 transition-all shadow-md flex-shrink-0"
                >
                  {isCurrent && isPlaying ? (
                    <span className="w-2.5 h-2.5 bg-black rounded-sm" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Genre Mixes */}
      {genreMixes.map((mix) => (
        <div key={mix.genre} className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white capitalize">
                {mix.genre}
              </h2>
            </div>
            <button
              onClick={() => onNavigate('cloud')}
              className="text-xs font-bold text-neutral-400 hover:text-emerald-400 transition-colors"
            >
              Ver más canciones
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {mix.songs.map((song) => {
              const isCurrent = currentSong?.id === song.id;
              return (
                <div
                  key={song.id}
                  onClick={() => playSong(song, mix.songs)}
                  className="bg-neutral-900/40 hover:bg-neutral-800/60 p-3.5 rounded-2xl border border-neutral-800/60 cursor-pointer group transition-all"
                >
                  <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-3 shadow-md relative">
                    <img
                      src={song.coverUrl}
                      alt={song.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-lg">
                        {isCurrent && isPlaying ? (
                          <span className="w-3 h-3 bg-black rounded-sm" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {song.isExplicit && (
                      <span
                        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-neutral-600/80 text-black text-[9px] font-black flex-shrink-0 select-none leading-none"
                        title="Contenido explícito"
                      >
                        E
                      </span>
                    )}
                    <h3
                      className={`font-bold text-xs truncate ${
                        isCurrent ? 'text-emerald-400' : 'text-white'
                      }`}
                    >
                      {song.title}
                    </h3>
                  </div>
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                    {song.artist}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ))}

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
              Explorar Repositorio
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {userFavoriteSongs.slice(0, 8).map((song) => {
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
