import React from 'react';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Pause from 'lucide-react/dist/esm/icons/pause.mjs';
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.mjs';
import { DownloadedIcon } from './DownloadedIcon';
import { useAudio, useAudioTime } from '../context/AudioContext';
import { useMusic } from '../context/MusicContext';
import { ArtistLinks } from './ArtistLinks';

interface MobilePlayerBarProps {
  onSelectArtist?: (artistName: string) => void;
}

export const MobilePlayerBar: React.FC<MobilePlayerBarProps> = ({ onSelectArtist }) => {
  const {
    currentSong,
    isPlaying,
    isBuffering,
    togglePlayPause,
    setIsFullscreenNowPlaying,
  } = useAudio();
  const { currentTime, duration } = useAudioTime();
  const { isDownloaded } = useMusic();

  if (!currentSong) return null;

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const downloaded = isDownloaded(currentSong.id);

  return (
    <div className="md:hidden relative flex-shrink-0 overflow-hidden border-t border-white/10 bg-neutral-950">
      {currentSong.coverUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center scale-125 blur-2xl opacity-70"
          style={{ backgroundImage: `url(${currentSong.coverUrl})` }}
        />
      )}
      <div className="absolute inset-0 bg-black/55" />

      <div className="relative flex items-center gap-3 px-3 py-2.5">
        <button
          onClick={() => setIsFullscreenNowPlaying(true)}
          className="w-11 h-11 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0 shadow-lg"
          title="Abrir reproductor"
        >
          {currentSong.coverUrl ? (
            <img
              src={currentSong.coverUrl}
              alt={currentSong.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-neutral-500 text-xs">
              ♪
            </span>
          )}
        </button>

        <button
          onClick={() => setIsFullscreenNowPlaying(true)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate text-xs font-bold text-white">{currentSong.title}</span>
            {downloaded && (
              <span title="Descargado" className="flex-shrink-0">
                <DownloadedIcon size={14} />
              </span>
            )}
          </div>
          <span className="block truncate text-[10px] text-white/70 mt-0.5">
            <ArtistLinks artists={currentSong.artist} onSelectArtist={onSelectArtist} />
          </span>
        </button>

        <button
          onClick={togglePlayPause}
          className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center flex-shrink-0 shadow-lg active:scale-95 transition-transform"
          title={isBuffering ? 'Cargando...' : isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {isBuffering ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/15">
        <div
          className="h-full bg-white/85 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
