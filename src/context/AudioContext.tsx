import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Song, LyricLine, SongVersion } from '../types';
import { parseLrc, getActiveLyricIndex } from '../utils/lyrics';
import { getSongBlob } from '../services/storage';
import { translateLyricsWithCache } from '../services/translation';
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
  type: 'playlist' | 'favorites' | 'catalog' | 'album' | 'artist';
  name: string;
  id?: string;
}

interface AudioContextType {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  isBuffering: boolean;
  playbackError: string | null;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  parsedLyrics: LyricLine[];
  showLyricsView: boolean;
  playbackSource: PlaybackSource | null;
  isRightPanelOpen: boolean;
  rightPanelTab: 'now-playing' | 'queue';
  isCenterLyricsOpen: boolean;
  isFullscreenNowPlaying: boolean;

  // Versions, karaoke & video
  activeVersionId: string | null;
  activeVersionLabel: string;
  availableVersions: SongVersion[];
  setActiveVersion: (versionId: string | null) => void;
  isKaraoke: boolean;
  hasInstrumental: boolean;
  toggleKaraoke: () => void;
  isVideoMode: boolean;
  videoUrl: string | null;
  openVideo: () => void;
  closeVideo: (seconds?: number) => void;

  // Lyrics translation
  translatedLyrics: LyricLine[];
  lyricsDisplayMode: 'original' | 'translation' | 'both';
  setLyricsDisplayMode: (mode: 'original' | 'translation' | 'both') => void;
  translationLang: string;
  setTranslationLang: (lang: string) => void;
  translationSourceLang: string;
  setTranslationSourceLang: (lang: string) => void;
  translationStatus: 'idle' | 'loading' | 'error';
  translationError: string | null;
  translationProvider: string | null;
  translationUpdatedAt: string | null;
  translateCurrentLyrics: (lang?: string) => Promise<void>;
  clearTranslation: () => void;

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

interface AudioTimeState {
  currentTime: number;
  duration: number;
  activeLyricIndex: number;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);
// Time updates several times per second. Keeping them in a separate context
// prevents the whole app (sidebar, views, player controls) from re-rendering
// on every `timeupdate` event.
const AudioTimeContext = createContext<AudioTimeState | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { recordSongPlay, recordListeningTime, isDownloaded, updateCatalogTrack } = useMusic();
  const { isAuthenticated, currentUser } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const hasRecordedPlayRef = useRef<string | null>(null);
  const playRequestRef = useRef<number>(0);
  const previousUserIdRef = useRef<string | null>(currentUser?.id || null);

  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const currentSongRef = useRef<Song | null>(null);
  currentSongRef.current = currentSong;
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

  // Versions / karaoke / video
  const [activeVersionId, setActiveVersionIdState] = useState<string | null>(null);
  const [isKaraoke, setIsKaraoke] = useState<boolean>(false);
  const [isVideoMode, setIsVideoMode] = useState<boolean>(false);

