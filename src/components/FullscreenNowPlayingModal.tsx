import React, { useEffect, useRef } from 'react';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Pause from 'lucide-react/dist/esm/icons/pause.mjs';
import SkipBack from 'lucide-react/dist/esm/icons/skip-back.mjs';
import SkipForward from 'lucide-react/dist/esm/icons/skip-forward.mjs';
import Shuffle from 'lucide-react/dist/esm/icons/shuffle.mjs';
import Repeat from 'lucide-react/dist/esm/icons/repeat.mjs';
import Repeat1 from 'lucide-react/dist/esm/icons/repeat-1.mjs';
import Heart from 'lucide-react/dist/esm/icons/heart.mjs';
import Star from 'lucide-react/dist/esm/icons/star.mjs';
import Volume2 from 'lucide-react/dist/esm/icons/volume-2.mjs';
import VolumeX from 'lucide-react/dist/esm/icons/volume-x.mjs';
import Video from 'lucide-react/dist/esm/icons/video.mjs';
import Mic2 from 'lucide-react/dist/esm/icons/mic-vocal.mjs';
import { useAudio, useAudioTime } from '../context/AudioContext';
import { useMusic } from '../context/MusicContext';
import { buildDisplayLyrics, formatTime } from '../utils/lyrics';
import { Album, Playlist } from '../types';
import { getAlbumsFromCatalog } from '../utils/albums';
import { ArtistLinks } from './ArtistLinks';
import { SongVersionSelector } from './SongVersionSelector';
import { LyricsTranslationButton } from './LyricsTranslationButton';

interface FullscreenNowPlayingModalProps {
  onSelectArtist?: (artistName: string) => void;
  onSelectAlbum?: (album: Album) => void;
  onSelectPlaylist?: (playlist: Playlist | 'favorites' | Album) => void;
}

