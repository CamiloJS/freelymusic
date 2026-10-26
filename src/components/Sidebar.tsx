import React from 'react';
import {
  Home,
  Compass,
  Library,
  Mic2,
  HardDriveDownload,
  ShieldAlert,
  PlusCircle,
  Music,
  UserCheck,
  Disc3,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenCreatePlaylist: () => void;
  onOpenProfileSwitcher: () => void;
  isOnline: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenCreatePlaylist,
  onOpenProfileSwitcher,
  isOnline,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const { playlists, downloadedSongIds } = useMusic();
  const { setShowLyricsView } = useAudio();

  const navItems = [
    { id: 'home', label: 'Inicio', icon: Home },
    { id: 'cloud', label: 'Explorar la Nube', icon: Compass },
    { id: 'library', label: 'Tu Biblioteca', icon: Library },
    { id: 'offline', label: 'Sin Conexión', icon: HardDriveDownload, badge: downloadedSongIds.length > 0 ? downloadedSongIds.length : null },
  ];

  return (
    <aside className="w-64 bg-black/95 text-neutral-300 flex flex-col h-full border-r border-neutral-900 select-none flex-shrink-0">
      {/* Brand Header */}
      <div className="p-6 flex items-center justify-between">
        <div
          onClick={() => setCurrentTab('home')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-green-400 to-teal-300 flex items-center justify-center shadow-lg shadow-emerald-500/25 group-hover:scale-105 transition-all">
            <Disc3 className="w-6 h-6 text-black animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          <div>
            <span className="font-extrabold tracking-wider text-xl text-white block">
              FreelyMusic
            </span>
            <span className="text-[10px] tracking-widest text-emerald-400 font-bold uppercase block -mt-1">
              Cloud Audio
            </span>
          </div>
        </div>

        {/* Network indicator */}
        <div
          title={isOnline ? 'Conexión activa a internet' : 'Modo fuera de línea'}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            isOnline ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60' : 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
          }`}
        >
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                isActive
                  ? 'bg-neutral-800/90 text-white shadow-inner font-bold'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400' : 'text-neutral-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== null && (
                <span className="text-[11px] bg-neutral-800 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Apple Music Style Lyrics trigger */}
        <button
          onClick={() => setShowLyricsView(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm text-neutral-400 hover:text-emerald-300 hover:bg-neutral-900/60 transition-all"
        >
          <Mic2 className="w-5 h-5 text-emerald-400" />
          <span>Letras Sincronizadas</span>
        </button>

        {/* Admin Panel (Admin-Only) */}
        {isAdmin && (
          <button
            onClick={() => setCurrentTab('admin')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
              currentTab === 'admin'
                ? 'bg-emerald-950/50 border border-emerald-500/30 text-emerald-400'
                : 'text-neutral-400 hover:text-emerald-300 hover:bg-neutral-900/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-emerald-400" />
              <span>Panel Admin</span>
            </div>
            <span className="text-[9px] uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-black">
              ADMIN
            </span>
          </button>
        )}
      </div>

      {/* Playlists Section */}
      <div className="mt-6 flex-1 flex flex-col min-h-0 border-t border-neutral-900/80 pt-4 px-3">
        <div className="flex items-center justify-between px-3 mb-2">
          <span className="text-xs uppercase tracking-wider text-neutral-500 font-bold">
            Tus Playlists
          </span>
          <button
            onClick={onOpenCreatePlaylist}
            className="text-neutral-400 hover:text-white p-1 hover:bg-neutral-800/80 rounded-lg transition-colors"
            title="Crear Playlist"
          >
            <PlusCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {playlists.length === 0 ? (
            <p className="text-xs text-neutral-600 px-3 py-2 italic">
              Sin playlists aún. Haz clic en '+' para crear una.
            </p>
          ) : (
            playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => {
                  setCurrentTab('library');
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm text-neutral-400 hover:text-white hover:bg-neutral-900/50 transition-colors group truncate"
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0 flex items-center justify-center">
                  {pl.coverUrl ? (
                    <img src={pl.coverUrl} alt={pl.name} className="w-full h-full object-cover" />
                  ) : (
                    <Music className="w-4 h-4 text-neutral-500" />
                  )}
                </div>
                <div className="truncate flex-1">
                  <span className="block truncate font-medium text-xs group-hover:text-white">
                    {pl.name}
                  </span>
                  <span className="block text-[10px] text-neutral-600">
                    {pl.songIds.length} canciones
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-neutral-900 bg-neutral-950/70">
        <button
          onClick={onOpenProfileSwitcher}
          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-neutral-900 transition-colors text-left group"
        >
          <img
            src={currentUser.avatarUrl}
            alt={currentUser.displayName}
            className="w-9 h-9 rounded-xl object-cover ring-2 ring-emerald-500/30 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white truncate block">
                {currentUser.displayName}
              </span>
              {isAdmin && (
                <UserCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              )}
            </div>
            <span className="text-[10px] text-neutral-500 block truncate">
              @{currentUser.username} • {currentUser.role === 'admin' ? 'Administrador' : 'Miembro'}
            </span>
          </div>
        </button>
      </div>
    </aside>
  );
};
