import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Play,
  Heart,
  Plus,
  Download,
  CheckCircle2,
  Cloud,
  Music,
  Disc,
  Clock,
  X,
  Mic2,
  Trash2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { Song } from '../types';
import { formatTime } from '../utils/lyrics';
import {
  getRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
  clearRecentSearches
} from '../services/storage';

interface CloudSearchViewProps {
  onOpenAddToPlaylist: (song: Song) => void;
  onOpenAddMusic?: () => void;
}

interface AutocompleteItem {
  type: 'song' | 'artist' | 'album' | 'lyric';
  text: string;
  subText?: string;
  song?: Song;
}

function findMatchingLyricSnippet(song: Song, query: string): string | null {
  if (!query || query.length < 2) return null;
  const q = query.toLowerCase();
  const text = song.lyricsLrc || song.plainLyrics || '';
  if (!text) return null;

  const lines = text.split('\n');
  for (const rawLine of lines) {
    const clean = rawLine.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();
    if (clean.toLowerCase().includes(q)) {
      return clean;
    }
  }
  return null;
}

export const CloudSearchView: React.FC<CloudSearchViewProps> = ({
  onOpenAddToPlaylist,
  onOpenAddMusic,
}) => {
  const {
    catalog,
    isFavorite,
    toggleFavorite,
    isDownloaded,
    toggleDownloadSong,
    downloadSingleSongFile,
  } = useMusic();
  const { playSong, currentSong } = useAudio();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches());

  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Close autocomplete on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Genres from catalog
  const genres = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((s) => {
      if (s.genre) set.add(s.genre);
    });
    return ['all', ...Array.from(set)];
  }, [catalog]);

  // Autocomplete suggestions based on query
  const autocompleteSuggestions = useMemo((): AutocompleteItem[] => {
    const q = searchQuery.toLowerCase().trim();
    if (!q || q.length < 1) return [];

    const items: AutocompleteItem[] = [];
    const seenArtists = new Set<string>();
    const seenAlbums = new Set<string>();

    for (const song of catalog) {
      // 1. Song Title match
      if (song.title.toLowerCase().includes(q)) {
        items.push({
          type: 'song',
          text: song.title,
          subText: `${song.artist} • Canción`,
          song,
        });
      }

      // 2. Artist match
      if (song.artist.toLowerCase().includes(q) && !seenArtists.has(song.artist)) {
        seenArtists.add(song.artist);
        items.push({
          type: 'artist',
          text: song.artist,
          subText: 'Artista',
        });
      }

      // 3. Album match
      if (song.album && song.album.toLowerCase().includes(q) && !seenAlbums.has(song.album)) {
        seenAlbums.add(song.album);
        items.push({
          type: 'album',
          text: song.album,
          subText: `${song.artist} • Álbum`,
        });
      }

      // 4. Lyrics match
      const lyricSnippet = findMatchingLyricSnippet(song, q);
      if (lyricSnippet) {
        items.push({
          type: 'lyric',
          text: lyricSnippet,
          subText: `Letra de "${song.title}" - ${song.artist}`,
          song,
        });
      }

      if (items.length >= 8) break;
    }

    return items;
  }, [catalog, searchQuery]);

  // Execute a search query and record history
  const handleSelectQuery = (term: string, songToPlay?: Song) => {
    setSearchQuery(term);
    setIsDropdownOpen(false);
    const updated = saveRecentSearch(term);
    setRecentSearches(updated);

    if (songToPlay) {
      playSong(songToPlay, [songToPlay]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const term = searchQuery.trim();
      if (term) {
        const updated = saveRecentSearch(term);
        setRecentSearches(updated);
        setIsDropdownOpen(false);
      }
    }
  };

  const handleRemoveRecent = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    const updated = removeRecentSearch(term);
    setRecentSearches(updated);
  };

  const handleClearAllRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  // Filtered songs (ONLY when searchQuery is NOT empty)
  const filteredSongs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return []; // Explicit user requirement: hide catalog until searched!

    return catalog.filter((song) => {
      const matchGenre = selectedGenre === 'all' || song.genre === selectedGenre;
      if (!matchGenre) return false;

      const titleMatch = song.title.toLowerCase().includes(q);
      const artistMatch = song.artist.toLowerCase().includes(q);
      const albumMatch = song.album ? song.album.toLowerCase().includes(q) : false;
      const genreMatch = song.genre ? song.genre.toLowerCase().includes(q) : false;
      const lyricsMatch = findMatchingLyricSnippet(song, q) !== null;

      return titleMatch || artistMatch || albumMatch || genreMatch || lyricsMatch;
    });
  }, [catalog, searchQuery, selectedGenre]);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-2">
            <Cloud className="w-4 h-4" />
            <span>Repositorio Privado en la Nube</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">Buscar en la Nube</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Encuentra canciones por título, artista, álbum o frases de la letra sincronizada.
          </p>
        </div>

        {onOpenAddMusic && (
          <button
            onClick={onOpenAddMusic}
            className="self-start md:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir Música por Enlace</span>
          </button>
        )}
      </div>

      {/* Intelligent Search Input with Autocomplete */}
      <div className="relative" ref={searchContainerRef}>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => {
                if (searchQuery.trim().length > 0) {
                  setIsDropdownOpen(true);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Buscar por título, artista, álbum o letra sincronizada..."
              className="w-full bg-neutral-900/90 border border-neutral-800 rounded-2xl pl-12 pr-10 py-3.5 text-sm text-white focus:outline-none focus:border-emerald-500 shadow-inner placeholder-neutral-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setIsDropdownOpen(false);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-neutral-400 hover:text-white"
                title="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Genre Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {genres.map((g) => (
              <button
                key={g}
                onClick={() => setSelectedGenre(g)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedGenre === g
                    ? 'bg-emerald-500 text-black font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                {g === 'all' ? 'Todos los géneros' : g}
              </button>
            ))}
          </div>
        </div>

        {/* Autocomplete Dropdown List */}
        {isDropdownOpen && autocompleteSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 md:max-w-2xl mt-2 bg-neutral-900/95 border border-neutral-800 rounded-2xl shadow-2xl backdrop-blur-xl z-50 overflow-hidden divide-y divide-neutral-800/60 animate-in fade-in slide-in-from-top-2">
            <div className="p-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5 px-3">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>Sugerencias inteligentes de autocompletado</span>
            </div>

            {autocompleteSuggestions.map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectQuery(item.type === 'lyric' && item.song ? item.song.title : item.text, item.song)}
                className="flex items-center justify-between p-3 px-4 hover:bg-neutral-800/80 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3 truncate">
                  <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center flex-shrink-0 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black transition-colors">
                    {item.type === 'song' && <Music className="w-4 h-4" />}
                    {item.type === 'artist' && <Disc className="w-4 h-4" />}
                    {item.type === 'album' && <Disc className="w-4 h-4" />}
                    {item.type === 'lyric' && <Mic2 className="w-4 h-4" />}
                  </div>

                  <div className="truncate">
                    <p className="text-sm font-semibold text-white group-hover:text-emerald-300 truncate">
                      {item.type === 'lyric' ? `"...${item.text}..."` : item.text}
                    </p>
                    <p className="text-xs text-neutral-400 truncate mt-0.5">
                      {item.subText}
                    </p>
                  </div>
                </div>

                <ArrowRight className="w-4 h-4 text-neutral-600 group-hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 ml-2" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* State A: EMPTY SEARCH QUERY -> Show Recent Searches (Max 10) & Private Cloud Info */}
      {!searchQuery.trim() ? (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Recent Searches Section (User Requirement: "guardar el historial de canciones buscadas, las últimas 10 canciones buscadas") */}
          {recentSearches.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-bold text-base">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>Búsquedas recientes (Últimas 10)</span>
                </div>
                <button
                  onClick={handleClearAllRecent}
                  className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Borrar historial</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {recentSearches.map((term, index) => {
                  // Check if term matches a song in catalog for enhanced thumbnail preview
                  const matchedSong = catalog.find(
                    (s) => s.title.toLowerCase() === term.toLowerCase()
                  );

                  return (
                    <div
                      key={index}
                      onClick={() => handleSelectQuery(term, matchedSong)}
                      className="group flex items-center gap-2 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 py-1.5 pl-3 pr-2 rounded-full cursor-pointer transition-all shadow-sm"
                    >
                      {matchedSong?.coverUrl ? (
                        <img
                          src={matchedSong.coverUrl}
                          alt={term}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <Search className="w-3.5 h-3.5 text-neutral-400 group-hover:text-emerald-400 transition-colors" />
                      )}

                      <span className="text-xs font-medium text-neutral-200 group-hover:text-white">
                        {term}
                      </span>

                      <button
                        onClick={(e) => handleRemoveRecent(e, term)}
                        className="p-1 rounded-full text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                        title="Eliminar de búsquedas recientes"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Privacy & Cloud Explanation Banner */}
          <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-3xl p-8 text-center space-y-4 max-w-2xl mx-auto shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <Search className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Tu catálogo está resguardado en la nube</h3>
              <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                Toda la música que subas por enlaces (File Garden, Dropbox, Notion, etc.) se almacena
                en tu repositorio global. No se muestra toda de golpe para mantener tu espacio limpio y
                organizado: busca el título, artista o frases de la letra para escucharla o añadirla a tus playlists.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap justify-center gap-2">
              <span className="text-[11px] text-neutral-500 bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-full">
                🔍 Búsqueda inteligente
              </span>
              <span className="text-[11px] text-neutral-500 bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-full">
                🎤 Coincidencias en letras sincronizadas
              </span>
              <span className="text-[11px] text-neutral-500 bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-full">
                ⚡ Sincronizado en todos tus dispositivos
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* State B: SEARCH QUERY ACTIVE -> Show Table with Search Results */
        <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-3xl overflow-hidden shadow-xl animate-in fade-in duration-200">
          <div className="p-4 border-b border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400 font-bold uppercase tracking-wider">
            <span>Resultados para "{searchQuery}" ({filteredSongs.length})</span>
            <div className="flex items-center gap-12 pr-4">
              <span className="hidden md:inline">Álbum</span>
              <span>Duración</span>
              <span>Acciones</span>
            </div>
          </div>

          {filteredSongs.length === 0 ? (
            <div className="p-12 text-center text-neutral-500 space-y-2">
              <Music className="w-10 h-10 mx-auto text-neutral-600" />
              <p className="text-sm font-semibold">No se encontraron canciones que coincidan con "{searchQuery}"</p>
              <p className="text-xs text-neutral-500">
                Prueba buscando por una palabra del título, del artista o añade el enlace en "Añadir Música".
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-800/40">
              {filteredSongs.map((song, index) => {
                const liked = isFavorite(song.id);
                const downloaded = isDownloaded(song.id);
                const isCurrent = currentSong?.id === song.id;
                const lyricMatchSnippet = findMatchingLyricSnippet(song, searchQuery);

                return (
                  <div
                    key={song.id}
                    onClick={() => {
                      saveRecentSearch(song.title);
                      setRecentSearches(getRecentSearches());
                      playSong(song, filteredSongs);
                    }}
                    className={`flex items-center justify-between p-3.5 hover:bg-neutral-800/50 transition-colors cursor-pointer group ${
                      isCurrent ? 'bg-neutral-800/40' : ''
                    }`}
                  >
                    {/* Left: Thumbnail & Song Name */}
                    <div className="flex items-center gap-3.5 truncate max-w-sm md:max-w-md">
                      <span className="text-xs font-mono text-neutral-500 w-5 text-right flex-shrink-0 group-hover:hidden">
                        {index + 1}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          saveRecentSearch(song.title);
                          setRecentSearches(getRecentSearches());
                          playSong(song, filteredSongs);
                        }}
                        className="w-5 text-emerald-400 flex-shrink-0 hidden group-hover:block"
                      >
                        <Play className="w-4 h-4 fill-current" />
                      </button>

                      <div className="w-11 h-11 rounded-xl bg-neutral-800 overflow-hidden flex-shrink-0 shadow relative">
                        <img
                          src={song.coverUrl}
                          alt={song.title}
                          className="w-full h-full object-cover"
                        />
                      </div>

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
                            className={`block text-sm font-bold truncate ${
                              isCurrent ? 'text-emerald-400' : 'text-white'
                            }`}
                          >
                            {song.title}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 text-xs text-neutral-400 truncate mt-0.5">
                          {song.artist.split(',').map((art, aIdx, arr) => {
                            const trimmed = art.trim();
                            return (
                              <React.Fragment key={aIdx}>
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectQuery(trimmed);
                                  }}
                                  className="hover:text-emerald-400 hover:underline cursor-pointer"
                                  title={`Ver todas las canciones y colaboraciones de ${trimmed}`}
                                >
                                  {trimmed}
                                </span>
                                {aIdx < arr.length - 1 && <span>,</span>}
                              </React.Fragment>
                            );
                          })}
                          {song.year ? <span>• {song.year}</span> : ''}
                        </div>

                        {lyricMatchSnippet && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400/90 font-medium truncate mt-1 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                            <Mic2 className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">Coincide letra: "{lyricMatchSnippet}"</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Album, Duration, Actions */}
                    <div className="flex items-center gap-6 md:gap-12 flex-shrink-0 pr-2">
                      <span className="hidden md:inline text-xs text-neutral-400 max-w-[140px] truncate">
                        {song.album || '—'}
                      </span>

                      <span className="text-xs font-mono text-neutral-400">
                        {formatTime(song.duration)}
                      </span>

                      <div className="flex items-center gap-1">
                        {/* Favorite Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(song.id);
                          }}
                          className={`p-2 rounded-full transition-colors active:scale-90 ${
                            liked ? 'text-emerald-400' : 'text-neutral-500 hover:text-white'
                          }`}
                          title={liked ? 'Quitar de favoritos' : 'Añadir a mis favoritos'}
                        >
                          <Heart className={`w-4 h-4 ${liked ? 'fill-emerald-400' : ''}`} />
                        </button>

                        {/* Add to Playlist Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenAddToPlaylist(song);
                          }}
                          className="p-2 rounded-full text-neutral-500 hover:text-white transition-colors"
                          title="Añadir a una playlist"
                        >
                          <Plus className="w-4 h-4" />
                        </button>

                        {/* Cache offline toggle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDownloadSong(song);
                          }}
                          className={`p-2 rounded-full transition-colors ${
                            downloaded
                              ? 'text-emerald-400 hover:text-emerald-300'
                              : 'text-neutral-500 hover:text-white'
                          }`}
                          title={downloaded ? 'Descargado sin conexión' : 'Guardar en caché local'}
                        >
                          {downloaded ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>

                        {/* Direct MP3 file download */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadSingleSongFile(song);
                          }}
                          className="p-2 rounded-full text-neutral-500 hover:text-white transition-colors hidden sm:block"
                          title="Descargar archivo al computador"
                        >
                          <Disc className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
