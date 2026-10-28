import React from 'react';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Pause from 'lucide-react/dist/esm/icons/pause.mjs';
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.mjs';
import Mic2 from 'lucide-react/dist/esm/icons/mic-vocal.mjs';
import Radio from 'lucide-react/dist/esm/icons/radio.mjs';
import Volume2 from 'lucide-react/dist/esm/icons/volume-2.mjs';
import { DownloadedIcon } from './DownloadedIcon';
import { SavedCheckIcon } from './SavedCheckIcon';
import { useAudio, useAudioTime } from '../context/AudioContext';
import { useMusic } from '../context/MusicContext';
import { useAuth } from '../context/AuthContext';
import { useConnect } from '../context/ConnectContext';
import { ArtistLinks } from './ArtistLinks';

interface MobilePlayerBarProps {
  onSelectArtist?: (artistName: string) => void;
}

export const MobilePlayerBar: React.FC<MobilePlayerBarProps> = ({ onSelectArtist }) => {
  const { currentUser } = useAuth();
  const {
    currentSong,
    isPlaying,
    isBuffering,
    togglePlayPause,
    setIsFullscreenNowPlaying,
    hasInstrumental,
    isKaraoke,
    toggleKaraoke,
  } = useAudio();
  const { currentTime, duration } = useAudioTime();
  const { isDownloaded, isFavorite, toggleFavorite } = useMusic();
  const { activeDevice, isCurrentDeviceActive, setIsConnectModalOpen } = useConnect();

  if (!currentSong) return null;

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const downloaded = isDownloaded(currentSong.id);
  const liked = isFavorite(currentSong.id);

  return (
    <div className="md:hidden px-2 pt-0 pb-1.5 bg-transparent flex-shrink-0 z-30 pointer-events-auto">
      <div
        onClick={() => setIsFullscreenNowPlaying(true)}
        className="mobile-player-bar relative overflow-hidden rounded-xl bg-[#242424] border border-[#282828] shadow-[0_8px_24px_rgba(0,0,0,0.6)] cursor-pointer select-none active:scale-[0.99] transition-transform"
        role="button"
        tabIndex={0}
        aria-label="Abrir reproductor a pantalla completa"
      >
        {/* Ambient subtle color tint from artwork */}
        {currentSong.coverUrl && (
          <div
            className="mobile-player-ambient-blur absolute inset-0 bg-cover bg-center scale-125 blur-2xl opacity-40 pointer-events-none"
            style={{ backgroundImage: `url(${currentSong.coverUrl})` }}
          />
        )}
        <div className="mobile-player-overlay absolute inset-0 bg-gradient-to-r from-[#242424]/95 via-[#242424]/85 to-[#242424]/95" />

        <div className="relative flex items-center gap-2.5 px-2.5 py-2">
          {/* Cover Art */}
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0 shadow-md border border-white/5">
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
          </div>

          {/* Track Title & Artist (Smooth scroll / truncate) */}
          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-1.5 min-w-0">
              {currentSong.isExplicit && (
                <span
                  className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-xs bg-neutral-600/90 text-white text-[9px] font-black flex-shrink-0 select-none leading-none"
                  title="Contenido explícito"
                >
                  E
                </span>
              )}
              <span className="truncate text-xs font-bold text-white block">{currentSong.title}</span>
              {downloaded && (
                <span title="Descargado" className="flex-shrink-0">
                  <DownloadedIcon size={12} />
                </span>
              )}
            </div>
            <span className="mobile-player-artist block truncate text-[10px] text-[#B3B3B3] mt-0.5 font-medium">
              <ArtistLinks artists={currentSong.artist} onSelectArtist={onSelectArtist} />
            </span>
          </div>

          {/* Controls: Karaoke button (if available), Like button, Play/Pause button */}
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* Karaoke Button for tracks with instrumental */}
            {hasInstrumental && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleKaraoke();
                }}
                className={`p-1.5 transition-all active:scale-90 ${
                  isKaraoke
                    ? 'text-[#1DB954] hover:text-[#1ed760]'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title={isKaraoke ? 'Desactivar modo karaoke' : 'Activar karaoke con voz eliminada'}
                aria-label={isKaraoke ? 'Desactivar modo karaoke' : 'Activar karaoke con voz eliminada'}
              >
                <Mic2 className={`w-4 h-4 ${isKaraoke ? 'stroke-[2.5]' : ''}`} />
              </button>
            )}


            {/* Sonora / Spotify Connect Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsConnectModalOpen(true);
              }}
              className={`p-1.5 transition-colors active:scale-90 relative ${
                !isCurrentDeviceActive ? 'text-emerald-400' : 'text-neutral-400 hover:text-white'
              }`}
              title="Dispositivos disponibles (Connect)"
              aria-label="Dispositivos disponibles"
            >
              <Radio className="w-4 h-4" />
              {!isCurrentDeviceActive && (
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full absolute top-1 right-1 animate-pulse" />
              )}
            </button>
            {/* Like button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(currentSong.id);
              }}
              className="p-1.5 transition-transform active:scale-90"
              title={liked ? 'Guardada en Tus me gusta' : 'Añadir a Tus me gusta'}
              aria-label={liked ? 'Guardada en Tus me gusta' : 'Añadir a Tus me gusta'}
            >
              {liked ? (
                <SavedCheckIcon size={19} filled={true} />
              ) : (
                <SavedCheckIcon size={19} filled={false} className="text-neutral-400 hover:text-white transition-colors" />
              )}
            </button>

            {/* Tactile Play/Pause button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              className="mobile-play-btn w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-lg active:scale-90 transition-transform"
              title={isBuffering ? 'Cargando...' : isPlaying ? 'Pausar' : 'Reproducir'}
              aria-label={isBuffering ? 'Cargando...' : isPlaying ? 'Pausar' : 'Reproducir'}
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
        </div>

        {/* Bottom Progress Track */}
        <div className="mobile-progress-track absolute bottom-0 left-0 right-0 h-[2px] bg-white/10">
          <div
            className="mobile-progress-fill h-full bg-[#1DB954] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
