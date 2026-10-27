import React from 'react';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Pause from 'lucide-react/dist/esm/icons/pause.mjs';
import Music from 'lucide-react/dist/esm/icons/music.mjs';
import Heart from 'lucide-react/dist/esm/icons/heart.mjs';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.mjs';
import PlusCircle from 'lucide-react/dist/esm/icons/circle-plus.mjs';
import ListMusic from 'lucide-react/dist/esm/icons/list-music.mjs';
import Disc from 'lucide-react/dist/esm/icons/disc.mjs';
import Mic2 from 'lucide-react/dist/esm/icons/mic-vocal.mjs';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link.mjs';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.mjs';
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2.mjs';
import Video from 'lucide-react/dist/esm/icons/video.mjs';
import { useAudio, useAudioTime } from '../context/AudioContext';
import { useMusic } from '../context/MusicContext';
import { formatTime, buildDisplayLyrics } from '../utils/lyrics';
import { Song, Album, Playlist } from '../types';
import { getAlbumsFromCatalog } from '../utils/albums';
import { ArtistLinks } from './ArtistLinks';
import { SavedCheckIcon } from './SavedCheckIcon';
import { SongVersionSelector } from './SongVersionSelector';
import { GlobalStatsCard } from './GlobalStatsCard';

interface SpotifyRightPanelProps {
  onSelectArtist?: (artistName: string) => void;
  onSelectAlbum?: (album: Album) => void;
  onSelectPlaylist?: (playlist: Playlist | 'favorites' | Album) => void;
}

