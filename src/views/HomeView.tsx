import React, { useMemo } from 'react';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Heart from 'lucide-react/dist/esm/icons/heart.mjs';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import Music from 'lucide-react/dist/esm/icons/eighth-notes.mjs';
import Clock from 'lucide-react/dist/esm/icons/clock.mjs';
import Compass from 'lucide-react/dist/esm/icons/compass.mjs';
import Radio from 'lucide-react/dist/esm/icons/radio.mjs';
import Disc from 'lucide-react/dist/esm/icons/disc.mjs';
import Flame from 'lucide-react/dist/esm/icons/flame.mjs';
import Shuffle from 'lucide-react/dist/esm/icons/shuffle.mjs';
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.mjs';
import Music2 from 'lucide-react/dist/esm/icons/eighth-note.mjs';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { Song, Playlist } from '../types';
import { ArtistLinks } from '../components/ArtistLinks';

interface HomeViewProps {
  onNavigate: (tab: string) => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onOpenAddToPlaylist: (song: Song) => void;
  onSelectArtist?: (artistName: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigate,
  onSelectPlaylist,
  onOpenAddToPlaylist,
  onSelectArtist,
}) => {
  const { currentUser } = useAuth();
  const {
    catalog,
    librarySongs,
    isCatalogReady,
    userFavoriteSongs,
    playlists,
    isFavorite,
    toggleFavorite,
    userPlayCounts,
  } = useMusic();
  const { playSong, currentSong, isPlaying } = useAudio();

  // Recommendations based on genre affinity, personal plays and recency.
  const { aiRecommendations, genreMixes, topGenreName } = useMemo(() => {
    if (!librarySongs || librarySongs.length === 0) {
      return { aiRecommendations: [], genreMixes: [], topGenreName: 'Música' };
    }

    const genreScore: Record<string, number> = {};
    (userFavoriteSongs || []).forEach((song) => {
      const genre = song?.genre || 'General';
      genreScore[genre] = (genreScore[genre] || 0) + 2;
    });

    (librarySongs || []).forEach((song) => {
      const genre = song?.genre || 'General';
      genreScore[genre] = (genreScore[genre] || 0) + 0.5;
    });

    const sortedGenres = Object.keys(genreScore).sort(
      (a, b) => genreScore[b] - genreScore[a]
    );

    const primaryGenre = sortedGenres[0] || 'General';
    const favoriteIds = new Set((userFavoriteSongs || []).map((song) => song.id));
    const playCounts = userPlayCounts || {};

    const recommendations = [...librarySongs]
      .map((song) => {
        const genreAffinity = genreScore[song.genre || 'General'] || 0;
        const favoriteBoost = favoriteIds.has(song.id) ? 2 : 0;
        const plays = Math.min(playCounts[song.id] || 0, 20);
        const createdAt = Date.parse(song.createdAt || '') || 0;

        return {
          song,
          score: genreAffinity + favoriteBoost + plays * 0.35 + createdAt / 1e14,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((entry) => entry.song);

    const mixes: { genre: string; songs: Song[] }[] = [];
    sortedGenres.slice(0, 3).forEach((genre) => {
      const genreSongs = librarySongs.filter((song) => (song.genre || 'General') === genre);
      if (genreSongs.length > 0) {
        mixes.push({ genre, songs: genreSongs.slice(0, 6) });
      }
    });

    return {
      aiRecommendations: recommendations,
      genreMixes: mixes,
      topGenreName: primaryGenre,
    };
  }, [librarySongs, userFavoriteSongs, userPlayCounts]);

  const recentSongs = useMemo(
    () =>
      [...librarySongs]
        .sort(
          (a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0)
        )
        .slice(0, 6),
    [librarySongs]
  );

  // A new device used to show an empty page while Firestore was loading.
  if (!isCatalogReady && catalog.length === 0) {
    return (
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto pb-32 animate-pulse">
        <div className="h-36 rounded-3xl bg-neutral-900/80 border border-neutral-800" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-16 rounded-xl bg-neutral-900/70 border border-neutral-800/60"
            />
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 text-xs font-bold text-neutral-500 pt-6">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Sincronizando tu música desde la nube...</span>
        </div>
      </div>
    );
  }

  if (librarySongs.length === 0) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto pb-32">
        <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-3xl p-10 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <Music2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Tu biblioteca está vacía</h1>
            <p className="text-sm text-neutral-400 mt-2 max-w-md mx-auto">
              Busca en el repositorio y guarda canciones con el corazón o añádelas a una
              playlist. Así aparecerán aquí sin llenar tu biblioteca con todo el catálogo.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => onNavigate('cloud')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-lg transition-transform active:scale-95"
            >
              <Compass className="w-4 h-4" />
              Buscar música
            </button>
            <button
              onClick={() => onNavigate('add-music')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs transition-colors"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              Añadir al repositorio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-7 md:space-y-9 max-w-7xl mx-auto pb-32">
      <div className="bg-gradient-to-r from-emerald-950/70 via-neutral-900 to-black p-5 md:p-6 rounded-3xl border border-emerald-500/20 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>Hecho para ti</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Tu mix · {topGenreName}
          </h1>
          <p className="text-neutral-400 text-xs md:text-sm">
            Basado en tu biblioteca, tus favoritos y lo que más escuchas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 md:gap-3">
          {aiRecommendations.length > 0 && (
            <button
              onClick={() =>
                playSong(aiRecommendations[0], aiRecommendations, {
                  type: 'playlist',
                  name: 'Recomendaciones',
                })
              }
              className="inline-flex items-center justify-center gap-2 px-4 md:px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs tracking-wide whitespace-nowrap shadow-lg shadow-emerald-500/25 transition-transform active:scale-95"
            >
              <Play className="w-4 h-4 fill-black" />
              Reproducir mix
            </button>
          )}
          <button
            onClick={() => onNavigate('cloud')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-semibold text-xs whitespace-nowrap border border-neutral-800 transition-colors"
          >
            <Compass className="w-4 h-4 text-emerald-400" />
            Buscar música
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
                onClick={() =>
                  playSong(song, recentSongs, {
                    type: song.album && song.album.toLowerCase() !== 'sencillo' ? 'album' : 'playlist',
                    name: song.album && song.album.toLowerCase() !== 'sencillo' ? song.album : 'Acceso Rápido',
                  })
                }
                className="flex items-center gap-4 bg-neutral-900/60 hover:bg-neutral-800/80 border border-neutral-800/60 rounded-xl overflow-hidden cursor-pointer group transition-all duration-200 pr-4 shadow-sm"
              >
                <div className="w-16 h-16 bg-neutral-800 flex-shrink-0 relative overflow-hidden">
                  <img
                    src={song.coverUrl}
                    alt={song.title} loading="lazy" decoding="async"
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
                        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-neutral-600/80 text-white text-[9px] font-black flex-shrink-0 select-none leading-none"
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
                    <ArtistLinks artists={song.artist} onSelectArtist={onSelectArtist} />
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playSong(song, recentSongs);
                  }}
                  className="w-9 h-9 rounded-full bg-emerald-500 text-black flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-105 active:scale-95 transition-all shadow-md flex-shrink-0"
                  title={`Reproducir ${song.title}`}
                  aria-label={`Reproducir ${song.title}`}
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
                  onClick={() => playSong(song, mix.songs, { type: 'playlist', name: mix.genre })}
                  className="bg-neutral-900/40 hover:bg-neutral-800/60 p-3.5 rounded-2xl border border-neutral-800/60 cursor-pointer group transition-all"
                >
                  <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-3 shadow-md relative">
                    <img
                      src={song.coverUrl}
                      alt={song.title} loading="lazy" decoding="async"
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
                        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-neutral-600/80 text-white text-[9px] font-black flex-shrink-0 select-none leading-none"
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
                    <ArtistLinks artists={song.artist} onSelectArtist={onSelectArtist} />
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
                  onClick={() =>
                    playSong(song, userFavoriteSongs, {
                      type: 'favorites',
                      name: 'Tus me gusta',
                      id: 'favorites',
                    })
                  }
                  className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/40 hover:bg-neutral-800/60 border border-neutral-800/40 group cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3 truncate">
                    <img
                      src={song.coverUrl}
                      alt={song.title} loading="lazy" decoding="async"
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
                        <ArtistLinks artists={song.artist} onSelectArtist={onSelectArtist} />
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
