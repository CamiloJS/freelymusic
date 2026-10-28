import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MusicProvider, useMusic } from './context/MusicContext';
import { AudioProvider, useAudio } from './context/AudioContext';
import { CustomizationProvider, useCustomization } from './context/CustomizationContext';
import { Sidebar } from './components/Sidebar';
import { PlayerBar } from './components/PlayerBar';
import { MobilePlayerBar } from './components/MobilePlayerBar';
import { MobileNav } from './components/MobileNav';
import { SpotifyRightPanel } from './components/SpotifyRightPanel';
import { InstallPrompt } from './components/InstallPrompt';
import { Playlist, Song, Album, UserProfile } from './types';
import { getAlbumsFromCatalog } from './utils/albums';
import { getCustomAppIcon, applyAppIcon } from './utils/appIcon';
import { DEFAULT_AVATAR, requestPersistentStorage } from './services/storage';
import Home from 'lucide-react/dist/esm/icons/house.mjs';
import Search from 'lucide-react/dist/esm/icons/search.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left.mjs';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.mjs';
import ArrowDownCircle from 'lucide-react/dist/esm/icons/circle-arrow-down.mjs';
import Settings from 'lucide-react/dist/esm/icons/settings.mjs';
import Disc3 from 'lucide-react/dist/esm/icons/disc-3.mjs';
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.mjs';
import Tv from 'lucide-react/dist/esm/icons/tv.mjs';
import { getStoredTvMode, setStoredTvMode, isSmartTV } from './utils/tvDetection';

// Views and modals are split into separate chunks: the first paint no longer
// has to download Admin, Add Music, the artist page or every modal.
const HomeView = lazy(() =>
  import('./views/HomeView').then((module) => ({ default: module.HomeView }))
);
const CloudSearchView = lazy(() =>
  import('./views/CloudSearchView').then((module) => ({ default: module.CloudSearchView }))
);
const LibraryView = lazy(() =>
  import('./views/LibraryView').then((module) => ({ default: module.LibraryView }))
);
const OfflineView = lazy(() =>
  import('./views/OfflineView').then((module) => ({ default: module.OfflineView }))
);
const AdminView = lazy(() =>
  import('./views/AdminView').then((module) => ({ default: module.AdminView }))
);
const AddMusicView = lazy(() =>
  import('./views/AddMusicView').then((module) => ({ default: module.AddMusicView }))
);
const ArtistProfileView = lazy(() =>
  import('./views/ArtistProfileView').then((module) => ({ default: module.ArtistProfileView }))
);
const ProfileView = lazy(() =>
  import('./views/ProfileView').then((module) => ({ default: module.ProfileView }))
);
const TvView = lazy(() =>
  import('./views/TvView').then((module) => ({ default: module.TvView }))
);
const ImportPlaylistModal = lazy(() =>
  import('./components/ImportPlaylistModal').then((module) => ({
    default: module.ImportPlaylistModal,
  }))
);
const CenterLyricsView = lazy(() =>
  import('./components/CenterLyricsView').then((module) => ({ default: module.CenterLyricsView }))
);
const FullscreenNowPlayingModal = lazy(() =>
  import('./components/FullscreenNowPlayingModal').then((module) => ({
    default: module.FullscreenNowPlayingModal,
  }))
);
const MusicVideoModal = lazy(() =>
  import('./components/MusicVideoModal').then((module) => ({
    default: module.MusicVideoModal,
  }))
);
const ProfileSwitcherModal = lazy(() =>
  import('./components/ProfileSwitcherModal').then((module) => ({
    default: module.ProfileSwitcherModal,
  }))
);
const SpotifySideDrawer = lazy(() =>
  import('./components/SpotifySideDrawer').then((module) => ({
    default: module.SpotifySideDrawer,
  }))
);
const RecientesHistoryModal = lazy(() =>
  import('./components/RecientesHistoryModal').then((module) => ({
    default: module.RecientesHistoryModal,
  }))
);
const CustomizeModal = lazy(() =>
  import('./components/CustomizeModal').then((module) => ({
    default: module.CustomizeModal,
  }))
);
const PrivacySettingsModal = lazy(() =>
  import('./components/PrivacySettingsModal').then((module) => ({
    default: module.PrivacySettingsModal,
  }))
);
const MessagesModal = lazy(() =>
  import('./components/MessagesModal').then((module) => ({
    default: module.MessagesModal,
  }))
);
const UserProfileModal = lazy(() =>
  import('./components/UserProfileModal').then((module) => ({
    default: module.UserProfileModal,
  }))
);
const AddToPlaylistModal = lazy(() =>
  import('./components/AddToPlaylistModal').then((module) => ({
    default: module.AddToPlaylistModal,
  }))
);
const CreatePlaylistModal = lazy(() =>
  import('./components/CreatePlaylistModal').then((module) => ({
    default: module.CreatePlaylistModal,
  }))
);
const LoginLockScreen = lazy(() =>
  import('./components/LoginLockScreen').then((module) => ({ default: module.LoginLockScreen }))
);

