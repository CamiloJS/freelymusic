import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Song, LyricLine, SongVersion } from '../types';
import { parseLrc, getActiveLyricIndex } from '../utils/lyrics';
import { getSongBlob, getInstrumentalBlob, getVideoBlob } from '../services/storage';
import { translateLyricsWithCache } from '../services/translation';
import { useMusic } from './MusicContext';
import { useAuth } from './AuthContext';
import { useConnect } from './ConnectContext';

const VOLUME_STORAGE_KEY = 'musica_volume';
const LAST_PLAYBACK_KEY = 'musica_last_playback_state';

interface LastPlaybackState {
  songId: string;
  currentTime: number;
  playbackSource?: PlaybackSource | null;
  queueIds?: string[];
  activeVersionId?: string | null;
  isKaraoke?: boolean;
}

function getInitialVolume(): number {
  try {
    const stored = Number(localStorage.getItem(VOLUME_STORAGE_KEY));
    if (Number.isFinite(stored) && stored >= 0 && stored <= 1) return stored;
  } catch {
    // ignore
  }
  return 0.85;
}

export function stopAllVideos() {
  if (typeof document !== 'undefined') {
    document.querySelectorAll('video').forEach((v) => {
      try {
        v.pause();
        v.muted = true;
        v.removeAttribute('src');
        v.load();
      } catch {}
    });
  }
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
  type: 'playlist' | 'favorites' | 'catalog' | 'album' | 'artist' | 'search';
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
  syncMediaTime: (seconds: number) => void;

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

  // Sleep Timer / Temporizador de sueño
  sleepTimerOption: string | null;
  sleepTimerRemainingSeconds: number | null;
  setSleepTimer: (option: string | null) => void;
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
  const { catalog, recordSongPlay, recordListeningTime, isDownloaded, updateCatalogTrack } = useMusic();
  const { isAuthenticated, currentUser } = useAuth();
  const connect = useConnect();
  const connectRef = useRef(connect);
  connectRef.current = connect;
  const [remoteCurrentTime, setRemoteCurrentTime] = useState<number>(0);
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
  const isVideoModeRef = useRef<boolean>(false);
  useEffect(() => {
    isVideoModeRef.current = isVideoMode;
  }, [isVideoMode]);

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

  // Initialize Audio element once with mobile PWA optimizations
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    (audio as unknown as { playsInline?: boolean; webkitPlaysInline?: boolean }).playsInline = true;
    (audio as unknown as { playsInline?: boolean; webkitPlaysInline?: boolean }).webkitPlaysInline = true;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    audio.style.display = 'none';

    // On mobile devices, ensure volume is 1.0 by default so the device hardware rocker controls sound
    const isMobile =
      typeof navigator !== 'undefined' &&
      (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (typeof window !== 'undefined' && window.innerWidth < 768));
    audio.volume = isMobile ? 1.0 : volume;

    // Attach to DOM so Android Chromium / PWA engines grant full foreground audio privileges
    if (typeof document !== 'undefined' && document.body && !document.body.contains(audio)) {
      document.body.appendChild(audio);
    }

    audioRef.current = audio;

    // Mobile one-time audio gesture unlocker
    const unlockAudio = () => {
      try {
        if (audio && audio.paused && !audio.src) {
          audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
          const p = audio.play();
          if (p && typeof p.then === 'function') {
            p.then(() => {
              audio.pause();
              audio.removeAttribute('src');
            }).catch(() => {});
          }
        }
      } catch {}
      window.removeEventListener('pointerdown', unlockAudio, true);
      window.removeEventListener('touchstart', unlockAudio, true);
      window.removeEventListener('click', unlockAudio, true);
    };

    window.addEventListener('pointerdown', unlockAudio, true);
    window.addEventListener('touchstart', unlockAudio, true);
    window.addEventListener('click', unlockAudio, true);

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setIsBuffering(false);
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

    const onPlay = () => {
      if (!isVideoModeRef.current) {
        setIsPlaying(true);
      }
      if (connectRef.current.isCurrentDeviceActive && currentSongRef.current) {
        void connectRef.current.publishPlaybackState({
          songId: currentSongRef.current.id,
          isPlaying: true,
          positionSec: audio.currentTime,
        });
      }
    };
    const onPlaying = () => {
      if (!isVideoModeRef.current) {
        setIsPlaying(true);
      }
      setIsBuffering(false);
    };
    const onPause = () => {
      if (!isVideoModeRef.current) {
        setIsPlaying(false);
      }
      if (connectRef.current.isCurrentDeviceActive && currentSongRef.current) {
        void connectRef.current.publishPlaybackState({
          songId: currentSongRef.current.id,
          isPlaying: false,
          positionSec: audio.currentTime,
        });
      }
    };
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
      const mediaErr = audio.error;
      // Abort error happens normally when switching tracks; do not stop playback
      if (mediaErr && mediaErr.code === 1) return; // MEDIA_ERR_ABORTED

      console.warn('Audio playback error:', mediaErr ? `code ${mediaErr.code}: ${mediaErr.message}` : e);

      // If playing an offline blob failed on Android, automatically attempt online baseUrl fallback
      const active = currentSongRef.current;
      if (blobUrlRef.current && active && typeof navigator !== 'undefined' && navigator.onLine) {
        console.log('Reintentando reproducción desde audioUrl online tras fallo de blob offline...');
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
        audio.src = active.audioUrl;
        audio.play().catch(() => {
          setIsPlaying(false);
          setIsBuffering(false);
          setPlaybackError(
            'No se pudo reproducir esta canción. Verifica el enlace o inténtalo de nuevo.'
          );
        });
        return;
      }

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
      window.removeEventListener('pointerdown', unlockAudio, true);
      window.removeEventListener('touchstart', unlockAudio, true);
      window.removeEventListener('click', unlockAudio, true);
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
      if (typeof document !== 'undefined' && document.body && document.body.contains(audio)) {
        try {
          document.body.removeChild(audio);
        } catch {}
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

  // Restore last played song & playback time on startup
  const restoredPlaybackRef = useRef(false);

  useEffect(() => {
    if (restoredPlaybackRef.current || !catalog || catalog.length === 0) return;
    try {
      const raw = localStorage.getItem(LAST_PLAYBACK_KEY);
      if (!raw) return;
      const state: LastPlaybackState = JSON.parse(raw);
      if (!state?.songId) return;

      const targetSong = catalog.find((s) => s.id === state.songId);
      if (!targetSong) return;

      restoredPlaybackRef.current = true;
      setCurrentSong(targetSong);
      if (state.playbackSource) setPlaybackSource(state.playbackSource);
      if (state.queueIds && state.queueIds.length > 0) {
        const restoredQueue = state.queueIds
          .map((id) => catalog.find((s) => s.id === id))
          .filter((s): s is Song => Boolean(s));
        if (restoredQueue.length > 0) setQueue(restoredQueue);
      }
      if (state.activeVersionId) setActiveVersionIdState(state.activeVersionId);
      if (state.isKaraoke) setIsKaraoke(true);

      const targetTime =
        typeof state.currentTime === 'number' && Number.isFinite(state.currentTime)
          ? state.currentTime
          : 0;
      setCurrentTime(targetTime);
      setDuration(targetSong.duration || 0);

      const audio = audioRef.current;
      if (audio) {
        audio.src = targetSong.audioUrl;
        audio.preload = 'metadata';
        try {
          audio.currentTime = targetTime;
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.warn('Error al restaurar la última reproducción:', err);
    }
  }, [catalog]);

  // Persist current playback state (debounced)
  useEffect(() => {
    if (!currentSong) return;
    const saveState = () => {
      try {
        const state: LastPlaybackState = {
          songId: currentSong.id,
          currentTime,
          playbackSource,
          queueIds: queue.map((s) => s.id),
          activeVersionId,
          isKaraoke,
        };
        localStorage.setItem(LAST_PLAYBACK_KEY, JSON.stringify(state));
      } catch {
        // ignore
      }
    };

    const timer = setTimeout(saveState, 1200);
    return () => clearTimeout(timer);
  }, [
    currentSong?.id,
    Math.floor(currentTime),
    playbackSource,
    queue,
    activeVersionId,
    isKaraoke,
  ]);

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
  const hasInstrumental = Boolean(
    playbackTrack?.instrumentalUrl ||
    currentSong?.instrumentalUrl ||
    currentSong?.versions?.some((v) => v.type === 'instrumental' || Boolean(v.instrumentalUrl))
  );
  const [offlineVideoUrl, setOfflineVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    if (currentSong && isDownloaded(currentSong.id)) {
      getVideoBlob(currentSong.id, activeVersionId).then((blob) => {
        if (!active) return;
        if (blob) {
          createdUrl = URL.createObjectURL(blob);
          setOfflineVideoUrl(createdUrl);
        } else {
          setOfflineVideoUrl(null);
        }
      });
    } else {
      setOfflineVideoUrl(null);
    }

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [currentSong?.id, activeVersionId, isDownloaded]);

  const videoUrl = offlineVideoUrl || playbackTrack?.videoUrl || null;

  // Background preloader for music video so it buffers seamlessly while audio plays
  const bgVideoPreloadRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoUrl || isVideoMode || !isPlaying) return;

    // Buffer video in background after audio has streamed safely for 2.5 seconds
    const timer = setTimeout(() => {
      try {
        if (!bgVideoPreloadRef.current) {
          const v = document.createElement('video');
          v.preload = 'auto';
          v.muted = true;
          v.playsInline = true;
          bgVideoPreloadRef.current = v;
        }
        const preloader = bgVideoPreloadRef.current;
        if (preloader.src !== videoUrl) {
          preloader.src = videoUrl;
          preloader.load();
        }
      } catch (err) {
        console.warn('Background video preload error:', err);
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [videoUrl, isVideoMode, isPlaying]);


  // Remote sync: calculate smooth remoteCurrentTime without continuous Firestore writes
  useEffect(() => {
    if (!connect.isRemoteControl || !connect.remotePlayback) return;
    const { positionSec, timestampMs, isPlaying: remoteIsPlaying, durationSec } = connect.remotePlayback;
    if (!remoteIsPlaying) {
      setRemoteCurrentTime(positionSec || 0);
      return;
    }
    const updateTime = () => {
      const elapsed = (Date.now() - (timestampMs || Date.now())) / 1000;
      const dur = durationSec || (currentSong?.duration ?? 0);
      const est = dur > 0 ? Math.min(dur, Math.max(0, (positionSec || 0) + elapsed)) : Math.max(0, (positionSec || 0) + elapsed);
      setRemoteCurrentTime(est);
    };
    updateTime();
    const timer = setInterval(updateTime, 350);
    return () => clearInterval(timer);
  }, [connect.isRemoteControl, connect.remotePlayback, currentSong?.duration]);

  // When this device is remote control, make sure local audio is paused
  useEffect(() => {
    if (connect.isRemoteControl && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, [connect.isRemoteControl]);

  // Synchronize remote playback track and state to local UI when remote
  useEffect(() => {
    if (!connect.isRemoteControl || !connect.remotePlayback) return;
    const {
      songId,
      isPlaying: remotePlaying,
      volume: remoteVol,
      repeatMode: remoteRep,
      isShuffle: remoteShuf,
    } = connect.remotePlayback;

    if (songId && (!currentSongRef.current || currentSongRef.current.id !== songId)) {
      const found = catalog.find((s) => s.id === songId);
      if (found) {
        setCurrentSong(found);
      }
    }
    setIsPlaying(Boolean(remotePlaying));
    if (typeof remoteVol === 'number') {
      setVolumeState(remoteVol);
    }
    if (remoteRep) {
      setRepeatMode(remoteRep);
    }
    if (typeof remoteShuf === 'boolean') {
      setIsShuffle(remoteShuf);
    }
  }, [connect.isRemoteControl, connect.remotePlayback, catalog]);



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

  // Pre-load cached translation if one is already saved in cloud or local cache
  useEffect(() => {
    if (!currentSong || !effectiveLyricsLrc) return;
    const reqId = translationRequestRef.current;

    void translateLyricsWithCache({
      songId: currentSong.id,
      versionId: activeVersionId || 'original',
      lrc: effectiveLyricsLrc,
      targetLang: translationLang || 'es',
      songTitle: currentSong.title,
      artist: currentSong.artist,
    })
      .then((result) => {
        if (result && result.cached && reqId === translationRequestRef.current) {
          setTranslatedLyrics(result.lines);
          setTranslationProvider(result.provider);
          setTranslationUpdatedAt(result.updatedAt);
        }
      })
      .catch(() => {
        // Silent background preload
      });
  }, [currentSong?.id, activeVersionId, effectiveLyricsLrc, translationLang]);

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

  // Ensure the primary audio element is paused and muted whenever in video mode so audio never duplicates
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isVideoMode) {
      audio.muted = true;
      if (!audio.paused) {
        audio.pause();
      }
    } else {
      audio.muted = isMuted;
    }
  }, [isVideoMode, isMuted]);

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

      // Online vs Offline strategy:
      // When offline or if baseUrl is missing, use the cached blob from IndexedDB.
      // When online, use the remote audioUrl directly (which gives native HTTP Range 206 support,
      // reliable lockscreen controls, and avoids the Android WebView blob decode bug).
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const shouldUseOfflineBlob = (!isOnline || !audioSource) && canUseOffline && isDownloaded(song.id);

      if (shouldUseOfflineBlob || (canUseOffline && isDownloaded(song.id) && !isOnline)) {
        let cachedBlob: Blob | null = null;
        if (karaoke) {
          cachedBlob = await withTimeout(getInstrumentalBlob(song.id, options?.versionId), 1500);
        } else if (options?.versionId) {
          cachedBlob = await withTimeout(getSongBlob(`${song.id}-version-${options.versionId}`), 1500);
          if (!cachedBlob) {
            cachedBlob = await withTimeout(getSongBlob(song.id), 1500);
          }
        } else {
          cachedBlob = await withTimeout(getSongBlob(song.id), 1500);
        }

        if (requestId !== playRequestRef.current) return;

        if (cachedBlob) {
          const typedBlob =
            cachedBlob.type && cachedBlob.type.startsWith('audio/')
              ? cachedBlob
              : new Blob([cachedBlob], { type: 'audio/mpeg' });
          const objectUrl = URL.createObjectURL(typedBlob);
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
        (audio as unknown as { playsInline?: boolean; webkitPlaysInline?: boolean }).playsInline = true;
        (audio as unknown as { playsInline?: boolean; webkitPlaysInline?: boolean }).webkitPlaysInline = true;

        const isMobile =
          typeof navigator !== 'undefined' &&
          (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (typeof window !== 'undefined' && window.innerWidth < 768));
        if (isMobile) {
          audio.volume = 1.0;
        }

        if (audio.src !== audioSource) {
          audio.src = audioSource;
          if (usedBlob) {
            audio.load();
          }
        }

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
          try {
            if (audio.currentTime !== 0) audio.currentTime = 0;
          } catch {}
        }

        if (isVideoModeRef.current) {
          if (!song.videoUrl) {
            stopAllVideos();
            setIsVideoMode(false);
            audio.muted = isMuted;
            await audio.play();
          } else {
            audio.muted = true;
            audio.pause();
          }
        } else {
          stopAllVideos();
          audio.muted = isMuted;
          await audio.play();
        }
      } catch (err) {
        if (requestId !== playRequestRef.current) return;

        // Two-way automatic fallback:
        // 1. If usedBlob failed, try online baseUrl
        if (usedBlob && baseUrl) {
          try {
            if (blobUrlRef.current) {
              URL.revokeObjectURL(blobUrlRef.current);
              blobUrlRef.current = null;
            }
            audio.src = baseUrl;
            audio.muted = isMuted;
            await audio.play();
            return;
          } catch {}
        }

        // 2. If online baseUrl failed, try offline blob from IndexedDB
        if (!usedBlob && canUseOffline && isDownloaded(song.id)) {
          try {
            const cachedBlob = await getSongBlob(song.id);
            if (cachedBlob) {
              const typedBlob =
                cachedBlob.type && cachedBlob.type.startsWith('audio/')
                  ? cachedBlob
                  : new Blob([cachedBlob], { type: 'audio/mpeg' });
              const objectUrl = URL.createObjectURL(typedBlob);
              blobUrlRef.current = objectUrl;
              audio.src = objectUrl;
              audio.load();
              audio.muted = isMuted;
              await audio.play();
              return;
            }
          } catch {}
        }

        console.warn('Playback error or auto-play prevented:', err);
        setIsPlaying(false);
        setIsBuffering(false);
        setPlaybackError(
          'No se pudo reproducir esta canción. Puede que el enlace esté caído o bloqueado.'
        );
      }
    },
    [isDownloaded, isMuted]
  );

  // Play a specific song and optionally update queue and source
  const playSong = useCallback(
    (song: Song, newQueue?: Song[], source?: PlaybackSource) => {
      if (connect.isRemoteControl) {
        setCurrentSong(song);
        void connect.sendCommand('playSong', { songId: song.id });
        return;
      }
      stopAllVideos();
      setCurrentSong(song);
      setActiveVersionIdState(null);
      setIsKaraoke(false);
      setIsVideoMode(false);
      if (source !== undefined) {
        setPlaybackSource(source);
      } else {
        // If source is not explicitly passed:
        // Check if the song is continuing the active queue (e.g. next/prev track)
        const isContinuingQueue = queue.some((s) => s.id === song.id);
        if (isContinuingQueue) {
          // If continuing queue, but previous source was an album and current song's album differs,
          // update or clear the album source to avoid displaying wrong album
          setPlaybackSource((prev) => {
            if (prev?.type === 'album') {
              const currentSongAlb = song.album?.trim().toLowerCase();
              const prevAlb = prev.name?.trim().toLowerCase();
              if (!currentSongAlb || !prevAlb || currentSongAlb !== prevAlb) {
                return currentSongAlb && currentSongAlb !== 'sencillo'
                  ? { type: 'album', name: song.album.trim() }
                  : null;
              }
            }
            return prev;
          });
        } else {
          if (song.album && song.album.trim().toLowerCase() !== 'sencillo') {
            setPlaybackSource({ type: 'album', name: song.album.trim() });
          } else {
            setPlaybackSource(null);
          }
        }
      }
      if (newQueue && newQueue.length > 0) {
        setQueue(newQueue);
      } else {
        setQueue((prev) => (prev.some((s) => s.id === song.id) ? prev : [song, ...prev]));
      }

      // Synchronously capture user gesture activation on mobile browsers!
      const audio = audioRef.current;
      if (audio) {
        (audio as unknown as { playsInline?: boolean; webkitPlaysInline?: boolean }).playsInline = true;
        (audio as unknown as { playsInline?: boolean; webkitPlaysInline?: boolean }).webkitPlaysInline = true;
        audio.muted = false;

        const isMobile =
          typeof navigator !== 'undefined' &&
          (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (typeof window !== 'undefined' && window.innerWidth < 768));
        if (isMobile) {
          audio.volume = 1.0;
        }

        // Assign initial url immediately inside user gesture so Chrome Android accepts playback
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        if (song.audioUrl && (isOnline || !isDownloaded(song.id))) {
          if (audio.src !== song.audioUrl) {
            audio.src = song.audioUrl;
          }
          const p = audio.play();
          if (p && typeof p.catch === 'function') {
            p.catch(() => {});
          }
        }
      }

      void loadAndPlaySong(song, { versionId: null, karaoke: false });
      if (connect.isCurrentDeviceActive) {
        void connect.publishPlaybackState({
          songId: song.id,
          isPlaying: true,
          positionSec: 0,
          durationSec: song.duration,
          volume,
          repeatMode,
          isShuffle,
        });
      }
    },
    [isDownloaded, loadAndPlaySong]
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

    const instVersion = currentSong.versions?.find(
      (v) => v.type === 'instrumental' || Boolean(v.instrumentalUrl)
    );
    const instrumental =
      activeVersion?.instrumentalUrl ?? currentSong.instrumentalUrl ?? instVersion?.instrumentalUrl ?? instVersion?.audioUrl;
    if (!instrumental) return;

    const audio = audioRef.current;
    const current = audio?.currentTime || 0;
    const offset = Number(
      activeVersion?.instrumentalOffset ?? currentSong.instrumentalOffset ?? instVersion?.instrumentalOffset ?? 0
    );
    const nextKaraoke = !isKaraoke;
    const startAt = Math.max(0, current + (nextKaraoke ? offset : -offset));

    stopAllVideos();
    setIsKaraoke(nextKaraoke);
    setIsVideoMode(false);

    const targetVersionId =
      nextKaraoke && !activeVersion?.instrumentalUrl && !currentSong.instrumentalUrl && instVersion
        ? instVersion.id
        : activeVersionId;

    void loadAndPlaySong(currentSong, {
      versionId: targetVersionId,
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
    if (!videoUrl) return;
    if (audioRef.current) {
      audioRef.current.muted = true;
      audioRef.current.pause();
    }
    setIsPlaying(true);
    setIsVideoMode(true);
    setIsRightPanelOpen(true);
    setRightPanelTab('now-playing');
  }, [videoUrl]);

  const closeVideo = useCallback((seconds?: number) => {
    stopAllVideos();
    setIsVideoMode(false);
    const audio = audioRef.current;
    if (!audio) return;

    audio.muted = isMuted;

    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      const maxTime = Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : seconds;
      audio.currentTime = Math.max(0, Math.min(seconds, maxTime));
      setCurrentTime(audio.currentTime);
    }

    setIsPlaying(true);
    audio.play().catch((err) => {
      console.warn('No se pudo reanudar el audio al cerrar el video:', err);
    });
  }, [isMuted]);

  const syncMediaTime = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds)) return;
    setCurrentTime(seconds);
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
    if (!currentSong) return;
    if (connect.isRemoteControl) {
      void connect.sendCommand(isPlaying ? 'pause' : 'play');
      return;
    }
    if (isVideoMode) {
      setIsPlaying((prev) => !prev);
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      if (connect.isCurrentDeviceActive) {
        void connect.publishPlaybackState({ isPlaying: false, positionSec: audio.currentTime });
      }
    } else {
      if (connect.isCurrentDeviceActive) {
        void connect.publishPlaybackState({ isPlaying: true, positionSec: audio.currentTime });
      }
      setPlaybackError(null);
      audio.muted = false;
      const isMobile =
        typeof navigator !== 'undefined' &&
        (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (typeof window !== 'undefined' && window.innerWidth < 768));
      if (isMobile) {
        audio.volume = 1.0;
      }

      if (!audio.src || audio.src === '' || audio.src === window.location.href) {
        void loadAndPlaySong(currentSong);
        return;
      }

      audio.play().catch((err) => {
        console.warn('No se pudo reanudar la reproducción directamente, recargando...', err);
        void loadAndPlaySong(currentSong);
      });
    }
  }, [isPlaying, currentSong, isVideoMode, loadAndPlaySong]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    const clamped = Math.max(0, seconds);
    if (connect.isRemoteControl) {
      setRemoteCurrentTime(clamped);
      void connect.sendCommand('seek', clamped);
      return;
    }
    if (connect.isCurrentDeviceActive) {
      void connect.publishPlaybackState({ positionSec: clamped });
    }
    if (audio) {
      const maxDur = audio.duration || seconds;
      audio.currentTime = Math.min(clamped, maxDur);
    }
    setCurrentTime(clamped);
  }, []);

  const nextTrack = useCallback(() => {
    if (!currentSong) return;
    if (connect.isRemoteControl) {
      void connect.sendCommand('next');
      return;
    }
    if (queue.length === 0) return;

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
    if (!currentSong) return;
    if (connect.isRemoteControl) {
      void connect.sendCommand('prev');
      return;
    }
    const audio = audioRef.current;
    if (!audio || queue.length === 0) return;

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

  // Sleep timer state & controls
  const [sleepTimerOption, setSleepTimerOption] = useState<string | null>(null);
  const [sleepTimerRemainingSeconds, setSleepTimerRemainingSeconds] = useState<number | null>(null);
  const sleepTimerOptionRef = useRef<string | null>(null);
  const sleepTimerEndRef = useRef<number | null>(null);

  const setSleepTimer = useCallback((option: string | null) => {
    sleepTimerOptionRef.current = option;
    setSleepTimerOption(option);

    if (!option) {
      sleepTimerEndRef.current = null;
      setSleepTimerRemainingSeconds(null);
      return;
    }

    if (option === 'end_of_track') {
      sleepTimerEndRef.current = null;
      setSleepTimerRemainingSeconds(null);
      return;
    }

    const minutes = Number(option);
    if (Number.isFinite(minutes) && minutes > 0) {
      const endTime = Date.now() + minutes * 60 * 1000;
      sleepTimerEndRef.current = endTime;
      setSleepTimerRemainingSeconds(minutes * 60);
    } else {
      sleepTimerEndRef.current = null;
      setSleepTimerRemainingSeconds(null);
    }
  }, []);

  useEffect(() => {
    if (!sleepTimerOption || sleepTimerOption === 'end_of_track' || !sleepTimerEndRef.current) {
      return;
    }

    const interval = setInterval(() => {
      if (!sleepTimerEndRef.current) return;
      const remaining = Math.max(0, Math.round((sleepTimerEndRef.current - Date.now()) / 1000));
      setSleepTimerRemainingSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        if (audioRef.current) {
          audioRef.current.pause();
        }
        setIsPlaying(false);
        setSleepTimer(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerOption, setSleepTimer]);

  // Handle song ended event with repeat logic
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      if (sleepTimerOptionRef.current === 'end_of_track') {
        audio.pause();
        setIsPlaying(false);
        setSleepTimer(null);
        return;
      }
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(console.error);
      } else {
        nextTrack();
      }
    };

    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [repeatMode, nextTrack, setSleepTimer]);

  

  // Volume controls
  const setVolume = useCallback(
    (val: number) => {
      const clamped = Math.max(0, Math.min(1, val));
      setVolumeState(clamped);
      if (connect.isRemoteControl) {
        void connect.sendCommand('volume', clamped);
        return;
      }
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

  // Handle incoming remote commands on the active playback host
  useEffect(() => {
    if (!connect.incomingCommand || !connect.isCurrentDeviceActive) return;
    const { id, action, param } = connect.incomingCommand;
    connect.consumeIncomingCommand(id);

    switch (action) {
      case 'play':
        if (audioRef.current && audioRef.current.paused) {
          audioRef.current.play().catch(() => {});
        }
        setIsPlaying(true);
        break;
      case 'pause':
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
        }
        setIsPlaying(false);
        break;
      case 'seek':
        if (typeof param === 'number') {
          seek(param);
        }
        break;
      case 'next':
        nextTrack();
        break;
      case 'prev':
        prevTrack();
        break;
      case 'volume':
        if (typeof param === 'number') {
          setVolume(param);
        }
        break;
      case 'playSong':
        if (param?.songId) {
          const s = catalog.find((item) => item.id === param.songId);
          if (s) playSong(s);
        }
        break;
      case 'transfer':
        if (connect.remotePlayback?.songId && !isPlaying) {
          const s = catalog.find((item) => item.id === connect.remotePlayback?.songId);
          if (s) {
            void loadAndPlaySong(s, {
              versionId: connect.remotePlayback.versionId,
              karaoke: connect.remotePlayback.isKaraoke,
              startAt: connect.remotePlayback.positionSec,
            });
          }
        }
        break;
    }
  }, [
    connect.incomingCommand,
    connect.isCurrentDeviceActive,
    connect.remotePlayback,
    connect.consumeIncomingCommand,
    isPlaying,
    seek,
    nextTrack,
    prevTrack,
    setVolume,
    playSong,
    loadAndPlaySong,
    catalog,
  ]);

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

  // Synchronize MediaSession playbackState with isPlaying for Android OS AudioFocus & lock screen notification
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch {}
  }, [isPlaying]);

  // Synchronize MediaSession position state for Android lock screen seekbar
  useEffect(() => {
    if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;
    try {
      if (duration > 0 && Number.isFinite(duration) && Number.isFinite(currentTime)) {
        navigator.mediaSession.setPositionState({
          duration: Math.max(duration, currentTime),
          playbackRate: isPlaying ? 1 : 0,
          position: Math.min(Math.max(0, currentTime), duration),
        });
      }
    } catch {}
  }, [currentTime, duration, isPlaying]);

  const effectiveCurrentTime = connect.isRemoteControl ? remoteCurrentTime : currentTime;
  const effectiveDuration = connect.isRemoteControl && connect.remotePlayback?.durationSec ? connect.remotePlayback.durationSec : duration;
  const effectiveLyricIndex = connect.isRemoteControl
    ? getActiveLyricIndex(parsedLyrics, effectiveCurrentTime)
    : activeLyricIndex;

  const audioTimeValue = React.useMemo(
    () => ({
      currentTime: effectiveCurrentTime,
      duration: effectiveDuration,
      activeLyricIndex: effectiveLyricIndex,
    }),
    [effectiveCurrentTime, effectiveDuration, effectiveLyricIndex]
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
      syncMediaTime,
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
      sleepTimerOption,
      sleepTimerRemainingSeconds,
      setSleepTimer,
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
      syncMediaTime,
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
      sleepTimerOption,
      sleepTimerRemainingSeconds,
      setSleepTimer,
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
