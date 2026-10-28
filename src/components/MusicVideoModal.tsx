import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Pause from 'lucide-react/dist/esm/icons/pause.mjs';
import SkipBack from 'lucide-react/dist/esm/icons/skip-back.mjs';
import SkipForward from 'lucide-react/dist/esm/icons/skip-forward.mjs';
import Shuffle from 'lucide-react/dist/esm/icons/shuffle.mjs';
import Repeat from 'lucide-react/dist/esm/icons/repeat.mjs';
import Repeat1 from 'lucide-react/dist/esm/icons/repeat-1.mjs';
import Volume2 from 'lucide-react/dist/esm/icons/volume-2.mjs';
import VolumeX from 'lucide-react/dist/esm/icons/volume-x.mjs';
import Music from 'lucide-react/dist/esm/icons/music.mjs';
import Video from 'lucide-react/dist/esm/icons/video.mjs';
import Minimize2 from 'lucide-react/dist/esm/icons/minimize-2.mjs';
import Subtitles from 'lucide-react/dist/esm/icons/subtitles.mjs';
import AlertCircle from 'lucide-react/dist/esm/icons/circle-alert.mjs';
import { useAudio, useAudioTime } from '../context/AudioContext';
import { useMusic } from '../context/MusicContext';
import { buildDisplayLyrics, formatTime } from '../utils/lyrics';
import { SavedCheckIcon } from './SavedCheckIcon';
import { ArtistLinks } from './ArtistLinks';
import { Album, Playlist } from '../types';

interface MusicVideoModalProps {
  onSelectArtist?: (artistName: string) => void;
  onSelectAlbum?: (album: Album) => void;
  onSelectPlaylist?: (playlist: Playlist | 'favorites' | Album) => void;
}

