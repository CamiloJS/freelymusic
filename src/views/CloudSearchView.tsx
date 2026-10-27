import React, { useMemo, useState } from 'react';
import Search from 'lucide-react/dist/esm/icons/search.mjs';
import Clock from 'lucide-react/dist/esm/icons/clock.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Heart from 'lucide-react/dist/esm/icons/heart.mjs';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.mjs';
import Download from 'lucide-react/dist/esm/icons/download.mjs';
import { DownloadedIcon } from '../components/DownloadedIcon';
import { SavedCheckIcon } from '../components/SavedCheckIcon';
import Music from 'lucide-react/dist/esm/icons/music.mjs';
import Disc from 'lucide-react/dist/esm/icons/disc.mjs';
import Mic2 from 'lucide-react/dist/esm/icons/mic-vocal.mjs';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { Song, Album } from '../types';
import { formatTime } from '../utils/lyrics';
import { getAlbumsFromCatalog } from '../utils/albums';
import { ArtistLinks } from '../components/ArtistLinks';
import {
  getRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from '../services/storage';

interface CloudSearchViewProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onOpenAddToPlaylist: (song: Song) => void;
  onSelectArtist?: (artistName: string) => void;
  onSelectAlbum?: (album: Album) => void;
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
  searchQuery,
  onSearchQueryChange,
  onOpenAddToPlaylist,
  onSelectArtist,
  onSelectAlbum,
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

  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches());

  const filteredSongs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];

    return catalog.filter((song) => {
      const titleMatch = song.title.toLowerCase().includes(q);
      const artistMatch = song.artist.toLowerCase().includes(q);
      const albumMatch = song.album ? song.album.toLowerCase().includes(q) : false;
      const genreMatch = song.genre ? song.genre.toLowerCase().includes(q) : false;
      const lyricsMatch = findMatchingLyricSnippet(song, q) !== null;
      return titleMatch || artistMatch || albumMatch || genreMatch || lyricsMatch;
    });
  }, [catalog, searchQuery]);

  const selectRecent = (term: string) => {
    onSearchQueryChange(term);
  };

  const handleRemoveRecent = (event: React.MouseEvent, term: string) => {
    event.stopPropagation();
    setRecentSearches(removeRecentSearch(term));
  };

  const handleClearRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto pb-32">
      {!searchQuery.trim() ? (
        <div className="max-w-2xl">
          <h1 className="text-3xl font-black text-white">Buscar</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Busca por título, artista, álbum o una frase de la letra.
          </p>

          {recentSearches.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2 text-base font-bold text-white">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  Búsquedas recientes
                </h2>
                <button
                  onClick={handleClearRecent}
                  className="text-[11px] text-neutral-500 hover:text-red-400 transition-colors"
                >
                  Borrar historial
                </button>
              </div>

              <div className="space-y-1">
                {recentSearches.map((term) => {
                  const matchedSong = catalog.find(
                    (song) => song.title.toLowerCase() === term.toLowerCase()
                  );
                  return (
                    <div
                      key={term}
                      onClick={() => selectRecent(term)}
                      className="flex items-center gap-3 rounded-xl p-2 hover:bg-neutral-900 cursor-pointer transition-colors group"
                    >
                      <div className="w-11 h-11 rounded-lg overflow-hidden bg-neutral-900 flex items-center justify-center flex-shrink-0">
                        {matchedSong?.coverUrl ? (
                          <img
                            src={matchedSong.coverUrl}
                            alt={term}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Search className="w-4 h-4 text-neutral-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate">{term}</p>
                        <p className="text-[11px] text-neutral-500 truncate">
                          {matchedSong
                            ? `${matchedSong.album} • ${matchedSong.artist}`
                            : 'Búsqueda reciente'}
                        </p>
                      </div>
                      <button
                        onClick={(event) => handleRemoveRecent(event, term)}
                        className="p-1.5 rounded-full text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Quitar de búsquedas recientes"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {recentSearches.length === 0 && (
            <div className="mt-10 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-8 text-center">
              <Search className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-neutral-300">
                Escribe en la barra superior para buscar
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                El catálogo completo está disponible aquí, pero no se muestra hasta que busques.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <h1 className="text-3xl font-black text-white">Resultados</h1>
            <p className="text-sm text-neutral-400 mt-1">
              {filteredSongs.length === 1
                ? `1 coincidencia para “${searchQuery.trim()}”`
                : `${filteredSongs.length} coincidencias para “${searchQuery.trim()}”`}
            </p>
          </div>

          {filteredSongs.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-12 text-center">
              <Music className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-neutral-300">
                No se encontraron canciones para “{searchQuery.trim()}”
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Prueba con otra palabra del título, del artista o de la letra.
              </p>
            </div>
          ) : (
            <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-3xl overflow-hidden">
              <div className="p-4 border-b border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500 font-bold uppercase tracking-wider">
                <span>Canción</span>
                <div className="flex items-center gap-6 sm:gap-12 sm:pr-4">
                  <span className="hidden md:inline">Álbum</span>
                  <span className="hidden sm:inline">Duración</span>
                  <span>Acciones</span>
                </div>
              </div>

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
                        const updated = saveRecentSearch(song.title);
                        setRecentSearches(updated);
                        playSong(song, filteredSongs);
                      }}
                      className={`flex items-center justify-between p-3.5 hover:bg-neutral-800/50 transition-colors cursor-pointer group ${
                        isCurrent ? 'bg-neutral-800/40' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3.5 min-w-0 flex-1 pr-2 md:max-w-md">
                        <span className="text-xs font-mono text-neutral-500 w-5 text-right flex-shrink-0 group-hover:hidden">
                          {index + 1}
                        </span>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            const updated = saveRecentSearch(song.title);
                            setRecentSearches(updated);
                            playSong(song, filteredSongs);
                          }}
                          className="w-5 text-emerald-400 flex-shrink-0 hidden group-hover:block"
                          title="Reproducir"
                        >
                          <Play className="w-4 h-4 fill-current" />
                        </button>

                        <div className="w-11 h-11 rounded-xl bg-neutral-800 overflow-hidden flex-shrink-0 shadow relative">
                          {song.coverUrl ? (
                            <img
                              src={song.coverUrl}
                              alt={song.title}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Music className="w-4 h-4 text-neutral-600 m-auto mt-3.5" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
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
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-400 truncate mt-0.5">
                            {downloaded && (
                              <span className="flex-shrink-0" title="Descargado">
                                <DownloadedIcon size={12} />
                              </span>
                            )}
                            <ArtistLinks
                              artists={song.artist}
                              onSelectArtist={onSelectArtist || selectRecent}
                            />
                            {song.year ? <span>• {song.year}</span> : ''}
                          </div>

                          {lyricMatchSnippet && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400/90 font-medium truncate mt-1 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                              <Mic2 className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">Coincide letra: “{lyricMatchSnippet}”</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 sm:gap-6 md:gap-12 flex-shrink-0 pr-0 sm:pr-2">
                        {song.album && song.album.trim().toLowerCase() !== 'sencillo' ? (
                          <span
                            onClick={(event) => {
                              if (onSelectAlbum) {
                                event.stopPropagation();
                                const targetAlbum = getAlbumsFromCatalog(catalog).find(
                                  (album) =>
                                    album.name.trim().toLowerCase() ===
                                    song.album.trim().toLowerCase()
                                );
                                if (targetAlbum) onSelectAlbum(targetAlbum);
                              }
                            }}
                            className="hidden md:inline text-xs text-neutral-400 max-w-[140px] truncate hover:underline hover:text-white cursor-pointer"
                            title={`Abrir álbum ${song.album}`}
                          >
                            {song.album}
                          </span>
                        ) : (
                          <span className="hidden md:inline text-xs text-neutral-400 max-w-[140px] truncate">
                            {song.album || '—'}
                          </span>
                        )}

                        <span className="hidden sm:inline text-xs font-mono text-neutral-400">
                          {formatTime(song.duration)}
                        </span>

                        <div className="flex items-center gap-0.5 sm:gap-1">
                          {/* Chulito verde if liked, plus if not */}
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleFavorite(song.id);
                            }}
                            className={`p-1.5 sm:p-2 rounded-full transition-transform active:scale-90 ${
                              liked ? 'hover:scale-110' : 'text-neutral-400 hover:text-white hover:scale-110'
                            }`}
                            title={liked ? 'Guardada en tus favoritos (clic para quitar)' : 'Añadir a tus favoritos'}
                          >
                            {liked ? (
                              <SavedCheckIcon size={16} />
                            ) : (
                              <Plus className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenAddToPlaylist(song);
                            }}
                            className="p-1.5 sm:p-2 rounded-full text-neutral-500 hover:text-white transition-colors"
                            title="Añadir a una playlist"
                          >
                            <Plus className="w-4 h-4" />
                          </button>

                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              void toggleDownloadSong(song);
                            }}
                            className={`p-1.5 sm:p-2 rounded-full transition-colors ${
                              downloaded
                                ? 'text-emerald-400 hover:text-emerald-300'
                                : 'text-neutral-500 hover:text-white'
                            }`}
                            title={downloaded ? 'Descargado sin conexión' : 'Guardar en caché local'}
                          >
                            {downloaded ? (
                              <DownloadedIcon size={16} />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              void downloadSingleSongFile(song);
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
            </div>
          )}
        </div>
      )}
    </div>
  );
};
