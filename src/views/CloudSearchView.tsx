import React, { useState, useMemo } from 'react';
import {
  Search,
  Compass,
  Play,
  Heart,
  Plus,
  Download,
  CheckCircle2,
  Cloud,
  Filter,
  Music,
  Disc,
  Info
} from 'lucide-react';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { Song } from '../types';
import { formatTime } from '../utils/lyrics';

interface CloudSearchViewProps {
  onOpenAddToPlaylist: (song: Song) => void;
  onOpenAddMusic?: () => void;
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
  const { playSong, currentSong, isPlaying } = useAudio();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');

  // Extract unique genres from catalog
  const genres = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((s) => {
      if (s.genre) set.add(s.genre);
    });
    return ['all', ...Array.from(set)];
  }, [catalog]);

  // Filter catalog based on query and genre
  const filteredSongs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return catalog.filter((song) => {
      const matchGenre = selectedGenre === 'all' || song.genre === selectedGenre;
      if (!matchGenre) return false;

      if (!q) return true;
      return (
        song.title.toLowerCase().includes(q) ||
        song.artist.toLowerCase().includes(q) ||
        song.album.toLowerCase().includes(q) ||
        (song.genre && song.genre.toLowerCase().includes(q))
      );
    });
  }, [catalog, searchQuery, selectedGenre]);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto pb-32">
      {/* Search Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-2">
            <Cloud className="w-4 h-4" />
            <span>Repositorio Global en la Nube</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">Buscar en la Nube</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Busca cualquier canción almacenada en tu repositorio por enlace. No aparecen en tu biblioteca hasta que las agregues a tus favoritos o a tus playlists.
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

      {/* Search Bar & Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título, artista, álbum o género..."
            className="w-full bg-neutral-900/90 border border-neutral-800 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 shadow-inner"
          />
        </div>

        {/* Genre Pill Filters */}
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

      {/* Catalog Table */}
      <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400 font-bold uppercase tracking-wider">
          <span>Canción</span>
          <div className="flex items-center gap-12 pr-4">
            <span className="hidden md:inline">Álbum</span>
            <span>Duración</span>
            <span>Acciones</span>
          </div>
        </div>

        {filteredSongs.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 space-y-2">
            <Music className="w-10 h-10 mx-auto text-neutral-600" />
            <p className="text-sm font-semibold">No se encontraron canciones para tu búsqueda</p>
            <p className="text-xs text-neutral-500">
              Prueba con otro término o añade nuevos enlaces desde el Panel de Administración.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-800/40">
            {filteredSongs.map((song, index) => {
              const liked = isFavorite(song.id);
              const downloaded = isDownloaded(song.id);
              const isCurrent = currentSong?.id === song.id;

              return (
                <div
                  key={song.id}
                  onClick={() => playSong(song, filteredSongs)}
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
                      <span
                        className={`block text-sm font-bold truncate ${
                          isCurrent ? 'text-emerald-400' : 'text-white'
                        }`}
                      >
                        {song.title}
                      </span>
                      <span className="block text-xs text-neutral-400 truncate mt-0.5">
                        {song.artist} {song.year ? `• ${song.year}` : ''}
                      </span>
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
                        title="Descargar archivo al dispositivo"
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
    </div>
  );
};