export const FullscreenNowPlayingModal: React.FC<FullscreenNowPlayingModalProps> = ({
  onSelectArtist,
  onSelectAlbum,
  onSelectPlaylist,
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
    volume,
    setVolume,
    isMuted,
    toggleMute,
    playbackSource,
    isFullscreenNowPlaying,
    setIsFullscreenNowPlaying,
    parsedLyrics,
    translatedLyrics,
    lyricsDisplayMode,
    activeVersionLabel,
    videoUrl,
    openVideo,
  } = useAudio();
  const { currentTime, duration, activeLyricIndex } = useAudioTime();
  const displayLyrics = buildDisplayLyrics(parsedLyrics, translatedLyrics, lyricsDisplayMode);

  const { isFavorite, toggleFavorite, catalog, playlists } = useMusic();

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const lyricsScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to active lyric smoothly like Apple Music without shifting parent layout
  useEffect(() => {
    if (activeLyricIndex < 0) return;
    if (activeLineRef.current && lyricsScrollRef.current) {
      const container = lyricsScrollRef.current;
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

  if (!isFullscreenNowPlaying || !currentSong) return null;

  const handleOriginClick = () => {
    setIsFullscreenNowPlaying(false);
    const sourceName = playbackSource?.name;

    if (
      playbackSource?.type === 'favorites' ||
      sourceName?.toLowerCase() === 'tus me gusta'
    ) {
      if (onSelectPlaylist) {
        onSelectPlaylist('favorites');
        return;
      }
    }

    const matchingPlaylist = playlists.find(
      (p) =>
        (playbackSource?.id && p.id === playbackSource.id) ||
        (sourceName && p.name.trim().toLowerCase() === sourceName.trim().toLowerCase())
    );
    if (matchingPlaylist && onSelectPlaylist) {
      onSelectPlaylist(matchingPlaylist);
      return;
    }

    const targetAlbumName =
      (playbackSource?.type === 'album' && sourceName ? sourceName : null) ||
      currentSong?.album;

    if (targetAlbumName && targetAlbumName.trim().toLowerCase() !== 'sencillo') {
      const albums = getAlbumsFromCatalog(catalog);
      const foundAlbum = albums.find(
        (a) => a.name.trim().toLowerCase() === targetAlbumName.trim().toLowerCase()
      );
      if (foundAlbum) {
        if (onSelectAlbum) {
          onSelectAlbum(foundAlbum);
          return;
        } else if (onSelectPlaylist) {
          onSelectPlaylist(foundAlbum);
          return;
        }
      } else {
        const matchingSongs = catalog.filter(
          (s) => s.album && s.album.trim().toLowerCase() === targetAlbumName.trim().toLowerCase()
        );
        const albumObj: Album = {
          name: targetAlbumName,
          artist: currentSong?.albumArtist || currentSong?.artist || '',
          coverUrl: currentSong?.coverUrl || '',
          year: currentSong?.year,
          genre: currentSong?.genre,
          songs: matchingSongs.length > 0 ? matchingSongs : currentSong ? [currentSong] : [],
        };
        if (onSelectAlbum) {
          onSelectAlbum(albumObj);
          return;
        } else if (onSelectPlaylist) {
          onSelectPlaylist(albumObj);
          return;
        }
      }
    }

    if (playbackSource?.type === 'artist' || (sourceName && /^artista:/i.test(sourceName))) {
      const artistName =
        playbackSource?.id || sourceName?.replace(/^artista:\s*/i, '').trim() || currentSong?.artist;
      if (artistName && onSelectArtist) {
        onSelectArtist(artistName);
        return;
      }
    }
  };

  const liked = isFavorite(currentSong.id);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const remainingTime = Math.max(0, duration - currentTime);

  return (
    <div className="fullscreen-now-playing-container fixed inset-0 z-50 bg-black flex flex-col justify-between select-none overflow-hidden animate-in fade-in duration-300">
      {/* Dynamic Animated Ambient Mesh Background (Takes album artwork colors) */}
      <div
        className="absolute inset-0 bg-cover bg-center filter blur-3xl scale-150 opacity-55 saturate-150 pointer-events-none transition-all duration-1000 transform motion-safe:animate-pulse"
        style={{ backgroundImage: `url(${currentSong.coverUrl})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_0%,rgba(0,0,0,0.4)_60%,rgba(0,0,0,0.85)_100%)] pointer-events-none" />

      {/* Top Bar with Discreet Close Button & Origin */}
      <div className="relative z-20 flex items-center justify-between px-6 md:px-12 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsFullscreenNowPlaying(false)}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all active:scale-95 shadow-md backdrop-blur-md"
            title="Cerrar pantalla completa"
          >
            <X className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={handleOriginClick}
            className="text-xs md:text-sm font-black uppercase tracking-wider text-white/70 hover:text-white hover:underline truncate transition-colors cursor-pointer"
            title={`Ir a ${playbackSource?.name || 'Tus me gusta'}`}
          >
            {playbackSource?.name || 'Tus me gusta'}
          </button>
        </div>

        {/* Video Clip Shortcut (if available) */}
        {videoUrl && (
          <button
            type="button"
            onClick={() => {
              openVideo();
              setIsFullscreenNowPlaying(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold transition-all backdrop-blur-md"
            title="Ver videoclip"
          >
            <Video className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Videoclip</span>
          </button>
        )}
      </div>

      {/* Main Two-Column Container (Apple Music Layout) */}
      <div className="relative z-10 flex-1 grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-14 px-6 md:px-12 lg:px-20 max-w-7xl mx-auto w-full items-center min-h-0 py-4 overflow-hidden">
        {/* LEFT COLUMN: Cover Art + Info + Player Controls */}
        <div className="md:col-span-5 lg:col-span-5 flex flex-col justify-center space-y-5 max-w-md mx-auto md:mx-0 w-full min-h-0">
          {/* High-res Album Cover */}
          <div className="w-56 h-56 sm:w-72 sm:h-72 lg:w-88 lg:h-88 aspect-square rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl shadow-black/80 ring-1 ring-white/15 mx-auto md:mx-0 flex-shrink-0 transition-transform duration-500">
            <img
              src={currentSong.coverUrl}
              alt={currentSong.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Song Info */}
          <div className="space-y-1 text-left">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight truncate">
                {currentSong.title}
              </h1>
              <button
                type="button"
                onClick={() => toggleFavorite(currentSong.id)}
                className={`p-2 rounded-full hover:bg-white/10 transition-colors flex-shrink-0 ${
                  liked ? 'text-amber-400' : 'text-white/50 hover:text-white'
                }`}
                title={liked ? 'En favoritos' : 'Añadir a favoritos'}
              >
                <Star className={`w-5 h-5 ${liked ? 'fill-amber-400' : ''}`} />
              </button>
            </div>

            <p className="text-sm sm:text-base text-white/70 font-semibold truncate">
              <ArtistLinks
                artists={currentSong.artist}
                onSelectArtist={(name) => {
                  setIsFullscreenNowPlaying(false);
                  if (onSelectArtist) onSelectArtist(name);
                }}
              />
              {currentSong.album && (
                <span className="text-white/50"> — {currentSong.album}</span>
              )}
            </p>

            <div className="pt-1">
              <SongVersionSelector compact />
            </div>
          </div>

          {/* Progress Timeline Slider (Apple Music style) */}
          <div className="space-y-1.5">
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                seek(percent * duration);
              }}
              className="w-full h-1.5 bg-white/20 hover:h-2 rounded-full overflow-hidden cursor-pointer transition-all group"
            >
              <div
                className="h-full bg-white group-hover:bg-emerald-400 transition-all rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-white/60">
              <span>{formatTime(currentTime)}</span>
              <span>-{formatTime(remainingTime)}</span>
            </div>
          </div>

          {/* Player Buttons (Apple Music style) */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={toggleShuffle}
              className={`p-2 rounded-full transition-colors ${
                isShuffle ? 'text-emerald-400' : 'text-white/50 hover:text-white'
              }`}
              title="Aleatorio"
            >
              <Shuffle className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={prevTrack}
              className="text-white hover:scale-105 active:scale-95 transition-transform p-2"
              title="Anterior"
            >
              <SkipBack className="w-6 h-6 fill-current" />
            </button>

            <button
              type="button"
              onClick={togglePlayPause}
              className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 shadow-xl transition-transform"
              title={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 fill-current" />
              ) : (
                <Play className="w-7 h-7 fill-current ml-1" />
              )}
            </button>

            <button
              type="button"
              onClick={nextTrack}
              className="text-white hover:scale-105 active:scale-95 transition-transform p-2"
              title="Siguiente"
            >
              <SkipForward className="w-6 h-6 fill-current" />
            </button>

            <button
              type="button"
              onClick={toggleRepeat}
              className={`p-2 rounded-full transition-colors ${
                repeatMode !== 'off' ? 'text-emerald-400' : 'text-white/50 hover:text-white'
              }`}
              title="Repetir"
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-5 h-5" />
              ) : (
                <Repeat className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Volume Control Bar */}
          <div className="flex items-center gap-3 pt-1 text-white/60">
            <button
              type="button"
              onClick={toggleMute}
              className="hover:text-white transition-colors"
              title={isMuted ? 'Activar sonido' : 'Silenciar'}
            >
              {isMuted || volume === 0 ? (
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
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                if (isMuted) toggleMute();
                setVolume(Number(e.target.value));
              }}
              className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white hover:accent-emerald-400"
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Full Synced Lyrics Scroll (Apple Music Style) */}
        <div
          ref={lyricsScrollRef}
          className="md:col-span-7 lg:col-span-7 h-full max-h-[70vh] md:max-h-[82vh] overflow-y-auto px-2 md:px-6 py-12 space-y-7 text-left scroll-smooth min-h-0"
        >
          {parsedLyrics.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
              <Mic2 className="w-12 h-12 text-white/30" />
              <h3 className="text-xl font-bold text-white">Letra no disponible</h3>
              <p className="text-xs text-white/50 max-w-sm">
                No hay letra sincronizada disponible para esta canción.
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
                  className={`cursor-pointer transition-all duration-300 transform group py-1.5 ${
                    isActive
                      ? 'text-white text-2xl sm:text-3xl lg:text-4xl font-black scale-102 filter drop-shadow-md'
                      : isPast
                      ? 'text-white/35 hover:text-white/80 text-lg sm:text-xl lg:text-2xl font-bold'
                      : 'text-white/25 hover:text-white/80 text-lg sm:text-xl lg:text-2xl font-bold'
                  }`}
                >
                  <p className="leading-tight transition-transform group-hover:translate-x-1.5">
                    {line.text || '♪'}
                  </p>
                  {line.translation && (
                    <p
                      className={`mt-1.5 leading-snug font-semibold transition-colors ${
                        isActive
                          ? 'text-white/90 text-sm sm:text-base lg:text-lg'
                          : 'text-white/40 text-xs sm:text-sm lg:text-base'
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

      {/* Bottom Floating Bar: Subtle Translation Control (Google Translate Icon A - 文) */}
      <div className="relative z-20 flex items-center justify-end px-6 md:px-12 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 flex-shrink-0">
        {parsedLyrics.length > 0 && (
          <LyricsTranslationButton dropDirection="up" />
        )}
      </div>
    </div>
  );
};
