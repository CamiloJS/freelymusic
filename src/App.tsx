import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MusicProvider, useMusic } from './context/MusicContext';
import { AudioProvider, useAudio } from './context/AudioContext';
import { Sidebar } from './components/Sidebar';
import { PlayerBar } from './components/PlayerBar';
import { LyricsModal } from './components/LyricsModal';
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
  Mic2,
  Menu,
  X,
  UploadCloud
} from 'lucide-react';

const MainLayout: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [songToAddToPlaylist, setSongToAddToPlaylist] = useState<Song | null>(null);
  const [isProfileSwitcherOpen, setIsProfileSwitcherOpen] = useState(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  const { isAdmin } = useAuth();
  const { setShowLyricsView } = useAudio();

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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black text-white select-none">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-shrink-0 h-full">
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={(tab) => {
            setCurrentTab(tab);
            if (tab !== 'library') setSelectedPlaylist(null);
          }}
          onOpenCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
          onOpenProfileSwitcher={() => setIsProfileSwitcherOpen(true)}
          isOnline={isOnline}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-neutral-950">
        {/* Mobile Top Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-neutral-950/90 border-b border-neutral-900 z-30">
          <div className="flex items-center gap-2">
            <span className="font-black text-lg text-white">MÚSICA</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsProfileSwitcherOpen(true)}
              className="text-xs font-semibold px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300"
            >
              Perfiles
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-1.5 rounded-lg bg-neutral-900 text-neutral-300"
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

        {/* Dynamic Views */}
        <main className="flex-1 overflow-y-auto">
          {currentTab === 'home' && (
            <HomeView
              onNavigate={(tab) => {
                setCurrentTab(tab);
                if (tab !== 'library') setSelectedPlaylist(null);
              }}
              onSelectPlaylist={(pl) => {
                setSelectedPlaylist(pl);
                setCurrentTab('library');
              }}
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
        </main>

        {/* Spotify-style Bottom Player Bar */}
        <PlayerBar />
      </div>

      {/* Apple Music Style Fullscreen / Lyrics View */}
      <LyricsModal />

      {/* PWA Install Banner */}
      <InstallPrompt />

      {/* Modals */}
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