export const MusicVideoModal: React.FC<MusicVideoModalProps> = ({
  onSelectArtist,
  onSelectAlbum,
  onSelectPlaylist,
}) => {
  const {
    currentSong,
    isPlaying,
    isVideoMode,
    videoUrl,
    closeVideo,
    togglePlayPause,
    seek,
    nextTrack,
    prevTrack,
    repeatMode,
    toggleRepeat,
    isShuffle,
    toggleShuffle,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    playbackSource,
    setIsFullscreenNowPlaying,
    syncMediaTime,
    parsedLyrics,
    translatedLyrics,
    lyricsDisplayMode,
    playSong,
  } = useAudio();

  const { currentTime, duration, activeLyricIndex } = useAudioTime();
  const { recordListeningTime, isFavorite, toggleFavorite, catalog } = useMusic();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    if (videoRef.current && !el) {
      try {
        videoRef.current.pause();
        videoRef.current.muted = true;
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      } catch {}
    }
    videoRef.current = el;
  }, []);

  useEffect(() => {
    return () => {
      const v = videoRef.current;
      if (v) {
        try {
          v.pause();
          v.muted = true;
          v.removeAttribute('src');
          v.load();
        } catch {}
      }
    };
  }, []);
  const lastTrackedRef = useRef(0);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [videoError, setVideoError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showSubtitles, setShowSubtitles] = useState<boolean>(true);
  const [isHoveringProgress, setIsHoveringProgress] = useState<boolean>(false);
  const [needsUserUnmute, setNeedsUserUnmute] = useState<boolean>(false);

  const handleUnmute = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = false;
      video.volume = volume > 0 ? volume : 1;
      setNeedsUserUnmute(false);
      if (isMuted) {
        toggleMute();
      }
    }
  }, [volume, isMuted, toggleMute]);

  // Sync video time on mount / change
  useEffect(() => {
    lastTrackedRef.current = 0;
    setVideoError(null);
    setNeedsUserUnmute(false);
    const video = videoRef.current;
    if (video) {
      if (Math.abs(video.currentTime - currentTime) > 1) {
        try {
          video.currentTime = currentTime;
        } catch {
          // ignore
        }
      }

      // Explicitly set audio volume & muted state for Android / iOS
      video.muted = isMuted;
      video.volume = isMuted ? 0 : (volume ?? 1);

      if (isPlaying) {
        video.play().catch((err: unknown) => {
          console.warn('Playback with sound restricted by mobile browser, starting muted with banner:', err);
          // On mobile Android/iOS, if unmuted playback is restricted by autoplay policy,
          // play muted and surface an unmute banner so 1 touch turns on full audio
          video.muted = true;
          video.play().then(() => {
            setNeedsUserUnmute(true);
          }).catch(() => {});
        });
      } else {
        video.pause();
      }
    }
  }, [videoUrl, isVideoMode]);

  // Sync play / pause
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [isPlaying]);

  // Sync volume & mute
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = isMuted;
      video.volume = isMuted ? 0 : (volume ?? 1);
    }
  }, [volume, isMuted]);

  // Autohide controls on inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3500);
  };

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const displayLyrics = useMemo(
    () => buildDisplayLyrics(parsedLyrics, translatedLyrics, lyricsDisplayMode),
    [parsedLyrics, translatedLyrics, lyricsDisplayMode]
  );

  if (!currentSong || !videoUrl) return null;

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    syncMediaTime(video.currentTime);

    const watched = video.currentTime - lastTrackedRef.current;
    if (watched >= 10) {
      recordListeningTime(currentSong.id, currentSong.artist, Math.floor(watched));
      lastTrackedRef.current = video.currentTime;
    }
  };

  const handleSwitchToAudio = () => {
    const video = videoRef.current;
    const pos = video?.currentTime ?? currentTime;
    setIsFullscreenNowPlaying(false);
    closeVideo(pos);
  };

  const handleExitFullscreen = () => {
    setIsFullscreenNowPlaying(false);
  };

  const liked = isFavorite(currentSong.id);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const isBeforeFirstLyric = parsedLyrics.length > 0 && currentTime < parsedLyrics[0].time - 0.2;
  const isAfterLastLyric =
    parsedLyrics.length > 0 &&
    activeLyricIndex === parsedLyrics.length - 1 &&
    currentTime > parsedLyrics[activeLyricIndex].time + 7;
  const isInstrumentalGap =
    parsedLyrics.length > 0 &&
    activeLyricIndex >= 0 &&
    activeLyricIndex < parsedLyrics.length - 1 &&
    parsedLyrics[activeLyricIndex + 1].time - parsedLyrics[activeLyricIndex].time > 8 &&
    currentTime >
      parsedLyrics[activeLyricIndex].time +
        Math.min(
          7,
          parsedLyrics[activeLyricIndex + 1].time - parsedLyrics[activeLyricIndex].time - 2
        );

  const shouldShowSubtitle =
    showSubtitles &&
    !isBeforeFirstLyric &&
    !isAfterLastLyric &&
    !isInstrumentalGap &&
    activeLyricIndex >= 0 &&
    Boolean(displayLyrics[activeLyricIndex]?.text?.trim());

  const activeLyric = shouldShowSubtitle ? displayLyrics[activeLyricIndex] : null;

  const sourceName = playbackSource?.name || currentSong.album || 'CUARTO AZUL';

  const relatedVideos = catalog
    .filter((s) => Boolean(s.videoUrl) && s.id !== currentSong.id)
    .slice(0, 4);

  const subtitlePositionClass = !showControls
    ? 'bottom-8 sm:bottom-12'
    : relatedVideos.length > 0
    ? 'bottom-56 sm:bottom-60 md:bottom-64'
    : 'bottom-32 sm:bottom-36';

  return (
    <div
      onMouseMove={handleMouseMove}
      onTouchStart={handleMouseMove}
      className="music-video-modal-container fixed inset-0 z-[70] bg-black flex flex-col justify-between select-none overflow-hidden cursor-default animate-in fade-in duration-200"
    >
      {/* Background Video Element (Fills the viewport) */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        {videoError ? (
          <div className="max-w-md text-center space-y-3 p-8 rounded-3xl bg-neutral-900/90 border border-red-500/30 z-20">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
            <h3 className="text-lg font-black text-white">No se pudo reproducir el videoclip</h3>
            <p className="text-xs text-neutral-400">{videoError}</p>
            <button
              onClick={handleSwitchToAudio}
              className="mt-2 px-4 py-2 rounded-full bg-white text-black text-xs font-bold hover:bg-neutral-200 transition-colors"
            >
              Volver al audio
            </button>
          </div>
        ) : (
          <>
            <video
              ref={setVideoRef}
              src={videoUrl}
              poster={currentSong.coverUrl}
              autoPlay={isPlaying}
              playsInline
              preload="auto"
              onTimeUpdate={handleTimeUpdate}
              onError={() =>
                setVideoError(
                  'El navegador no pudo reproducir este archivo de video. Revisa el enlace o descárgalo para uso offline.'
                )
              }
              onEnded={() => handleSwitchToAudio()}
              onClick={() => {
                if (needsUserUnmute) {
                  handleUnmute();
                } else {
                  togglePlayPause();
                }
              }}
              className="w-full h-full object-contain cursor-pointer"
            />

            {/* Mobile Unmute Alert Pill if Autoplay started muted on Android/iOS */}
            {needsUserUnmute && (
              <button
                type="button"
                onClick={handleUnmute}
                className="absolute top-24 z-40 flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-emerald-500 text-black font-black text-xs md:text-sm shadow-2xl animate-bounce hover:scale-105 active:scale-95 transition-all"
              >
                <VolumeX className="w-4 h-4 md:w-5 md:h-5 text-black" />
                <span>Toca aquí para activar el sonido</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Top Bar (Spotify Image 5: CUARTO AZUL | Cambiar a audio | CC | Exit) */}
      <div
        className={`relative z-20 flex items-center justify-between px-6 md:px-10 py-5 bg-gradient-to-b from-black/85 via-black/40 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Context origin name (Spotify Image 5: "CUARTO AZUL") */}
        <div className="flex items-center gap-3 truncate">
          <span className="text-xs md:text-sm font-black uppercase tracking-widest text-white/90 drop-shadow">
            {sourceName}
          </span>
        </div>

        {/* Top actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSwitchToAudio}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 hover:bg-black/90 text-white text-xs font-bold border border-white/20 backdrop-blur-md transition-all active:scale-95 shadow-lg"
            title="Cambiar a audio"
          >
            <Music className="w-3.5 h-3.5 text-neutral-300" />
            <span>Cambiar a audio</span>
          </button>

          {/* Subtitles CC toggle button */}
          <button
            type="button"
            onClick={() => setShowSubtitles((prev) => !prev)}
            className={`p-2 md:px-3.5 md:py-2 rounded-full text-xs font-bold border backdrop-blur-md transition-all active:scale-95 flex items-center gap-1.5 shadow-lg ${
              showSubtitles
                ? 'bg-emerald-500 text-black border-emerald-400 font-black'
                : 'bg-black/60 text-white/80 border-white/20 hover:bg-black/90 hover:text-white'
            }`}
            title={showSubtitles ? 'Desactivar subtítulos de letras' : 'Activar subtítulos sincronizados'}
          >
            <Subtitles className="w-4 h-4" />
            <span className="hidden md:inline">Subtítulos</span>
          </button>

          <button
            type="button"
            onClick={handleExitFullscreen}
            className="p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 backdrop-blur-md transition-all active:scale-95 shadow-lg"
            title="Salir de pantalla completa"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Synchronized Subtitles (Positioned near bottom above controls, safely clear of related videos) */}
      <div
        className={`absolute left-0 right-0 z-30 pointer-events-none flex justify-center px-4 transition-all duration-300 ease-out ${subtitlePositionClass} ${
          activeLyric ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        {activeLyric && (
          <div className="max-w-2xl sm:max-w-3xl text-center px-5 py-2.5 rounded-2xl bg-black/80 backdrop-blur-md border border-white/10 shadow-2xl transition-all duration-200">
            <p className="text-white text-base sm:text-xl md:text-2xl font-black drop-shadow tracking-tight leading-snug">
              {activeLyric.text}
            </p>
            {activeLyric.translation && (
              <p className="text-emerald-300 text-xs sm:text-sm md:text-base font-semibold drop-shadow mt-1">
                {activeLyric.translation}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bottom Controls Bar (Spotify Image 5) */}
      <div
        className={`relative z-20 flex flex-col bg-gradient-to-t from-black/95 via-black/80 to-transparent pt-6 pb-6 px-6 md:px-10 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Related videos preview strip */}
        {relatedVideos.length > 0 && (
          <div className="mb-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-2">
              Videos musicales relacionados
            </span>
            <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
              {relatedVideos.map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    playSong(s, undefined, playbackSource || undefined);
                  }}
                  className="flex items-center gap-2 p-1.5 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-white/10 cursor-pointer flex-shrink-0 transition-transform active:scale-95 group"
                >
                  <div className="w-12 h-8 rounded-lg overflow-hidden bg-neutral-800 relative flex-shrink-0">
                    <img src={s.coverUrl} alt={s.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Play className="w-3 h-3 fill-white text-white" />
                    </div>
                  </div>
                  <div className="max-w-[120px] truncate text-left pr-1">
                    <p className="text-xs font-bold text-white truncate">{s.title}</p>
                    <p className="text-[10px] text-neutral-400 truncate">{s.artist}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress Bar & Timestamps */}
        <div className="w-full flex items-center gap-3 text-xs text-neutral-400 font-mono mb-3">
          <span className="w-10 text-right">{formatTime(currentTime)}</span>
          <div
            className="relative flex-1 flex items-center group cursor-pointer h-4"
            onMouseEnter={() => setIsHoveringProgress(true)}
            onMouseLeave={() => setIsHoveringProgress(false)}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              seek(percent * duration);
              if (videoRef.current) {
                videoRef.current.currentTime = percent * duration;
              }
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

        {/* Playback Controls Row (Left: Info, Center: Buttons, Right: Volume & Exit) */}
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          {/* Left: Track Info */}
          <div className="flex items-center gap-2.5 min-w-0 max-w-[140px] sm:max-w-none sm:w-1/4">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden bg-neutral-900 shadow-md flex-shrink-0">
              <img src={currentSong.coverUrl} alt={currentSong.title} className="w-full h-full object-cover" />
            </div>
            <div className="truncate min-w-0">
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-xs sm:text-sm font-bold text-white truncate block">{currentSong.title}</span>
              </div>
              <p className="text-[10px] sm:text-xs text-neutral-400 truncate">
                <ArtistLinks
                  artists={currentSong.artist}
                  onSelectArtist={(name) => {
                    handleExitFullscreen();
                    if (onSelectArtist) onSelectArtist(name);
                  }}
                />
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleFavorite(currentSong.id)}
              className="p-1 sm:p-1.5 rounded-full hover:scale-105 transition-transform flex-shrink-0 hidden xs:block"
              title={liked ? 'Guardada en Tus me gusta' : 'Añadir a Tus me gusta'}
            >
              {liked ? (
                <SavedCheckIcon size={20} />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-neutral-400 hover:text-white">
                  <circle cx="12" cy="12" r="10.5" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M12 7.5v9M7.5 12h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>

          {/* Center: Main Playback Controls */}
          <div className="flex items-center gap-2.5 sm:gap-5 justify-center flex-1 max-w-md">
            <button
              type="button"
              onClick={toggleShuffle}
              className={`p-1 transition-colors hidden sm:block ${
                isShuffle ? 'text-emerald-400' : 'text-neutral-400 hover:text-white'
              }`}
              title="Aleatorio"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={prevTrack}
              className="text-neutral-300 hover:text-white transition-transform active:scale-95 p-1"
              title="Anterior"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            <button
              type="button"
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

            <button
              type="button"
              onClick={nextTrack}
              className="text-neutral-300 hover:text-white transition-transform active:scale-95 p-1"
              title="Siguiente"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            <button
              type="button"
              onClick={toggleRepeat}
              className={`p-1 transition-colors hidden sm:block ${
                repeatMode !== 'off' ? 'text-emerald-400' : 'text-neutral-400 hover:text-white'
              }`}
              title="Repetición"
            >
              {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </button>
          </div>

          {/* Right: Volume & Fullscreen controls */}
          <div className="flex items-center justify-end gap-2 sm:gap-3 sm:w-1/4">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (needsUserUnmute) {
                    handleUnmute();
                  } else {
                    toggleMute();
                  }
                }}
                className={`p-1.5 rounded-full transition-colors ${
                  isMuted || needsUserUnmute
                    ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title={isMuted || needsUserUnmute ? 'Activar sonido' : 'Silenciar'}
              >
                {isMuted || volume === 0 || needsUserUnmute ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted || needsUserUnmute ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  if (needsUserUnmute) setNeedsUserUnmute(false);
                }}
                aria-label="Volumen"
                title="Volumen"
                className="w-20 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 hidden sm:block"
              />
            </div>

            <button
              type="button"
              onClick={handleExitFullscreen}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Salir de pantalla completa"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
