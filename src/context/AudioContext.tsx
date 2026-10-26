import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Song, LyricLine } from '../types';
import { parseLrc, getActiveLyricIndex } from '../utils/lyrics';
import { getSongBlob } from '../services/storage';
import { useMusic } from './MusicContext';
import { useAuth } from './AuthContext';

const VOLUME_STORAGE_KEY = 'musica_volume';

function getInitialVolume(): number {
  try {
    const stored = Number(localStorage.getItem(VOLUME_STORAGE_KEY));
    if (Number.isFinite(stored) && stored >= 0 && stored <= 1) return stored;
  } catch {
    // ignore
  }
  return 0.85;
}

// Never let an IndexedDB read block the start of a network stream forever.
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlaybackSource {
  type: 'playlist' | 'favorites' | 'catalog' | 'album';
  name: string;
}

interface AudioContextType {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  isBuffering: boolean;
  playbackError: string | null;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  parsedLyrics: LyricLine[];
  activeLyricIndex: number;
  showLyricsView: boolean;
  playbackSource: PlaybackSource | null;
  isRightPanelOpen: boolean;
  rightPanelTab: 'now-playing' | 'queue';
  isCenterLyricsOpen: boolean;
  isFullscreenNowPlaying: boolean;

  // Actions
  playSong: (song: Song, newQueue?: Song[], source?: PlaybackSource) => void;
  togglePlayPause: () => void;
  seek: (seconds: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (val: number) => void;
  toggleMute: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  setShowLyricsView: (show: boolean) => void;
  setPlaybackSource: (source: PlaybackSource | null) => void;
  setIsRightPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRightPanelTab: (tab: 'now-playing' | 'queue') => void;
  setIsCenterLyricsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsFullscreenNowPlaying: React.Dispatch<React.SetStateAction<boolean>>;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { recordSongPlay, isDownloaded } = useMusic();
  const { isAuthenticated, currentUser } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const hasRecordedPlayRef = useRef<string | null>(null);
  const playRequestRef = useRef<number>(0);
  const previousUserIdRef = useRef<string | null>(currentUser?.id || null);

  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(getInitialVolume);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [showLyricsView, setShowLyricsView] = useState<boolean>(false);
  const [playbackSource, setPlaybackSource] = useState<PlaybackSource | null>(null);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(true);
  const [rightPanelTab, setRightPanelTab] = useState<'now-playing' | 'queue'>('now-playing');
  const [isCenterLyricsOpen, setIsCenterLyricsOpen] = useState<boolean>(false);
  const [isFullscreenNowPlaying, setIsFullscreenNowPlaying] = useState<boolean>(false);

  // Initialize Audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = volume;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onDurationChange = () => {
      if (!isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPlaying = () => {
      setIsPlaying(true);
      setIsBuffering(false);
    };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onStalled = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);
    const onLoadStart = () => setIsBuffering(true);
    const onEmptied = () => {
      setCurrentTime(0);
      setDuration(0);
    };
    const onError = (e: Event) => {
      console.warn('Audio playback error:', e);
      setIsPlaying(false);
      setIsBuffering(false);
      setPlaybackError(
        'No se pudo reproducir esta canción. Verifica el enlace o inténtalo de nuevo.'
      );
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('loadstart', onLoadStart);
    audio.addEventListener('emptied', onEmptied);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('loadstart', onLoadStart);
      audio.removeEventListener('emptied', onEmptied);
      audio.removeEventListener('error', onError);
      audio.pause();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }

    playRequestRef.current += 1;
    setIsPlaying(false);
    setIsBuffering(false);
    setCurrentSong(null);
    setQueue([]);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackError(null);

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  // Persist volume between sessions
  useEffect(() => {
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
    } catch {
      // ignore
    }
  }, [volume]);

  // Logging out must stop playback immediately (otherwise the previous
  // session's music keeps playing on the lock screen / another profile).
  useEffect(() => {
    if (!isAuthenticated) {
      stopPlayback();
    }
  }, [isAuthenticated, stopPlayback]);

  // Switching to another profile should not inherit the previous queue.
  useEffect(() => {
    const nextUserId = currentUser?.id || null;
    if (
      previousUserIdRef.current &&
      nextUserId &&
      previousUserIdRef.current !== nextUserId
    ) {
      stopPlayback();
    }
    previousUserIdRef.current = nextUserId;
  }, [currentUser?.id, stopPlayback]);

  // Sync lyrics parsing
  const parsedLyrics = React.useMemo(() => {
    if (!currentSong?.lyricsLrc) return [];
    return parseLrc(currentSong.lyricsLrc);
  }, [currentSong?.lyricsLrc]);

  const activeLyricIndex = React.useMemo(() => {
    return getActiveLyricIndex(parsedLyrics, currentTime);
  }, [parsedLyrics, currentTime]);

  // Record personal play event after ~3 seconds of continuous playback
  useEffect(() => {
    if (currentSong && currentTime > 3 && hasRecordedPlayRef.current !== currentSong.id) {
      hasRecordedPlayRef.current = currentSong.id;
      recordSongPlay(currentSong.id);
    }
  }, [currentSong, currentTime, recordSongPlay]);

