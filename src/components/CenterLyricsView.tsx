import React, { useEffect, useRef, useMemo } from 'react';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Minimize2 from 'lucide-react/dist/esm/icons/minimize-2.mjs';
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2.mjs';
import Mic2 from 'lucide-react/dist/esm/icons/mic-vocal.mjs';
import { useAudio, useAudioTime } from '../context/AudioContext';
import { buildDisplayLyrics } from '../utils/lyrics';
import { LyricsTranslationButton } from './LyricsTranslationButton';

export const CenterLyricsView: React.FC = () => {
  const {
    currentSong,
    parsedLyrics,
    translatedLyrics,
    lyricsDisplayMode,
    seek,
    playbackSource,
    setIsCenterLyricsOpen,
    setIsFullscreenNowPlaying,
  } = useAudio();
  const { activeLyricIndex } = useAudioTime();

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to active lyric smoothly without moving outer parent layout
  useEffect(() => {
    if (activeLyricIndex < 0) return;
    if (activeLineRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const activeEl = activeLineRef.current;
      const containerHeight = container.clientHeight;
      const activeTop = activeEl.offsetTop;
      const activeHeight = activeEl.clientHeight;

      const targetScroll = activeTop - containerHeight / 2 + activeHeight / 2;
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    }
  }, [activeLyricIndex]);

  if (!currentSong) return null;

  const sourceName = playbackSource?.name || 'Tus me gusta';
  const displayLyrics = useMemo(
    () => buildDisplayLyrics(parsedLyrics, translatedLyrics, lyricsDisplayMode),
    [parsedLyrics, translatedLyrics, lyricsDisplayMode]
  );

  return (
    <div className="center-lyrics-container flex-1 flex flex-col h-full bg-neutral-950 relative overflow-hidden select-none animate-in fade-in duration-300">
      {/* Ambient Artwork Background (Diffused color wash from song/album cover) */}
      <div
        className="center-lyrics-ambient absolute inset-0 bg-cover bg-center blur-[120px] scale-150 opacity-35 saturate-150 pointer-events-none transition-all duration-1000"
        style={{ backgroundImage: `url(${currentSong.coverUrl})` }}
      />
      <div className="center-lyrics-overlay absolute inset-0 bg-gradient-to-b from-black/50 via-neutral-950/70 to-neutral-950 pointer-events-none" />
      <div className="center-lyrics-fade-bottom absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent pointer-events-none z-10" />
      <div className="center-lyrics-fade-top absolute inset-x-0 top-[65px] h-12 bg-gradient-to-b from-neutral-950 via-neutral-950/60 to-transparent pointer-events-none z-20" />

      {/* Top Action Bar (z-40 ensures popover overlays lyrics) */}
      <div className="center-lyrics-header relative z-40 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-3 truncate">
          <span className="text-xs font-black uppercase tracking-wider text-neutral-300">
            {sourceName}
          </span>
          <span className="text-neutral-500">•</span>
          <span className="text-xs text-white font-bold truncate">
            {currentSong.title} — {currentSong.artist}
          </span>
        </div>

        {/* Translation and Window controls */}
        <div className="flex items-center gap-2">
          {parsedLyrics.length > 0 && (
            <LyricsTranslationButton dropDirection="down" />
          )}

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
        className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden px-6 md:px-12 pt-16 pb-36 space-y-7 text-center md:text-left scroll-smooth"
      >
        {parsedLyrics.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
            <Mic2 className="w-12 h-12 text-white/30" />
            <h3 className="text-xl font-bold text-white">No hay letras disponibles</h3>
            <p className="text-xs text-neutral-400 max-w-sm">
              Esta canción no cuenta con archivo .LRC sincronizado. Puedes editar la canción o subir las letras desde la sección "Añadir Música".
            </p>
          </div>
        ) : (
          displayLyrics.map((line, index) => {
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
                    ? 'text-white/40 hover:text-white text-xl md:text-2xl font-bold'
                    : 'text-white/25 hover:text-white text-xl md:text-2xl font-bold'
                }`}
              >
                <p className="leading-tight transition-transform group-hover:translate-x-1">
                  {line.text || '♪'}
                </p>
                {line.translation && (
                  <p
                    className={`mt-1 leading-snug font-semibold transition-colors ${
                      isActive
                        ? 'text-white/90 text-sm md:text-lg'
                        : 'text-white/40 text-xs md:text-base'
                    }`}
                  >
                    {line.translation}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
