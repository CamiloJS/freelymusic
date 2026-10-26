import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Heart,
  Mic2,
  Download,
  CheckCircle2,
  Maximize2
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useMusic } from '../context/MusicContext';
import { formatTime } from '../utils/lyrics';

export const PlayerBar: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffle,
    togglePlayPause,
    seek,
    nextTrack,
    prevTrack,
    setVolume,
    toggleMute,
    toggleRepeat,
    toggleShuffle,
    showLyricsView,
    setShowLyricsView,
  } = useAudio();

  const { isFavorite, toggleFavorite, isDownloaded, toggleDownloadSong, downloadSingleSongFile } =
    useMusic();

  const [isHoveringProgress, setIsHoveringProgress] = useState(false);

  if (!currentSong) {
    return (
      <footer className="h-20 bg-neutral-950 border-t border-neutral-900 flex items-center justify-between px-6 text-neutral-500 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-neutral-900 flex items-center justify-center">
            <Mic2 className="w-5 h-5 text-neutral-700" />
          </div>
          <span>Selecciona una canción para comenzar la reproducción...</span>
        </div>
      </footer>
    );
  }

  const liked = isFavorite(currentSong.id);
  const downloaded = isDownloaded(currentSong.id);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <footer className="h-22 bg-neutral-950/95 backdrop-blur-xl border-t border-neutral-800/80 px-4 md:px-8 flex items-center justify-between select-none z-40 relative">
      {/* Track Info (Left) */}
      <div className="flex items-center gap-4 w-1/4 min-w-[180px] max-w-[320px]">
        <div
          onClick={() => setShowLyricsView(!showLyricsView)}
          className="relative group cursor-pointer w-13 h-13 rounded-xl overflow-hidden shadow-md flex-shrink-0 bg-neutral-900"
        >
          <img
            src={currentSong.coverUrl}
            alt={currentSong.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Mic2 className="w-4 h-4 text-white" />
          </div>
        </div>

        <div className="truncate flex-1">
          <div className="flex items-center gap-2">
            <span
              onClick={() => setShowLyricsView(!showLyricsView)}
              className="text-sm font-bold text-white hover:underline cursor-pointer truncate block"
            >
              {currentSong.title}
            </span>
            {downloaded && (
              <span title="Guardado sin conexión">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              </span>
            )}
          </div>
          <span className="text-xs text-neutral-400 truncate block">
            {currentSong.artist}
          </span>
        </div>

        {/* Favorite & Direct Download button */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => toggleFavorite(currentSong.id)}
            className={`p-1.5 rounded-full transition-transform active:scale-90 ${
              liked ? 'text-emerald-400' : 'text-neutral-500 hover:text-white'
            }`}
            title={liked ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          >
            <Heart className={`w-4 h-4 ${liked ? 'fill-emerald-400' : ''}`} />
          </button>

          <button
            onClick={() => toggleDownloadSong(currentSong)}
            className={`p-1.5 rounded-full transition-colors ${
              downloaded
                ? 'text-emerald-400 hover:text-emerald-300'
                : 'text-neutral-500 hover:text-white'
            }`}
            title={downloaded ? 'Descargado sin conexión' : 'Guardar para escuchar sin conexión'}
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Playback Controls (Center) */}
      <div className="flex flex-col items-center gap-1.5 flex-1 max-w-2xl px-4">
        <div className="flex items-center gap-5">
          {/* Shuffle */}
          <button
            onClick={toggleShuffle}
            className={`transition-colors p-1 rounded-full ${
              isShuffle ? 'text-emerald-400' : 'text-neutral-500 hover:text-white'
            }`}
            title="Aleatorio"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          {/* Prev */}
          <button
            onClick={prevTrack}
            className="text-neutral-300 hover:text-white transition-transform active:scale-90 p-1"
            title="Anterior"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          {/* Play / Pause */}
          <button
            onClick={togglePlayPause}
            className="w-10 h-10 rounded-full bg-white text-black hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg transition-transform"
            title={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          {/* Next */}
          <button
            onClick={nextTrack}
            className="text-neutral-300 hover:text-white transition-transform active:scale-90 p-1"
            title="Siguiente"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          {/* Repeat */}
          <button
            onClick={toggleRepeat}
            className={`transition-colors p-1 rounded-full relative ${
              repeatMode !== 'off' ? 'text-emerald-400' : 'text-neutral-500 hover:text-white'
            }`}
            title={`Repetir: ${repeatMode}`}
          >
            {repeatMode === 'one' ? (
              <Repeat1 className="w-4 h-4" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Progress Bar & Timestamps */}
        <div className="w-full flex items-center gap-2 text-[11px] text-neutral-400 font-mono">
          <span className="w-10 text-right">{formatTime(currentTime)}</span>
          <div
            className="relative flex-1 flex items-center group cursor-pointer h-4"
            onMouseEnter={() => setIsHoveringProgress(true)}
            onMouseLeave={() => setIsHoveringProgress(false)}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              seek(percent * duration);
            }}
          >
            <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  isHoveringProgress ? 'bg-emerald-400' : 'bg-white'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <span className="w-10 text-left">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Auxiliary Controls (Right) */}
      <div className="flex items-center justify-end gap-3 w-1/4 min-w-[180px] max-w-[320px]">
        {/* Toggle Lyrics */}
        <button
          onClick={() => setShowLyricsView(!showLyricsView)}
          className={`p-2 rounded-xl transition-colors ${
            showLyricsView
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
          title="Letras en tiempo real (Apple Music Style)"
        >
          <Mic2 className="w-4 h-4" />
        </button>

        {/* Download file directly */}
        <button
          onClick={() => downloadSingleSongFile(currentSong)}
          className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors"
          title="Descargar archivo MP3 al computador"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Volume controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="text-neutral-400 hover:text-white transition-colors"
            title={isMuted ? 'Activar sonido' : 'Silenciar'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        {/* Expand / Maximize view */}
        <button
          onClick={() => setShowLyricsView(true)}
          className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors hidden sm:block"
          title="Pantalla completa"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </footer>
  );
};
