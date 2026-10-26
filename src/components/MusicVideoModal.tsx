import React, { useEffect, useRef, useState } from 'react';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Video from 'lucide-react/dist/esm/icons/video.mjs';
import AlertCircle from 'lucide-react/dist/esm/icons/circle-alert.mjs';
import { useAudio } from '../context/AudioContext';
import { useMusic } from '../context/MusicContext';

export const MusicVideoModal: React.FC = () => {
  const {
    currentSong,
    activeVersionLabel,
    isVideoMode,
    videoUrl,
    closeVideo,
  } = useAudio();
  const { recordListeningTime } = useMusic();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastTrackedRef = useRef(0);
  const [videoError, setVideoError] = useState<string | null>(null);

  useEffect(() => {
    lastTrackedRef.current = 0;
    setVideoError(null);
  }, [videoUrl, isVideoMode]);

  if (!isVideoMode || !currentSong || !videoUrl) return null;

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const watched = video.currentTime - lastTrackedRef.current;
    if (watched >= 10) {
      recordListeningTime(
        currentSong.id,
        currentSong.artist,
        Math.floor(watched)
      );
      lastTrackedRef.current = video.currentTime;
    }
  };

  const handleClose = () => {
    const video = videoRef.current;
    if (video) {
      const watched = video.currentTime - lastTrackedRef.current;
      if (watched >= 1) {
        recordListeningTime(
          currentSong.id,
          currentSong.artist,
          Math.floor(watched)
        );
      }
    }
    closeVideo(video?.currentTime);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl flex flex-col select-none animate-in fade-in duration-200">
      <header className="flex items-center justify-between px-4 md:px-8 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-neutral-900 flex-shrink-0">
            <img
              src={currentSong.coverUrl}
              alt={currentSong.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="truncate">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400">
              <Video className="w-3.5 h-3.5" />
              Videoclip
              {activeVersionLabel !== 'Original' && (
                <span className="text-neutral-500">· {activeVersionLabel}</span>
              )}
            </p>
            <h2 className="text-sm md:text-base font-bold text-white truncate">
              {currentSong.title} — {currentSong.artist}
            </h2>
          </div>
        </div>

        <button
          onClick={handleClose}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
          title="Volver al audio"
        >
          <X className="w-4 h-4" />
          <span>Volver al audio</span>
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center p-3 md:p-8 min-h-0">
        {videoError ? (
          <div className="max-w-md text-center space-y-3 p-8 rounded-3xl bg-neutral-900 border border-red-500/30">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
            <h3 className="text-lg font-black text-white">No se pudo cargar el videoclip</h3>
            <p className="text-xs text-neutral-400">{videoError}</p>
            <p className="text-[11px] text-neutral-500">
              El enlace debe ser un archivo de video directo (MP4 o WebM). Los enlaces de
              YouTube/Spotify no se pueden reproducir aquí.
            </p>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={videoUrl}
            poster={currentSong.coverUrl}
            controls
            autoPlay
            playsInline
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onError={() =>
              setVideoError(
                'El navegador no pudo reproducir este archivo. Revisa que sea MP4/WebM y que el servidor permita streaming.'
              )
            }
            onEnded={() => closeVideo(videoRef.current?.currentTime)}
            className="max-h-full max-w-full w-auto h-auto rounded-2xl shadow-2xl bg-black"
          >
            Tu navegador no soporta video HTML5.
          </video>
        )}
      </div>

      <footer className="px-6 py-3 text-center text-[11px] text-neutral-500 border-t border-white/5 flex-shrink-0">
        Reproducción directa desde la fuente externa · sin anuncios ni reproductores incrustados
      </footer>
    </div>
  );
};