  // Lyrics translation
  const [translatedLyrics, setTranslatedLyrics] = useState<LyricLine[]>([]);
  const [lyricsDisplayMode, setLyricsDisplayModeState] = useState<
    'original' | 'translation' | 'both'
  >('original');
  const [translationLang, setTranslationLangState] = useState<string>('es');
  const [translationSourceLang, setTranslationSourceLangState] = useState<string>('auto');
  const [translationStatus, setTranslationStatus] = useState<
    'idle' | 'loading' | 'error'
  >('idle');
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translationProvider, setTranslationProvider] = useState<string | null>(null);
  const [translationUpdatedAt, setTranslationUpdatedAt] = useState<string | null>(null);
  const translationRequestRef = useRef<number>(0);

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
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        const rounded = Math.round(audio.duration);
        setDuration(rounded);

        const active = currentSongRef.current;
        if (active && (active.duration === 180 || active.duration <= 0 || Math.abs(active.duration - rounded) > 2)) {
          active.duration = rounded;
          updateCatalogTrack({ ...active, duration: rounded });
        }
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
    const onCanPlay = () => {
      setIsBuffering(false);
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        const rounded = Math.round(audio.duration);
        setDuration(rounded);

        const active = currentSongRef.current;
        if (active && (active.duration === 180 || active.duration <= 0 || Math.abs(active.duration - rounded) > 2)) {
          active.duration = rounded;
          updateCatalogTrack({ ...active, duration: rounded });
        }
      }
    };
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
    translationRequestRef.current += 1;
    setIsPlaying(false);
    setIsBuffering(false);
    setCurrentSong(null);
    setQueue([]);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackError(null);

    setActiveVersionIdState(null);
    setIsKaraoke(false);
    setIsVideoMode(false);
    setTranslatedLyrics([]);
    setLyricsDisplayModeState('original');
    setTranslationStatus('idle');
    setTranslationError(null);
    setTranslationProvider(null);
    setTranslationUpdatedAt(null);

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    // Do not leave the previous session's song on the lock screen.
    try {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
      }
    } catch {
      // ignore
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

  const activeVersion = React.useMemo(() => {
    if (!currentSong?.versions?.length || !activeVersionId) return null;
    return currentSong.versions.find((version) => version.id === activeVersionId) || null;
  }, [currentSong, activeVersionId]);

  const playbackTrack = React.useMemo(() => {
    if (!currentSong) return null;
    if (!activeVersion) return currentSong;

    return {
      ...currentSong,
      audioUrl: activeVersion.audioUrl || currentSong.audioUrl,
      lyricsLrc: activeVersion.lyricsLrc ?? currentSong.lyricsLrc,
      plainLyrics: activeVersion.plainLyrics ?? currentSong.plainLyrics,
      duration: activeVersion.duration ?? currentSong.duration,
      videoUrl: activeVersion.videoUrl ?? currentSong.videoUrl,
      instrumentalUrl: activeVersion.instrumentalUrl ?? currentSong.instrumentalUrl,
      instrumentalLyricsLrc:
        activeVersion.instrumentalLyricsLrc ?? currentSong.instrumentalLyricsLrc,
      instrumentalOffset:
        activeVersion.instrumentalOffset ?? currentSong.instrumentalOffset,
    };
  }, [currentSong, activeVersion]);

  const availableVersions = React.useMemo(
    () => currentSong?.versions || [],
    [currentSong]
  );

  const activeVersionLabel = activeVersion?.label || 'Original';
  const hasInstrumental = Boolean(playbackTrack?.instrumentalUrl);
  const videoUrl = playbackTrack?.videoUrl || null;

  // Karaoke can have its own LRC with different timings. Prefer it when present.
  const effectiveLyricsLrc =
    isKaraoke && playbackTrack?.instrumentalLyricsLrc
      ? playbackTrack.instrumentalLyricsLrc
      : playbackTrack?.lyricsLrc;

  // Sync lyrics parsing. If the instrumental has an offset but no its own LRC,
  // shift the original timestamps so they still match the karaoke audio.
  const parsedLyrics = React.useMemo(() => {
    if (!effectiveLyricsLrc) return [];

    const lines = parseLrc(effectiveLyricsLrc);
    if (isKaraoke && !playbackTrack?.instrumentalLyricsLrc) {
      const offset = Number(playbackTrack?.instrumentalOffset || 0);
      if (offset !== 0) {
        return lines
          .map((line) => ({ ...line, time: Math.max(0, line.time - offset) }))
          .sort((a, b) => a.time - b.time);
      }
    }
    return lines;
  }, [
    effectiveLyricsLrc,
    isKaraoke,
    playbackTrack?.instrumentalLyricsLrc,
    playbackTrack?.instrumentalOffset,
  ]);

  const activeLyricIndex = React.useMemo(() => {
    return getActiveLyricIndex(parsedLyrics, currentTime);
  }, [parsedLyrics, currentTime]);

  // Changing songs, versions or karaoke mode invalidates the current translation.
  useEffect(() => {
    translationRequestRef.current += 1;
    setTranslatedLyrics([]);
    setLyricsDisplayModeState('original');
    setTranslationStatus('idle');
    setTranslationError(null);
    setTranslationProvider(null);
    setTranslationUpdatedAt(null);
  }, [currentSong?.id, activeVersionId, isKaraoke]);

  // Record personal play event after ~3 seconds of continuous playback
  useEffect(() => {
    if (
      currentSong &&
      isPlaying &&
      currentTime > 3 &&
      hasRecordedPlayRef.current !== currentSong.id
    ) {
      hasRecordedPlayRef.current = currentSong.id;
      recordSongPlay(currentSong.id);
    }
  }, [currentSong, currentTime, isPlaying, recordSongPlay]);

  // Accumulate listening time in 10-second chunks while audio is playing.
  // Video mode tracks its own time from the video element.
  useEffect(() => {
    if (!isPlaying || isVideoMode || !currentSong) return;

    const interval = setInterval(() => {
      recordListeningTime(currentSong.id, currentSong.artist, 10);
    }, 10000);

    return () => clearInterval(interval);
  }, [
    isPlaying,
    isVideoMode,
    currentSong?.id,
    currentSong?.artist,
    recordListeningTime,
  ]);

  // Load and play song (handling offline blob caching, versions and karaoke)
  const loadAndPlaySong = useCallback(
    async (
      song: Song,
      options?: {
        versionId?: string | null;
        karaoke?: boolean;
        startAt?: number;
      }
    ) => {
      const audio = audioRef.current;
      if (!audio) return;

      const requestId = ++playRequestRef.current;
      const version = options?.versionId
        ? song.versions?.find((item) => item.id === options.versionId)
        : null;
      const karaoke = options?.karaoke === true;
      const baseUrl = version?.audioUrl || song.audioUrl;
      const instrumentalUrl = version?.instrumentalUrl ?? song.instrumentalUrl;
      const canUseOffline = !version && !karaoke;

      hasRecordedPlayRef.current = null;
      setPlaybackError(null);
      setIsBuffering(true);

      // Revoke previous blob url if exists
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      let audioSource = karaoke && instrumentalUrl ? instrumentalUrl : baseUrl;
      let usedBlob = false;

      // Only touch IndexedDB when the song is actually downloaded and we are
      // playing its original audio. Alternates/karaoke are streamed.
      if (canUseOffline && isDownloaded(song.id)) {
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
        setPlaybackError(
          karaoke
            ? 'Esta canción no tiene una pista instrumental válida.'
            : 'Esta canción no tiene un enlace de audio válido.'
        );
        return;
      }

      try {
        audio.preload = 'auto';
        audio.src = audioSource;

        const startAt = options?.startAt;
        if (typeof startAt === 'number' && Number.isFinite(startAt) && startAt > 0) {
          const applyStart = () => {
            try {
              audio.currentTime = startAt;
            } catch {
              // The browser will clamp values outside the media range.
            }
            audio.removeEventListener('loadedmetadata', applyStart);
          };
          audio.addEventListener('loadedmetadata', applyStart);
        } else {
          audio.currentTime = 0;
        }

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
            audio.src = baseUrl;
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
  const playSong = useCallback(
    (song: Song, newQueue?: Song[], source?: PlaybackSource) => {
      setCurrentSong(song);
      setActiveVersionIdState(null);
      setIsKaraoke(false);
      setIsVideoMode(false);
      if (source) {
        setPlaybackSource(source);
      }
      if (newQueue && newQueue.length > 0) {
        setQueue(newQueue);
      } else {
        setQueue((prev) => (prev.some((s) => s.id === song.id) ? prev : [song, ...prev]));
      }
      void loadAndPlaySong(song, { versionId: null, karaoke: false });
    },
    [loadAndPlaySong]
  );

  const setActiveVersion = useCallback(
    (versionId: string | null) => {
      if (!currentSong) {
        setActiveVersionIdState(versionId);
        return;
      }

      const version = versionId
        ? currentSong.versions?.find((item) => item.id === versionId)
        : null;
      if (versionId && !version) return;

      const nextKaraoke =
        isKaraoke && Boolean(version?.instrumentalUrl ?? currentSong.instrumentalUrl);

      setActiveVersionIdState(versionId);
      setIsKaraoke(nextKaraoke);
      setIsVideoMode(false);

      const audio = audioRef.current;
      const startAt = audio?.currentTime || 0;
      void loadAndPlaySong(currentSong, {
        versionId,
        karaoke: nextKaraoke,
        startAt,
      });
    },
    [currentSong, isKaraoke, loadAndPlaySong]
  );

  const toggleKaraoke = useCallback(() => {
    if (!currentSong) return;

    const instrumental =
      activeVersion?.instrumentalUrl ?? currentSong.instrumentalUrl;
    if (!instrumental) return;

    const audio = audioRef.current;
    const current = audio?.currentTime || 0;
    const offset = Number(
      activeVersion?.instrumentalOffset ?? currentSong.instrumentalOffset ?? 0
    );
    const nextKaraoke = !isKaraoke;
    const startAt = Math.max(0, current + (nextKaraoke ? offset : -offset));

    setIsKaraoke(nextKaraoke);
    setIsVideoMode(false);

    void loadAndPlaySong(currentSong, {
      versionId: activeVersionId,
      karaoke: nextKaraoke,
      startAt,
    });
  }, [
    currentSong,
    activeVersion,
    activeVersionId,
    isKaraoke,
    loadAndPlaySong,
  ]);

  const openVideo = useCallback(() => {
    if (!playbackTrack?.videoUrl) return;
    audioRef.current?.pause();
    setIsVideoMode(true);
  }, [playbackTrack]);

  const closeVideo = useCallback((seconds?: number) => {
    setIsVideoMode(false);
    const audio = audioRef.current;
    if (!audio) return;

    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      const maxTime = Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : seconds;
      audio.currentTime = Math.max(0, Math.min(seconds, maxTime));
      setCurrentTime(audio.currentTime);
    }

    audio.play().catch((err) => {
      console.warn('No se pudo reanudar el audio al cerrar el video:', err);
    });
  }, []);

  const clearTranslation = useCallback(() => {
    translationRequestRef.current += 1;
    setTranslatedLyrics([]);
    setLyricsDisplayModeState('original');
    setTranslationStatus('idle');
    setTranslationError(null);
    setTranslationProvider(null);
    setTranslationUpdatedAt(null);
  }, []);

  const setLyricsDisplayMode = useCallback(
    (mode: 'original' | 'translation' | 'both') => {
      if (mode !== 'original' && translatedLyrics.length === 0) return;
      setLyricsDisplayModeState(mode);
    },
    [translatedLyrics.length]
  );

  const setTranslationLang = useCallback(
    (lang: string) => {
      setTranslationLangState(lang);
      clearTranslation();
    },
    [clearTranslation]
  );

  const setTranslationSourceLang = useCallback(
    (lang: string) => {
      setTranslationSourceLangState(lang);
      clearTranslation();
    },
    [clearTranslation]
  );

  const translateCurrentLyrics = useCallback(
    async (lang?: string) => {
      if (!currentSong) return;

      const targetLang = lang || translationLang;
      const lrc = effectiveLyricsLrc;

      if (!lrc || !lrc.trim()) {
        setTranslationStatus('error');
        setTranslationError('Esta canción no tiene una letra sincronizada para traducir.');
        return;
      }

      const requestId = translationRequestRef.current + 1;
      translationRequestRef.current = requestId;

      setTranslationStatus('loading');
      setTranslationError(null);

      try {
        const result = await translateLyricsWithCache({
          songId: currentSong.id,
          versionId: activeVersionId || 'original',
          lrc,
          targetLang,
          sourceLang:
            translationSourceLang === 'auto' ? undefined : translationSourceLang,
          songTitle: currentSong.title,
          artist: currentSong.artist,
        });

        if (requestId !== translationRequestRef.current) return;

        setTranslatedLyrics(result.lines);
        setTranslationProvider(result.provider);
        setTranslationUpdatedAt(result.updatedAt);
        setTranslationStatus('idle');
        setTranslationLangState(targetLang);
        setLyricsDisplayModeState('both');
      } catch (err) {
        if (requestId !== translationRequestRef.current) return;
        console.warn('No se pudo traducir la letra:', err);
        setTranslationStatus('error');
        setTranslationError(
          err instanceof Error
            ? err.message
            : 'No se pudo traducir la letra en este momento.'
        );
      }
    },
    [
      currentSong,
      effectiveLyricsLrc,
      activeVersionId,
      translationLang,
      translationSourceLang,
    ]
  );

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong || isVideoMode) return;

    if (isPlaying) {
      audio.pause();
    } else {
      setPlaybackError(null);
      audio.play().catch((err) => {
        console.warn('No se pudo reanudar la reproducción:', err);
        setPlaybackError('No se pudo reanudar la reproducción. Inténtalo de nuevo.');
      });
    }
  }, [isPlaying, currentSong, isVideoMode]);

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
  const setVolume = useCallback(
    (val: number) => {
      const clamped = Math.max(0, Math.min(1, val));
      setVolumeState(clamped);
      if (audioRef.current) {
        audioRef.current.volume = clamped;
      }
      if (clamped > 0 && isMuted) {
        setIsMuted(false);
      }
    },
    [isMuted]
  );

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isMuted) {
      audio.volume = volume;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => !prev);
  }, []);

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

  const audioTimeValue = React.useMemo(
    () => ({ currentTime, duration, activeLyricIndex }),
    [currentTime, duration, activeLyricIndex]
  );

  const audioValue = React.useMemo(
    () => ({
      currentSong,
      queue,
      isPlaying,
      isBuffering,
      playbackError,
      volume,
      isMuted,
      repeatMode,
      isShuffle,
      parsedLyrics,
      showLyricsView,
      playbackSource,
      isRightPanelOpen,
      rightPanelTab,
      isCenterLyricsOpen,
      isFullscreenNowPlaying,
      activeVersionId,
      activeVersionLabel,
      availableVersions,
      setActiveVersion,
      isKaraoke,
      hasInstrumental,
      toggleKaraoke,
      isVideoMode,
      videoUrl,
      openVideo,
      closeVideo,
      translatedLyrics,
      lyricsDisplayMode,
      setLyricsDisplayMode,
      translationLang,
      setTranslationLang,
      translationSourceLang,
      setTranslationSourceLang,
      translationStatus,
      translationError,
      translationProvider,
      translationUpdatedAt,
      translateCurrentLyrics,
      clearTranslation,
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
    }),
    [
      currentSong,
      queue,
      isPlaying,
      isBuffering,
      playbackError,
      volume,
      isMuted,
      repeatMode,
      isShuffle,
      parsedLyrics,
      showLyricsView,
      playbackSource,
      isRightPanelOpen,
      rightPanelTab,
      isCenterLyricsOpen,
      isFullscreenNowPlaying,
      activeVersionId,
      activeVersionLabel,
      availableVersions,
      setActiveVersion,
      isKaraoke,
      hasInstrumental,
      toggleKaraoke,
      isVideoMode,
      videoUrl,
      openVideo,
      closeVideo,
      translatedLyrics,
      lyricsDisplayMode,
      setLyricsDisplayMode,
      translationLang,
      setTranslationLang,
      translationSourceLang,
      setTranslationSourceLang,
      translationStatus,
      translationError,
      translationProvider,
      translationUpdatedAt,
      translateCurrentLyrics,
      clearTranslation,
      playSong,
      togglePlayPause,
      seek,
      nextTrack,
      prevTrack,
      setVolume,
      toggleMute,
      toggleRepeat,
      toggleShuffle,
    ]
  );

  return (
    <AudioContext.Provider value={audioValue}>
      <AudioTimeContext.Provider value={audioTimeValue}>
        {children}
      </AudioTimeContext.Provider>
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) throw new Error('useAudio must be used within an AudioProvider');
  return context;
};

export const useAudioTime = () => {
  const context = useContext(AudioTimeContext);
  if (!context) throw new Error('useAudioTime must be used within an AudioProvider');
  return context;
};
