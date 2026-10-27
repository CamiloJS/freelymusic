import React, { useState } from 'react';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Pause from 'lucide-react/dist/esm/icons/pause.mjs';
import SkipBack from 'lucide-react/dist/esm/icons/skip-back.mjs';
import SkipForward from 'lucide-react/dist/esm/icons/skip-forward.mjs';
import Shuffle from 'lucide-react/dist/esm/icons/shuffle.mjs';
import Repeat from 'lucide-react/dist/esm/icons/repeat.mjs';
import Repeat1 from 'lucide-react/dist/esm/icons/repeat-1.mjs';
import Volume2 from 'lucide-react/dist/esm/icons/volume-2.mjs';
import VolumeX from 'lucide-react/dist/esm/icons/volume-x.mjs';
import Heart from 'lucide-react/dist/esm/icons/heart.mjs';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.mjs';
import PlusCircle from 'lucide-react/dist/esm/icons/circle-plus.mjs';
import Mic2 from 'lucide-react/dist/esm/icons/mic-vocal.mjs';
import ListMusic from 'lucide-react/dist/esm/icons/list-music.mjs';
import { DownloadedIcon } from './DownloadedIcon';
import { SavedCheckIcon } from './SavedCheckIcon';
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2.mjs';
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.mjs';
import AlertCircle from 'lucide-react/dist/esm/icons/circle-alert.mjs';
import Video from 'lucide-react/dist/esm/icons/video.mjs';
import { useAudio, useAudioTime } from '../context/AudioContext';
import { useMusic } from '../context/MusicContext';
import { formatTime } from '../utils/lyrics';
import { ArtistLinks } from './ArtistLinks';

