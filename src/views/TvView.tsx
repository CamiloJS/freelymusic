import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Home from 'lucide-react/dist/esm/icons/house.mjs';
import Search from 'lucide-react/dist/esm/icons/search.mjs';
import Library from 'lucide-react/dist/esm/icons/library.mjs';
import Tv from 'lucide-react/dist/esm/icons/tv.mjs';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Pause from 'lucide-react/dist/esm/icons/pause.mjs';
import SkipBack from 'lucide-react/dist/esm/icons/skip-back.mjs';
import SkipForward from 'lucide-react/dist/esm/icons/skip-forward.mjs';
import Shuffle from 'lucide-react/dist/esm/icons/shuffle.mjs';
import Repeat from 'lucide-react/dist/esm/icons/repeat.mjs';
import Repeat1 from 'lucide-react/dist/esm/icons/repeat-1.mjs';
import Heart from 'lucide-react/dist/esm/icons/heart.mjs';
import Mic from 'lucide-react/dist/esm/icons/mic.mjs';
import Video from 'lucide-react/dist/esm/icons/video.mjs';
import FileText from 'lucide-react/dist/esm/icons/file-text.mjs';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left.mjs';
import Disc from 'lucide-react/dist/esm/icons/disc.mjs';
import ListMusic from 'lucide-react/dist/esm/icons/list-music.mjs';
import FastForward from 'lucide-react/dist/esm/icons/fast-forward.mjs';
import Rewind from 'lucide-react/dist/esm/icons/rewind.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';

import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { useAudio, useAudioTime } from '../context/AudioContext';
import { getAlbumsFromCatalog } from '../utils/albums';
import { buildDisplayLyrics, formatTime } from '../utils/lyrics';
import { useArtworkColor } from '../utils/dominantColor';
import { useTvNavigation } from '../utils/useTvNavigation';
import { Album, Playlist, Song } from '../types';

interface TvViewProps {
  onExitTvMode: () => void;
}

type TvTab = 'home' | 'search' | 'library';

