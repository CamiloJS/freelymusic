import React, { useState, useEffect } from 'react';
import Home from 'lucide-react/dist/esm/icons/house.mjs';
import Compass from 'lucide-react/dist/esm/icons/compass.mjs';
import Library from 'lucide-react/dist/esm/icons/library.mjs';
import UploadCloud from 'lucide-react/dist/esm/icons/cloud-upload.mjs';
import HardDriveDownload from 'lucide-react/dist/esm/icons/hard-drive-download.mjs';
import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert.mjs';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import Music from 'lucide-react/dist/esm/icons/eighth-notes.mjs';
import UserCheck from 'lucide-react/dist/esm/icons/user-check.mjs';
import Disc from 'lucide-react/dist/esm/icons/disc.mjs';
import Disc3 from 'lucide-react/dist/esm/icons/disc-3.mjs';
import Wifi from 'lucide-react/dist/esm/icons/wifi.mjs';
import WifiOff from 'lucide-react/dist/esm/icons/wifi-off.mjs';
import Settings from 'lucide-react/dist/esm/icons/settings.mjs';
import Heart from 'lucide-react/dist/esm/icons/heart.mjs';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.mjs';
import ArrowDownCircle from 'lucide-react/dist/esm/icons/circle-arrow-down.mjs';
import Search from 'lucide-react/dist/esm/icons/search.mjs';
import UserRound from 'lucide-react/dist/esm/icons/user-round.mjs';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { useCustomization } from '../context/CustomizationContext';
import { getCustomAppIcon } from '../utils/appIcon';
import { Playlist, Album } from '../types';
import { getAlbumsFromCatalog } from '../utils/albums';
import { DEFAULT_AVATAR } from '../services/storage';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onSelectPlaylist: (playlist: Playlist | 'favorites' | Album) => void;
  selectedPlaylist: Playlist | 'favorites' | Album | null;
  onOpenCreatePlaylist: () => void;
  onOpenProfileSwitcher: () => void;
  isOnline: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  onSelectPlaylist,
  selectedPlaylist,
  onOpenCreatePlaylist,
  onOpenProfileSwitcher,
  isOnline,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const { playlists, userFavoriteSongs, downloadedSongIds, isDownloaded, catalog } = useMusic();
  const { setIsCenterLyricsOpen } = useAudio();
  const [appIcon, setAppIcon] = useState<string | null>(() => getCustomAppIcon());
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'playlists' | 'albums'>('all');
  const [librarySearch, setLibrarySearch] = useState('');

  useEffect(() => {
    const handleIconChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setAppIcon(customEvent.detail || null);
    };

    window.addEventListener('musica_icon_changed', handleIconChange);
    return () => window.removeEventListener('musica_icon_changed', handleIconChange);
  }, []);

  const navItems = [
    { id: 'home', label: 'Inicio', icon: Home },
    { id: 'cloud', label: 'Explorar la Nube', icon: Compass },
    { id: 'add-music', label: 'Añadir Música', icon: UploadCloud },
    { id: 'profile', label: 'Mi Perfil', icon: UserRound },
  ];

  const { appName, appIcon: contextIcon } = useCustomization();

  // Extract unique albums from catalog (grouped solely by album name so guest collaborations remain together)
  const uniqueAlbums = React.useMemo((): Album[] => {
    return getAlbumsFromCatalog(catalog);
  }, [catalog]);

  // Check if all favorites are downloaded
  const areFavoritesDownloaded = userFavoriteSongs.length > 0 && userFavoriteSongs.every((s) => isDownloaded(s.id));

  // Filter playlists
  const filteredPlaylists = playlists.filter((pl) => {
    if (!librarySearch) return true;
    return pl.name.toLowerCase().includes(librarySearch.toLowerCase());
  });

  // Filter albums
  const filteredAlbums = uniqueAlbums.filter((alb) => {
    if (!librarySearch) return true;
    const q = librarySearch.toLowerCase();
    return alb.name.toLowerCase().includes(q) || alb.artist.toLowerCase().includes(q);
  });

  const activeIcon = contextIcon || appIcon;

  return (
    <aside className="w-68 lg:w-76 bg-black text-neutral-300 flex flex-col h-full border-r border-neutral-900 select-none flex-shrink-0">
      {/* Brand Header */}
      <div className="p-5 flex items-center justify-between">
        <div
          onClick={() => {
            setIsCenterLyricsOpen(false);
            setCurrentTab('home');
          }}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-500 via-green-400 to-teal-300 flex items-center justify-center shadow-lg shadow-emerald-500/25 group-hover:scale-105 transition-all overflow-hidden flex-shrink-0">
            {activeIcon ? (
              <img src={activeIcon} alt={appName} className="w-full h-full object-cover" />
            ) : (
              <Disc3 className="w-5 h-5 text-black animate-spin" style={{ animationDuration: '8s' }} />
            )}
          </div>
          <div>
            <span className="font-black tracking-wider text-lg text-white block">
              {appName}
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation (Inicio, Explorar la Nube, Añadir Música) */}
      <div className="px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id && !selectedPlaylist;
          return (
            <button
              key={item.id}
              onClick={() => {
                setIsCenterLyricsOpen(false);
                setCurrentTab(item.id);
              }}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl font-bold text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-neutral-800/90 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900/60'
              }`}
            >
              <Icon
                className={`w-5 h-5 ${
                  isActive ? 'text-emerald-400' : 'text-neutral-400 group-hover:text-white'
                }`}
              />
              <span>{item.label}</span>
            </button>
          );
        })}

        {isAdmin && (
          <button
            onClick={() => {
              setIsCenterLyricsOpen(false);
              setCurrentTab('admin');
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl font-bold text-sm transition-all duration-150 ${
              currentTab === 'admin'
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900/60'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              <span>Panel Admin</span>
            </div>
            <span className="text-[9px] uppercase tracking-wider font-black bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
              ADMIN
            </span>
          </button>
        )}
      </div>

      {/* Spotify-style "Tu biblioteca" Section (Spotify Images 1, 2, 4) */}
      <div className="mt-4 flex-1 flex flex-col min-h-0 bg-neutral-950/90 rounded-2xl mx-2 border border-neutral-900/90 overflow-hidden">
        {/* Tu Biblioteca Header */}
        <div className="p-3.5 pb-2 border-b border-neutral-900/80">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => {
                setIsCenterLyricsOpen(false);
                setCurrentTab('library');
              }}
              className="flex items-center gap-2.5 text-neutral-300 hover:text-white font-extrabold text-sm transition-colors"
            >
              <Library className="w-5 h-5 text-neutral-400" />
              <span>Tu biblioteca</span>
            </button>

            <button
              onClick={onOpenCreatePlaylist}
              className="text-neutral-400 hover:text-white p-1 hover:bg-neutral-800 rounded-full transition-colors"
              title="Crear playlist"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Filter Chips: Playlists, Álbumes */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setLibraryFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                libraryFilter === 'all'
                  ? 'bg-white text-black'
                  : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              Todo
            </button>
            <button
              onClick={() => setLibraryFilter('playlists')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                libraryFilter === 'playlists'
                  ? 'bg-white text-black'
                  : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              Playlists
            </button>
            <button
              onClick={() => setLibraryFilter('albums')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                libraryFilter === 'albums'
                  ? 'bg-white text-black'
                  : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              Álbumes
            </button>
          </div>

          <div className="relative mt-2">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={librarySearch}
              onChange={(event) => setLibrarySearch(event.target.value)}
              placeholder="Buscar en tu biblioteca..."
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Scrollable Playlists List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Pinned: "Tus me gusta" (Spotify Image 1 & 2) */}
          {(libraryFilter === 'all' || libraryFilter === 'playlists') && (
            <div
              onClick={() => {
                setIsCenterLyricsOpen(false);
                onSelectPlaylist('favorites');
                setCurrentTab('library');
              }}
              className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all ${
                selectedPlaylist === 'favorites' && currentTab === 'library'
                  ? 'bg-neutral-850 text-white'
                  : 'hover:bg-neutral-900/70 text-neutral-300'
              }`}
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-md">
                <Heart className="w-5 h-5 text-white fill-white" />
              </div>

              <div className="truncate flex-1">
                <span className={`block font-bold text-xs truncate ${selectedPlaylist === 'favorites' ? 'text-emerald-400' : 'text-white'}`}>
                  Tus me gusta
                </span>
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 truncate mt-0.5">
                  {areFavoritesDownloaded ? (
                    <span title="Descargado en tu dispositivo">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400 text-black flex-shrink-0 inline" />
                    </span>
                  ) : (
                    <span title="Disponible para descargar">
                      <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 inline" />
                    </span>
                  )}
                  <span>Playlist • {currentUser?.displayName || 'Tú'} ({userFavoriteSongs.length})</span>
                </div>
              </div>
            </div>
          )}

          {/* User Playlists */}
          {(libraryFilter === 'all' || libraryFilter === 'playlists') &&
            filteredPlaylists.map((pl) => {
              const isSelected =
                selectedPlaylist !== 'favorites' &&
                selectedPlaylist &&
                'id' in selectedPlaylist &&
                selectedPlaylist.id === pl.id &&
                currentTab === 'library';
              const allSongsDownloaded = pl.songIds.length > 0 && pl.songIds.every((id) => isDownloaded(id));

              return (
                <div
                  key={pl.id}
                  onClick={() => {
                    setIsCenterLyricsOpen(false);
                    onSelectPlaylist(pl);
                    setCurrentTab('library');
                  }}
                  className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all group ${
                    isSelected
                      ? 'bg-neutral-850 text-white'
                      : 'hover:bg-neutral-900/70 text-neutral-300'
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0 shadow flex items-center justify-center">
                    {pl.coverUrl ? (
                      <img src={pl.coverUrl} alt={pl.name} className="w-full h-full object-cover" />
                    ) : (
                      <Music className="w-5 h-5 text-neutral-600" />
                    )}
                  </div>

                  <div className="truncate flex-1">
                    <span className={`block font-bold text-xs truncate ${isSelected ? 'text-emerald-400' : 'text-white group-hover:text-white'}`}>
                      {pl.name}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 truncate mt-0.5">
                      {allSongsDownloaded ? (
                        <span title="Descargado">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400 text-black flex-shrink-0 inline" />
                        </span>
                      ) : (
                        <span title="Descargar">
                          <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 inline" />
                        </span>
                      )}
                      <span>Playlist • {currentUser?.displayName || 'Tú'} ({pl.songIds.length})</span>
                    </div>
                  </div>
                </div>
              );
            })}

          {/* User Albums */}
          {(libraryFilter === 'all' || libraryFilter === 'albums') &&
            filteredAlbums.map((alb) => {
              const isSelected =
                selectedPlaylist &&
                typeof selectedPlaylist === 'object' &&
                'songs' in selectedPlaylist &&
                selectedPlaylist.name.toLowerCase() === alb.name.toLowerCase() &&
                currentTab === 'library';

              const allDownloaded = alb.songs.length > 0 && alb.songs.every((s) => isDownloaded(s.id));

              return (
                <div
                  key={`${alb.name}-${alb.artist}`}
                  onClick={() => {
                    setIsCenterLyricsOpen(false);
                    onSelectPlaylist(alb);
                    setCurrentTab('library');
                  }}
                  className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all group ${
                    isSelected
                      ? 'bg-neutral-850 text-white'
                      : 'hover:bg-neutral-900/70 text-neutral-300'
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0 shadow flex items-center justify-center">
                    {alb.coverUrl ? (
                      <img src={alb.coverUrl} alt={alb.name} className="w-full h-full object-cover" />
                    ) : (
                      <Disc className="w-5 h-5 text-neutral-600" />
                    )}
                  </div>

                  <div className="truncate flex-1">
                    <span className={`block font-bold text-xs truncate ${isSelected ? 'text-emerald-400' : 'text-white group-hover:text-white'}`}>
                      {alb.name}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 truncate mt-0.5">
                      {allDownloaded ? (
                        <span title="Descargado">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400 text-black flex-shrink-0 inline" />
                        </span>
                      ) : (
                        <span title="Disponible para descargar">
                          <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 inline" />
                        </span>
                      )}
                      <span>Álbum • {alb.artist} ({alb.songs.length})</span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* User Profile Footer (Ajustes y Preferencias) */}
      <div className="p-3 border-t border-neutral-900 bg-neutral-950/80">
        <button
          onClick={onOpenProfileSwitcher}
          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-neutral-900 transition-colors text-left group"
          title="Ajustes, preferencias y perfiles"
        >
          <img
            src={currentUser?.avatarUrl || DEFAULT_AVATAR}
            alt={currentUser?.displayName || 'Usuario'}
            className="w-8 h-8 rounded-xl object-cover ring-2 ring-emerald-500/30 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white truncate block">
                {currentUser?.displayName || 'Usuario'}
              </span>
              {isAdmin && (
                <UserCheck className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              )}
            </div>
            <span className="text-[10px] text-neutral-500 block truncate">
              Ajustes y Cuenta
            </span>
          </div>
          <Settings className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors flex-shrink-0" />
        </button>
      </div>
    </aside>
  );
};