interface PlayerBarProps {
  onSelectArtist?: (artistName: string) => void;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({ onSelectArtist }) => {
  const {
    currentSong,
    isPlaying,
    isBuffering,
    playbackError,
    isVideoMode,
    videoUrl,
    openVideo,
    activeVersionLabel,
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
    isCenterLyricsOpen,
    setIsCenterLyricsOpen,
    isRightPanelOpen,
    setIsRightPanelOpen,
    rightPanelTab,
    setRightPanelTab,
    setIsFullscreenNowPlaying,
  } = useAudio();

  const { currentTime, duration } = useAudioTime();
  const { isFavorite, toggleFavorite, isDownloaded } = useMusic();
  const [isHoveringProgress, setIsHoveringProgress] = useState(false);

  if (!currentSong) {
    return (
      <footer className="h-20 bg-neutral-950 border-t border-neutral-900 flex items-center justify-between px-6 text-neutral-500 text-xs select-none">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-neutral-900 flex items-center justify-center">
            <Mic2 className="w-5 h-5 text-neutral-700" />
          </div>
          <span>Selecciona una canción para comenzar a escuchar...</span>
        </div>
      </footer>
    );
  }

  const liked = isFavorite(currentSong.id);
  const downloaded = isDownloaded(currentSong.id);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Toggle Lyrics in the center area
  const handleToggleLyrics = () => {
    setIsCenterLyricsOpen((prev) => !prev);
  };

  // Toggle Right Panel (Queue / Now Playing)
  const handleToggleQueue = () => {
    if (!isRightPanelOpen) {
      setIsRightPanelOpen(true);
      setRightPanelTab('queue');
    } else if (rightPanelTab === 'now-playing') {
      setRightPanelTab('queue');
    } else {
      setIsRightPanelOpen(false);
    }
  };

  const handleToggleNowPlaying = () => {
    if (!isRightPanelOpen) {
      setIsRightPanelOpen(true);
      setRightPanelTab('now-playing');
    } else if (rightPanelTab === 'queue') {
      setRightPanelTab('now-playing');
    } else {
      setIsRightPanelOpen(false);
    }
  };

  return (
    <footer className="h-22 bg-neutral-950/90 backdrop-blur-xl border-t border-neutral-900 px-4 md:px-6 flex items-center justify-between select-none z-40 relative isolate">
      {/* Ambient colour taken from the artwork, Spotify-style. */}
      {currentSong?.coverUrl && (
        <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none">
          <div
            className="absolute inset-0 bg-cover bg-center scale-150 blur-2xl opacity-30 saturate-150"
            style={{ backgroundImage: `url(${currentSong.coverUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/80 via-neutral-950/65 to-neutral-950/80" />
        </div>
      )}

      {playbackError && (
        <div className="absolute -top-11 left-1/2 -translate-x-1/2 max-w-[90vw] flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-950/95 border border-red-500/40 text-red-200 text-[11px] font-semibold shadow-xl">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="truncate">{playbackError}</span>
        </div>
      )}

      {/* Left: Track Info (Artwork, Title, Artist, Like / Check) */}
      <div className="flex items-center gap-3 w-1/4 min-w-[180px] max-w-[300px]">
        <div
          onClick={handleToggleNowPlaying}
          className="relative group cursor-pointer w-13 h-13 rounded-xl overflow-hidden shadow-md flex-shrink-0 bg-neutral-900"
          title="Ver carátula y detalles en el panel derecho"
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
          <div className="flex items-center gap-1.5">
            {currentSong.isExplicit && (
              <span
                className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-neutral-600/80 text-black text-[9px] font-black flex-shrink-0 select-none leading-none"
                title="Contenido explícito"
              >
                E
              </span>
            )}
            <span
              onClick={handleToggleNowPlaying}
              className="text-sm font-bold text-white hover:underline cursor-pointer truncate block"
            >
              {currentSong.title}
            </span>
            {downloaded && (
              <span title="Descargado en tu dispositivo">
                <DownloadedIcon size={14} />
              </span>
            )}
          </div>
          <span className="text-xs text-neutral-400 truncate block">
            <ArtistLinks artists={currentSong.artist} onSelectArtist={onSelectArtist} />
          </span>
        </div>

        {/* Favorite button (Spotify Style: green SavedCheckIcon when saved, subtle plus circle when not) */}
        <button
          onClick={() => toggleFavorite(currentSong.id)}
          className="p-1 rounded-full transition-transform active:scale-90 hover:scale-105 flex-shrink-0"
          title={liked ? 'Guardada en Tus me gusta (clic para quitar)' : 'Añadir a Tus me gusta'}
        >
          {liked ? (
            <SavedCheckIcon size={20} />
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              className="text-neutral-400 hover:text-white transition-colors"
            >
              <circle cx="12" cy="12" r="10.5" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M12 7.5v9M7.5 12h9"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Center: Main Playback Controls & Progress Bar (Spotify Style) */}
      <div className="flex flex-col items-center gap-1.5 flex-1 max-w-xl px-4">
        <div className="flex items-center gap-5">
          {/* Shuffle (Aleatorio) */}
          <button
            onClick={toggleShuffle}
            className={`transition-colors p-1 rounded-full relative ${
              isShuffle ? 'text-emerald-400' : 'text-neutral-400 hover:text-white'
            }`}
            title={isShuffle ? 'Desactivar aleatorio' : 'Activar aleatorio'}
          >
            <Shuffle className="w-4 h-4" />
            {isShuffle && (
              <span className="w-1 h-1 bg-emerald-400 rounded-full absolute -bottom-0.5 left-1/2 -translate-x-1/2" />
            )}
          </button>

          {/* Previous Track */}
          <button
            onClick={prevTrack}
            className="text-neutral-300 hover:text-white transition-transform active:scale-90 p-1"
            title="Anterior"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          {/* Play / Pause Circular Button */}
          <button
            onClick={togglePlayPause}
            className="w-10 h-10 rounded-full bg-white text-black hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg transition-transform"
            title={isBuffering ? 'Cargando canción...' : isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isBuffering ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          {/* Next Track */}
          <button
            onClick={nextTrack}
            className="text-neutral-300 hover:text-white transition-transform active:scale-90 p-1"
            title="Siguiente"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          {/* Repeat Button (Repetir todo / Repetir 1 / Desactivar) */}
          <button
            onClick={toggleRepeat}
            className={`transition-colors p-1 rounded-full relative ${
              repeatMode !== 'off' ? 'text-emerald-400' : 'text-neutral-400 hover:text-white'
            }`}
            title={`Repetición: ${repeatMode === 'one' ? 'Repitiendo esta canción' : repeatMode === 'all' ? 'Repitiendo todo' : 'Desactivada'}`}
          >
            {repeatMode === 'one' ? (
              <Repeat1 className="w-4 h-4" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
            {repeatMode !== 'off' && (
              <span className="w-1 h-1 bg-emerald-400 rounded-full absolute -bottom-0.5 left-1/2 -translate-x-1/2" />
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

      {/* Right: Auxiliary Controls (Lyrics in center, Queue, Volume, Fullscreen) */}
      <div className="flex items-center justify-end gap-2.5 w-1/4 min-w-[180px] max-w-[300px]">
        {/* Toggle Lyrics in Center View */}
        <button
          onClick={handleToggleLyrics}
          className={`p-2 rounded-xl transition-colors relative ${
            isCenterLyricsOpen
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
          title={isCenterLyricsOpen ? 'Ocultar letras' : 'Ver letras sincronizadas'}
        >
          <Mic2 className="w-4 h-4" />
          {isCenterLyricsOpen && (
            <span className="w-1 h-1 bg-emerald-400 rounded-full absolute bottom-1 left-1/2 -translate-x-1/2" />
          )}
        </button>

        {/* Toggle Queue / Now Playing Panel (Fila de reproducción) */}
        <button
          onClick={handleToggleQueue}
          className={`p-2 rounded-xl transition-colors relative ${
            isRightPanelOpen
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
          title="Fila de reproducción y vista actual"
        >
          <ListMusic className="w-4 h-4" />
          {isRightPanelOpen && (
            <span className="w-1 h-1 bg-emerald-400 rounded-full absolute bottom-1 left-1/2 -translate-x-1/2" />
          )}
        </button>

        {/* Volume Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleMute}
            className="text-neutral-400 hover:text-white transition-colors p-1"
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
            aria-label="Volumen"
            title="Volumen"
            className="w-18 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        {videoUrl && (
          <button
            onClick={openVideo}
            className={`p-2 rounded-xl transition-colors ${
              isVideoMode
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
            title="Ver videoclip"
          >
            <Video className="w-4 h-4" />
          </button>
        )}

        {/* Fullscreen Artwork Button (Pantalla Completa - Spotify Style) */}
        <button
          onClick={() => setIsFullscreenNowPlaying(true)}
          className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors hidden sm:block"
          title="Pantalla completa con carátula del artista"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </footer>
  );
};
