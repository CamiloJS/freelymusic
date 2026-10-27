import React, { useEffect, useRef, useState, useMemo } from 'react';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.mjs';
import MoreHorizontal from 'lucide-react/dist/esm/icons/ellipsis.mjs';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Pause from 'lucide-react/dist/esm/icons/pause.mjs';
import SkipBack from 'lucide-react/dist/esm/icons/skip-back.mjs';
import SkipForward from 'lucide-react/dist/esm/icons/skip-forward.mjs';
import Shuffle from 'lucide-react/dist/esm/icons/shuffle.mjs';
import Repeat from 'lucide-react/dist/esm/icons/repeat.mjs';
import Repeat1 from 'lucide-react/dist/esm/icons/repeat-1.mjs';
import Volume2 from 'lucide-react/dist/esm/icons/volume-2.mjs';
import VolumeX from 'lucide-react/dist/esm/icons/volume-x.mjs';
import Share2 from 'lucide-react/dist/esm/icons/share-2.mjs';
import ListMusic from 'lucide-react/dist/esm/icons/list-music.mjs';
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2.mjs';
import Mic2 from 'lucide-react/dist/esm/icons/mic-vocal.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Moon from 'lucide-react/dist/esm/icons/moon.mjs';
import QrCode from 'lucide-react/dist/esm/icons/qr-code.mjs';
import PlusCircle from 'lucide-react/dist/esm/icons/circle-plus.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import Disc from 'lucide-react/dist/esm/icons/disc.mjs';
import UserRound from 'lucide-react/dist/esm/icons/user-round.mjs';
import Heart from 'lucide-react/dist/esm/icons/heart.mjs';
import { useAudio, useAudioTime, type PlaybackSource } from '../context/AudioContext';
import { useMusic } from '../context/MusicContext';
import { buildDisplayLyrics, formatTime } from '../utils/lyrics';
import { Album, Playlist, Song } from '../types';
import { getAlbumsFromCatalog } from '../utils/albums';
import { ArtistLinks } from './ArtistLinks';
import { SongVersionSelector } from './SongVersionSelector';
import { LyricsTranslationButton } from './LyricsTranslationButton';
import { SavedCheckIcon } from './SavedCheckIcon';
import { SpotifyCode } from './SpotifyCode';
import { SpotifyCodeModal } from './SpotifyCodeModal';
import { useArtworkColor } from '../utils/dominantColor';

interface FullscreenNowPlayingModalProps {
  onSelectArtist?: (artistName: string) => void;
  onSelectAlbum?: (album: Album) => void;
  onSelectPlaylist?: (playlist: Playlist | 'favorites' | Album) => void;
  onOpenAddToPlaylist?: (song: Song) => void;
  onNavigateSearch?: () => void;
}

