import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MusicProvider, useMusic } from './context/MusicContext';
import { AudioProvider, useAudio } from './context/AudioContext';
import { Sidebar } from './components/Sidebar';
import { PlayerBar } from './components/PlayerBar';
import { SpotifyRightPanel } from './components/SpotifyRightPanel';
import { CenterLyricsView } from './components/CenterLyricsView';
import { FullscreenNowPlayingModal } from './components/FullscreenNowPlayingModal';
import { InstallPrompt } from './components/InstallPrompt';
import { ProfileSwitcherModal } from './components/ProfileSwitcherModal';
import { AddToPlaylistModal } from './components/AddToPlaylistModal';
import { CreatePlaylistModal } from './components/CreatePlaylistModal';
import { HomeView } from './views/HomeView';
import { CloudSearchView } from './views/CloudSearchView';
import { LibraryView } from './views/LibraryView';
import { OfflineView } from './views/OfflineView';
import { AdminView } from './views/AdminView';
import { AddMusicView } from './views/AddMusicView';
import { Playlist, Song } from './types';
import { getCustomAppIcon, applyAppIcon } from './utils/appIcon';
import {
  Compass,
  Home,
  Library,
  HardDriveDownload,
  ShieldAlert,
  Search,
  Menu,
  X,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  ArrowDownCircle,
  Settings,
  Sparkles
} from 'lucide-react';

const MainLayout: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | 'favorites' | null>(null);
  const [songToAddToPlaylist, setSongToAddToPlaylist] = useState<Song | null>(null);
  const [isProfileSwitcherOpen, setIsProfileSwitcherOpen] = useState(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  const { currentUser, isAdmin } = useAuth();
  const { downloadingState } = useMusic();
  const { isCenterLyricsOpen, setIsCenterLyricsOpen, currentSong } = useAudio();

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

  const handleSelectPlaylist = (playlist: Playlist | 'favorites') => {
    setSelectedPlaylist(playlist);
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
              onClick={() => window.history.back()}
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
              src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80'}
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
            <CenterLyricsView />
          ) : (
            /* Normal Center Content Views */
            <div className="flex-1 overflow-y-auto">
              {currentTab === 'home' && (
                <HomeView
                  onNavigate={(tab) => {
                    setCurrentTab(tab);
                    if (tab !== 'library') setSelectedPlaylist(null);
                  }}
                  onSelectPlaylist={handleSelectPlaylist}
                  onOpenAddToPlaylist={handleOpenAddToPlaylist}
                />
              )}

              {currentTab === 'cloud' && (
                <CloudSearchView
                  onOpenAddToPlaylist={handleOpenAddToPlaylist}
                  onOpenAddMusic={() => setCurrentTab('add-music')}
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
                />
              )}

              {currentTab === 'offline' && <OfflineView />}

              {currentTab === 'admin' && <AdminView />}
            </div>
          )}
        </main>

        {/* Right Column: Spotify Right Panel (Now Playing & Queue - Spotify Images 4 & 5) */}
        <div className="hidden lg:flex flex-shrink-0 h-full">
          <SpotifyRightPanel />
        </div>
      </div>

      {/* Spotify Bottom Player Bar */}
      <PlayerBar />

      {/* Fullscreen Now Playing View Modal (Bottom right expand button) */}
      <FullscreenNowPlayingModal />

      {/* PWA Install Banner */}
      <InstallPrompt />

      {/* Settings / Profile Preferences Modal */}
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

      <AddToPlaylistModal
        song={songToAddToPlaylist}
        isOpen={Boolean(songToAddToPlaylist)}
        onClose={() => setSongToAddToPlaylist(null)}
        onOpenCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
      />

      <CreatePlaylistModal
        isOpen={isCreatePlaylistOpen}
        onClose={() => setIsCreatePlaylistOpen(false)}
      />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <MusicProvider>
        <AudioProvider>
          <MainLayout />
        </AudioProvider>
      </MusicProvider>
    </AuthProvider>
  );
}

export default App;
