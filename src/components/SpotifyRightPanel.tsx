import React from 'react';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Heart from 'lucide-react/dist/esm/icons/heart.mjs';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.mjs';
import ListMusic from 'lucide-react/dist/esm/icons/list-music.mjs';
import Disc from 'lucide-react/dist/esm/icons/disc.mjs';
import Mic2 from 'lucide-react/dist/esm/icons/mic-vocal.mjs';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link.mjs';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.mjs';
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2.mjs';
import Video from 'lucide-react/dist/esm/icons/video.mjs';
import { useAudio, useAudioTime } from '../context/AudioContext';
import { useMusic } from '../context/MusicContext';
import { formatTime } from '../utils/lyrics';
import { Song, Album } from '../types';
import { getAlbumsFromCatalog } from '../utils/albums';
import { ArtistLinks } from './ArtistLinks';
import { SongVersionSelector } from './SongVersionSelector';

interface SpotifyRightPanelProps {
  onSelectArtist?: (artistName: string) => void;
  onSelectAlbum?: (album: Album) => void;
}

export const SpotifyRightPanel: React.FC<SpotifyRightPanelProps> = ({
  onSelectArtist,
  onSelectAlbum,
}) => {
  const {
    currentSong,
    queue,
    isPlaying,
    playbackSource,
    isRightPanelOpen,
    setIsRightPanelOpen,
    rightPanelTab,
    setRightPanelTab,
    setIsCenterLyricsOpen,
    setIsFullscreenNowPlaying,
    playSong,
    parsedLyrics,
    videoUrl,
    openVideo,
  } = useAudio();
  const { activeLyricIndex } = useAudioTime();

  const { catalog, isFavorite, toggleFavorite, isDownloaded } = useMusic();

  if (!isRightPanelOpen || !currentSong) return null;

  const liked = isFavorite(currentSong.id);
  const downloaded = isDownloaded(currentSong.id);

  // Find upcoming queue tracks
  const currentIndex = queue.findIndex((s) => s.id === currentSong.id);
  const upcomingSongs = currentIndex >= 0 ? queue.slice(currentIndex + 1) : queue;

  // Visible lyric lines for "Letra" card (at least 5-6 lines around active line)
  const startLyricIndex = Math.max(0, activeLyricIndex - 1);
  const lyricSnippet = parsedLyrics.length > 0
    ? parsedLyrics.slice(startLyricIndex, startLyricIndex + 6)
    : [];

  const sourceName = playbackSource?.name || 'Tus me gusta';

  return (
    <aside className="w-80 lg:w-88 bg-neutral-950 border-l border-neutral-900/90 flex flex-col h-full flex-shrink-0 select-none overflow-hidden animate-in slide-in-from-right-4 duration-200">
      {/* Header Tabs (Fila de reproducción / Vista actual) */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-900 flex-shrink-0">
        <div className="flex items-center gap-4 text-xs font-bold">
          <button
            onClick={() => setRightPanelTab('now-playing')}
            className={`transition-colors pb-0.5 border-b-2 ${
              rightPanelTab === 'now-playing'
                ? 'text-white border-emerald-400 font-extrabold'
                : 'text-neutral-400 border-transparent hover:text-white'
            }`}
          >
            Vista actual
          </button>
          <button
            onClick={() => setRightPanelTab('queue')}
            className={`transition-colors pb-0.5 border-b-2 ${
              rightPanelTab === 'queue'
                ? 'text-white border-emerald-400 font-extrabold'
                : 'text-neutral-400 border-transparent hover:text-white'
            }`}
          >
            Fila de reproducción
          </button>
        </div>

        <button
          onClick={() => setIsRightPanelOpen(false)}
          className="text-neutral-400 hover:text-white p-1 rounded-full hover:bg-neutral-900 transition-colors"
          title="Ocultar panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {rightPanelTab === 'now-playing' ? (
          /* TAB: VISTA ACTUAL (Spotify Image 5) */
          <div className="space-y-5">
            {/* Source Origin Title */}
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400 block truncate">
                {sourceName}
              </span>
            </div>

            {/* High-res Cover Art */}
            <div className="aspect-square w-full rounded-2xl overflow-hidden bg-neutral-900 shadow-2xl relative group">
              <img
                src={currentSong.coverUrl}
                alt={currentSong.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={() => setIsFullscreenNowPlaying(true)}
                  className="px-3.5 py-2 rounded-xl bg-black/80 hover:bg-black text-white text-xs font-bold backdrop-blur-md flex items-center gap-1.5 shadow-lg"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Pantalla Completa</span>
                </button>
              </div>
            </div>

            {/* Title & Artist */}
            <div className="flex items-center justify-between gap-3">
              <div className="truncate flex-1">
                <div className="flex items-center gap-1.5">
                  {currentSong.isExplicit && (
                    <span
                      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-neutral-600/80 text-black text-[9px] font-black flex-shrink-0 select-none leading-none"
                      title="Contenido explícito"
                    >
                      E
                    </span>
                  )}
                  <h3 className="font-extrabold text-base text-white truncate block">
                    {currentSong.title}
                  </h3>
                </div>
                <p className="text-xs text-neutral-400 truncate mt-0.5">
                  <ArtistLinks artists={currentSong.artist} onSelectArtist={onSelectArtist} />
                </p>
                <div className="mt-2">
                  <SongVersionSelector compact />
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {videoUrl && (
                  <button
                    onClick={openVideo}
                    className="p-1.5 rounded-full text-neutral-400 hover:text-emerald-400 transition-colors"
                    title="Ver videoclip"
                  >
                    <Video className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => toggleFavorite(currentSong.id)}
                  className={`p-1.5 rounded-full transition-transform active:scale-90 ${
                    liked ? 'text-emerald-400' : 'text-neutral-500 hover:text-white'
                  }`}
                  title={liked ? 'Guardado en favoritos' : 'Añadir a favoritos'}
                >
                  <CheckCircle2 className={`w-5 h-5 ${liked ? 'fill-emerald-400 text-black' : ''}`} />
                </button>
              </div>
            </div>

            {/* Letra Card */}
            <div
              onClick={() => setIsCenterLyricsOpen(true)}
              className="bg-gradient-to-br from-cyan-950 via-sky-950 to-neutral-950 border border-sky-900/40 p-4 rounded-2xl cursor-pointer group hover:border-sky-500/50 transition-all shadow-xl space-y-2 relative overflow-hidden"
            >
              <div className="flex items-center justify-between text-sky-400 text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <Mic2 className="w-3.5 h-3.5" />
                  Letra
                </span>
                <span className="text-[10px] uppercase font-bold text-sky-300 group-hover:underline flex items-center gap-0.5">
                  Ver completa <ChevronRight className="w-3 h-3" />
                </span>
              </div>

              {lyricSnippet.length > 0 ? (
                <div className="space-y-1.5 pt-1 max-h-56 overflow-hidden">
                  {lyricSnippet.map((line, idx) => {
                    const actualIdx = startLyricIndex + idx;
                    const isActive = actualIdx === activeLyricIndex;
                    return (
                      <p
                        key={idx}
                        className={`text-xs md:text-sm leading-relaxed transition-all ${
                          isActive
                            ? 'text-white font-extrabold scale-101 origin-left'
                            : 'text-sky-300/60 font-medium'
                        }`}
                      >
                        {line.text}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-neutral-400 pt-1">
                  {currentSong.lyricsLrc ? 'Toca para ver la letra sincronizada' : 'Sin letras registradas en esta canción.'}
                </p>
              )}
            </div>

            {/* Album & Info Card */}
            <div className="p-4 bg-neutral-900/60 rounded-2xl border border-neutral-800/80 space-y-1.5 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                Álbum y detalles
              </span>
              <p
                onClick={() => {
                  if (onSelectAlbum && currentSong.album) {
                    const alb = getAlbumsFromCatalog(catalog).find(
                      (a) => a.name.trim().toLowerCase() === currentSong.album.trim().toLowerCase()
                    );
                    if (alb) onSelectAlbum(alb);
                  }
                }}
                className={`font-bold text-white truncate ${onSelectAlbum ? 'hover:underline cursor-pointer' : ''}`}
                title={onSelectAlbum ? `Abrir álbum ${currentSong.album}` : undefined}
              >
                {currentSong.album}
              </p>
              <p className="text-neutral-400">
                Género: <span className="text-emerald-400 font-semibold">{currentSong.genre || 'General'}</span> • Año: {currentSong.year || '2026'}
              </p>
            </div>
          </div>
        ) : (
          /* TAB: FILA DE REPRODUCCIÓN (Spotify Image 4) */
          <div className="space-y-6">
            {/* Now Playing in Queue */}
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400 mb-2.5 block">
                Estás escuchando
              </span>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-neutral-900 border border-emerald-500/30 shadow-md">
                <div className="w-11 h-11 rounded-lg overflow-hidden relative flex-shrink-0">
                  <img src={currentSong.coverUrl} alt={currentSong.title} className="w-full h-full object-cover" />
                  {isPlaying && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    </div>
                  )}
                </div>
                <div className="truncate flex-1">
                  <span className="font-bold text-xs text-emerald-400 truncate block">
                    {currentSong.title}
                  </span>
                  <span className="text-[11px] text-neutral-400 truncate block">
                    <ArtistLinks artists={currentSong.artist} onSelectArtist={onSelectArtist} />
                  </span>
                </div>
              </div>
            </div>

            {/* Upcoming Songs */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-black uppercase tracking-wider text-neutral-300">
                  Próximas canciones de: {sourceName}
                </span>
                <span className="text-[10px] text-neutral-500 font-bold">
                  {upcomingSongs.length} en cola
                </span>
              </div>

              <div className="space-y-1.5">
                {upcomingSongs.length === 0 ? (
                  <p className="text-xs text-neutral-500 italic p-3 text-center bg-neutral-900/40 rounded-xl">
                    No hay más canciones en la cola.
                  </p>
                ) : (
                  upcomingSongs.slice(0, 15).map((song, i) => (
                    <div
                      key={song.id}
                      onClick={() => playSong(song, queue, playbackSource || undefined)}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-neutral-900 border border-transparent hover:border-neutral-800 cursor-pointer group transition-all"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span className="text-xs font-bold text-neutral-500 w-4 text-center group-hover:hidden">
                          {i + 1}
                        </span>
                        <Play className="w-3.5 h-3.5 text-white fill-white hidden group-hover:block ml-0.5 flex-shrink-0" />
                        <img
                          src={song.coverUrl}
                          alt={song.title}
                          className="w-9 h-9 rounded-md object-cover flex-shrink-0"
                        />
                        <div className="truncate">
                          <span className="font-bold text-xs text-white truncate block group-hover:text-emerald-400">
                            {song.title}
                          </span>
                          <span className="text-[10px] text-neutral-400 truncate block">
                            <ArtistLinks artists={song.artist} onSelectArtist={onSelectArtist} />
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] text-neutral-500 font-mono flex-shrink-0">
                        {formatTime(song.duration)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
