import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MusicProvider, useMusic } from './context/MusicContext';
import { AudioProvider, useAudio } from './context/AudioContext';
import { CustomizationProvider, useCustomization } from './context/CustomizationContext';
import { Sidebar } from './components/Sidebar';
import { PlayerBar } from './components/PlayerBar';
import { SpotifyRightPanel } from './components/SpotifyRightPanel';
import { InstallPrompt } from './components/InstallPrompt';
import { Playlist, Song, Album } from './types';
import { getCustomAppIcon, applyAppIcon } from './utils/appIcon';
import { DEFAULT_AVATAR } from './services/storage';
import Compass from 'lucide-react/dist/esm/icons/compass.mjs';
import Home from 'lucide-react/dist/esm/icons/house.mjs';
import Library from 'lucide-react/dist/esm/icons/library.mjs';
import HardDriveDownload from 'lucide-react/dist/esm/icons/hard-drive-download.mjs';
import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert.mjs';
import Search from 'lucide-react/dist/esm/icons/search.mjs';
import Menu from 'lucide-react/dist/esm/icons/menu.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import UploadCloud from 'lucide-react/dist/esm/icons/cloud-upload.mjs';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left.mjs';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.mjs';
import ArrowDownCircle from 'lucide-react/dist/esm/icons/circle-arrow-down.mjs';
import Settings from 'lucide-react/dist/esm/icons/settings.mjs';
import UserRound from 'lucide-react/dist/esm/icons/user-round.mjs';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  const { currentUser, isAdmin } = useAuth();
  const { downloadingState } = useMusic();
  const {
    isCenterLyricsOpen,
    setIsCenterLyricsOpen,
    currentSong,
    isFullscreenNowPlaying,
    isVideoMode,
  } = useAudio();
  const { appName, appIcon } = useCustomization();

  // Listen to network status & initialize custom app icon
  useEffect(() => {
    const customIcon = getCustomAppIcon();
    if (customIcon) {
      applyAppIcon(customIcon);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
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

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-black text-white select-none">
      {/* Spotify Top Bar (Images 1, 2, 4) */}
      <header className="h-14 bg-black border-b border-neutral-900/80 px-4 flex items-center justify-between flex-shrink-0 z-30">
        {/* Left: Navigation arrows & Home */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => {
                if (currentTab === 'artist') {
                  handleBackFromArtist();
                } else if (currentTab === 'library' && selectedPlaylist) {
                  setSelectedPlaylist(null);
                } else {
                  window.history.back();
                }
              }}
              className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-300 flex items-center justify-center transition-colors"
              title="Atrás"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => window.history.forward()}
              className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-300 flex items-center justify-center transition-colors"
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
            className="w-9 h-9 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white flex items-center justify-center transition-colors ml-1"
            title="Inicio"
          >
            <Home className="w-4 h-4 text-emerald-400" />
          </button>
        </div>

        {/* Center: Search input & Downloading notification banner */}
        <div className="flex-1 max-w-lg mx-3 flex items-center justify-center gap-3">
          {/* Downloading Indicator Pill (User request: "cuando se está descargando música, ahí arriba sale como que descargando") */}
          {downloadingState?.isDownloading ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold animate-pulse shadow-lg">
              <ArrowDownCircle className="w-4 h-4 text-emerald-400 animate-bounce" />
              <span>
                Descargando música: {downloadingState.title || 'Guardando offline...'}
              </span>
            </div>
          ) : (
            /* Spotify-style search bar */
            <div
              onClick={() => {
                setIsCenterLyricsOpen(false);
                setCurrentTab('cloud');
              }}
              className="w-full flex items-center gap-2.5 bg-neutral-900/90 hover:bg-neutral-850 border border-neutral-800/80 hover:border-neutral-700 px-4 py-2 rounded-full cursor-pointer transition-all max-w-md shadow-inner group"
            >
              <Search className="w-4 h-4 text-neutral-400 group-hover:text-white transition-colors" />
              <span className="text-xs text-neutral-400 font-semibold truncate">
                ¿Qué quieres reproducir?
              </span>
            </div>
          )}
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
            <Settings className="w-3.5 h-3.5 text-neutral-400" />
          </button>

          {/* Mobile hamburger menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-neutral-900 text-neutral-300"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-14 left-0 right-0 z-40 bg-neutral-900/95 border-b border-neutral-800 p-4 space-y-2 backdrop-blur-xl animate-in slide-in-from-top-2">
          <button
            onClick={() => {
              setCurrentTab('home');
              setIsCenterLyricsOpen(false);
              setIsMobileMenuOpen(false);
            }}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-neutral-950 text-sm font-bold text-white"
          >
            <Home className="w-4 h-4 text-emerald-400" />
            Inicio
          </button>
          <button
            onClick={() => {
              setCurrentTab('cloud');
              setIsCenterLyricsOpen(false);
              setIsMobileMenuOpen(false);
            }}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-neutral-950 text-sm font-bold text-white"
          >
            <Compass className="w-4 h-4 text-emerald-400" />
            Explorar la Nube
          </button>
          <button
            onClick={() => {
              setCurrentTab('add-music');
              setIsCenterLyricsOpen(false);
              setIsMobileMenuOpen(false);
            }}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-neutral-950 text-sm font-bold text-white"
          >
            <UploadCloud className="w-4 h-4 text-emerald-400" />
            Añadir Música
          </button>
          <button
            onClick={() => {
              setCurrentTab('library');
              setIsCenterLyricsOpen(false);
              setIsMobileMenuOpen(false);
            }}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-neutral-950 text-sm font-bold text-white"
          >
            <Library className="w-4 h-4 text-emerald-400" />
            Tu Biblioteca
          </button>
          <button
            onClick={() => {
              setCurrentTab('offline');
              setIsCenterLyricsOpen(false);
              setIsMobileMenuOpen(false);
            }}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-neutral-950 text-sm font-bold text-white"
          >
            <HardDriveDownload className="w-4 h-4 text-emerald-400" />
            Modo Sin Conexión
          </button>
          <button
            onClick={() => {
              setCurrentTab('profile');
              setIsCenterLyricsOpen(false);
              setIsMobileMenuOpen(false);
            }}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-neutral-950 text-sm font-bold text-white"
          >
            <UserRound className="w-4 h-4 text-emerald-400" />
            Mi Perfil y Estadísticas
          </button>
          {isAdmin && (
            <button
              onClick={() => {
                setCurrentTab('admin');
                setIsCenterLyricsOpen(false);
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-sm font-bold text-emerald-400"
            >
              <ShieldAlert className="w-4 h-4" />
              Panel Admin
            </button>
          )}
        </div>
      )}

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
                    onOpenAddToPlaylist={handleOpenAddToPlaylist}
                    onOpenAddMusic={() => setCurrentTab('add-music')}
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

      {/* Spotify Bottom Player Bar */}
      <PlayerBar onSelectArtist={handleSelectArtist} />

      {/* PWA Install Banner */}
      <InstallPrompt />

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