  // Load and play song (handling offline blob caching transparently)
  const loadAndPlaySong = useCallback(
    async (song: Song) => {
      const audio = audioRef.current;
      if (!audio) return;

      const requestId = ++playRequestRef.current;
      hasRecordedPlayRef.current = null;
      setPlaybackError(null);
      setIsBuffering(true);

      // Revoke previous blob url if exists
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      let audioSource = song.audioUrl;
      let usedBlob = false;

      // Only touch IndexedDB when the song is actually downloaded. Looking up
      // every song on every play added a noticeable delay on mobile devices.
      if (isDownloaded(song.id)) {
        const cachedBlob = await withTimeout(getSongBlob(song.id), 1200);
        if (requestId !== playRequestRef.current) return;

        if (cachedBlob) {
          const objectUrl = URL.createObjectURL(cachedBlob);
          blobUrlRef.current = objectUrl;
          audioSource = objectUrl;
          usedBlob = true;
        }
      }

      if (requestId !== playRequestRef.current) return;

      if (!audioSource) {
        setIsBuffering(false);
        setPlaybackError('Esta canción no tiene un enlace de audio válido.');
        return;
      }

      try {
        audio.preload = 'auto';
        audio.src = audioSource;
        audio.currentTime = 0;
        await audio.play();
      } catch (err) {
        if (requestId !== playRequestRef.current) return;

        // A corrupt/evicted offline blob should never block network playback.
        if (usedBlob) {
          try {
            if (blobUrlRef.current) {
              URL.revokeObjectURL(blobUrlRef.current);
              blobUrlRef.current = null;
            }
            audio.src = song.audioUrl;
            await audio.play();
            return;
          } catch {
            // fall through to the visible error below
          }
        }

        console.warn('Playback error or auto-play prevented:', err);
        setIsPlaying(false);
        setIsBuffering(false);
        setPlaybackError(
          'No se pudo reproducir esta canción. Puede que el enlace esté caído o bloqueado.'
        );
      }
    },
    [isDownloaded]
  );

  // Play a specific song and optionally update queue and source
  const playSong = useCallback((song: Song, newQueue?: Song[], source?: PlaybackSource) => {
    setCurrentSong(song);
    if (source) {
      setPlaybackSource(source);
    }
    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
    } else {
      setQueue((prev) => (prev.some((s) => s.id === song.id) ? prev : [song, ...prev]));
    }
    loadAndPlaySong(song);
  }, [loadAndPlaySong]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    if (isPlaying) {
      audio.pause();
    } else {
      setPlaybackError(null);
      audio.play().catch((err) => {
        console.warn('No se pudo reanudar la reproducción:', err);
        setPlaybackError('No se pudo reanudar la reproducción. Inténtalo de nuevo.');
      });
    }
  }, [isPlaying, currentSong]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setCurrentTime(seconds);
  }, []);

  const nextTrack = useCallback(() => {
    if (!currentSong || queue.length === 0) return;

    const currentIndex = queue.findIndex((s) => s.id === currentSong.id);
    let nextIndex = currentIndex + 1;

    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        return; // reached end of queue
      }
    }

    const nextSong = queue[nextIndex];
    if (nextSong) {
      playSong(nextSong);
    }
  }, [currentSong, queue, isShuffle, repeatMode, playSong]);

  const prevTrack = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong || queue.length === 0) return;

    // If more than 3 seconds in, restart the song
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }

    const currentIndex = queue.findIndex((s) => s.id === currentSong.id);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;
    const prevSong = queue[prevIndex];
    if (prevSong) {
      playSong(prevSong);
    }
  }, [currentSong, queue, playSong]);

  // Handle song ended event with repeat logic
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(console.error);
      } else {
        nextTrack();
      }
    };

    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [repeatMode, nextTrack]);

  // Volume controls
  const setVolume = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isMuted) {
      audio.volume = volume;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleRepeat = () => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  const toggleShuffle = () => {
    setIsShuffle((prev) => !prev);
  };

  // MediaSession API Integration (Lock Screen, Notification Controls, Car Bluetooth)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentSong) return;

    try {
      const artwork = currentSong.coverUrl
        ? [
            { src: currentSong.coverUrl, sizes: '96x96', type: 'image/jpeg' },
            { src: currentSong.coverUrl, sizes: '128x128', type: 'image/jpeg' },
            { src: currentSong.coverUrl, sizes: '256x256', type: 'image/jpeg' },
            { src: currentSong.coverUrl, sizes: '512x512', type: 'image/jpeg' },
          ]
        : [];

      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist,
        album: currentSong.album || 'freelymusic',
        artwork,
      });

      navigator.mediaSession.setActionHandler('play', () => togglePlayPause());
      navigator.mediaSession.setActionHandler('pause', () => togglePlayPause());
      navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          seek(details.seekTime);
        }
      });
    } catch (err) {
      // Some browsers do not support every MediaSession action.
      console.warn('MediaSession no disponible por completo:', err);
    }
  }, [currentSong, togglePlayPause, prevTrack, nextTrack, seek]);

  return (
    <AudioContext.Provider
      value={{
        currentSong,
        queue,
        isPlaying,
        isBuffering,
        playbackError,
        currentTime,
        duration,
        volume,
        isMuted,
        repeatMode,
        isShuffle,
        parsedLyrics,
        activeLyricIndex,
        showLyricsView,
        playbackSource,
        isRightPanelOpen,
        rightPanelTab,
        isCenterLyricsOpen,
        isFullscreenNowPlaying,
        playSong,
        togglePlayPause,
        seek,
        nextTrack,
        prevTrack,
        setVolume,
        toggleMute,
        toggleRepeat,
        toggleShuffle,
        setShowLyricsView,
        setPlaybackSource,
        setIsRightPanelOpen,
        setRightPanelTab,
        setIsCenterLyricsOpen,
        setIsFullscreenNowPlaying,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) throw new Error('useAudio must be used within an AudioProvider');
  return context;
};
