import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
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
import { Playlist, Song, Album } from './types';
import { getCustomAppIcon, applyAppIcon } from './utils/appIcon';
import { DEFAULT_AVATAR } from './services/storage';
import Home from 'lucide-react/dist/esm/icons/house.mjs';
import Search from 'lucide-react/dist/esm/icons/search.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left.mjs';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.mjs';
import ArrowDownCircle from 'lucide-react/dist/esm/icons/circle-arrow-down.mjs';
import Settings from 'lucide-react/dist/esm/icons/settings.mjs';
import Disc3 from 'lucide-react/dist/esm/icons/disc-3.mjs';
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.mjs';

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
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [isImportPlaylistOpen, setIsImportPlaylistOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  const { currentUser } = useAuth();
  const { downloadingState } = useMusic();
  const {
    isCenterLyricsOpen,
    setIsCenterLyricsOpen,
    currentSong,
    isFullscreenNowPlaying,
    setIsFullscreenNowPlaying,
    isVideoMode,
  } = useAudio();
  const { appName, appIcon } = useCustomization();

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

  const handleSelectPlaylist = (playlist: Playlist | 'favorites' | Album) => {
    setSelectedPlaylist(playlist);
    setCurrentTab('library');
    setIsCenterLyricsOpen(false);
  };

  const handleSelectArtist = (artistName: string) => {
    if (currentTab !== 'artist') {
      previousTabRef.current = currentTab;
    }
    setSelectedArtist(artistName);
    setCurrentTab('artist');
    setIsCenterLyricsOpen(false);
  };

  const handleBackFromArtist = () => {
    setCurrentTab(previousTabRef.current || 'home');
  };

  const handleSelectAlbum = (album: Album) => {
    setSelectedPlaylist(album);
    setCurrentTab('library');
    setIsCenterLyricsOpen(false);
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
    setCurrentTab(tab);
    if (tab !== 'cloud') setSearchQuery('');
    setSelectedPlaylist(null);
    setSelectedArtist(null);
    setIsCenterLyricsOpen(false);
    setIsFullscreenNowPlaying(false);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-black text-white select-none">
      {/* Spotify Top Bar (Images 1, 2, 4) */}
      <header
        className="bg-black border-b border-neutral-900/80 px-4 flex items-center justify-between flex-shrink-0 z-30"
        style={{
          height: 'calc(3.5rem + env(safe-area-inset-top))',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {/* Left: Brand, navigation arrows & Home */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`${
              currentTab === 'home' ? 'flex' : 'hidden'
            } md:flex items-center gap-2 min-w-0 mr-1`}
          >
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg md:rounded-xl bg-gradient-to-tr from-emerald-500 via-green-400 to-teal-300 flex items-center justify-center overflow-hidden shadow-lg shadow-emerald-500/20 flex-shrink-0">
              {appIcon ? (
                <img src={appIcon} alt={appName} className="w-full h-full object-cover" />
              ) : (
                <Disc3 className="w-4 h-4 text-black" />
              )}
            </div>
            <span className="hidden md:block text-sm font-black text-white truncate max-w-[130px]">
              {appName}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (currentTab === 'artist') {
                  handleBackFromArtist();
                } else if (currentTab === 'library' && selectedPlaylist) {
                  setSelectedPlaylist(null);
                } else if (currentTab !== 'home') {
                  setCurrentTab('home');
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
            onClick={() => {
              setIsCenterLyricsOpen(false);
              setCurrentTab('home');
              setSelectedPlaylist(null);
            }}
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
                setIsCenterLyricsOpen(false);
                setCurrentTab('cloud');
                setSelectedPlaylist(null);
              }}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setIsCenterLyricsOpen(false);
                setCurrentTab('cloud');
                setSelectedPlaylist(null);
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
            onClick={() => setIsProfileSwitcherOpen(true)}
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
            setCurrentTab={(tab) => {
              setCurrentTab(tab);
              if (tab !== 'library') setSelectedPlaylist(null);
            }}
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
                    onNavigate={(tab) => {
                      setCurrentTab(tab);
                      if (tab !== 'library') setSelectedPlaylist(null);
                    }}
                    onSelectPlaylist={handleSelectPlaylist}
                    onOpenAddToPlaylist={handleOpenAddToPlaylist}
                    onSelectArtist={handleSelectArtist}
                  />
                )}

                {currentTab === 'cloud' && (
                  <CloudSearchView
                    searchQuery={searchQuery}
                    onSearchQueryChange={setSearchQuery}
                    onOpenAddToPlaylist={handleOpenAddToPlaylist}
                    onSelectArtist={handleSelectArtist}
                    onSelectAlbum={handleSelectAlbum}
                  />
                )}

                {currentTab === 'add-music' && (
                  <AddMusicView onNavigate={setCurrentTab} />
                )}

                {currentTab === 'library' && (
                  <LibraryView
                    selectedPlaylist={selectedPlaylist}
                    setSelectedPlaylist={setSelectedPlaylist}
                    onOpenCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
                    onOpenAddToPlaylist={handleOpenAddToPlaylist}
                    onOpenImportPlaylist={() => setIsImportPlaylistOpen(true)}
                    onSelectArtist={handleSelectArtist}
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
                    onNavigate={(tab) => {
                      setCurrentTab(tab);
                      if (tab !== 'library') setSelectedPlaylist(null);
                    }}
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

      {isFullscreenNowPlaying && (
        <Suspense fallback={null}>
          <FullscreenNowPlayingModal onSelectArtist={handleSelectArtist} />
        </Suspense>
      )}

      {isVideoMode && (
        <Suspense fallback={null}>
          <MusicVideoModal />
        </Suspense>
      )}

      {isProfileSwitcherOpen && (
        <Suspense fallback={null}>
          <ProfileSwitcherModal
            isOpen={isProfileSwitcherOpen}
            onClose={() => setIsProfileSwitcherOpen(false)}
            onOpenCreateProfile={() => {
              setCurrentTab('admin');
            }}
            onNavigateAddMusic={() => {
              setCurrentTab('add-music');
            }}
            onOpenProfileView={() => {
              setSelectedPlaylist(null);
              setCurrentTab('profile');
            }}
            onOpenAdminPanel={() => {
              setSelectedPlaylist(null);
              setCurrentTab('admin');
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
              setSelectedPlaylist(playlist);
              setCurrentTab('library');
              setIsImportPlaylistOpen(false);
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
