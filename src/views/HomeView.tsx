import React, { useState, useMemo } from 'react';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Pause from 'lucide-react/dist/esm/icons/pause.mjs';
import Video from 'lucide-react/dist/esm/icons/video.mjs';
import Compass from 'lucide-react/dist/esm/icons/compass.mjs';
import Music from 'lucide-react/dist/esm/icons/eighth-notes.mjs';
import Podcast from 'lucide-react/dist/esm/icons/podcast.mjs';
import BookOpen from 'lucide-react/dist/esm/icons/book-open.mjs';
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.mjs';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { Song, Playlist } from '../types';
import { ArtistLinks } from '../components/ArtistLinks';
import { formatTime } from '../utils/lyrics';

interface HomeViewProps {
  onNavigate: (tab: string) => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onOpenAddToPlaylist: (song: Song) => void;
  onSelectArtist?: (artistName: string) => void;
  onOpenProfileSwitcher?: () => void;
}

const FILTER_CHIPS = ['Todas', 'Música', 'Podcasts', 'Audiolibros'] as const;
type FilterChip = (typeof FILTER_CHIPS)[number];

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigate,
  onSelectPlaylist,
  onSelectArtist,
  onOpenProfileSwitcher,
}) => {
  const { currentUser } = useAuth();
  const {
    catalog,
    librarySongs,
    isCatalogReady,
    userFavoriteSongs,
    playlists,
    userPlayCounts,
  } = useMusic();
  const { playSong, currentSong, isPlaying, openVideo } = useAudio();

  const [activeFilter, setActiveFilter] = useState<FilterChip>('Todas');

  // Dynamic greeting based on current local hour
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'Buenos días';
    if (hour >= 12 && hour < 20) return 'Buenas tardes';
    return 'Buenas noches';
  }, []);

  // Quick picks: 8 items for the 2-column grid (Spotify Mobile Style)
  const quickPicks = useMemo(() => {
    const picks: {
      id: string;
      title: string;
      coverUrl: string;
      song?: Song;
      playlist?: Playlist;
      isFavorites?: boolean;
    }[] = [];

    // 1. Favorites card if has favorite songs
    if (userFavoriteSongs.length > 0) {
      picks.push({
        id: 'favorites',
        title: 'Tus me gusta',
        coverUrl: userFavoriteSongs[0].coverUrl,
        isFavorites: true,
      });
    }

    // 2. Playlists
    playlists.slice(0, 3).forEach((pl) => {
      const plSong = catalog.find((s) => pl.songIds.includes(s.id));
      picks.push({
        id: `pl-${pl.id}`,
        title: pl.name,
        coverUrl: pl.coverUrl || plSong?.coverUrl || '',
        playlist: pl,
      });
    });

    // 3. Recent / top played songs
    const recent = [...librarySongs]
      .sort((a, b) => (userPlayCounts[b.id] || 0) - (userPlayCounts[a.id] || 0))
      .slice(0, 8);

    recent.forEach((song) => {
      if (picks.length < 8 && !picks.some((p) => p.song?.id === song.id)) {
        picks.push({
          id: `song-${song.id}`,
          title: song.title,
          coverUrl: song.coverUrl,
          song,
        });
      }
    });

    return picks.slice(0, 8);
  }, [userFavoriteSongs, playlists, librarySongs, catalog, userPlayCounts]);

  // Recommendations and Genre Mixes
  const { aiRecommendations, genreMixes } = useMemo(() => {
    if (!librarySongs || librarySongs.length === 0) {
      return { aiRecommendations: [], genreMixes: [] };
    }

    const genreScore: Record<string, number> = {};
    (userFavoriteSongs || []).forEach((song) => {
      const genre = song?.genre || 'Pop';
      genreScore[genre] = (genreScore[genre] || 0) + 2;
    });

    (librarySongs || []).forEach((song) => {
      const genre = song?.genre || 'Pop';
      genreScore[genre] = (genreScore[genre] || 0) + 0.5;
    });

    const sortedGenres = Object.keys(genreScore).sort(
      (a, b) => genreScore[b] - genreScore[a]
    );

    const mixes: { genre: string; songs: Song[] }[] = [];
    sortedGenres.slice(0, 4).forEach((genre) => {
      const genreSongs = librarySongs.filter((song) => (song.genre || 'Pop') === genre);
      if (genreSongs.length > 0) {
        mixes.push({ genre, songs: genreSongs.slice(0, 6) });
      }
    });

    return {
      aiRecommendations: librarySongs.slice(0, 8),
      genreMixes: mixes,
    };
  }, [librarySongs, userFavoriteSongs]);

  // Video / Canvas clips
  const videoSongs = useMemo(() => {
    return catalog.filter((s) => Boolean(s.videoUrl));
  }, [catalog]);

  if (!isCatalogReady && catalog.length === 0) {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto pb-32 animate-pulse">
        <div className="h-10 w-48 rounded-full bg-[#242424]" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 rounded-md bg-[#242424]" />
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 text-xs font-bold text-neutral-400 pt-6">
          <Loader2 className="w-4 h-4 animate-spin text-[#1DB954]" />
          <span>Cargando catálogo musical...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="home-view-container min-h-full bg-[#121212] text-white select-none pb-36">
      {/* =========================================================================
          A. STICKY TOP HEADER & FILTER CHIPS (Exact Spotify Mobile Style)
          ========================================================================= */}
      <div className="home-sticky-header sticky top-0 z-30 bg-[#121212]/95 backdrop-blur-xl pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-3 px-4 sm:px-6 border-b border-transparent">
        <div className="flex items-center gap-3">
          {/* User profile avatar on left (tappable to open settings/switcher) */}
          <button
            type="button"
            onClick={onOpenProfileSwitcher}
            className="w-8 h-8 rounded-full overflow-hidden bg-neutral-800 ring-2 ring-transparent active:scale-90 transition-transform flex-shrink-0"
            title="Tu perfil y preferencias"
            aria-label="Tu perfil y preferencias"
          >
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.displayName || 'Usuario'}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-700 text-black text-xs font-black">
                {(currentUser?.displayName || 'U').charAt(0).toUpperCase()}
              </span>
            )}
          </button>

          {/* Filter Chips Carousel */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none snap-x py-0.5">
            {FILTER_CHIPS.map((chip) => {
              const isActive = activeFilter === chip;
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setActiveFilter(chip)}
                  className={`home-filter-chip px-3.5 py-1.5 rounded-full text-xs transition-all whitespace-nowrap snap-start ${
                    isActive
                      ? 'home-filter-chip-active bg-[#1DB954] text-black font-extrabold shadow-md'
                      : 'home-filter-chip-inactive bg-[#242424] text-white hover:bg-[#2a2a2a] active:bg-[#333333] font-medium'
                  }`}
                >
                  {chip}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 pt-3 space-y-7 max-w-7xl mx-auto">
        {/* If Podcast / Audiolibros filter is active */}
        {activeFilter === 'Podcasts' || activeFilter === 'Audiolibros' ? (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#242424] border border-[#282828] flex items-center justify-center mx-auto text-[#1DB954]">
              {activeFilter === 'Podcasts' ? (
                <Podcast className="w-8 h-8" />
              ) : (
                <BookOpen className="w-8 h-8" />
              )}
            </div>
            <h2 className="text-xl font-bold text-white">Explora {activeFilter}</h2>
            <p className="text-xs text-[#B3B3B3] max-w-sm mx-auto">
              Pronto podrás disfrutar de miles de episodios y audiolibros sincronizados en tu biblioteca.
            </p>
            <button
              onClick={() => setActiveFilter('Todas')}
              className="px-5 py-2 rounded-full bg-[#1DB954] text-black text-xs font-bold active:scale-95 transition-transform"
            >
              Volver a la música
            </button>
          </div>
        ) : (
          <>
            {/* =========================================================================
                B1. GREETING & 2-COLUMN QUICK PICKS GRID (Spotify Mobile Style)
                ========================================================================= */}
            <div>
              <h1 className="home-greeting text-xl sm:text-2xl font-black text-white tracking-tight mb-3">
                {greeting}
              </h1>

              <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                {quickPicks.map((pick) => {
                  const isCurrent =
                    pick.song && currentSong?.id === pick.song.id && isPlaying;

                  return (
                    <div
                      key={pick.id}
                      onClick={() => {
                        if (pick.isFavorites && userFavoriteSongs.length > 0) {
                          playSong(userFavoriteSongs[0], userFavoriteSongs, {
                            type: 'favorites',
                            name: 'Tus me gusta',
                            id: 'favorites',
                          });
                        } else if (pick.playlist) {
                          onSelectPlaylist(pick.playlist);
                        } else if (pick.song) {
                          playSong(pick.song, librarySongs, {
                            type: 'playlist',
                            name: 'Acceso Rápido',
                          });
                        }
                      }}
                      className="home-quick-pick flex items-center bg-[#242424]/90 hover:bg-[#282828] active:bg-[#2e2e2e] rounded-md overflow-hidden cursor-pointer group transition-colors shadow-sm relative"
                    >
                      {/* Square image on left */}
                      <div className="home-quick-pick-thumb w-13 h-13 sm:w-14 sm:h-14 bg-neutral-800 flex-shrink-0 relative overflow-hidden">
                        {pick.isFavorites ? (
                          <div className="w-full h-full bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-600 flex items-center justify-center">
                            <span className="text-white text-base">♥</span>
                          </div>
                        ) : pick.coverUrl ? (
                          <img
                            src={pick.coverUrl}
                            alt={pick.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-neutral-800 text-neutral-500">
                            <Music className="w-5 h-5" />
                          </div>
                        )}
                      </div>

                      {/* Title on right */}
                      <div className="flex-1 min-w-0 px-2.5 py-1 flex items-center justify-between gap-1">
                        <span
                          className={`home-quick-pick-title text-xs font-bold leading-tight line-clamp-2 ${
                            isCurrent ? 'text-[#1DB954]' : 'text-white'
                          }`}
                        >
                          {pick.title}
                        </span>

                        {/* Animated Equalizer Wave when playing */}
                        {isCurrent && (
                          <div className="flex items-end gap-0.5 h-3.5 flex-shrink-0">
                            <span className="w-0.5 bg-[#1DB954] rounded-full animate-eq-1" />
                            <span className="w-0.5 bg-[#1DB954] rounded-full animate-eq-2" />
                            <span className="w-0.5 bg-[#1DB954] rounded-full animate-eq-3" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* =========================================================================
                B2. HORIZONTAL CAROUSEL: "Tus mixes más escuchados"
                ========================================================================= */}
            {genreMixes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    Tus mixes más escuchados
                  </h2>
                </div>

                <div className="flex gap-3.5 sm:gap-4 overflow-x-auto scrollbar-none snap-x pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6">
                  {genreMixes.map((mix) => {
                    const firstSong = mix.songs[0];
                    return (
                      <div
                        key={mix.genre}
                        onClick={() =>
                          playSong(firstSong, mix.songs, {
                            type: 'playlist',
                            name: `Mix ${mix.genre}`,
                          })
                        }
                        className="w-36 sm:w-40 flex-shrink-0 snap-start bg-[#181818] p-2.5 rounded-lg hover:bg-[#242424] active:bg-[#282828] transition-all cursor-pointer group"
                      >
                        <div className="aspect-square rounded-md overflow-hidden bg-neutral-800 mb-2.5 relative shadow-md">
                          <img
                            src={firstSong.coverUrl}
                            alt={mix.genre}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-[#1DB954] text-black flex items-center justify-center shadow-xl">
                              <Play className="w-4 h-4 fill-current ml-0.5" />
                            </div>
                          </div>
                        </div>

                        <h3 className="font-bold text-xs text-white truncate">
                          Mix {mix.genre}
                        </h3>
                        <p className="text-[11px] text-[#B3B3B3] line-clamp-2 mt-0.5">
                          {mix.songs.map((s) => s.artist).slice(0, 3).join(', ')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* =========================================================================
                B3. HORIZONTAL CAROUSEL: "Hecho para ti / Estaciones recomendadas"
                ========================================================================= */}
            {aiRecommendations.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    Hecho para ti
                  </h2>
                </div>

                <div className="flex gap-3.5 sm:gap-4 overflow-x-auto scrollbar-none snap-x pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6">
                  {aiRecommendations.map((song) => {
                    const isCurrent = currentSong?.id === song.id && isPlaying;
                    return (
                      <div
                        key={song.id}
                        onClick={() =>
                          playSong(song, aiRecommendations, {
                            type: 'playlist',
                            name: 'Hecho para ti',
                          })
                        }
                        className="w-36 sm:w-40 flex-shrink-0 snap-start bg-[#181818] p-2.5 rounded-lg hover:bg-[#242424] active:bg-[#282828] transition-all cursor-pointer group"
                      >
                        <div className="aspect-square rounded-md overflow-hidden bg-neutral-800 mb-2.5 relative shadow-md">
                          <img
                            src={song.coverUrl}
                            alt={song.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-[#1DB954] text-black flex items-center justify-center shadow-xl">
                              {isCurrent ? (
                                <Pause className="w-4 h-4 fill-current" />
                              ) : (
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                              )}
                            </div>
                          </div>
                        </div>

                        <h3
                          className={`font-bold text-xs truncate ${
                            isCurrent ? 'text-[#1DB954]' : 'text-white'
                          }`}
                        >
                          {song.title}
                        </h3>
                        <p className="text-[11px] text-[#B3B3B3] truncate mt-0.5">
                          {song.artist}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* =========================================================================
                B4. HORIZONTAL CAROUSEL: "Videoclips y Canvas Dinámico" (16:9 Cards)
                ========================================================================= */}
            {videoSongs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Video className="w-5 h-5 text-[#1DB954]" />
                    <span>Videoclips y Canvas</span>
                  </h2>
                </div>

                <div className="flex gap-4 overflow-x-auto scrollbar-none snap-x pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6">
                  {videoSongs.map((song) => (
                    <div
                      key={song.id}
                      onClick={() => {
                        playSong(song, videoSongs, {
                          type: 'playlist',
                          name: 'Videoclips',
                        });
                        openVideo();
                      }}
                      className="w-60 sm:w-64 flex-shrink-0 snap-start bg-[#181818] p-2.5 rounded-xl hover:bg-[#242424] active:bg-[#282828] transition-all cursor-pointer group border border-white/5 shadow-md"
                    >
                      {/* 16:9 Aspect Video Container */}
                      <div className="aspect-video w-full rounded-lg overflow-hidden bg-black relative shadow mb-2">
                        <img
                          src={song.coverUrl}
                          alt={song.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-black/70 backdrop-blur-md border border-white/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-xl">
                            <Play className="w-4 h-4 fill-white ml-0.5" />
                          </div>
                        </div>

                        {/* Duration badge at bottom right */}
                        {song.duration > 0 && (
                          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[10px] font-bold text-white font-mono">
                            {formatTime(song.duration)}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-[#1DB954] text-[9px] font-extrabold uppercase tracking-wide">
                          Video
                        </span>
                        <h3 className="font-bold text-xs text-white truncate flex-1">
                          {song.title}
                        </h3>
                      </div>
                      <p className="text-[11px] text-[#B3B3B3] truncate mt-0.5">
                        {song.artist}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