const ViewLoader: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <div
    className={`flex items-center justify-center text-emerald-400 ${
      compact ? 'h-32' : 'h-full min-h-[240px]'
    }`}
  >
    <Loader2 className="w-6 h-6 animate-spin" />
  </div>
);

const MainLayout: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('home');
  const previousTabRef = useRef<string>('home');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | 'favorites' | Album | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [songToAddToPlaylist, setSongToAddToPlaylist] = useState<Song | null>(null);
  const [isProfileSwitcherOpen, setIsProfileSwitcherOpen] = useState(false);
  const [isSideDrawerOpen, setIsSideDrawerOpen] = useState(false);
  const [isRecientesOpen, setIsRecientesOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isPrivacySettingsOpen, setIsPrivacySettingsOpen] = useState(false);
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [messagesInitialThreadId, setMessagesInitialThreadId] = useState<string | undefined>();
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [isImportPlaylistOpen, setIsImportPlaylistOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isTvMode, setIsTvMode] = useState<boolean>(() => getStoredTvMode());

  useEffect(() => {
    void requestPersistentStorage();
    const handleHash = () => {
      const isTv = getStoredTvMode();
      setIsTvMode(isTv);
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleToggleTvMode = useCallback((enabled: boolean) => {
    setIsTvMode(enabled);
    setStoredTvMode(enabled);
    if (enabled) {
      if (!window.location.hash.includes('/tv')) {
        window.location.hash = '#/tv';
      }
    } else {
      if (window.location.hash.includes('/tv')) {
        window.location.hash = '#/';
      }
    }
  }, []);

  const { currentUser } = useAuth();
  const { downloadingState, catalog, playlists } = useMusic();
  const {
    isCenterLyricsOpen,
    setIsCenterLyricsOpen,
    currentSong,
    isFullscreenNowPlaying,
    setIsFullscreenNowPlaying,
    isVideoMode,
  } = useAudio();
  const { appName, appIcon } = useCustomization();

  // Hash-based URL router for shareable direct links & browser history
  const isSyncingHashRef = useRef(false);

  const syncRouteFromHash = useCallback(() => {
    isSyncingHashRef.current = true;
    const rawHash = window.location.hash.replace(/^#\/?/, '').trim();
    if (!rawHash) {
      setCurrentTab('home');
      setSelectedPlaylist(null);
      setSelectedArtist(null);
      isSyncingHashRef.current = false;
      return;
    }

    const [segment, ...rest] = rawHash.split('/');
    const param = decodeURIComponent(rest.join('/'));

    switch (segment) {
      case 'tv':
        setIsTvMode(true);
        setStoredTvMode(true);
        break;
      case 'search':
      case 'cloud':
        setCurrentTab('cloud');
        setSelectedPlaylist(null);
        setSelectedArtist(null);
        break;
      case 'library':
        setCurrentTab('library');
        setSelectedPlaylist(null);
        setSelectedArtist(null);
        break;
      case 'favorites':
        setCurrentTab('library');
        setSelectedPlaylist('favorites');
        setSelectedArtist(null);
        break;
      case 'playlist':
        if (param) {
          const pl = playlists.find(
            (p) => p.id === param || p.name.trim().toLowerCase() === param.trim().toLowerCase()
          );
          if (pl) {
            setSelectedPlaylist(pl);
          } else {
            setSelectedPlaylist((prev) => {
              if (
                prev &&
                typeof prev === 'object' &&
                'id' in prev &&
                (prev.id === param || prev.name.trim().toLowerCase() === param.trim().toLowerCase())
              ) {
                return prev;
              }
              return {
                id: param,
                name: param,
                userId: '',
                songIds: [],
                createdAt: '',
                updatedAt: '',
              };
            });
          }
          setCurrentTab('library');
          setSelectedArtist(null);
        } else {
          setCurrentTab('library');
        }
        break;
      case 'album':
        if (param) {
          const allAlbums = getAlbumsFromCatalog(catalog);
          const found = allAlbums.find(
            (a) => a.name.trim().toLowerCase() === param.trim().toLowerCase()
          );
          if (found) {
            setSelectedPlaylist(found);
          } else {
            setSelectedPlaylist((prev) => {
              if (
                prev &&
                typeof prev === 'object' &&
                'songs' in prev &&
                prev.name.trim().toLowerCase() === param.trim().toLowerCase()
              ) {
                return prev;
              }
              const matchingSongs = catalog.filter(
                (s) => s.album && s.album.trim().toLowerCase() === param.trim().toLowerCase()
              );
              return {
                name: param,
                artist: matchingSongs[0]?.artist || '',
                coverUrl: matchingSongs[0]?.coverUrl || '',
                songs: matchingSongs,
              };
            });
          }
          setCurrentTab('library');
          setSelectedArtist(null);
        } else {
          setCurrentTab('library');
        }
        break;
      case 'artist':
        if (param) {
          setSelectedArtist(param);
          setCurrentTab('artist');
          setSelectedPlaylist(null);
        } else {
          setCurrentTab('home');
        }
        break;
      case 'profile':
        setCurrentTab('profile');
        setSelectedPlaylist(null);
        setSelectedArtist(null);
        break;
      case 'offline':
        setCurrentTab('offline');
        setSelectedPlaylist(null);
        setSelectedArtist(null);
        break;
      case 'add-music':
        setCurrentTab('add-music');
        setSelectedPlaylist(null);
        setSelectedArtist(null);
        break;
      case 'admin':
        setCurrentTab('admin');
        setSelectedPlaylist(null);
        setSelectedArtist(null);
        break;
      default:
        setCurrentTab('home');
        setSelectedPlaylist(null);
        setSelectedArtist(null);
    }
    isSyncingHashRef.current = false;
  }, [catalog, playlists]);

  useEffect(() => {
    syncRouteFromHash();
    window.addEventListener('hashchange', syncRouteFromHash);
    return () => window.removeEventListener('hashchange', syncRouteFromHash);
  }, [syncRouteFromHash]);

  // Listen to network status & initialize custom app icon
  useEffect(() => {
    const customIcon = getCustomAppIcon();
    applyAppIcon(customIcon || '/icon.svg');

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Warm the service-worker cache for the core views after first paint so the
  // app can still be opened offline after the initial visit.
  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        await Promise.allSettled([
          import('./views/HomeView'),
          import('./views/CloudSearchView'),
          import('./views/LibraryView'),
          import('./views/ProfileView'),
          import('./views/OfflineView'),
          import('./views/AddMusicView'),
        ]);

        // Re-fetch chunks that were loaded before the service worker took
        // control (for example right after an update) so they are in the
        // offline cache too.
        const assetUrls = performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .filter(
            (url) =>
              url.includes('/assets/') &&
              (url.endsWith('.js') || url.endsWith('.css'))
          );

        await Promise.allSettled(
          assetUrls.map((url) =>
            fetch(url, { cache: 'reload' }).then((response) => response.blob())
          )
        );
      })();
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const handleOpenAddToPlaylist = (song: Song) => {
    setSongToAddToPlaylist(song);
  };

  const handleSelectPlaylist = useCallback((playlist: Playlist | 'favorites' | Album) => {
    setSelectedPlaylist(playlist);
    setCurrentTab('library');
    setIsCenterLyricsOpen(false);
    setIsFullscreenNowPlaying(false);

    if (playlist === 'favorites') {
      if (window.location.hash !== '#/favorites') {
        window.location.hash = '#/favorites';
      }
    } else if ('songs' in playlist) {
      const albumHash = `#/album/${encodeURIComponent(playlist.name)}`;
      if (window.location.hash !== albumHash) {
        window.location.hash = albumHash;
      }
    } else {
      const plHash = `#/playlist/${encodeURIComponent(playlist.id)}`;
      if (window.location.hash !== plHash) {
        window.location.hash = plHash;
      }
    }
  }, [setIsCenterLyricsOpen, setIsFullscreenNowPlaying]);

  const handleSetSelectedPlaylist = useCallback(
    (playlist: Playlist | 'favorites' | Album | null) => {
      if (playlist === null) {
        setSelectedPlaylist(null);
        if (window.location.hash !== '#/library') {
          window.location.hash = '#/library';
        }
      } else {
        handleSelectPlaylist(playlist);
      }
    },
    [handleSelectPlaylist]
  );

  const handleSelectArtist = (artistName: string) => {
    if (currentTab !== 'artist') {
      previousTabRef.current = currentTab;
    }
    setSelectedArtist(artistName);
    setCurrentTab('artist');
    setIsCenterLyricsOpen(false);
    setIsFullscreenNowPlaying(false);
    window.location.hash = `#/artist/${encodeURIComponent(artistName)}`;
  };

  const handleBackFromArtist = () => {
    window.history.back();
  };

  const handleSelectAlbum = (album: Album) => {
    handleSelectPlaylist(album);
  };

  const handleNavigateTab = (tab: string) => {
    setIsCenterLyricsOpen(false);
    setIsFullscreenNowPlaying(false);
    if (tab === 'home') {
      setSelectedPlaylist(null);
      setSelectedArtist(null);
      window.location.hash = '#/';
    } else if (tab === 'cloud' || tab === 'search') {
      setSelectedPlaylist(null);
      setSelectedArtist(null);
      window.location.hash = '#/search';
    } else if (tab === 'library') {
      setSelectedPlaylist(null);
      setSelectedArtist(null);
      window.location.hash = '#/library';
    } else {
      setSelectedPlaylist(null);
      setSelectedArtist(null);
      window.location.hash = `#/${tab}`;
    }
  };

  // On mobile, the bottom nav handles the root sections. The header back arrow
  // is only useful inside details such as an album, artist or settings view.
  const showMobileBack =
    currentTab === 'artist' ||
    currentTab === 'add-music' ||
    currentTab === 'profile' ||
    currentTab === 'admin' ||
    currentTab === 'offline' ||
    (currentTab === 'library' && Boolean(selectedPlaylist));

  const handleMobileTab = (tab: 'home' | 'cloud' | 'library') => {
    handleNavigateTab(tab);
  };

  if (isTvMode) {
    return (
      <Suspense fallback={<ViewLoader />}>
        <TvView onExitTvMode={() => handleToggleTvMode(false)} />
      </Suspense>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-black text-white select-none">
      {/* Spotify Top Bar (Images 1, 2, 4) */}
      <header
        className={`${
          currentTab === 'home' || (currentTab === 'library' && !selectedPlaylist)
            ? 'hidden md:flex'
            : 'flex'
        } bg-black border-b border-neutral-900/80 px-4 items-center justify-between flex-shrink-0 z-30`}
        style={{
          height: 'calc(3.5rem + env(safe-area-inset-top))',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {/* Left: Navigation arrows & Home */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (currentTab === 'artist') {
                  handleBackFromArtist();
                } else if (currentTab === 'library' && selectedPlaylist) {
                  setSelectedPlaylist(null);
                  window.location.hash = '#/library';
                } else if (currentTab !== 'home') {
                  handleNavigateTab('home');
                } else {
                  window.history.back();
                }
              }}
              className={`${
                showMobileBack ? 'flex' : 'hidden md:flex'
              } w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-300 items-center justify-center transition-colors`}
              title="Atrás"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => window.history.forward()}
              className="hidden sm:flex w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-300 items-center justify-center transition-colors"
              title="Adelante"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => handleNavigateTab('home')}
            className="hidden md:flex w-9 h-9 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white items-center justify-center transition-colors ml-1"
            title="Inicio"
          >
            <Home className="w-4 h-4 text-emerald-400" />
          </button>
        </div>

        {/* Center: one real search input, shared with the search view */}
        <div className="flex-1 max-w-lg mx-3">
          <div className="w-full flex items-center gap-2.5 bg-neutral-900/90 hover:bg-neutral-850 border border-neutral-800/80 hover:border-neutral-600 focus-within:border-white/70 px-4 py-2 rounded-full transition-all max-w-md shadow-inner group">
            <Search className="w-4 h-4 text-neutral-400 group-focus-within:text-white transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => {
                if (currentTab !== 'cloud') handleNavigateTab('cloud');
              }}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                if (currentTab !== 'cloud') handleNavigateTab('cloud');
              }}
              placeholder="¿Qué quieres reproducir?"
              aria-label="Buscar música"
              className="flex-1 min-w-0 bg-transparent text-xs text-white placeholder-neutral-400 focus:outline-none font-semibold"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-0.5 rounded-full text-neutral-400 hover:text-white"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right: User Profile & Preferences Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (window.innerWidth < 768) {
                setIsSideDrawerOpen(true);
              } else {
                setIsProfileSwitcherOpen(true);
              }
            }}
            className="flex items-center gap-2 p-1 pl-1 pr-3 rounded-full bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 transition-all text-left"
            title="Abrir preferencias, cuenta y ajustes"
          >
            <img
              src={currentUser?.avatarUrl || DEFAULT_AVATAR}
              alt={currentUser?.displayName || 'Usuario'}
              className="w-7 h-7 rounded-full object-cover ring-1 ring-emerald-500/40"
            />
            <span className="text-xs font-bold text-white hidden md:inline truncate max-w-[120px]">
              {currentUser?.displayName || 'Usuario'}
            </span>
            <Settings className="hidden md:block w-3.5 h-3.5 text-neutral-400" />
          </button>

        </div>
      </header>

      {/* Main 3-Column Spotify Desktop Layout (Left Sidebar | Center Content | Right Panel) */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Column: Tu biblioteca */}
        <div className="hidden md:flex flex-shrink-0 h-full">
          <Sidebar
            currentTab={currentTab}
            setCurrentTab={handleNavigateTab}
            onSelectPlaylist={handleSelectPlaylist}
            selectedPlaylist={selectedPlaylist}
            onOpenCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
            onOpenProfileSwitcher={() => setIsProfileSwitcherOpen(true)}
            onSelectArtist={handleSelectArtist}
            isOnline={isOnline}
          />
        </div>

        {/* Center Column: Dynamic View OR Center Lyrics View (Spotify Image 3) */}
        <main className="flex-1 flex flex-col h-full min-w-0 bg-neutral-950 overflow-hidden relative">
          {isCenterLyricsOpen && currentSong ? (
            /* Lyrics View docked in center area */
            <Suspense fallback={<ViewLoader />}>
              <CenterLyricsView />
            </Suspense>
          ) : (
            /* Normal Center Content Views */
            <div className="flex-1 overflow-y-auto">
              <Suspense fallback={<ViewLoader />}>
                {currentTab === 'home' && (
                  <HomeView
                    onNavigate={handleNavigateTab}
                    onSelectPlaylist={handleSelectPlaylist}
                    onOpenAddToPlaylist={handleOpenAddToPlaylist}
                    onSelectArtist={handleSelectArtist}
                    onOpenProfileSwitcher={() => setIsSideDrawerOpen(true)}
                  />
                )}

                {currentTab === 'cloud' && (
                  <CloudSearchView
                    searchQuery={searchQuery}
                    onSearchQueryChange={setSearchQuery}
                    onOpenAddToPlaylist={handleOpenAddToPlaylist}
                    onSelectArtist={handleSelectArtist}
                    onSelectAlbum={handleSelectAlbum}
                    onSelectUserProfile={(user) => setSelectedUserProfile(user)}
                  />
                )}

                {currentTab === 'add-music' && (
                  <AddMusicView onNavigate={handleNavigateTab} />
                )}

                {currentTab === 'library' && (
                  <LibraryView
                    selectedPlaylist={selectedPlaylist}
                    setSelectedPlaylist={handleSetSelectedPlaylist}
                    onOpenCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
                    onOpenAddToPlaylist={handleOpenAddToPlaylist}
                    onOpenImportPlaylist={() => setIsImportPlaylistOpen(true)}
                    onSelectArtist={handleSelectArtist}
                    onOpenProfileSwitcher={() => setIsSideDrawerOpen(true)}
                  />
                )}

                {currentTab === 'artist' && selectedArtist && (
                  <ArtistProfileView
                    artistName={selectedArtist}
                    onSelectArtist={handleSelectArtist}
                    onSelectAlbum={handleSelectAlbum}
                    onOpenAddToPlaylist={handleOpenAddToPlaylist}
                    onBack={handleBackFromArtist}
                  />
                )}

                {currentTab === 'profile' && (
                  <ProfileView
                    onSelectPlaylist={handleSelectPlaylist}
                    onSelectArtist={handleSelectArtist}
                    onOpenCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
                    onOpenImportPlaylist={() => setIsImportPlaylistOpen(true)}
                    onNavigate={handleNavigateTab}
                  />
                )}

                {currentTab === 'offline' && <OfflineView />}

                {currentTab === 'admin' && <AdminView />}
              </Suspense>
            </div>
          )}
        </main>

        {/* Right Column: Spotify Right Panel (Now Playing & Queue - Spotify Images 4 & 5) */}
        <div className="hidden lg:flex flex-shrink-0 h-full">
          <SpotifyRightPanel
            onSelectArtist={handleSelectArtist}
            onSelectAlbum={handleSelectAlbum}
            onSelectPlaylist={handleSelectPlaylist}
            onNavigateSearch={() => setCurrentTab('search')}
          />
        </div>
      </div>

      {/* Desktop player. Mobile has its own compact player + bottom navigation. */}
      <div className="hidden md:block">
        <PlayerBar onSelectArtist={handleSelectArtist} />
      </div>
      <MobilePlayerBar onSelectArtist={handleSelectArtist} />
      <MobileNav currentTab={currentTab} onSelectTab={handleMobileTab} />

      {/* PWA Install Banner */}
      <InstallPrompt />

      {downloadingState?.isDownloading && (
        <div className="fixed bottom-24 right-4 z-40 w-72 rounded-2xl border border-emerald-500/25 bg-neutral-900/95 p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
            <ArrowDownCircle className="w-4 h-4 animate-bounce flex-shrink-0" />
            <span className="truncate flex-1">
              {downloadingState.title || 'Descargando música...'}
            </span>
            {typeof downloadingState.progress === 'number' && (
              <span className="text-[10px] text-emerald-400 flex-shrink-0">
                {Math.round(downloadingState.progress)}%
              </span>
            )}
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
            <div
              className={`h-full rounded-full bg-emerald-400 transition-all ${
                typeof downloadingState.progress === 'number' ? '' : 'w-1/3 animate-pulse'
              }`}
              style={
                typeof downloadingState.progress === 'number'
                  ? { width: `${Math.max(4, Math.min(100, downloadingState.progress))}%` }
                  : undefined
              }
            />
          </div>
          <p className="mt-1.5 text-[10px] text-neutral-500">
            Guardando para escuchar sin conexión
          </p>
        </div>
      )}

      {isFullscreenNowPlaying && !isVideoMode && (
        <Suspense fallback={null}>
          <FullscreenNowPlayingModal
            onSelectArtist={handleSelectArtist}
            onSelectAlbum={handleSelectAlbum}
            onSelectPlaylist={handleSelectPlaylist}
            onOpenAddToPlaylist={handleOpenAddToPlaylist}
            onNavigateSearch={() => setCurrentTab('search')}
          />
        </Suspense>
      )}

      {isFullscreenNowPlaying && isVideoMode && (
        <Suspense fallback={null}>
          <MusicVideoModal
            onSelectArtist={handleSelectArtist}
            onSelectAlbum={handleSelectAlbum}
            onSelectPlaylist={handleSelectPlaylist}
          />
        </Suspense>
      )}

      {isProfileSwitcherOpen && (
        <Suspense fallback={null}>
          <ProfileSwitcherModal
            isOpen={isProfileSwitcherOpen}
            onClose={() => setIsProfileSwitcherOpen(false)}
            onOpenCreateProfile={() => {
              handleNavigateTab('admin');
            }}
            onNavigateAddMusic={() => {
              handleNavigateTab('add-music');
            }}
            onOpenProfileView={() => {
              handleNavigateTab('profile');
            }}
            onOpenAdminPanel={() => {
              handleNavigateTab('admin');
            }}
          />
        </Suspense>
      )}

      {songToAddToPlaylist && (
        <Suspense fallback={null}>
          <AddToPlaylistModal
            song={songToAddToPlaylist}
            isOpen
            onClose={() => setSongToAddToPlaylist(null)}
            onOpenCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
          />
        </Suspense>
      )}

      {isCreatePlaylistOpen && (
        <Suspense fallback={null}>
          <CreatePlaylistModal
            isOpen={isCreatePlaylistOpen}
            onClose={() => setIsCreatePlaylistOpen(false)}
          />
        </Suspense>
      )}

      {isImportPlaylistOpen && (
        <Suspense fallback={null}>
          <ImportPlaylistModal
            isOpen={isImportPlaylistOpen}
            onClose={() => setIsImportPlaylistOpen(false)}
            onCreated={(playlist) => {
              handleSelectPlaylist(playlist);
              setIsImportPlaylistOpen(false);
            }}
          />
        </Suspense>
      )}

      {isSideDrawerOpen && (
        <Suspense fallback={null}>
          <SpotifySideDrawer
            isOpen={isSideDrawerOpen}
            onClose={() => setIsSideDrawerOpen(false)}
            onOpenProfile={() => setIsProfileSwitcherOpen(true)}
            onOpenAddAccount={() => setIsProfileSwitcherOpen(true)}
            onOpenAdminPanel={() => handleNavigateTab('admin')}
            onOpenStats={() => handleNavigateTab('profile')}
            onOpenRecents={() => setIsRecientesOpen(true)}
            onOpenCustomize={() => setIsCustomizeOpen(true)}
            onOpenSettingsPrivacy={() => setIsPrivacySettingsOpen(true)}
            onOpenMessages={(threadId) => {
              setMessagesInitialThreadId(threadId);
              setIsMessagesOpen(true);
            }}
            onOpenTvMode={() => handleToggleTvMode(true)}
            onSelectFriendProfile={(user) => setSelectedUserProfile(user)}
          />
        </Suspense>
      )}

      {isRecientesOpen && (
        <Suspense fallback={null}>
          <RecientesHistoryModal
            isOpen={isRecientesOpen}
            onClose={() => setIsRecientesOpen(false)}
            onOpenAddToPlaylist={handleOpenAddToPlaylist}
          />
        </Suspense>
      )}

      {isCustomizeOpen && (
        <Suspense fallback={null}>
          <CustomizeModal
            isOpen={isCustomizeOpen}
            onClose={() => setIsCustomizeOpen(false)}
          />
        </Suspense>
      )}

      {isPrivacySettingsOpen && (
        <Suspense fallback={null}>
          <PrivacySettingsModal
            isOpen={isPrivacySettingsOpen}
            onClose={() => setIsPrivacySettingsOpen(false)}
          />
        </Suspense>
      )}

      {isMessagesOpen && (
        <Suspense fallback={null}>
          <MessagesModal
            isOpen={isMessagesOpen}
            onClose={() => {
              setIsMessagesOpen(false);
              setMessagesInitialThreadId(undefined);
            }}
            initialThreadId={messagesInitialThreadId}
          />
        </Suspense>
      )}

      {selectedUserProfile && (
        <Suspense fallback={null}>
          <UserProfileModal
            user={selectedUserProfile}
            isOpen={Boolean(selectedUserProfile)}
            onClose={() => setSelectedUserProfile(null)}
            onOpenMessagesWithUser={(user) => {
              setSelectedUserProfile(null);
              setMessagesInitialThreadId(undefined);
              setIsMessagesOpen(true);
            }}
            onSelectPlaylist={(pl) => {
              setSelectedUserProfile(null);
              handleSelectPlaylist(pl);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

const AuthenticatedApp: React.FC = () => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return (
      <Suspense fallback={<ViewLoader />}>
        <LoginLockScreen />
      </Suspense>
    );
  }
  return <MainLayout />;
};

export function App() {
  return (
    <CustomizationProvider>
      <AuthProvider>
        <MusicProvider>
          <AudioProvider>
            <AuthenticatedApp />
          </AudioProvider>
        </MusicProvider>
      </AuthProvider>
    </CustomizationProvider>
  );
}

export default App;