export const SpotifyRightPanel: React.FC<SpotifyRightPanelProps> = ({
  onSelectArtist,
  onSelectAlbum,
  onSelectPlaylist,
}) => {
  const {
    currentSong,
    queue,
    isPlaying,
    playbackSource,
    isRightPanelOpen,
    setIsRightPanelOpen,
    rightPanelTab,
    setRightPanelTab,
    setIsCenterLyricsOpen,
    isFullscreenNowPlaying,
    setIsFullscreenNowPlaying,
    playSong,
    parsedLyrics,
    translatedLyrics,
    lyricsDisplayMode,
    isVideoMode,
    videoUrl,
    openVideo,
    closeVideo,
    syncMediaTime,
    volume,
    isMuted,
    togglePlayPause,
  } = useAudio();
  const { currentTime, duration, activeLyricIndex } = useAudioTime();

  const { catalog, isFavorite, toggleFavorite, playlists, recordListeningTime } = useMusic();

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const lastTrackedRef = React.useRef(0);

  // Sync video time and playback when entering video mode or seeking
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isFullscreenNowPlaying) {
      video.pause();
      video.muted = true;
      return;
    }

    video.muted = isMuted;

    if (isVideoMode) {
      if (Math.abs(video.currentTime - currentTime) > 1) {
        try {
          video.currentTime = currentTime;
        } catch {
          // ignore
        }
      }
      if (isPlaying) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    } else {
      video.pause();
    }
  }, [isVideoMode, isPlaying, isFullscreenNowPlaying, isMuted]);

  // Keep volume synced with audio player
  React.useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = isMuted || isFullscreenNowPlaying ? 0 : volume;
    }
  }, [volume, isMuted, isFullscreenNowPlaying]);

  const handleInlineVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    syncMediaTime(video.currentTime);

    const watched = video.currentTime - lastTrackedRef.current;
    if (watched >= 10 && currentSong) {
      recordListeningTime(currentSong.id, currentSong.artist, Math.floor(watched));
      lastTrackedRef.current = video.currentTime;
    }
  };

  const relatedVideos = React.useMemo(() => {
    return catalog
      .filter((s) => Boolean(s.videoUrl) && s.id !== currentSong?.id)
      .slice(0, 4);
  }, [catalog, currentSong?.id]);
  const displayLyrics = React.useMemo(
    () => buildDisplayLyrics(parsedLyrics, translatedLyrics, lyricsDisplayMode),
    [parsedLyrics, translatedLyrics, lyricsDisplayMode]
  );

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

  const shouldShowInlineSubtitle =
    !isFullscreenNowPlaying &&
    !isBeforeFirstLyric &&
    !isAfterLastLyric &&
    !isInstrumentalGap &&
    activeLyricIndex >= 0 &&
    Boolean(displayLyrics[activeLyricIndex]?.text?.trim());

  const activeInlineLyric = shouldShowInlineSubtitle ? displayLyrics[activeLyricIndex] : null;

  const displayOrigin = React.useMemo(() => {
    if (!currentSong) return null;
    if (!playbackSource?.name) {
      return currentSong.album && currentSong.album.toLowerCase() !== 'sencillo'
        ? currentSong.album
        : null;
    }
    // If it says "Artista: ...", remove it as requested (redundant)
    if (/^artista:/i.test(playbackSource.name.trim())) {
      return currentSong.album && currentSong.album.toLowerCase() !== 'sencillo'
        ? currentSong.album
        : null;
    }
    return playbackSource.name;
  }, [playbackSource, currentSong?.album, currentSong]);

  if (!isRightPanelOpen || !currentSong) return null;

  const liked = isFavorite(currentSong.id);

  // Find upcoming queue tracks
  const currentIndex = queue.findIndex((s) => s.id === currentSong.id);
  const upcomingSongs = currentIndex >= 0 ? queue.slice(currentIndex + 1) : queue;

  // Visible lyric lines for "Letra" card (at least 5-6 lines around active line)
  const startLyricIndex = Math.max(0, activeLyricIndex - 1);
  const lyricSnippet = parsedLyrics.length > 0
    ? parsedLyrics.slice(startLyricIndex, startLyricIndex + 6)
    : [];

  const sourceName = displayOrigin || playbackSource?.name || 'Tus me gusta';

  const handleNavigateToOrigin = () => {
    if (!displayOrigin && !playbackSource) return;

    // 1. Favorites check
    if (
      playbackSource?.type === 'favorites' ||
      displayOrigin?.toLowerCase() === 'tus me gusta' ||
      displayOrigin?.toLowerCase() === 'canciones que te gustan'
    ) {
      if (onSelectPlaylist) {
        onSelectPlaylist('favorites');
        return;
      }
    }

    // 2. Playlist check (by ID or matching name)
    const matchingPlaylist = playlists.find(
      (p) =>
        (playbackSource?.type === 'playlist' && playbackSource.id && p.id === playbackSource.id) ||
        (playbackSource?.name && p.name.trim().toLowerCase() === playbackSource.name.trim().toLowerCase()) ||
        (displayOrigin && p.name.trim().toLowerCase() === displayOrigin.trim().toLowerCase())
    );
    if (matchingPlaylist && onSelectPlaylist) {
      onSelectPlaylist(matchingPlaylist);
      return;
    }

    // 3. Album check (by target album name from playbackSource, displayOrigin, or currentSong.album)
    const targetAlbumName =
      (playbackSource?.type === 'album' && playbackSource.name ? playbackSource.name : displayOrigin) ||
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
        // Dynamic fallback Album object from catalog songs matching album name
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

    // 4. Artist check
    if (
      playbackSource?.type === 'artist' ||
      (playbackSource?.name && /^artista:/i.test(playbackSource.name))
    ) {
      const artistName =
        playbackSource.id ||
        playbackSource.name.replace(/^artista:\s*/i, '').trim() ||
        currentSong?.artist;
      if (artistName && onSelectArtist) {
        onSelectArtist(artistName);
        return;
      }
    }

    // 5. Fallback: if displayOrigin matches an artist
    if (displayOrigin && onSelectArtist) {
      if (displayOrigin.trim().toLowerCase() === currentSong?.artist.trim().toLowerCase()) {
        onSelectArtist(currentSong.artist);
        return;
      }
    }
  };

  return (
    <aside className="w-80 lg:w-88 bg-neutral-950 border-l border-neutral-900/90 flex flex-col h-full flex-shrink-0 select-none overflow-hidden animate-in slide-in-from-right-4 duration-200">
      {/* Header Tabs (Fila de reproducción / Vista actual) */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-900 flex-shrink-0">
        <div className="flex items-center gap-4 text-xs font-bold">
          <button
            onClick={() => setRightPanelTab('now-playing')}
            className={`transition-colors pb-0.5 border-b-2 ${
              rightPanelTab === 'now-playing'
                ? 'text-white border-emerald-400 font-extrabold'
                : 'text-neutral-400 border-transparent hover:text-white'
            }`}
          >
            Vista actual
          </button>
          <button
            onClick={() => setRightPanelTab('queue')}
            className={`transition-colors pb-0.5 border-b-2 ${
              rightPanelTab === 'queue'
                ? 'text-white border-emerald-400 font-extrabold'
                : 'text-neutral-400 border-transparent hover:text-white'
            }`}
          >
            Fila de reproducción
          </button>
        </div>

        <button
          onClick={() => setIsRightPanelOpen(false)}
          className="text-neutral-400 hover:text-white p-1 rounded-full hover:bg-neutral-900 transition-colors"
          title="Ocultar panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {rightPanelTab === 'now-playing' ? (
          /* TAB: VISTA ACTUAL (Spotify Image 5) */
          <div className="space-y-5">
            {/* Source Origin Title (clickable like Spotify) */}
            {displayOrigin && (
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={handleNavigateToOrigin}
                  className="text-[11px] font-black uppercase tracking-wider text-neutral-400 hover:text-white hover:underline block truncate text-left transition-colors cursor-pointer w-full group"
                  title={`Ir a ${displayOrigin}`}
                >
                  <span className="truncate">{displayOrigin}</span>
                </button>
              </div>
            )}

            {/* High-res Cover Art OR Inline Video (Spotify Image 4) */}
            <div
              className={`${
                isVideoMode && videoUrl ? 'aspect-video bg-black' : 'aspect-square bg-neutral-900'
              } w-full rounded-2xl overflow-hidden shadow-2xl relative group flex items-center justify-center transition-all duration-200`}
            >
              {isVideoMode && videoUrl ? (
                <div className="relative w-full h-full bg-black flex items-center justify-center">
                  {!isFullscreenNowPlaying ? (
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      poster={currentSong.coverUrl}
                      autoPlay={isPlaying}
                      playsInline
                      onTimeUpdate={handleInlineVideoTimeUpdate}
                      onEnded={() => closeVideo(videoRef.current?.currentTime)}
                      onClick={togglePlayPause}
                      className="w-full h-full object-contain cursor-pointer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-black">
                      {currentSong.coverUrl && (
                        <img
                          src={currentSong.coverUrl}
                          alt={currentSong.title}
                          className="w-full h-full object-contain opacity-50"
                        />
                      )}
                    </div>
                  )}
                  {/* Floating overlay on hover with play/pause and fullscreen button */}
                  {!isFullscreenNowPlaying && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between p-3 pointer-events-none">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlayPause();
                        }}
                        className="p-2 rounded-full bg-black/70 hover:bg-black text-white pointer-events-auto transition-transform active:scale-95 shadow-md"
                        title={isPlaying ? 'Pausar' : 'Reproducir'}
                      >
                        {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsFullscreenNowPlaying(true);
                        }}
                        className="px-3 py-1.5 rounded-full bg-black/70 hover:bg-black text-white text-xs font-bold backdrop-blur-md flex items-center gap-1.5 shadow-lg pointer-events-auto transition-transform active:scale-95"
                        title="Pantalla Completa"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Pantalla Completa</span>
                      </button>
                    </div>
                  )}
                  {/* Subtle video subtitle overlay at bottom of right panel video */}
                  {!isFullscreenNowPlaying && activeInlineLyric && (
                    <div className="absolute bottom-2 left-2 right-2 z-10 pointer-events-none text-center animate-in fade-in duration-150">
                      <span className="inline-block px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-sm text-white text-[11px] font-bold border border-white/10 shadow truncate max-w-full">
                        {activeInlineLyric.text}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <img
                    src={currentSong.coverUrl}
                    alt={currentSong.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => setIsFullscreenNowPlaying(true)}
                      className="px-3.5 py-2 rounded-xl bg-black/80 hover:bg-black text-white text-xs font-bold backdrop-blur-md flex items-center gap-1.5 shadow-lg transition-transform active:scale-95"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Pantalla Completa</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Toggle Audio / Video Mode Button (Spotify Image 4: "Cambiar a audio") */}
            {videoUrl && (
              <button
                type="button"
                onClick={() => {
                  if (isVideoMode) {
                    closeVideo(videoRef.current?.currentTime);
                  } else {
                    openVideo();
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-800 text-xs font-bold transition-all shadow-md active:scale-98"
                title={isVideoMode ? 'Volver a modo audio' : 'Reproducir videoclip musical'}
              >
                {isVideoMode ? (
                  <>
                    <Music className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Cambiar a audio</span>
                  </>
                ) : (
                  <>
                    <Video className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Cambiar a vídeo</span>
                  </>
                )}
              </button>
            )}

            {/* Title & Artist */}
            <div className="flex items-center justify-between gap-3">
              <div className="truncate flex-1">
                <div className="flex items-center gap-1.5">
                  {currentSong.isExplicit && (
                    <span
                      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-neutral-600/80 text-white text-[9px] font-black flex-shrink-0 select-none leading-none"
                      title="Contenido explícito"
                    >
                      E
                    </span>
                  )}
                  <h3 className="font-extrabold text-base text-white truncate block">
                    {currentSong.title}
                  </h3>
                </div>
                <p className="text-xs text-neutral-400 truncate mt-0.5">
                  <ArtistLinks artists={currentSong.artist} onSelectArtist={onSelectArtist} />
                </p>
                <div className="mt-2">
                  <SongVersionSelector compact />
                </div>
                <GlobalStatsCard
                  type="track"
                  name={currentSong.title}
                  artist={currentSong.artist}
                  compact
                  className="mt-2"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {videoUrl && (
                  <button
                    onClick={openVideo}
                    className="p-1.5 rounded-full text-neutral-400 hover:text-emerald-400 transition-colors"
                    title="Ver videoclip"
                  >
                    <Video className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => toggleFavorite(currentSong.id)}
                  className="p-1.5 rounded-full transition-transform active:scale-90 hover:scale-105"
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
            </div>

            {/* Videos musicales relacionados (Spotify Image 4 - solo visible al reproducir video) */}
            {isVideoMode && relatedVideos.length > 0 && (
              <div className="space-y-2.5 pt-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-neutral-300 block">
                  Videos musicales relacionados
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {relatedVideos.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => {
                        playSong(s, undefined, playbackSource || undefined);
                        openVideo();
                      }}
                      className="group cursor-pointer bg-neutral-900/60 hover:bg-neutral-800 p-2 rounded-xl border border-white/5 hover:border-white/10 transition-all space-y-1.5"
                    >
                      <div className="aspect-video w-full rounded-lg overflow-hidden bg-black relative">
                        <img
                          src={s.coverUrl}
                          alt={s.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                          <div className="w-6 h-6 rounded-full bg-black/80 flex items-center justify-center text-white">
                            <Play className="w-3 h-3 fill-white ml-0.5" />
                          </div>
                        </div>
                      </div>
                      <p className="text-[11px] font-bold text-white truncate">{s.title}</p>
                      <p className="text-[10px] text-neutral-400 truncate">{s.artist}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Letra Card (Dynamic ambient colors from artwork, not always blue) */}
            <div
              onClick={() => setIsCenterLyricsOpen(true)}
              className="bg-neutral-900/90 border border-white/10 p-4 rounded-2xl cursor-pointer group hover:border-emerald-500/50 transition-all shadow-xl space-y-2 relative overflow-hidden"
            >
              {/* Cover dynamic background blur for this card */}
              <div
                className="absolute inset-0 bg-cover bg-center filter blur-2xl scale-125 opacity-30 saturate-150 pointer-events-none transition-all duration-700"
                style={{ backgroundImage: `url(${currentSong.coverUrl})` }}
              />
              <div className="absolute inset-0 bg-black/60 pointer-events-none" />

              <div className="relative z-10 flex items-center justify-between text-white text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <Mic2 className="w-3.5 h-3.5 text-emerald-400" />
                  Letra
                </span>
                <span className="text-[10px] uppercase font-bold text-white/70 group-hover:text-white group-hover:underline flex items-center gap-0.5">
                  Ver completa <ChevronRight className="w-3 h-3" />
                </span>
              </div>

              {lyricSnippet.length > 0 ? (
                <div className="relative z-10 space-y-1.5 pt-1 max-h-56 overflow-hidden">
                  {lyricSnippet.map((line, idx) => {
                    const actualIdx = startLyricIndex + idx;
                    const isActive = actualIdx === activeLyricIndex;
                    return (
                      <p
                        key={idx}
                        className={`text-xs md:text-sm leading-relaxed transition-all ${
                          isActive
                            ? 'text-white font-extrabold scale-101 origin-left drop-shadow'
                            : 'text-white/45 font-medium'
                        }`}
                      >
                        {line.text}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <p className="relative z-10 text-xs text-neutral-400 pt-1">
                  {currentSong.lyricsLrc ? 'Toca para ver la letra sincronizada' : 'Sin letras registradas en esta canción.'}
                </p>
              )}
            </div>

            {/* Album & Info Card */}
            <div className="p-4 bg-neutral-900/60 rounded-2xl border border-neutral-800/80 space-y-1.5 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                Álbum y detalles
              </span>
              <p
                onClick={() => {
                  if (onSelectAlbum && currentSong.album) {
                    const alb = getAlbumsFromCatalog(catalog).find(
                      (a) => a.name.trim().toLowerCase() === currentSong.album.trim().toLowerCase()
                    );
                    if (alb) onSelectAlbum(alb);
                  }
                }}
                className={`font-bold text-white truncate ${onSelectAlbum ? 'hover:underline cursor-pointer' : ''}`}
                title={onSelectAlbum ? `Abrir álbum ${currentSong.album}` : undefined}
              >
                {currentSong.album}
              </p>
              <p className="text-neutral-400">
                Género: <span className="text-emerald-400 font-semibold">{currentSong.genre || 'General'}</span> • Año: {currentSong.year || '2026'}
              </p>
            </div>
          </div>
        ) : (
          /* TAB: FILA DE REPRODUCCIÓN (Spotify Image 4) */
          <div className="space-y-6">
            {/* Now Playing in Queue */}
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400 mb-2.5 block">
                Estás escuchando
              </span>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-neutral-900 border border-emerald-500/30 shadow-md">
                <div className="w-11 h-11 rounded-lg overflow-hidden relative flex-shrink-0">
                  <img src={currentSong.coverUrl} alt={currentSong.title} className="w-full h-full object-cover" />
                  {isPlaying && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    </div>
                  )}
                </div>
                <div className="truncate flex-1">
                  <span className="font-bold text-xs text-emerald-400 truncate block">
                    {currentSong.title}
                  </span>
                  <span className="text-[11px] text-neutral-400 truncate block">
                    <ArtistLinks artists={currentSong.artist} onSelectArtist={onSelectArtist} />
                  </span>
                </div>
              </div>
            </div>

            {/* Upcoming Songs */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-black uppercase tracking-wider text-neutral-300 truncate pr-2">
                  Próximas canciones de:{' '}
                  <button
                    type="button"
                    onClick={handleNavigateToOrigin}
                    className="hover:text-emerald-400 hover:underline cursor-pointer inline transition-colors text-white font-black"
                    title={`Ir a ${sourceName}`}
                  >
                    {sourceName}
                  </button>
                </span>
                <span className="text-[10px] text-neutral-500 font-bold flex-shrink-0">
                  {upcomingSongs.length} en cola
                </span>
              </div>

              <div className="space-y-1.5">
                {upcomingSongs.length === 0 ? (
                  <p className="text-xs text-neutral-500 italic p-3 text-center bg-neutral-900/40 rounded-xl">
                    No hay más canciones en la cola.
                  </p>
                ) : (
                  upcomingSongs.slice(0, 15).map((song, i) => (
                    <div
                      key={song.id}
                      onClick={() => playSong(song, queue, playbackSource || undefined)}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-neutral-900 border border-transparent hover:border-neutral-800 cursor-pointer group transition-all"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span className="text-xs font-bold text-neutral-500 w-4 text-center group-hover:hidden">
                          {i + 1}
                        </span>
                        <Play className="w-3.5 h-3.5 text-white fill-white hidden group-hover:block ml-0.5 flex-shrink-0" />
                        <img
                          src={song.coverUrl}
                          alt={song.title}
                          className="w-9 h-9 rounded-md object-cover flex-shrink-0"
                        />
                        <div className="truncate">
                          <span className="font-bold text-xs text-white truncate block group-hover:text-emerald-400">
                            {song.title}
                          </span>
                          <span className="text-[10px] text-neutral-400 truncate block">
                            <ArtistLinks artists={song.artist} onSelectArtist={onSelectArtist} />
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] text-neutral-500 font-mono flex-shrink-0">
                        {formatTime(song.duration)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
