import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Song, LyricLine } from '../types';
import { parseLrc, getActiveLyricIndex } from '../utils/lyrics';
import { getSongBlob } from '../services/storage';

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlaybackSource {
  type: 'playlist' | 'favorites' | 'catalog';
  name: string;
}

interface AudioContextType {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(0.85);
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
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.pause();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  // Sync lyrics parsing
  const parsedLyrics = React.useMemo(() => {
    if (!currentSong?.lyricsLrc) return [];
    return parseLrc(currentSong.lyricsLrc);
  }, [currentSong?.lyricsLrc]);

  const activeLyricIndex = React.useMemo(() => {
    return getActiveLyricIndex(parsedLyrics, currentTime);
  }, [parsedLyrics, currentTime]);

  // Load and play song (handling offline blob caching transparently)
  const loadAndPlaySong = useCallback(async (song: Song) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Revoke previous blob url if exists
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    try {
      // Check if we have an offline cached audio blob
      const cachedBlob = await getSongBlob(song.id);
      let audioSource = song.audioUrl;

      if (cachedBlob) {
        const objectUrl = URL.createObjectURL(cachedBlob);
        blobUrlRef.current = objectUrl;
        audioSource = objectUrl;
      }

      audio.src = audioSource;
      audio.currentTime = 0;
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      console.warn('Playback error or auto-play prevented:', err);
    }
  }, []);

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
      audio.play().catch(console.error);
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
    if ('mediaSession' in navigator && currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist,
        album: currentSong.album || 'Sonora Music',
        artwork: [
          { src: currentSong.coverUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: currentSong.coverUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: currentSong.coverUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: currentSong.coverUrl, sizes: '512x512', type: 'image/jpeg' },
        ],
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
    }
  }, [currentSong, togglePlayPause, prevTrack, nextTrack, seek]);

  return (
    <AudioContext.Provider
      value={{
        currentSong,
        queue,
        isPlaying,
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