export const TvView: React.FC<TvViewProps> = ({ onExitTvMode }) => {
  const { currentUser } = useAuth();
  const {
    catalog,
    playlists,
    isFavorite,
    toggleFavorite,
    userFavoriteSongs,
    getArtistProfile,
  } = useMusic();
  const {
    currentSong,
    isPlaying,
    playSong,
    togglePlayPause,
    seek,
    nextTrack,
    prevTrack,
    isShuffle,
    toggleShuffle,
    repeatMode,
    toggleRepeat,
    parsedLyrics,
    translatedLyrics,
    lyricsDisplayMode,
    videoUrl,
    isKaraoke,
    hasInstrumental,
    toggleKaraoke,
    openVideo,
    closeVideo,
    syncMediaTime,
  } = useAudio();
  const { currentTime, duration, activeLyricIndex } = useAudioTime();

  // Navigation and overlay state
  const [activeTab, setActiveTab] = useState<TvTab>('home');
  const [selectedDetail, setSelectedDetail] = useState<
    | { type: 'playlist'; playlist: Playlist; songs: Song[] }
    | { type: 'album'; album: Album; songs: Song[] }
    | { type: 'favorites'; title: string; songs: Song[] }
    | null
  >(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isLyricsActive, setIsLyricsActive] = useState(false);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showControlsTimer, setShowControlsTimer] = useState<number>(0);
  const [controlsVisible, setControlsVisible] = useState(true);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const activeLyricRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Dominant colors for cinematic TV backdrop
  const { gradient } = useArtworkColor(currentSong?.coverUrl, currentSong?.title);

  // Extract real albums and artists
  const allAlbums = useMemo(() => getAlbumsFromCatalog(catalog), [catalog]);
  const allArtists = useMemo(() => {
    const artistMap = new Map<string, { name: string; coverUrl?: string; songCount: number }>();
    catalog.forEach((s) => {
      const artName = s.artist.split(/[,&/]|feat\.|ft\./i)[0].trim();
      if (!artName) return;
      const existing = artistMap.get(artName);
      if (existing) {
        existing.songCount += 1;
        if (!existing.coverUrl && s.coverUrl) existing.coverUrl = s.coverUrl;
      } else {
        artistMap.set(artName, { name: artName, coverUrl: s.coverUrl, songCount: 1 });
      }
    });
    return Array.from(artistMap.values()).slice(0, 15);
  }, [catalog]);

  // Synchronized lyrics
  const displayLyrics = useMemo(
    () => buildDisplayLyrics(parsedLyrics, translatedLyrics, lyricsDisplayMode),
    [parsedLyrics, translatedLyrics, lyricsDisplayMode]
  );

  // Auto-scroll lyrics smoothly in TV Lyrics mode
  useEffect(() => {
    if (!isLyricsActive || activeLyricIndex < 0) return;
    const activeEl = activeLyricRef.current;
    const container = lyricsContainerRef.current;
    if (activeEl && container) {
      const topOffset = activeEl.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2;
      container.scrollTo({ top: Math.max(0, topOffset), behavior: 'smooth' });
    }
  }, [isLyricsActive, activeLyricIndex]);

  // Video playback seamless management
  const handleOpenVideo = useCallback(() => {
    if (!videoUrl) return;
    openVideo();
    setIsVideoActive(true);
  }, [videoUrl, openVideo]);

  const handleCloseVideo = useCallback(() => {
    const video = videoRef.current;
    const finalTime = video && Number.isFinite(video.currentTime) ? video.currentTime : currentTime;
    closeVideo(finalTime);
    setIsVideoActive(false);
  }, [closeVideo, currentTime]);

  useEffect(() => {
    if (isVideoActive && videoRef.current) {
      try {
        videoRef.current.currentTime = currentTime;
        if (isPlaying) {
          videoRef.current.play().catch(() => {});
        }
      } catch {}
    }
  }, [isVideoActive]);

  // TV Inactivity controls auto-dimming during playback
  useEffect(() => {
    if (!isPlayerOpen && !isLyricsActive) {
      setControlsVisible(true);
      return;
    }

    const resetTimer = () => {
      setControlsVisible(true);
      setShowControlsTimer(Date.now());
    };

    window.addEventListener('keydown', resetTimer);
    window.addEventListener('mousemove', resetTimer);

    const interval = window.setInterval(() => {
      if (isPlaying && Date.now() - showControlsTimer > 4500) {
        setControlsVisible(false);
      }
    }, 1000);

    return () => {
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('mousemove', resetTimer);
      window.clearInterval(interval);
    };
  }, [isPlayerOpen, isLyricsActive, isPlaying, showControlsTimer]);

  // Back button handler for Smart TV remote
  const handleRemoteBack = useCallback(() => {
    if (isVideoActive) {
      handleCloseVideo();
      return;
    }
    if (isLyricsActive) {
      setIsLyricsActive(false);
      return;
    }
    if (isPlayerOpen) {
      setIsPlayerOpen(false);
      return;
    }
    if (selectedDetail) {
      setSelectedDetail(null);
      return;
    }
    if (activeTab !== 'home') {
      setActiveTab('home');
      return;
    }
    // At root home, user pressing Back exits TV mode
    onExitTvMode();
  }, [isVideoActive, handleCloseVideo, isLyricsActive, isPlayerOpen, selectedDetail, activeTab, onExitTvMode]);

  // Rewind / Fast Forward 10 seconds via TV remote
  const handleFastForward = useCallback(() => {
    const target = Math.min(duration, currentTime + 10);
    if (isVideoActive && videoRef.current) {
      videoRef.current.currentTime = target;
    }
    seek(target);
  }, [seek, duration, currentTime, isVideoActive]);

  const handleRewind = useCallback(() => {
    const target = Math.max(0, currentTime - 10);
    if (isVideoActive && videoRef.current) {
      videoRef.current.currentTime = target;
    }
    seek(target);
  }, [seek, currentTime, isVideoActive]);

  const handleTogglePlayPause = useCallback(() => {
    if (isVideoActive && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
    togglePlayPause();
  }, [isVideoActive, togglePlayPause]);

  // Initialize TV remote D-Pad spatial navigation
  const { focusFirst } = useTvNavigation({
    containerRef,
    onBack: handleRemoteBack,
    onPlayPause: handleTogglePlayPause,
    onNext: nextTrack,
    onPrev: prevTrack,
    onFastForward: handleFastForward,
    onRewind: handleRewind,
    enabled: true,
  });

  // Focus initial element when changing tabs or views
  useEffect(() => {
    const timer = window.setTimeout(() => {
      focusFirst();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [activeTab, selectedDetail, isPlayerOpen, isLyricsActive, focusFirst]);

  // Search filtered results (Artists First!)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const normQ = q.replace(/[\s._-]+/g, '');

    // Extract all artists from catalog and profiles
    const artistMap = new Map<string, { name: string; coverUrl?: string; songCount: number; songs: Song[] }>();
    catalog.forEach((s) => {
      const parts = s.artist.split(/[,&/]|feat\.|ft\./i).map((p) => p.trim()).filter(Boolean);
      parts.forEach((p) => {
        const prof = getArtistProfile(p);
        const canonical = prof?.name || p;
        const key = canonical.toLowerCase();
        if (!artistMap.has(key)) {
          artistMap.set(key, {
            name: canonical,
            coverUrl: prof?.avatarUrl || s.coverUrl,
            songCount: 0,
            songs: [],
          });
        }
        const item = artistMap.get(key)!;
        item.songCount += 1;
        if (!item.coverUrl && s.coverUrl) item.coverUrl = s.coverUrl;
        if (!item.songs.some((song) => song.id === s.id)) {
          item.songs.push(s);
        }
      });
    });

    const allExtractedArtists = Array.from(artistMap.values());

    if (!q) {
      return {
        artists: allExtractedArtists.slice(0, 10),
        songs: catalog.slice(0, 15),
        albums: allAlbums.slice(0, 8),
        playlists: playlists.slice(0, 8),
      };
    }

    // Match artists: exact, prefix, contains, or fuzzy
    const matchedArtists = allExtractedArtists
      .filter((art) => {
        const artNorm = art.name.toLowerCase();
        const artFuzzy = artNorm.replace(/[\s._-]+/g, '');
        return artNorm.includes(q) || artFuzzy.includes(normQ);
      })
      .sort((a, b) => {
        const aNorm = a.name.toLowerCase();
        const bNorm = b.name.toLowerCase();
        if (aNorm === q) return -1;
        if (bNorm === q) return 1;
        if (aNorm.startsWith(q)) return -1;
        if (bNorm.startsWith(q)) return 1;
        return b.songCount - a.songCount;
      });

    const matchedSongs = catalog.filter((s) => {
      const titleNorm = s.title.toLowerCase();
      const artistNorm = s.artist.toLowerCase();
      return (
        titleNorm.includes(q) ||
        artistNorm.includes(q) ||
        titleNorm.replace(/[\s._-]+/g, '').includes(normQ) ||
        artistNorm.replace(/[\s._-]+/g, '').includes(normQ)
      );
    });

    const matchedAlbums = allAlbums.filter((a) => {
      const nameNorm = a.name.toLowerCase();
      const artistNorm = a.artist.toLowerCase();
      return (
        nameNorm.includes(q) ||
        artistNorm.includes(q) ||
        nameNorm.replace(/[\s._-]+/g, '').includes(normQ)
      );
    });

    const matchedPlaylists = playlists.filter((p) =>
      p.name.toLowerCase().includes(q)
    );

    return {
      artists: matchedArtists,
      songs: matchedSongs,
      albums: matchedAlbums,
      playlists: matchedPlaylists,
    };
  }, [searchQuery, catalog, allAlbums, playlists, getArtistProfile]);

  // Hero featured item: current song's album, or first user playlist, or first catalog album
  const featuredHero = useMemo(() => {
    if (currentSong) {
      return {
        title: currentSong.title,
        subtitle: `${currentSong.artist} • ${currentSong.album || 'Canción'}`,
        coverUrl: currentSong.coverUrl,
        song: currentSong,
      };
    }
    if (allAlbums.length > 0) {
      const alb = allAlbums[0];
      return {
        title: alb.name,
        subtitle: `${alb.artist} • Álbum • ${alb.songs.length} canciones`,
        coverUrl: alb.coverUrl,
        album: alb,
      };
    }
    if (playlists.length > 0) {
      const pl = playlists[0];
      return {
        title: pl.name,
        subtitle: `Playlist • ${pl.songIds.length} canciones`,
        coverUrl: pl.coverUrl,
        playlist: pl,
      };
    }
    return {
      title: 'Sonora en tu TV',
      subtitle: 'Explora y disfruta de tu música favorita con tu control remoto',
      coverUrl: '',
    };
  }, [currentSong, allAlbums, playlists]);

  // Helper to play detail
  const playDetailList = (songs: Song[], startIndex = 0) => {
    if (!songs || songs.length === 0) return;
    const source =
      selectedDetail?.type === 'album'
        ? { type: 'album' as const, name: selectedDetail.album.name }
        : selectedDetail?.type === 'playlist'
        ? {
            type: 'playlist' as const,
            name: selectedDetail.playlist.name,
            id: selectedDetail.playlist.id,
          }
        : { type: 'favorites' as const, name: 'Canciones que te gustan' };
    playSong(songs[startIndex], songs, source);
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-[#0e0e11] text-white flex flex-col overflow-hidden select-none font-sans"
      style={{
        background: gradient
          ? `linear-gradient(180deg, ${gradient} 0%, #0a0a0d 65%, #050507 100%)`
          : 'linear-gradient(180deg, #121217 0%, #08080a 100%)',
      }}
    >
      {/* Dynamic Animated Blurred Backdrop based on current playing song */}
      {currentSong?.coverUrl && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div
            className={`w-full h-full bg-cover bg-center transition-all duration-700 ${
              isPlaying ? 'animate-tv-rhythm' : ''
            }`}
            style={{
              backgroundImage: `url(${currentSong.coverUrl})`,
              filter: isLyricsActive
                ? 'blur(52px) brightness(0.22) saturate(1.4)'
                : 'blur(30px) brightness(0.38) saturate(1.3)',
              transform: 'scale(1.18)',
            }}
          />
          <div
            className={`absolute inset-0 transition-colors duration-500 ${
              isLyricsActive ? 'bg-black/70' : 'bg-black/45'
            }`}
          />
        </div>
      )}

      {/* 1. TOP BAR (Matching Spotify TV Reference Image) */}
      <header className="flex items-center justify-between px-8 py-5 flex-shrink-0 z-30 bg-black/40 backdrop-blur-md border-b border-white/10">
        {/* Left: Now Playing Mini Card */}
        <div className="flex items-center min-w-0">
          {currentSong ? (
            <button
              data-tv-focus="true"
              tabIndex={0}
              onClick={() => setIsPlayerOpen(true)}
              className="group flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 focus:bg-white/25 focus:ring-4 focus:ring-white focus:outline-none transition-all max-w-xs shadow-lg"
              title="Abrir reproductor en TV"
            >
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-neutral-800 flex-shrink-0 shadow">
                {currentSong.coverUrl ? (
                  <img
                    src={currentSong.coverUrl}
                    alt={currentSong.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/50">
                    <Disc className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className="text-left truncate min-w-0">
                <p className="text-sm font-extrabold text-white truncate leading-tight">
                  {currentSong.title}
                </p>
                <p className="text-xs text-neutral-300 truncate mt-0.5">{currentSong.artist}</p>
              </div>
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white flex-shrink-0 ml-1">
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-2.5 text-white/90 px-3 py-1.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <Disc className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="font-extrabold text-sm tracking-wide">Sonora</span>
            </div>
          )}
        </div>

        {/* Center: Navigation Tabs */}
        <nav className="flex items-center gap-2">
          <button
            data-tv-focus="true"
            tabIndex={0}
            onClick={() => {
              setActiveTab('home');
              setSelectedDetail(null);
            }}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-bold transition-all focus:outline-none focus:ring-4 focus:ring-white ${
              activeTab === 'home' && !selectedDetail
                ? 'bg-white text-black shadow-lg scale-105'
                : 'bg-white/10 text-white/80 hover:bg-white/15'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Inicio</span>
          </button>

          <button
            data-tv-focus="true"
            tabIndex={0}
            onClick={() => {
              setActiveTab('search');
              setSelectedDetail(null);
            }}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-bold transition-all focus:outline-none focus:ring-4 focus:ring-white ${
              activeTab === 'search'
                ? 'bg-white text-black shadow-lg scale-105'
                : 'bg-white/10 text-white/80 hover:bg-white/15'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Buscar</span>
          </button>

          <button
            data-tv-focus="true"
            tabIndex={0}
            onClick={() => {
              setActiveTab('library');
              setSelectedDetail(null);
            }}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-bold transition-all focus:outline-none focus:ring-4 focus:ring-white ${
              activeTab === 'library'
                ? 'bg-white text-black shadow-lg scale-105'
                : 'bg-white/10 text-white/80 hover:bg-white/15'
            }`}
          >
            <Library className="w-4 h-4" />
            <span>Tu biblioteca</span>
          </button>
        </nav>

        {/* Right: User Profile Pill */}
        <div className="flex items-center">
          <div
            data-tv-focus="true"
            tabIndex={0}
            className="flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/10 focus:ring-4 focus:ring-white focus:outline-none transition-all shadow"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-500/30 flex items-center justify-center border border-white/20">
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.displayName || 'Usuario'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-extrabold text-xs text-white">
                  {(currentUser?.displayName || 'C').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className="text-sm font-bold text-white max-w-[140px] truncate">
              {currentUser?.displayName ? `Bienvenido ${currentUser.displayName}` : 'Bienvenido'}
            </span>
          </div>
        </div>
      </header>

      {/* 2. MAIN SCROLLABLE CONTENT BODY */}
      <main className="flex-1 overflow-y-auto px-8 py-6 space-y-8 scrollbar-none">
        {/* VIEW 1: HOME VIEW */}
        {activeTab === 'home' && !selectedDetail && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* HERO SECTION (Reference image style) */}
            <section className="relative overflow-hidden rounded-3xl p-8 bg-gradient-to-r from-black/80 via-black/50 to-transparent border border-white/10 shadow-2xl flex items-center justify-between min-h-[220px]">
              <div className="relative z-10 max-w-2xl space-y-3">
                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight drop-shadow-md">
                  {featuredHero.title}
                </h1>
                <p className="text-base md:text-lg text-neutral-300 font-semibold drop-shadow">
                  {featuredHero.subtitle}
                </p>
                <div className="pt-2 flex items-center gap-4">
                  <button
                    data-tv-focus="true"
                    tabIndex={0}
                    onClick={() => {
                      if (featuredHero.song) {
                        togglePlayPause();
                      } else if (featuredHero.album && featuredHero.album.songs.length > 0) {
                        playSong(
                          featuredHero.album.songs[0],
                          featuredHero.album.songs,
                          { type: 'album', name: featuredHero.album.name }
                        );
                      } else if (featuredHero.playlist && featuredHero.playlist.songIds.length > 0) {
                        const plSongs = featuredHero.playlist.songIds
                          .map((id) => catalog.find((s) => s.id === id))
                          .filter(Boolean) as Song[];
                        if (plSongs.length > 0) {
                          playSong(plSongs[0], plSongs, {
                            type: 'playlist',
                            name: featuredHero.playlist.name,
                            id: featuredHero.playlist.id,
                          });
                        }
                      }
                    }}
                    className="flex items-center gap-3 px-6 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-black text-base shadow-xl focus:outline-none focus:ring-4 focus:ring-white transition-all transform hover:scale-105"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                    <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
                  </button>

                  {currentSong && (
                    <button
                      data-tv-focus="true"
                      tabIndex={0}
                      onClick={() => setIsPlayerOpen(true)}
                      className="flex items-center gap-2 px-5 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-sm focus:outline-none focus:ring-4 focus:ring-white transition-all"
                    >
                      <Disc className="w-4 h-4" />
                      <span>Ver Reproductor TV</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Ambient Artwork in Hero */}
              {featuredHero.coverUrl && (
                <div className="hidden md:block w-72 h-72 rounded-2xl overflow-hidden shadow-2xl border border-white/20 flex-shrink-0 relative">
                  <img
                    src={featuredHero.coverUrl}
                    alt={featuredHero.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                </div>
              )}
            </section>

            {/* QUICK ACCESS GRID (2x4 Cards like reference image) */}
            <section className="space-y-3">
              <h2 className="text-xl font-extrabold text-white">Accesos Rápidos</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* 1. Liked Songs Card (Gradient purple/blue with heart) */}
                <button
                  data-tv-focus="true"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedDetail({
                      type: 'favorites',
                      title: 'Canciones que te gustan',
                      songs: userFavoriteSongs,
                    });
                  }}
                  className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 hover:bg-white/15 focus:bg-white/20 focus:ring-4 focus:ring-white focus:outline-none transition-all group border border-white/5 text-left shadow-lg"
                >
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white flex-shrink-0 shadow-md group-hover:scale-105 transition-transform">
                    <Heart className="w-7 h-7 fill-white text-white" />
                  </div>
                  <div className="truncate flex-1 min-w-0">
                    <span className="block text-base font-extrabold text-white truncate">
                      Canciones que te gustan
                    </span>
                    <span className="block text-xs text-neutral-400 mt-0.5">
                      {userFavoriteSongs.length} canciones
                    </span>
                  </div>
                </button>

                {/* 2. User Playlists (Real playlists only!) */}
                {playlists.slice(0, 7).map((pl) => {
                  const plSongs = pl.songIds
                    .map((id) => catalog.find((s) => s.id === id))
                    .filter(Boolean) as Song[];
                  return (
                    <button
                      key={pl.id}
                      data-tv-focus="true"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedDetail({
                          type: 'playlist',
                          playlist: pl,
                          songs: plSongs,
                        });
                      }}
                      className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 hover:bg-white/15 focus:bg-white/20 focus:ring-4 focus:ring-white focus:outline-none transition-all group border border-white/5 text-left shadow-lg"
                    >
                      <div className="w-16 h-16 rounded-xl bg-neutral-800 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-105 transition-transform">
                        {pl.coverUrl ? (
                          <img
                            src={pl.coverUrl}
                            alt={pl.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ListMusic className="w-7 h-7 text-neutral-500" />
                        )}
                      </div>
                      <div className="truncate flex-1 min-w-0">
                        <span className="block text-base font-extrabold text-white truncate">
                          {pl.name}
                        </span>
                        <span className="block text-xs text-neutral-400 mt-0.5">
                          Playlist • {plSongs.length} canciones
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* CAROUSEL 1: TUS PLAYLISTS */}
            {playlists.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-extrabold text-white">Tus Playlists</h2>
                </div>
                <div className="flex items-center gap-5 overflow-x-auto pb-4 pt-1 scrollbar-none">
                  {playlists.map((pl) => {
                    const plSongs = pl.songIds
                      .map((id) => catalog.find((s) => s.id === id))
                      .filter(Boolean) as Song[];
                    return (
                      <button
                        key={`carousel-pl-${pl.id}`}
                        data-tv-focus="true"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedDetail({
                            type: 'playlist',
                            playlist: pl,
                            songs: plSongs,
                          });
                        }}
                        className="w-48 p-3 rounded-2xl bg-white/5 hover:bg-white/15 focus:bg-white/20 focus:ring-4 focus:ring-white focus:outline-none transition-all flex flex-col text-left group flex-shrink-0 border border-white/5 shadow-md"
                      >
                        <div className="w-full aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-3 shadow">
                          {pl.coverUrl ? (
                            <img
                              src={pl.coverUrl}
                              alt={pl.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-600">
                              <ListMusic className="w-10 h-10" />
                            </div>
                          )}
                        </div>
                        <span className="font-extrabold text-sm text-white truncate">{pl.name}</span>
                        <span className="text-xs text-neutral-400 mt-1">
                          {plSongs.length} canciones
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* CAROUSEL 2: ÁLBUMES EN TU BIBLIOTECA */}
            {allAlbums.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-extrabold text-white">Álbumes en tu biblioteca</h2>
                </div>
                <div className="flex items-center gap-5 overflow-x-auto pb-4 pt-1 scrollbar-none">
                  {allAlbums.map((alb) => (
                    <button
                      key={`carousel-alb-${alb.name}`}
                      data-tv-focus="true"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedDetail({
                          type: 'album',
                          album: alb,
                          songs: alb.songs,
                        });
                      }}
                      className="w-48 p-3 rounded-2xl bg-white/5 hover:bg-white/15 focus:bg-white/20 focus:ring-4 focus:ring-white focus:outline-none transition-all flex flex-col text-left group flex-shrink-0 border border-white/5 shadow-md"
                    >
                      <div className="w-full aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-3 shadow">
                        {alb.coverUrl ? (
                          <img
                            src={alb.coverUrl}
                            alt={alb.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-600">
                            <Disc className="w-10 h-10" />
                          </div>
                        )}
                      </div>
                      <span className="font-extrabold text-sm text-white truncate">{alb.name}</span>
                      <span className="text-xs text-neutral-400 mt-1 truncate">{alb.artist}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* CAROUSEL 3: ARTISTAS */}
            {allArtists.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xl font-extrabold text-white">Artistas</h2>
                <div className="flex items-center gap-5 overflow-x-auto pb-4 pt-1 scrollbar-none">
                  {allArtists.map((art) => (
                    <button
                      key={`carousel-art-${art.name}`}
                      data-tv-focus="true"
                      tabIndex={0}
                      onClick={() => {
                        const artistSongs = catalog.filter((s) =>
                          s.artist.toLowerCase().includes(art.name.toLowerCase())
                        );
                        setSelectedDetail({
                          type: 'favorites',
                          title: `Música de ${art.name}`,
                          songs: artistSongs,
                        });
                      }}
                      className="w-40 p-3 rounded-2xl bg-white/5 hover:bg-white/15 focus:bg-white/20 focus:ring-4 focus:ring-white focus:outline-none transition-all flex flex-col items-center text-center group flex-shrink-0 border border-white/5 shadow-md"
                    >
                      <div className="w-32 h-32 rounded-full overflow-hidden bg-neutral-800 mb-3 shadow-lg border border-white/10">
                        {art.coverUrl ? (
                          <img
                            src={art.coverUrl}
                            alt={art.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-500 font-black text-xl">
                            {art.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <span className="font-extrabold text-sm text-white truncate max-w-full">
                        {art.name}
                      </span>
                      <span className="text-xs text-neutral-400 mt-1">Artista</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* VIEW 2: SEARCH TAB */}
        {activeTab === 'search' && !selectedDetail && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* TV Search Input */}
            <div className="max-w-xl mx-auto space-y-3">
              <div className="flex items-center gap-3 bg-white/10 border-2 border-white/20 focus-within:border-white focus-within:ring-4 focus-within:ring-white/40 px-5 py-3.5 rounded-full shadow-inner transition-all">
                <Search className="w-5 h-5 text-neutral-300 flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Escribe el nombre de una canción, artista o álbum..."
                  className="flex-1 bg-transparent text-white text-base font-bold placeholder-neutral-400 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="p-1 rounded-full text-neutral-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Results Grid - ARTISTS FIRST */}
            <div className="space-y-6">
              {/* 1. MATCHED ARTISTS (Shown first as requested) */}
              {searchResults.artists.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-xl font-extrabold text-white">
                    {searchQuery ? 'Artistas encontrados' : 'Artistas sugeridos'}
                  </h2>
                  <div className="flex items-center gap-5 overflow-x-auto pb-3 pt-1 scrollbar-none">
                    {searchResults.artists.map((art) => (
                      <button
                        key={`search-art-${art.name}`}
                        data-tv-focus="true"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedDetail({
                            type: 'favorites',
                            title: `Música de ${art.name}`,
                            songs: art.songs,
                          });
                        }}
                        className="w-44 p-4 rounded-2xl bg-white/5 hover:bg-white/15 focus:bg-white/20 focus:ring-4 focus:ring-white focus:outline-none transition-all flex flex-col items-center text-center group flex-shrink-0 border border-white/5 shadow-md"
                      >
                        <div className="w-28 h-28 rounded-full overflow-hidden bg-neutral-800 mb-3 shadow-lg border border-white/10 group-hover:scale-105 transition-transform duration-300">
                          {art.coverUrl ? (
                            <img
                              src={art.coverUrl}
                              alt={art.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-500 font-black text-2xl">
                              {art.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <span className="font-extrabold text-sm text-white truncate max-w-full">
                          {art.name}
                        </span>
                        <span className="text-xs text-neutral-400 mt-1">
                          Artista • {art.songCount} {art.songCount === 1 ? 'canción' : 'canciones'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. MATCHED ALBUMS (If any) */}
              {searchResults.albums.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-xl font-extrabold text-white">Álbumes</h2>
                  <div className="flex items-center gap-5 overflow-x-auto pb-3 pt-1 scrollbar-none">
                    {searchResults.albums.map((alb) => (
                      <button
                        key={`search-alb-${alb.name}`}
                        data-tv-focus="true"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedDetail({
                            type: 'album',
                            album: alb,
                            songs: alb.songs,
                          });
                        }}
                        className="w-44 p-3 rounded-2xl bg-white/5 hover:bg-white/15 focus:bg-white/20 focus:ring-4 focus:ring-white focus:outline-none transition-all flex flex-col text-left group flex-shrink-0 border border-white/5 shadow-md"
                      >
                        <div className="w-full aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-3 shadow">
                          {alb.coverUrl ? (
                            <img
                              src={alb.coverUrl}
                              alt={alb.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-600">
                              <Disc className="w-10 h-10" />
                            </div>
                          )}
                        </div>
                        <span className="font-extrabold text-sm text-white truncate">{alb.name}</span>
                        <span className="text-xs text-neutral-400 mt-1 truncate">{alb.artist}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. MATCHED SONGS */}
              <div className="space-y-3">
                <h2 className="text-xl font-extrabold text-white">
                  {searchQuery ? `Canciones para "${searchQuery}"` : 'Canciones sugeridas'}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {searchResults.songs.map((song) => (
                    <button
                      key={song.id}
                      data-tv-focus="true"
                      tabIndex={0}
                      onClick={() => {
                        playSong(song, searchResults.songs, { type: 'catalog', name: 'Búsqueda TV' });
                      }}
                      className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/5 hover:bg-white/15 focus:bg-white/20 focus:ring-4 focus:ring-white focus:outline-none transition-all text-left border border-white/5 shadow"
                    >
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-neutral-800 flex-shrink-0 shadow">
                        {song.coverUrl ? (
                          <img
                            src={song.coverUrl}
                            alt={song.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Disc className="w-6 h-6 text-neutral-500 m-4" />
                        )}
                      </div>
                      <div className="truncate flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-white truncate">
                            {song.title}
                          </span>
                          {song.isExplicit && (
                            <span className="text-[10px] font-black bg-neutral-400 text-black px-1 rounded">
                              E
                            </span>
                          )}
                        </div>
                        <span className="block text-xs text-neutral-400 truncate mt-0.5">
                          {song.artist}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-400 font-semibold flex-shrink-0">
                        {formatTime(song.duration)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: LIBRARY TAB */}
        {activeTab === 'library' && !selectedDetail && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-2xl font-black text-white">Tu biblioteca</h2>

            {/* Playlists and Liked Songs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {/* Liked songs card */}
              <button
                data-tv-focus="true"
                tabIndex={0}
                onClick={() => {
                  setSelectedDetail({
                    type: 'favorites',
                    title: 'Canciones que te gustan',
                    songs: userFavoriteSongs,
                  });
                }}
                className="p-4 rounded-2xl bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-600 focus:ring-4 focus:ring-white focus:outline-none transition-all flex flex-col justify-end aspect-square shadow-xl group text-left"
              >
                <Heart className="w-10 h-10 fill-white text-white mb-auto" />
                <span className="text-xl font-black text-white leading-tight">
                  Canciones que te gustan
                </span>
                <span className="text-xs text-white/80 mt-1">
                  {userFavoriteSongs.length} canciones
                </span>
              </button>

              {/* All Playlists */}
              {playlists.map((pl) => {
                const plSongs = pl.songIds
                  .map((id) => catalog.find((s) => s.id === id))
                  .filter(Boolean) as Song[];
                return (
                  <button
                    key={pl.id}
                    data-tv-focus="true"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedDetail({
                        type: 'playlist',
                        playlist: pl,
                        songs: plSongs,
                      });
                    }}
                    className="p-3 rounded-2xl bg-white/5 hover:bg-white/15 focus:bg-white/20 focus:ring-4 focus:ring-white focus:outline-none transition-all flex flex-col text-left group border border-white/5 shadow-md"
                  >
                    <div className="w-full aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-3 shadow">
                      {pl.coverUrl ? (
                        <img
                          src={pl.coverUrl}
                          alt={pl.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-600">
                          <ListMusic className="w-12 h-12" />
                        </div>
                      )}
                    </div>
                    <span className="font-extrabold text-sm text-white truncate">{pl.name}</span>
                    <span className="text-xs text-neutral-400 mt-1">{plSongs.length} canciones</span>
                  </button>
                );
              })}

              {/* All Albums */}
              {allAlbums.map((alb) => (
                <button
                  key={alb.name}
                  data-tv-focus="true"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedDetail({
                      type: 'album',
                      album: alb,
                      songs: alb.songs,
                    });
                  }}
                  className="p-3 rounded-2xl bg-white/5 hover:bg-white/15 focus:bg-white/20 focus:ring-4 focus:ring-white focus:outline-none transition-all flex flex-col text-left group border border-white/5 shadow-md"
                >
                  <div className="w-full aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-3 shadow">
                    {alb.coverUrl ? (
                      <img
                        src={alb.coverUrl}
                        alt={alb.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-600">
                        <Disc className="w-12 h-12" />
                      </div>
                    )}
                  </div>
                  <span className="font-extrabold text-sm text-white truncate">{alb.name}</span>
                  <span className="text-xs text-neutral-400 mt-1 truncate">{alb.artist}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 4: DETAIL VIEW (Selected Playlist / Album / Favorites) */}
        {selectedDetail && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Top Detail Header */}
            <div className="flex flex-col md:flex-row items-start md:items-end gap-6 p-6 rounded-3xl bg-white/5 border border-white/10 shadow-xl">
              <div className="w-44 h-44 rounded-2xl overflow-hidden bg-neutral-800 flex-shrink-0 shadow-2xl">
                {selectedDetail.type === 'favorites' ? (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-600 flex items-center justify-center">
                    <Heart className="w-16 h-16 fill-white text-white" />
                  </div>
                ) : selectedDetail.type === 'album' && selectedDetail.album.coverUrl ? (
                  <img
                    src={selectedDetail.album.coverUrl}
                    alt={selectedDetail.album.name}
                    className="w-full h-full object-cover"
                  />
                ) : selectedDetail.type === 'playlist' && selectedDetail.playlist.coverUrl ? (
                  <img
                    src={selectedDetail.playlist.coverUrl}
                    alt={selectedDetail.playlist.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-600">
                    <ListMusic className="w-16 h-16" />
                  </div>
                )}
              </div>

              <div className="space-y-3 flex-1 min-w-0">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  {selectedDetail.type === 'favorites'
                    ? 'Lista Favorita'
                    : selectedDetail.type === 'album'
                    ? 'Álbum'
                    : 'Playlist'}
                </span>
                <h1 className="text-3xl md:text-4xl font-black text-white truncate">
                  {selectedDetail.type === 'favorites'
                    ? selectedDetail.title
                    : selectedDetail.type === 'album'
                    ? selectedDetail.album.name
                    : selectedDetail.playlist.name}
                </h1>
                <p className="text-sm font-semibold text-neutral-300">
                  {selectedDetail.type === 'album' ? selectedDetail.album.artist : 'Sonora'} •{' '}
                  {selectedDetail.songs.length} canciones
                </p>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    data-tv-focus="true"
                    tabIndex={0}
                    onClick={() => playDetailList(selectedDetail.songs, 0)}
                    disabled={selectedDetail.songs.length === 0}
                    className="flex items-center gap-2.5 px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm focus:outline-none focus:ring-4 focus:ring-white transition-all disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Reproducir todo</span>
                  </button>

                  <button
                    data-tv-focus="true"
                    tabIndex={0}
                    onClick={() => setSelectedDetail(null)}
                    className="flex items-center gap-2 px-4 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-sm focus:outline-none focus:ring-4 focus:ring-white transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Volver</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Tracklist Table for TV */}
            <div className="space-y-1.5">
              {selectedDetail.songs.map((song, index) => {
                const isCurrent = currentSong?.id === song.id;
                return (
                  <button
                    key={song.id}
                    data-tv-focus="true"
                    tabIndex={0}
                    onClick={() => playDetailList(selectedDetail.songs, index)}
                    className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all text-left focus:ring-4 focus:ring-white focus:outline-none ${
                      isCurrent
                        ? 'bg-emerald-500/20 text-emerald-400 font-extrabold'
                        : 'bg-white/5 hover:bg-white/10 text-white'
                    }`}
                  >
                    <span className="w-6 text-center font-bold text-sm text-neutral-400">
                      {index + 1}
                    </span>

                    <div className="w-11 h-11 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0 shadow">
                      {song.coverUrl ? (
                        <img
                          src={song.coverUrl}
                          alt={song.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Disc className="w-5 h-5 text-neutral-500 m-3" />
                      )}
                    </div>

                    <div className="truncate flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm truncate">{song.title}</span>
                        {song.isExplicit && (
                          <span className="text-[10px] font-black bg-neutral-400 text-black px-1 rounded">
                            E
                          </span>
                        )}
                      </div>
                      <span className="block text-xs text-neutral-400 truncate mt-0.5">
                        {song.artist}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-neutral-400 flex-shrink-0 pr-2">
                      {formatTime(song.duration)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* 3. SPOTIFY TV FULLSCREEN PLAYER & KARAOKE MODAL */}
      {isPlayerOpen && currentSong && (
        <div
          className="fixed inset-0 z-50 bg-[#07070a] flex flex-col justify-between p-8 md:p-12 animate-in fade-in duration-300 overflow-hidden"
          style={{
            background: gradient
              ? `radial-gradient(circle at 30% 40%, ${gradient} 0%, #08080c 70%, #030305 100%)`
              : 'radial-gradient(circle at 30% 40%, #1f2937 0%, #050507 100%)',
          }}
        >
          {/* Dynamic Animated Blurred Backdrop for Fullscreen Player */}
          {currentSong?.coverUrl && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
              <div
                className={`w-full h-full bg-cover bg-center transition-all duration-700 ${
                  isPlaying ? 'animate-tv-rhythm' : ''
                }`}
                style={{
                  backgroundImage: `url(${currentSong.coverUrl})`,
                  filter: isLyricsActive
                    ? 'blur(55px) brightness(0.20) saturate(1.4)'
                    : 'blur(32px) brightness(0.40) saturate(1.3)',
                  transform: 'scale(1.2)',
                }}
              />
              <div
                className={`absolute inset-0 transition-colors duration-500 ${
                  isLyricsActive ? 'bg-black/75' : 'bg-black/45'
                }`}
              />
            </div>
          )}

          {/* Top Bar inside TV Player */}
          <div className="flex items-center justify-between z-20 flex-shrink-0">
            <button
              data-tv-focus="true"
              tabIndex={0}
              onClick={() => {
                if (isVideoActive) handleCloseVideo();
                setIsPlayerOpen(false);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-sm focus:outline-none focus:ring-4 focus:ring-white transition-all shadow"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Volver al Menú</span>
            </button>

            <div className="flex items-center gap-3">
              {/* Lyrics Toggle Button */}
              <button
                data-tv-focus="true"
                tabIndex={0}
                onClick={() => setIsLyricsActive((prev) => !prev)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm focus:outline-none focus:ring-4 focus:ring-white transition-all shadow ${
                  isLyricsActive
                    ? 'bg-white text-black font-extrabold shadow-lg scale-105'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title="Mostrar u ocultar letra sincronizada"
              >
                <FileText className="w-4 h-4" />
                <span>{isLyricsActive ? 'Ocultar Letra' : 'Letras'}</span>
              </button>

              {/* Karaoke Toggle Button (Instrumental audio) */}
              <button
                data-tv-focus="true"
                tabIndex={0}
                onClick={() => {
                  if (hasInstrumental || currentSong?.instrumentalUrl) {
                    toggleKaraoke();
                  } else {
                    alert('Esta canción no cuenta con pista instrumental / karaoke');
                  }
                }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm focus:outline-none focus:ring-4 focus:ring-white transition-all shadow ${
                  isKaraoke
                    ? 'bg-emerald-500 text-black font-extrabold shadow-lg scale-105'
                    : hasInstrumental || currentSong?.instrumentalUrl
                    ? 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-white/5 text-white/40'
                }`}
                title={
                  hasInstrumental || currentSong?.instrumentalUrl
                    ? isKaraoke
                      ? 'Pista instrumental activa. Clic para volver a voz original'
                      : 'Activar pista instrumental para karaoke'
                    : 'Sin pista instrumental disponible'
                }
              >
                <Mic className="w-4 h-4" />
                <span>{isKaraoke ? 'Karaoke Activo (Voz OFF)' : 'Modo Karaoke'}</span>
              </button>

              {/* Video Toggle Button (if available) */}
              {videoUrl && (
                <button
                  data-tv-focus="true"
                  tabIndex={0}
                  onClick={() => {
                    if (isVideoActive) {
                      handleCloseVideo();
                    } else {
                      handleOpenVideo();
                    }
                  }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm focus:outline-none focus:ring-4 focus:ring-white transition-all shadow ${
                    isVideoActive
                      ? 'bg-blue-500 text-white font-extrabold shadow-lg scale-105'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                  title="Ver Video Musical"
                >
                  <Video className="w-4 h-4" />
                  <span>{isVideoActive ? 'Ocultar Video' : 'Video'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Center Content: Artwork + Metadata OR Synchronized Lyrics OR Video Player */}
          <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-12 my-6 min-h-0 overflow-hidden relative z-10">
            {/* If in video mode, render dedicated TV video frame */}
            {isVideoActive && videoUrl ? (
              <div className="w-full max-w-4xl aspect-video rounded-3xl overflow-hidden shadow-2xl border border-white/20 bg-black flex items-center justify-center relative">
                {videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be') ? (
                  <iframe
                    src={`${videoUrl.replace('watch?v=', 'embed/')}?autoplay=1&start=${Math.floor(currentTime)}&enablejsapi=1`}
                    title="Video musical"
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    autoPlay
                    playsInline
                    onTimeUpdate={(e) => syncMediaTime(e.currentTarget.currentTime)}
                    onPlay={() => !isPlaying && togglePlayPause()}
                    onPause={() => isPlaying && togglePlayPause()}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            ) : isLyricsActive ? (
              /* SPOTIFY TV LYRICS VIEW: Auto-scrolling Synchronized LRC Lyrics */
              <div className="flex-1 flex flex-col md:flex-row items-center gap-10 h-full max-w-6xl w-full">
                {/* Mini song info on the left */}
                <div className="w-64 flex flex-col items-center text-center flex-shrink-0">
                  <div className="w-52 h-52 rounded-2xl overflow-hidden shadow-2xl mb-4 border border-white/10">
                    <img
                      src={currentSong.coverUrl || ''}
                      alt={currentSong.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-xl font-extrabold text-white truncate max-w-full">
                    {currentSong.title}
                  </h3>
                  <p className="text-sm font-semibold text-neutral-400 truncate max-w-full mt-1">
                    {currentSong.artist}
                  </p>
                </div>

                {/* Big lyrics scroll on the right */}
                <div
                  ref={lyricsContainerRef}
                  className="flex-1 h-full overflow-y-auto px-6 py-12 scrollbar-none space-y-6 text-center md:text-left"
                >
                  {displayLyrics.length > 0 ? (
                    displayLyrics.map((line, idx) => {
                      const isActive = idx === activeLyricIndex;
                      return (
                        <div
                          key={`tv-lyric-${idx}`}
                          ref={isActive ? activeLyricRef : null}
                          onClick={() => line.time !== undefined && seek(line.time)}
                          className={`cursor-pointer transition-all duration-300 transform ${
                            isActive
                              ? 'text-white text-3xl md:text-4xl font-black scale-105 drop-shadow-[0_4px_16px_rgba(255,255,255,0.4)]'
                              : 'text-white/35 text-xl md:text-2xl font-bold hover:text-white/60'
                          }`}
                        >
                          <p>{line.text}</p>
                          {line.translation && (
                            <p className="text-base text-emerald-400/80 font-normal mt-1">
                              {line.translation}
                            </p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-neutral-400 space-y-3">
                      <FileText className="w-12 h-12 text-neutral-600" />
                      <p className="text-2xl font-bold">Sin letra sincronizada</p>
                      <p className="text-sm text-neutral-500">
                        Disfruta el ritmo de la música
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* STANDARD SPOTIFY TV NOW PLAYING VIEW */
              <div className="flex flex-col md:flex-row items-center justify-center gap-12 max-w-5xl w-full">
                {/* Large high-res cover art */}
                <div className="w-72 h-72 md:w-96 md:h-96 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/20 flex-shrink-0 group">
                  <img
                    src={currentSong.coverUrl || ''}
                    alt={currentSong.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Track Details */}
                <div className="space-y-4 max-w-lg text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-3">
                    <h1 className="text-3xl md:text-5xl font-black text-white leading-tight">
                      {currentSong.title}
                    </h1>
                    {currentSong.isExplicit && (
                      <span className="text-xs font-black bg-neutral-400 text-black px-1.5 py-0.5 rounded">
                        E
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-neutral-300">
                    {currentSong.artist}
                  </h2>
                  {currentSong.album && (
                    <p className="text-sm font-semibold text-neutral-400">
                      Álbum • {currentSong.album}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Playback Controls Bar for TV */}
          <div
            className={`z-20 max-w-4xl mx-auto w-full space-y-4 transition-opacity duration-300 ${
              controlsVisible ? 'opacity-100' : 'opacity-25 hover:opacity-100'
            }`}
          >
            {/* Progress Slider */}
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-neutral-400 w-12 text-right">
                {formatTime(currentTime)}
              </span>
              <div
                className="flex-1 h-3 rounded-full bg-white/20 overflow-hidden cursor-pointer relative"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  seek(pct * duration);
                }}
              >
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (currentTime / (duration || 1)) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-bold text-neutral-400 w-12">
                {formatTime(duration)}
              </span>
            </div>

            {/* Remote Navigation Buttons Row */}
            <div className="flex items-center justify-center gap-5">
              {/* Shuffle */}
              <button
                data-tv-focus="true"
                tabIndex={0}
                onClick={toggleShuffle}
                className={`p-3 rounded-full transition-all focus:outline-none focus:ring-4 focus:ring-white ${
                  isShuffle ? 'text-emerald-400 bg-white/10' : 'text-neutral-400 hover:text-white'
                }`}
                title="Aleatorio"
              >
                <Shuffle className="w-5 h-5" />
              </button>

              {/* Rewind 10s */}
              <button
                data-tv-focus="true"
                tabIndex={0}
                onClick={handleRewind}
                className="p-3 rounded-full text-neutral-300 hover:text-white focus:outline-none focus:ring-4 focus:ring-white transition-all"
                title="Retroceder 10s"
              >
                <Rewind className="w-5 h-5" />
              </button>

              {/* Previous */}
              <button
                data-tv-focus="true"
                tabIndex={0}
                onClick={prevTrack}
                className="p-3 rounded-full text-white hover:scale-110 focus:outline-none focus:ring-4 focus:ring-white transition-all"
                title="Canción anterior"
              >
                <SkipBack className="w-6 h-6 fill-current" />
              </button>

              {/* Big Play/Pause Button */}
              <button
                data-tv-focus="true"
                tabIndex={0}
                onClick={togglePlayPause}
                className="w-16 h-16 rounded-full bg-white text-black hover:scale-105 focus:outline-none focus:ring-4 focus:ring-emerald-400 flex items-center justify-center shadow-2xl transition-all"
                title={isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8 fill-current" />
                ) : (
                  <Play className="w-8 h-8 fill-current ml-1" />
                )}
              </button>

              {/* Next */}
              <button
                data-tv-focus="true"
                tabIndex={0}
                onClick={nextTrack}
                className="p-3 rounded-full text-white hover:scale-110 focus:outline-none focus:ring-4 focus:ring-white transition-all"
                title="Siguiente canción"
              >
                <SkipForward className="w-6 h-6 fill-current" />
              </button>

              {/* Fast Forward 10s */}
              <button
                data-tv-focus="true"
                tabIndex={0}
                onClick={handleFastForward}
                className="p-3 rounded-full text-neutral-300 hover:text-white focus:outline-none focus:ring-4 focus:ring-white transition-all"
                title="Adelantar 10s"
              >
                <FastForward className="w-5 h-5" />
              </button>

              {/* Repeat */}
              <button
                data-tv-focus="true"
                tabIndex={0}
                onClick={toggleRepeat}
                className={`p-3 rounded-full transition-all focus:outline-none focus:ring-4 focus:ring-white ${
                  repeatMode !== 'off'
                    ? 'text-emerald-400 bg-white/10'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Repetir"
              >
                {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
              </button>

              {/* Like / Favorite */}
              <button
                data-tv-focus="true"
                tabIndex={0}
                onClick={() => currentSong && toggleFavorite(currentSong.id)}
                className={`p-3 rounded-full transition-all focus:outline-none focus:ring-4 focus:ring-white ${
                  currentSong && isFavorite(currentSong.id)
                    ? 'text-emerald-400'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Me gusta"
              >
                <Heart
                  className={`w-5 h-5 ${
                    currentSong && isFavorite(currentSong.id) ? 'fill-current' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
