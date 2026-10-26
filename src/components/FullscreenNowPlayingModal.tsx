import React from 'react';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Pause from 'lucide-react/dist/esm/icons/pause.mjs';
import SkipBack from 'lucide-react/dist/esm/icons/skip-back.mjs';
import SkipForward from 'lucide-react/dist/esm/icons/skip-forward.mjs';
import Shuffle from 'lucide-react/dist/esm/icons/shuffle.mjs';
import Repeat from 'lucide-react/dist/esm/icons/repeat.mjs';
import Repeat1 from 'lucide-react/dist/esm/icons/repeat-1.mjs';
import Minimize2 from 'lucide-react/dist/esm/icons/minimize-2.mjs';
import Heart from 'lucide-react/dist/esm/icons/heart.mjs';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.mjs';
import Mic2 from 'lucide-react/dist/esm/icons/mic-vocal.mjs';
import { useAudio, useAudioTime } from '../context/AudioContext';
import { useMusic } from '../context/MusicContext';
import { formatTime } from '../utils/lyrics';
import { ArtistLinks } from './ArtistLinks';

interface FullscreenNowPlayingModalProps {
  onSelectArtist?: (artistName: string) => void;
}

export const FullscreenNowPlayingModal: React.FC<FullscreenNowPlayingModalProps> = ({
  onSelectArtist,
}) => {
  const {
    currentSong,
    isPlaying,
    repeatMode,
    isShuffle,
    togglePlayPause,
    seek,
    nextTrack,
    prevTrack,
    toggleRepeat,
    toggleShuffle,
    playbackSource,
    isFullscreenNowPlaying,
    setIsFullscreenNowPlaying,
    parsedLyrics,
    setIsCenterLyricsOpen,
  } = useAudio();
  const { currentTime, duration, activeLyricIndex } = useAudioTime();

  const { isFavorite, toggleFavorite } = useMusic();

  if (!isFullscreenNowPlaying || !currentSong) return null;

  const liked = isFavorite(currentSong.id);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const currentLine = parsedLyrics[activeLyricIndex];

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-8 md:p-14 select-none overflow-hidden animate-in fade-in duration-300">
      {/* Blurred artwork background */}
      <div
        className="absolute inset-0 bg-cover bg-center filter blur-3xl scale-125 opacity-25 pointer-events-none transition-all duration-1000"
        style={{ backgroundImage: `url(${currentSong.coverUrl})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/40 pointer-events-none" />

      {/* Top Header */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-black uppercase tracking-widest text-emerald-400">
            {playbackSource?.name || 'Tus me gusta'}
          </span>
        </div>

        <button
          onClick={() => setIsFullscreenNowPlaying(false)}
          className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
          title="Salir de pantalla completa"
        >
          <Minimize2 className="w-5 h-5" />
        </button>
      </div>

      {/* Center Section: Cover + Live lyric line */}
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-10 max-w-5xl mx-auto w-full my-auto">
        <div className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-3xl overflow-hidden shadow-2xl shadow-emerald-500/15 ring-1 ring-white/10 flex-shrink-0">
          <img
            src={currentSong.coverUrl}
            alt={currentSong.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 space-y-6 text-center md:text-left max-w-lg">
          <div>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
              {currentSong.title}
            </h1>
            <p className="text-lg md:text-xl text-neutral-400 font-medium mt-1">
              <ArtistLinks
                artists={currentSong.artist}
                onSelectArtist={(name) => {
                  setIsFullscreenNowPlaying(false);
                  if (onSelectArtist) onSelectArtist(name);
                }}
              />
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">
              {currentSong.album} • {currentSong.year || '2026'}
            </p>
          </div>

          {/* Current Live Lyric Snippet */}
          {currentLine && (
            <div
              onClick={() => {
                setIsFullscreenNowPlaying(false);
                setIsCenterLyricsOpen(true);
              }}
              className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md cursor-pointer hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1">
                <Mic2 className="w-3.5 h-3.5" />
                <span>Letra en vivo</span>
              </div>
              <p className="text-xl md:text-2xl font-black text-white leading-snug">
                {currentLine.text}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="relative z-10 max-w-3xl mx-auto w-full space-y-4">
        {/* Progress Bar */}
        <div className="flex items-center gap-3 text-xs font-mono text-neutral-400">
          <span>{formatTime(currentTime)}</span>
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              seek(percent * duration);
            }}
            className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden cursor-pointer"
          >
            <div
              className="h-full bg-emerald-400 transition-all rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => toggleFavorite(currentSong.id)}
            className={`p-3 rounded-full transition-all ${liked ? 'text-emerald-400' : 'text-neutral-400 hover:text-white'}`}
          >
            <Heart className={`w-6 h-6 ${liked ? 'fill-emerald-400' : ''}`} />
          </button>

          <div className="flex items-center gap-6">
            <button
              onClick={toggleShuffle}
              className={`p-2 rounded-full transition-colors ${isShuffle ? 'text-emerald-400' : 'text-neutral-400 hover:text-white'}`}
            >
              <Shuffle className="w-5 h-5" />
            </button>
            <button
              onClick={prevTrack}
              className="text-white hover:scale-105 active:scale-95 transition-transform"
            >
              <SkipBack className="w-7 h-7 fill-current" />
            </button>
            <button
              onClick={togglePlayPause}
              className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 shadow-xl transition-transform"
            >
              {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
            </button>
            <button
              onClick={nextTrack}
              className="text-white hover:scale-105 active:scale-95 transition-transform"
            >
              <SkipForward className="w-7 h-7 fill-current" />
            </button>
            <button
              onClick={toggleRepeat}
              className={`p-2 rounded-full transition-colors relative ${repeatMode !== 'off' ? 'text-emerald-400' : 'text-neutral-400 hover:text-white'}`}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
            </button>
          </div>

          <button
            onClick={() => {
              setIsFullscreenNowPlaying(false);
              setIsCenterLyricsOpen(true);
            }}
            className="p-3 rounded-full text-neutral-400 hover:text-white transition-colors"
            title="Ver letras"
          >
            <Mic2 className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
