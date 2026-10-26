import React, { useEffect, useRef } from 'react';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Minimize2 from 'lucide-react/dist/esm/icons/minimize-2.mjs';
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2.mjs';
import Mic2 from 'lucide-react/dist/esm/icons/mic-vocal.mjs';
import Disc from 'lucide-react/dist/esm/icons/disc.mjs';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Pause from 'lucide-react/dist/esm/icons/pause.mjs';
import { useAudio, useAudioTime } from '../context/AudioContext';
import { useMusic } from '../context/MusicContext';
import { formatTime } from '../utils/lyrics';

export const CenterLyricsView: React.FC = () => {
  const {
    currentSong,
    parsedLyrics,
    seek,
    playbackSource,
    setIsCenterLyricsOpen,
    setIsFullscreenNowPlaying,
  } = useAudio();
  const { currentTime, duration, activeLyricIndex } = useAudioTime();

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to active lyric smoothly
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLyricIndex]);

  if (!currentSong) return null;

  const sourceName = playbackSource?.name || 'Tus me gusta';

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-sky-950/70 via-slate-950 to-neutral-950 relative overflow-hidden select-none animate-in fade-in duration-300">
      {/* Top Action Bar (Spotify Image 3) */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 z-10 bg-black/20 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-3 truncate">
          <span className="text-xs font-black uppercase tracking-wider text-neutral-300">
            {sourceName}
          </span>
          <span className="text-neutral-500">•</span>
          <span className="text-xs text-sky-300 font-bold truncate">
            {currentSong.title} — {currentSong.artist}
          </span>
        </div>

        {/* Window controls (Minimize, Fullscreen, Close) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFullscreenNowPlaying(true)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Pantalla Completa"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsCenterLyricsOpen(false)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Minimizar vista de letras"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsCenterLyricsOpen(false)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Cerrar letras"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrolling Lyrics Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-6 md:px-12 py-12 space-y-7 text-center md:text-left scroll-smooth"
      >
        {parsedLyrics.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
            <Mic2 className="w-12 h-12 text-sky-400/40" />
            <h3 className="text-xl font-bold text-white">No hay letras disponibles</h3>
            <p className="text-xs text-neutral-400 max-w-sm">
              Esta canción no cuenta con archivo .LRC sincronizado. Puedes editar la canción o subir las letras desde la sección "Añadir Música".
            </p>
          </div>
        ) : (
          parsedLyrics.map((line, index) => {
            const isActive = index === activeLyricIndex;
            const isPast = index < activeLyricIndex;

            return (
              <div
                key={index}
                ref={isActive ? activeLineRef : null}
                onClick={() => seek(line.time)}
                className={`cursor-pointer transition-all duration-300 transform group py-1 ${
                  isActive
                    ? 'text-white text-2xl md:text-4xl font-black scale-102 filter drop-shadow-md'
                    : isPast
                    ? 'text-sky-200/50 hover:text-white text-xl md:text-2xl font-bold'
                    : 'text-sky-300/30 hover:text-white text-xl md:text-2xl font-bold'
                }`}
              >
                <p className="leading-tight transition-transform group-hover:translate-x-1">
                  {line.text || '♪'}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
