import React, { useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Mic2,
  Volume2,
  VolumeX,
  Heart,
  Edit3
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useMusic } from '../context/MusicContext';
import { formatTime } from '../utils/lyrics';

export const LyricsModal: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    seek,
    nextTrack,
    prevTrack,
    volume,
    isMuted,
    setVolume,
    toggleMute,
    showLyricsView,
    setShowLyricsView,
    parsedLyrics,
    activeLyricIndex,
  } = useAudio();

  const { isFavorite, toggleFavorite } = useMusic();
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to active lyric line
  useEffect(() => {
    if (activeLineRef.current && showLyricsView) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLyricIndex, showLyricsView]);

  if (!showLyricsView || !currentSong) return null;

  const liked = isFavorite(currentSong.id);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white overflow-hidden animate-in fade-in duration-300">
      {/* Dynamic Ambient Blurred Background */}
      <div
        className="absolute inset-0 bg-cover bg-center filter blur-3xl scale-125 opacity-35 pointer-events-none transition-all duration-1000"
        style={{ backgroundImage: `url(${currentSong.coverUrl})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
            <Mic2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              Letras en Tiempo Real
              <span className="text-[10px] uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                Apple Music Style
              </span>
            </h3>
            <p className="text-xs text-neutral-400">
              Toca cualquier línea para saltar a ese instante
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowLyricsView(false)}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-all text-white active:scale-95"
          title="Cerrar vista de letras"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content Area: Split View on Desktop (Artwork Left, Scrolling Lyrics Right) */}
      <div className="relative z-10 flex-1 flex flex-col md:flex-row overflow-hidden max-w-7xl mx-auto w-full p-4 md:p-8 gap-8">
        {/* Left Side: Large Album Cover & Metadata */}
        <div className="hidden md:flex flex-col justify-center items-center w-5/12 max-w-md">
          <div className="w-72 h-72 lg:w-84 lg:h-84 rounded-3xl overflow-hidden shadow-2xl shadow-emerald-500/10 ring-1 ring-white/15 group">
            <img
              src={currentSong.coverUrl}
              alt={currentSong.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
          </div>

          <div className="mt-6 text-center w-full px-4">
            <h1 className="text-2xl font-black text-white truncate">{currentSong.title}</h1>
            <p className="text-sm font-medium text-emerald-400 mt-1 truncate">{currentSong.artist}</p>
            {currentSong.album && (
              <p className="text-xs text-neutral-400 mt-0.5 truncate">{currentSong.album}</p>
            )}
          </div>
        </div>

        {/* Right Side: Karaoke Synced Lyrics Scroll Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto px-4 md:px-8 py-12 scroll-smooth text-left space-y-6"
          style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)' }}
        >
          {parsedLyrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-neutral-500 mb-4">
                <Mic2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-neutral-300">
                Esta canción no tiene letras sincronizadas aún
              </h3>
              <p className="text-sm text-neutral-500 max-w-md mt-1">
                Puedes agregar un archivo .LRC con las marcas de tiempo desde el Panel de Administración.
              </p>
            </div>
          ) : (
            parsedLyrics.map((line, index) => {
              const isActive = index === activeLyricIndex;
              const isPast = index < activeLyricIndex;

              return (
                <div
                  key={`${line.time}-${index}`}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => seek(line.time)}
                  className={`cursor-pointer transition-all duration-300 py-2 px-3 rounded-2xl select-none ${
                    isActive
                      ? 'text-2xl sm:text-3xl md:text-4xl font-extrabold text-white scale-102 bg-white/5 shadow-inner drop-shadow-md'
                      : isPast
                      ? 'text-lg sm:text-xl md:text-2xl font-semibold text-white/40 hover:text-white/70'
                      : 'text-lg sm:text-xl md:text-2xl font-semibold text-white/30 hover:text-white/60'
                  }`}
                >
                  <p className="leading-snug tracking-tight">{line.text || '♪ ♪ ♪'}</p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Floating Bottom Playback Control Bar */}
      <div className="relative z-20 px-6 py-4 bg-black/80 backdrop-blur-2xl border-t border-white/10 max-w-4xl mx-auto w-full rounded-t-3xl shadow-2xl">
        {/* Scrubber */}
        <div className="flex items-center gap-3 text-xs text-neutral-400 font-mono mb-3">
          <span>{formatTime(currentTime)}</span>
          <div
            className="flex-1 h-2 bg-neutral-800 rounded-full cursor-pointer relative overflow-hidden group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              seek(percent * duration);
            }}
          >
            <div
              className="h-full bg-emerald-400 group-hover:bg-emerald-300 transition-all rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => toggleFavorite(currentSong.id)}
              className={`p-2 rounded-full ${liked ? 'text-emerald-400' : 'text-neutral-400 hover:text-white'}`}
            >
              <Heart className={`w-5 h-5 ${liked ? 'fill-emerald-400' : ''}`} />
            </button>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={prevTrack}
              className="text-neutral-400 hover:text-white transition-transform active:scale-90"
            >
              <SkipBack className="w-6 h-6 fill-current" />
            </button>

            <button
              onClick={togglePlayPause}
              className="w-12 h-12 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black flex items-center justify-center shadow-lg shadow-emerald-400/20 active:scale-95 transition-transform"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={nextTrack}
              className="text-neutral-400 hover:text-white transition-transform active:scale-90"
            >
              <SkipForward className="w-6 h-6 fill-current" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={toggleMute} className="text-neutral-400 hover:text-white">
              {isMuted || volume === 0 ? (
                <VolumeX className="w-5 h-5 text-red-400" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-20 accent-emerald-400 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