export const FullscreenNowPlayingModal: React.FC<FullscreenNowPlayingModalProps> = ({
  onSelectArtist,
  onSelectAlbum,
  onSelectPlaylist,
  onOpenAddToPlaylist,
  onNavigateSearch,
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
    videoUrl,
    openVideo,
    setIsRightPanelOpen,
    setRightPanelTab,
    sleepTimerOption,
    sleepTimerRemainingSeconds,
    setSleepTimer,
    hasInstrumental,
    isKaraoke,
    toggleKaraoke,
  } = useAudio();
  const { currentTime, duration, activeLyricIndex } = useAudioTime();

  // Mobile state for full-screen lyrics expansion & Spotify menus
  const [isLyricsExpanded, setIsLyricsExpanded] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showSleepTimerSheet, setShowSleepTimerSheet] = useState(false);
  const [showSpotifyCodeModal, setShowSpotifyCodeModal] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [sleepTimerFeedback, setSleepTimerFeedback] = useState<string | null>(null);

  // Dynamic dominant color extraction from current song artwork
  const { lyricsCardGradient, gradient } = useArtworkColor(
    currentSong?.coverUrl,
    currentSong?.title
  );

  const displayLyrics = useMemo(
    () => buildDisplayLyrics(parsedLyrics, translatedLyrics, lyricsDisplayMode),
    [parsedLyrics, translatedLyrics, lyricsDisplayMode]
  );

  const { isFavorite, toggleFavorite, catalog, playlists } = useMusic();

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const lyricsScrollRef = useRef<HTMLDivElement | null>(null);
  const desktopLyricsScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to active lyric smoothly like Spotify / Apple Music
  useEffect(() => {
    if (activeLyricIndex < 0) return;
    const activeEl = activeLineRef.current;
    if (!activeEl) return;

    const scrollInContainer = (container: HTMLDivElement | null) => {
      if (!container) return;
      const containerHeight = container.clientHeight;
      const activeTop = activeEl.offsetTop;
      const activeHeight = activeEl.clientHeight;
      const targetScroll = activeTop - containerHeight / 2 + activeHeight / 2;
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    };

    scrollInContainer(lyricsScrollRef.current);
    scrollInContainer(desktopLyricsScrollRef.current);
  }, [activeLyricIndex]);

  const albums = useMemo(() => getAlbumsFromCatalog(catalog), [catalog]);

  const validatedSource = useMemo((): PlaybackSource | null => {
    if (!currentSong || !playbackSource) return null;
    if (playbackSource.type === 'album') {
      const alb = currentSong.album?.trim().toLowerCase();
      const src = playbackSource.name?.trim().toLowerCase();
      if (alb && src && alb !== src) {
        return alb !== 'sencillo' ? { type: 'album', name: currentSong.album.trim() } : null;
      }
    }
    return playbackSource;
  }, [playbackSource, currentSong]);

  const sourceSubtitle = useMemo(() => {
    if (validatedSource?.type === 'playlist') return 'DE LA PLAYLIST';
    if (validatedSource?.type === 'album') return 'DEL ÁLBUM';
    if (validatedSource?.type === 'artist') return 'DEL ARTISTA';
    if (validatedSource?.type === 'favorites') return 'DE TUS ME GUSTA';
    if (validatedSource?.type === 'search') return 'DE LA BÚSQUEDA';
    return 'REPRODUCIENDO';
  }, [validatedSource]);

  const sourceTitle = useMemo(() => {
    if (validatedSource?.type === 'search' || validatedSource?.name?.startsWith('Buscar "')) {
      return validatedSource.name;
    }
    if (validatedSource?.name) return validatedSource.name;
    if (currentSong?.album && currentSong.album.toLowerCase() !== 'sencillo') {
      return currentSong.album;
    }
    return 'Tus me gusta';
  }, [validatedSource, currentSong]);

  if (!isFullscreenNowPlaying || !currentSong) return null;

  const handleOriginClick = () => {
    setIsFullscreenNowPlaying(false);
    const sourceName = validatedSource?.name;

    if (validatedSource?.type === 'search' || sourceName?.startsWith('Buscar "')) {
      if (onNavigateSearch) {
        onNavigateSearch();
        return;
      }
    }

    if (
      validatedSource?.type === 'favorites' ||
      sourceName?.toLowerCase() === 'tus me gusta'
    ) {
      if (onSelectPlaylist) {
        onSelectPlaylist('favorites');
        return;
      }
    }

    const matchingPlaylist = playlists.find(
      (p) =>
        (validatedSource?.id && p.id === validatedSource.id) ||
        (sourceName && p.name.trim().toLowerCase() === sourceName.trim().toLowerCase())
    );
    if (matchingPlaylist && onSelectPlaylist) {
      onSelectPlaylist(matchingPlaylist);
      return;
    }

    const targetAlbumName =
      (validatedSource?.type === 'album' && sourceName ? sourceName : null) ||
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

    if (validatedSource?.type === 'artist' || (sourceName && /^artista:/i.test(sourceName))) {
      const artistName =
        validatedSource?.id || sourceName?.replace(/^artista:\s*/i, '').trim() || currentSong?.artist;
      if (artistName && onSelectArtist) {
        onSelectArtist(artistName);
        return;
      }
    }
  };

  const handleShare = async () => {
    const text = `Escuchando ${currentSong.title} de ${currentSong.artist} en Sonora`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: currentSong.title,
          text,
          url: window.location.href,
        });
        return;
      } catch {
        // ignore share cancellation
      }
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleOpenQueue = () => {
    setIsFullscreenNowPlaying(false);
    setIsRightPanelOpen(true);
    setRightPanelTab('queue');
  };

  const liked = isFavorite(currentSong.id);
  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="fullscreen-now-playing-container fixed inset-0 z-50 bg-[#121212] flex flex-col justify-between select-none overflow-y-auto overflow-x-hidden text-white font-sans antialiased animate-in fade-in duration-300">
      {/* Dynamic Ambient Artwork Glow (Takes album artwork colors, Spotify-style) */}
      <div
        className="fixed inset-0 bg-cover bg-center filter blur-3xl scale-125 opacity-35 saturate-150 pointer-events-none transition-all duration-1000"
        style={{ backgroundImage: `url(${currentSong.coverUrl})` }}
      />
      <div className="fixed inset-0 bg-gradient-to-b from-black/40 via-neutral-950/75 to-neutral-950 pointer-events-none" />

      {/* Toast Notification */}
      {copiedNotification && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[80] px-4 py-2 rounded-full bg-emerald-500 text-black text-xs font-black shadow-2xl animate-in fade-in slide-in-from-top-2">
          Enlace copiado al portapapeles
        </div>
      )}

      {/* =========================================================================
          MOBILE VIEW (Exact Match to Spotify Mobile UI in Image 2)
          ========================================================================= */}
      <div className="md:hidden relative z-20 flex flex-col min-h-screen px-6 pt-[calc(env(safe-area-inset-top,1rem)+0.5rem)] pb-[calc(env(safe-area-inset-bottom,1.5rem)+1rem)] max-w-md mx-auto w-full">
        {/* If Mobile Lyrics are Expanded full screen */}
        {isLyricsExpanded ? (
          <div
            className="flex flex-col h-full flex-1 rounded-3xl p-4 animate-in fade-in duration-200"
            style={{ background: gradient }}
          >
            {/* Header for Expanded Lyrics */}
            <div className="flex items-center justify-between py-2 mb-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsLyricsExpanded(false)}
                className="p-2 -ml-2 text-white/90 hover:text-white active:scale-90 transition-transform"
                title="Volver a la canción"
              >
                <ChevronDown className="w-6 h-6" />
              </button>

              <div className="text-center truncate px-2">
                <p className="text-xs font-bold text-white truncate">{currentSong.title}</p>
                <p className="text-[10px] text-white/60 truncate">{currentSong.artist}</p>
              </div>

              {parsedLyrics.length > 0 && <LyricsTranslationButton dropDirection="down" />}
            </div>

            {/* Lyrics List */}
            <div
              ref={lyricsScrollRef}
              className="flex-1 overflow-y-auto py-6 space-y-6 text-left scroll-smooth min-h-0"
            >
              {displayLyrics.map((line, index) => {
                const isActive = index === activeLyricIndex;
                const isPast = index < activeLyricIndex;

                return (
                  <div
                    key={index}
                    ref={isActive ? activeLineRef : null}
                    onClick={() => seek(line.time)}
                    className={`cursor-pointer transition-all duration-300 py-1 ${
                      isActive
                        ? 'text-white text-2xl font-black scale-102 filter drop-shadow-md'
                        : isPast
                        ? 'text-white/35 hover:text-white/80 text-xl font-bold'
                        : 'text-white/25 hover:text-white/80 text-xl font-bold'
                    }`}
                  >
                    <p className="leading-tight">{line.text || '♪'}</p>
                    {line.translation && (
                      <p
                        className={`mt-1 leading-snug font-semibold ${
                          isActive ? 'text-emerald-300 text-sm' : 'text-white/40 text-xs'
                        }`}
                      >
                        {line.translation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom floating controls in lyrics view */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10 flex-shrink-0">
              <button
                type="button"
                onClick={prevTrack}
                className="p-2 text-white/80 active:scale-90 transition-transform"
              >
                <SkipBack className="w-6 h-6 fill-current" />
              </button>
              <button
                type="button"
                onClick={togglePlayPause}
                className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                )}
              </button>
              <button
                type="button"
                onClick={nextTrack}
                className="p-2 text-white/80 active:scale-90 transition-transform"
              >
                <SkipForward className="w-6 h-6 fill-current" />
              </button>
            </div>
          </div>
        ) : (
          /* Normal Spotify Mobile Now Playing Layout (Image 2) */
          <div className="flex flex-col flex-1 justify-between">
            {/* 1. Header Row (Chevron Down, Source Label, Options Menu) */}
            <div className="flex items-center justify-between py-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsFullscreenNowPlaying(false)}
                className="p-2 -ml-2 text-white/90 hover:text-white active:scale-90 transition-transform"
                title="Minimizar reproductor"
                aria-label="Minimizar reproductor"
              >
                <ChevronDown className="w-6 h-6" />
              </button>

              <button
                type="button"
                onClick={handleOriginClick}
                className="flex flex-col items-center min-w-0 px-2 hover:underline cursor-pointer text-center max-w-[220px]"
                title={`${sourceSubtitle} • ${sourceTitle}`}
              >
                <span className="text-[9px] font-black uppercase tracking-wider text-[#b3b3b3] truncate block">
                  {sourceSubtitle}
                </span>
                <span className="text-xs font-bold text-white truncate block">
                  {sourceTitle}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowOptionsModal(true)}
                className="p-2 -mr-2 text-white/90 hover:text-white active:scale-90 transition-transform"
                title="Más opciones"
                aria-label="Más opciones"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

            {/* 2. Large Album Artwork (Square, Rounded-lg, High Res) */}
            <div className="my-auto py-2">
              <div className="w-full aspect-square rounded-lg overflow-hidden shadow-2xl shadow-black/80 bg-neutral-900 border border-white/5 relative mx-auto">
                <img
                  src={currentSong.coverUrl}
                  alt={currentSong.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* 3. Cambiar a video button (Directly under cover art, matching Image 2) */}
              {videoUrl && (
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={openVideo}
                    className="fullscreen-cambiar-video-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-white text-xs font-bold border border-white/10 shadow-md transition-all active:scale-95"
                    title="Reproducir videoclip musical"
                  >
                    <Play className="w-3.5 h-3.5 fill-white text-white" />
                    <span>Cambiar a video</span>
                  </button>
                </div>
              )}
            </div>

            {/* 4. Track Info & Like Button Row */}
            <div className="pt-2 pb-1 flex items-center justify-between gap-3 flex-shrink-0">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug truncate">
                  {currentSong.title}
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {currentSong.isExplicit && (
                    <span
                      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-xs bg-neutral-600/90 text-white text-[9px] font-black flex-shrink-0 leading-none select-none"
                      title="Contenido explícito"
                    >
                      E
                    </span>
                  )}
                  <p className="text-xs sm:text-sm font-medium text-neutral-400 truncate">
                    <ArtistLinks
                      artists={currentSong.artist}
                      onSelectArtist={(name) => {
                        setIsFullscreenNowPlaying(false);
                        if (onSelectArtist) onSelectArtist(name);
                      }}
                    />
                  </p>
                </div>
              </div>

              {/* Green Saved Check Icon / Like Button */}
              <button
                type="button"
                onClick={() => toggleFavorite(currentSong.id)}
                className="p-1 transition-transform active:scale-90 flex-shrink-0"
                title={liked ? 'Guardada en Tus me gusta (clic para quitar)' : 'Añadir a Tus me gusta'}
                aria-label={liked ? 'Guardada en Tus me gusta' : 'Añadir a Tus me gusta'}
              >
                {liked ? (
                  <SavedCheckIcon size={26} />
                ) : (
                  <svg
                    width="26"
                    height="26"
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

            {/* 5. Timeline with Scrubber Knob */}
            <div className="pt-2 pb-1 flex-shrink-0">
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  seek(percent * duration);
                }}
                className="relative flex items-center h-5 cursor-pointer select-none group"
              >
                <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {/* White scrub circle knob */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md pointer-events-none transition-all"
                  style={{ left: `calc(${progressPercent}% - 6px)` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-normal text-neutral-400 -mt-0.5">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* 6. Main Playback Controls Row (Shuffle, SkipBack, Large Play/Pause, SkipForward, Repeat) */}
            <div className="flex items-center justify-between py-2 flex-shrink-0">
              <button
                type="button"
                onClick={toggleShuffle}
                className={`p-2 transition-colors active:scale-90 ${
                  isShuffle ? 'text-emerald-400' : 'text-neutral-400 hover:text-white'
                }`}
                title={isShuffle ? 'Desactivar aleatorio' : 'Activar aleatorio'}
              >
                <Shuffle className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={prevTrack}
                className="p-2 text-white hover:scale-105 active:scale-95 transition-transform"
                title="Canción anterior"
              >
                <SkipBack className="w-7 h-7 fill-white text-white" />
              </button>

              <button
                type="button"
                onClick={togglePlayPause}
                className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-transform"
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
                className="p-2 text-white hover:scale-105 active:scale-95 transition-transform"
                title="Siguiente canción"
              >
                <SkipForward className="w-7 h-7 fill-white text-white" />
              </button>

              <button
                type="button"
                onClick={toggleRepeat}
                className={`p-2 transition-colors active:scale-90 ${
                  repeatMode !== 'off' ? 'text-emerald-400' : 'text-neutral-400 hover:text-white'
                }`}
                title="Repetición"
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-5 h-5" />
                ) : (
                  <Repeat className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* 7. Auxiliary Row (Karaoke on left if available, Share & Queue on right) */}
            <div className="flex items-center justify-between py-1 text-neutral-400 flex-shrink-0">
              {hasInstrumental ? (
                <button
                  type="button"
                  onClick={toggleKaraoke}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-95 ${
                    isKaraoke
                      ? 'bg-[#1DB954] text-black shadow-lg shadow-[#1DB954]/25'
                      : 'bg-[#242424] text-neutral-300 hover:text-white border border-white/10'
                  }`}
                  title={isKaraoke ? 'Desactivar modo karaoke' : 'Activar modo karaoke'}
                  aria-label={isKaraoke ? 'Desactivar modo karaoke' : 'Activar modo karaoke'}
                >
                  <Mic2 className="w-4 h-4" />
                  <span>Karaoke</span>
                </button>
              ) : (
                <div className="w-5 h-5" />
              )}

              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={handleShare}
                  className="p-1 hover:text-white active:scale-90 transition-transform"
                  title="Compartir canción"
                >
                  <Share2 className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={handleOpenQueue}
                  className="p-1 hover:text-white active:scale-90 transition-transform"
                  title="Fila de reproducción"
                >
                  <ListMusic className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 8. Spotify Lyrics Card (Peeking at the bottom, exact match to Image 2) */}
            {parsedLyrics.length > 0 && (
              <div className="pt-3 flex-shrink-0">
                <div
                  onClick={() => setIsLyricsExpanded(true)}
                  className="rounded-2xl sm:rounded-3xl p-4 text-white shadow-2xl transition-all duration-300 active:scale-99 cursor-pointer border border-white/10"
                  style={{ background: lyricsCardGradient }}
                >
                  {/* Card Header: "Letra" + Translate + Share + Expand */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-extrabold text-base tracking-tight text-white">
                      Letra
                    </span>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <LyricsTranslationButton dropDirection="up" />

                      <button
                        type="button"
                        onClick={handleShare}
                        className="p-1.5 rounded-full bg-black/25 hover:bg-black/40 text-white transition-colors"
                        title="Compartir letra"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsLyricsExpanded(true)}
                        className="p-1.5 rounded-full bg-black/25 hover:bg-black/40 text-white transition-colors"
                        title="Ampliar letras"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Synced Lyrics Preview (Active line and neighboring lines) */}
                  <div className="space-y-1 py-1">
                    {displayLyrics
                      .slice(
                        Math.max(0, activeLyricIndex - 1),
                        Math.max(0, activeLyricIndex - 1) + 3
                      )
                      .map((l, i) => {
                        const isCurrent = l.time === displayLyrics[activeLyricIndex]?.time;
                        return (
                          <div key={i} className="truncate">
                            <p
                              className={`truncate leading-snug ${
                                isCurrent
                                  ? 'text-white text-lg font-black'
                                  : 'text-white/50 text-base font-bold'
                              }`}
                            >
                              {l.text || '♪'}
                            </p>
                            {l.translation && isCurrent && (
                              <p className="text-white/80 text-xs font-semibold truncate mt-0.5">
                                {l.translation}
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          DESKTOP VIEW (Two-Column Side-by-Side: Cover/Controls Left, Lyrics Right)
          ========================================================================= */}
      <div className="hidden md:flex flex-col justify-between h-full min-h-screen relative z-20">
        {/* Desktop Top Bar */}
        <div className="flex items-center justify-between px-10 pt-6 pb-2 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsFullscreenNowPlaying(false)}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 shadow-md backdrop-blur-md"
              title="Cerrar pantalla completa"
            >
              <ChevronDown className="w-5 h-5" />
            </button>

            <div className="flex flex-col min-w-0 max-w-md">
              {sourceSubtitle && (
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 truncate block">
                  {sourceSubtitle}
                </span>
              )}
              <button
                type="button"
                onClick={handleOriginClick}
                className="text-xs font-black uppercase tracking-wider text-white/75 hover:text-white hover:underline truncate transition-colors cursor-pointer text-left"
                title={`Ir a ${sourceTitle}`}
              >
                {sourceTitle}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {videoUrl && (
              <button
                type="button"
                onClick={openVideo}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold transition-all backdrop-blur-md"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Videoclip</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleShare}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
              title="Compartir"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Desktop Body: 2 Columns */}
        <div className="flex-1 grid grid-cols-12 gap-12 px-12 lg:px-20 max-w-7xl mx-auto w-full items-center min-h-0 py-6 overflow-hidden">
          {/* Left Column: Artwork + Song info + Controls + Volume */}
          <div className="col-span-5 flex flex-col justify-center space-y-6 max-w-md w-full min-h-0">
            <div className="w-72 h-72 lg:w-84 lg:h-84 aspect-square rounded-2xl overflow-hidden shadow-2xl shadow-black/90 mx-auto lg:mx-0 flex-shrink-0 bg-neutral-900 border border-white/5">
              <img
                src={currentSong.coverUrl}
                alt={currentSong.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-1 text-left w-full">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 truncate flex-1">
                  {currentSong.isExplicit && (
                    <span
                      className="inline-flex items-center justify-center w-4 h-4 rounded-xs bg-neutral-600/90 text-white text-[10px] font-black flex-shrink-0 leading-none select-none"
                      title="Contenido explícito"
                    >
                      E
                    </span>
                  )}
                  <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight truncate">
                    {currentSong.title}
                  </h1>
                </div>

                <button
                  type="button"
                  onClick={() => toggleFavorite(currentSong.id)}
                  className="p-1.5 transition-transform active:scale-90 flex-shrink-0"
                  title={liked ? 'Guardada en Tus me gusta' : 'Añadir a Tus me gusta'}
                >
                  {liked ? (
                    <SavedCheckIcon size={26} />
                  ) : (
                    <svg
                      width="26"
                      height="26"
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

              <p className="text-sm font-semibold text-neutral-400 truncate">
                <ArtistLinks
                  artists={currentSong.artist}
                  onSelectArtist={(name) => {
                    setIsFullscreenNowPlaying(false);
                    if (onSelectArtist) onSelectArtist(name);
                  }}
                />
                {currentSong.album && <span className="text-neutral-500"> — {currentSong.album}</span>}
              </p>

              <div className="pt-1">
                <SongVersionSelector compact />
              </div>
            </div>

            {/* Desktop Timeline */}
            <div className="space-y-1 w-full">
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  seek(percent * duration);
                }}
                className="relative flex items-center h-4 cursor-pointer select-none group"
              >
                <div className="w-full h-1 bg-white/20 group-hover:h-1.5 rounded-full overflow-hidden transition-all">
                  <div
                    className="h-full bg-white group-hover:bg-emerald-400 rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Desktop Controls */}
            <div className="flex items-center justify-between pt-1 w-full">
              <button
                type="button"
                onClick={toggleShuffle}
                className={`p-2 transition-colors ${
                  isShuffle ? 'text-emerald-400' : 'text-neutral-400 hover:text-white'
                }`}
                title="Aleatorio"
              >
                <Shuffle className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={prevTrack}
                className="p-2 text-white hover:scale-105 active:scale-95 transition-transform"
                title="Anterior"
              >
                <SkipBack className="w-7 h-7 fill-white text-white" />
              </button>

              <button
                type="button"
                onClick={togglePlayPause}
                className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 shadow-2xl transition-transform"
                title={isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 fill-current" />
                ) : (
                  <Play className="w-7 h-7 fill-current ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={nextTrack}
                className="p-2 text-white hover:scale-105 active:scale-95 transition-transform"
                title="Siguiente"
              >
                <SkipForward className="w-7 h-7 fill-white text-white" />
              </button>

              <button
                type="button"
                onClick={toggleRepeat}
                className={`p-2 transition-colors ${
                  repeatMode !== 'off' ? 'text-emerald-400' : 'text-neutral-400 hover:text-white'
                }`}
                title="Repetir"
              >
                {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
              </button>
            </div>

            {/* Desktop Volume Slider */}
            <div className="flex items-center gap-3 pt-2 text-white/60">
              <button
                type="button"
                onClick={toggleMute}
                className="hover:text-white transition-colors"
                title={isMuted ? 'Activar sonido' : 'Silenciar'}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
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

          {/* Right Column: Full Synced Lyrics Scroll */}
          <div
            ref={desktopLyricsScrollRef}
            className="col-span-7 h-full max-h-[82vh] overflow-y-auto px-6 py-12 space-y-7 text-left scroll-smooth min-h-0"
          >
            {parsedLyrics.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                <Mic2 className="w-12 h-12 text-white/30" />
                <h3 className="text-xl font-bold text-white">Letra no disponible</h3>
                <p className="text-xs text-white/50 max-w-sm">
                  Esta canción no cuenta con archivo .LRC sincronizado.
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
                    className={`cursor-pointer transition-all duration-300 py-1.5 ${
                      isActive
                        ? 'text-white text-3xl lg:text-4xl font-black scale-102 filter drop-shadow-md'
                        : isPast
                        ? 'text-white/35 hover:text-white/80 text-xl lg:text-2xl font-bold'
                        : 'text-white/25 hover:text-white/80 text-xl lg:text-2xl font-bold'
                    }`}
                  >
                    <p className="leading-tight">{line.text || '♪'}</p>
                    {line.translation && (
                      <p
                        className={`mt-1.5 leading-snug font-semibold ${
                          isActive ? 'text-white/90 text-base lg:text-lg' : 'text-white/40 text-sm lg:text-base'
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

        {/* Desktop Bottom Translation Button */}
        <div className="flex items-center justify-end px-12 pb-6 pt-2 flex-shrink-0">
          {parsedLyrics.length > 0 && <LyricsTranslationButton dropDirection="up" />}
        </div>
      </div>

      {/* Toast Notifications */}
      {sleepTimerFeedback && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[110] px-4 py-2 rounded-full bg-[#1DB954] text-black text-xs font-black shadow-2xl animate-in fade-in slide-in-from-top-2">
          {sleepTimerFeedback}
        </div>
      )}

      {/* Spotify Options Bottom Sheet (...) */}
      {showOptionsModal && (
        <div
          className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200 select-none"
          onClick={() => setShowOptionsModal(false)}
        >
          <div
            className="w-full max-w-lg mx-auto bg-[#181818] border-t border-[#282828] rounded-t-[16px] p-5 pb-8 shadow-2xl relative animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto scrollbar-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div className="w-10 h-1 rounded-full bg-neutral-600 mx-auto mb-4" />

            {/* Song Cover & Spotify Code Header */}
            <div className="flex flex-col items-center text-center pb-4 border-b border-[#282828]">
              <div className="w-28 h-28 rounded-lg overflow-hidden shadow-2xl shadow-black mb-2.5">
                <img
                  src={currentSong.coverUrl}
                  alt={currentSong.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <h2 className="font-extrabold text-white text-base tracking-tight truncate max-w-[280px]">
                {currentSong.title}
              </h2>
              <p className="text-xs text-[#b3b3b3] truncate max-w-[260px] mt-0.5">
                {currentSong.artist}
              </p>

              {/* Spotify Code Bar */}
              <div className="mt-2.5 px-3 py-1 rounded-full bg-[#121212] border border-[#282828]">
                <SpotifyCode song={currentSong} barColor="#1DB954" className="scale-90" />
              </div>
            </div>

            {/* Actions List */}
            <div className="py-2 space-y-1">
              {/* Me gusta */}
              <button
                type="button"
                onClick={() => {
                  toggleFavorite(currentSong.id);
                  setShowOptionsModal(false);
                }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-semibold text-white hover:bg-[#242424] active:bg-[#282828] transition-colors text-left"
              >
                {liked ? (
                  <>
                    <SavedCheckIcon size={20} />
                    <span>Quitar de Tus me gusta</span>
                  </>
                ) : (
                  <>
                    <Heart className="w-5 h-5 text-[#b3b3b3]" />
                    <span>Añadir a Tus me gusta</span>
                  </>
                )}
              </button>

              {/* Añadir a playlist */}
              <button
                type="button"
                onClick={() => {
                  setShowOptionsModal(false);
                  if (onOpenAddToPlaylist) {
                    onOpenAddToPlaylist(currentSong);
                  }
                }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-semibold text-white hover:bg-[#242424] active:bg-[#282828] transition-colors text-left"
              >
                <PlusCircle className="w-5 h-5 text-[#b3b3b3]" />
                <span>Añadir a playlist</span>
              </button>

              {/* Añadir a la fila */}
              <button
                type="button"
                onClick={() => {
                  setShowOptionsModal(false);
                  handleOpenQueue();
                }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-semibold text-white hover:bg-[#242424] active:bg-[#282828] transition-colors text-left"
              >
                <ListMusic className="w-5 h-5 text-[#b3b3b3]" />
                <span>Añadir a la fila de reproducción</span>
              </button>

              {/* Temporizador de sueño (Apagado automático) */}
              <button
                type="button"
                onClick={() => {
                  setShowOptionsModal(false);
                  setShowSleepTimerSheet(true);
                }}
                className="w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold text-white hover:bg-[#242424] active:bg-[#282828] transition-colors text-left"
              >
                <div className="flex items-center gap-3.5">
                  <Moon className="w-5 h-5 text-[#b3b3b3]" />
                  <span>Apagado automático</span>
                </div>
                {sleepTimerOption && (
                  <span className="text-xs font-bold text-[#1DB954] bg-[#1DB954]/10 px-2.5 py-0.5 rounded-full">
                    {sleepTimerOption === 'end_of_track'
                      ? 'Fin de canción'
                      : `${Math.ceil((sleepTimerRemainingSeconds || 0) / 60)} min`}
                  </span>
                )}
              </button>

              {/* Mostrar código de Spotify */}
              <button
                type="button"
                onClick={() => {
                  setShowOptionsModal(false);
                  setShowSpotifyCodeModal(true);
                }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-semibold text-white hover:bg-[#242424] active:bg-[#282828] transition-colors text-left"
              >
                <QrCode className="w-5 h-5 text-[#b3b3b3]" />
                <span>Mostrar código de Spotify</span>
              </button>

              {/* Ver álbum */}
              {currentSong.album && currentSong.album.toLowerCase() !== 'sencillo' && (
                <button
                  type="button"
                  onClick={() => {
                    setShowOptionsModal(false);
                    setIsFullscreenNowPlaying(false);
                    const targetAlbum = albums.find(
                      (a) => a.name.trim().toLowerCase() === currentSong.album?.trim().toLowerCase()
                    );
                    if (targetAlbum && onSelectAlbum) {
                      onSelectAlbum(targetAlbum);
                    }
                  }}
                  className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-semibold text-white hover:bg-[#242424] active:bg-[#282828] transition-colors text-left"
                >
                  <Disc className="w-5 h-5 text-[#b3b3b3]" />
                  <span>Ver álbum ({currentSong.album})</span>
                </button>
              )}

              {/* Ver artista */}
              <button
                type="button"
                onClick={() => {
                  setShowOptionsModal(false);
                  setIsFullscreenNowPlaying(false);
                  if (onSelectArtist) {
                    onSelectArtist(currentSong.artist);
                  }
                }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-semibold text-white hover:bg-[#242424] active:bg-[#282828] transition-colors text-left"
              >
                <UserRound className="w-5 h-5 text-[#b3b3b3]" />
                <span>Ver artista ({currentSong.artist})</span>
              </button>

              {/* Versiones si existen */}
              <div className="pt-1">
                <SongVersionSelector compact />
              </div>

              {/* Compartir */}
              <button
                type="button"
                onClick={() => {
                  setShowOptionsModal(false);
                  handleShare();
                }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-semibold text-white hover:bg-[#242424] active:bg-[#282828] transition-colors text-left"
              >
                <Share2 className="w-5 h-5 text-[#b3b3b3]" />
                <span>Compartir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sleep Timer Selector Bottom Sheet */}
      {showSleepTimerSheet && (
        <div
          className="fixed inset-0 z-[95] bg-black/70 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200 select-none"
          onClick={() => setShowSleepTimerSheet(false)}
        >
          <div
            className="w-full max-w-lg mx-auto bg-[#181818] border-t border-[#282828] rounded-t-[16px] p-5 pb-8 shadow-2xl relative animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-neutral-600 mx-auto mb-4" />
            <div className="flex items-center justify-between pb-3 border-b border-[#282828] mb-2">
              <h3 className="text-base font-extrabold text-white">
                ¿Cuándo quieres detener la música?
              </h3>
              <button
                onClick={() => setShowSleepTimerSheet(false)}
                className="p-1 text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              {[
                { label: '5 minutos', value: '5' },
                { label: '10 minutos', value: '10' },
                { label: '15 minutos', value: '15' },
                { label: '30 minutos', value: '30' },
                { label: '45 minutos', value: '45' },
                { label: '1 hora', value: '60' },
                { label: 'Al final de la canción', value: 'end_of_track' },
              ].map((opt) => {
                const isSelected = sleepTimerOption === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setSleepTimer(opt.value);
                      setShowSleepTimerSheet(false);
                      setSleepTimerFeedback(`Temporizador activado: ${opt.label}`);
                      setTimeout(() => setSleepTimerFeedback(null), 3000);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors text-left ${
                      isSelected
                        ? 'text-[#1DB954] font-bold bg-[#242424]'
                        : 'text-white hover:bg-[#242424]/60'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-[#1DB954] stroke-[3]" />}
                  </button>
                );
              })}

              {sleepTimerOption && (
                <button
                  type="button"
                  onClick={() => {
                    setSleepTimer(null);
                    setShowSleepTimerSheet(false);
                    setSleepTimerFeedback('Temporizador desactivado');
                    setTimeout(() => setSleepTimerFeedback(null), 3000);
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-bold text-red-400 hover:bg-red-950/20 transition-colors text-left mt-2 border-t border-[#282828]"
                >
                  <span>Desactivar temporizador</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Spotify Code Full Modal */}
      <SpotifyCodeModal
        song={currentSong}
        isOpen={showSpotifyCodeModal}
        onClose={() => setShowSpotifyCodeModal(false)}
      />
    </div>
  );
};
