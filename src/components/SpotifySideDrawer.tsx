import React from 'react';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import LayoutGrid from 'lucide-react/dist/esm/icons/layout-grid.mjs';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up.mjs';
import History from 'lucide-react/dist/esm/icons/history.mjs';
import Sliders from 'lucide-react/dist/esm/icons/sliders.mjs';
import Settings from 'lucide-react/dist/esm/icons/settings.mjs';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.mjs';
import SquarePen from 'lucide-react/dist/esm/icons/square-pen.mjs';
import UserPlus from 'lucide-react/dist/esm/icons/user-plus.mjs';
import Music2 from 'lucide-react/dist/esm/icons/music-2.mjs';
import LogOut from 'lucide-react/dist/esm/icons/log-out.mjs';
import { useAuth } from '../context/AuthContext';
import { UserProfile, ChatThread } from '../types';
import { getStoredChatThreads } from '../services/storage';

interface SpotifySideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProfile: () => void;
  onOpenAddAccount: () => void;
  onOpenAdminPanel: () => void;
  onOpenStats: () => void;
  onOpenRecents: () => void;
  onOpenCustomize: () => void;
  onOpenSettingsPrivacy: () => void;
  onOpenMessages: (threadId?: string) => void;
  onSelectFriendProfile?: (user: UserProfile) => void;
}

export const SpotifySideDrawer: React.FC<SpotifySideDrawerProps> = ({
  isOpen,
  onClose,
  onOpenProfile,
  onOpenAddAccount,
  onOpenAdminPanel,
  onOpenStats,
  onOpenRecents,
  onOpenCustomize,
  onOpenSettingsPrivacy,
  onOpenMessages,
  onSelectFriendProfile,
}) => {
  const { currentUser, allUsers, isAdmin, logout } = useAuth();
  const isMainProfile = currentUser?.id === 'camilo-admin' || isAdmin;
  const [chatThreads, setChatThreads] = React.useState<ChatThread[]>(() => getStoredChatThreads());

  React.useEffect(() => {
    if (isOpen) {
      setChatThreads(getStoredChatThreads());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter out current user for friend list
  const otherUsers = allUsers.filter((u) => u.id !== currentUser.id);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
        aria-hidden="true"
      />

      {/* Drawer Surface (Slides from left, max 86% width on mobile) */}
      <div className="fixed inset-y-0 left-0 w-[86%] max-w-[340px] bg-[#121212] border-r border-[#282828] shadow-2xl flex flex-col justify-between overflow-y-auto scrollbar-none transform transition-transform animate-in slide-in-from-left duration-300 ease-out z-50">
        
        {/* Top Content Area */}
        <div className="p-4 sm:p-5 space-y-4">
          
          {/* 1. User Profile Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
            <div
              onClick={() => {
                onClose();
                onOpenProfile();
              }}
              className="flex items-center gap-3 cursor-pointer group min-w-0 flex-1"
            >
              <div className="w-12 h-12 rounded-full overflow-hidden bg-[#242424] border border-white/10 flex-shrink-0 shadow">
                {currentUser?.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.displayName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-bold text-base">
                    {(currentUser?.displayName || 'C').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-white leading-tight truncate group-hover:text-emerald-400 transition-colors">
                  {currentUser?.displayName || 'Camilo Jaimes'}
                </h2>
                <p className="text-xs text-[#b3b3b3] mt-0.5 truncate">
                  {isMainProfile ? 'Ver perfil' : 'Mi cuenta'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-neutral-400 hover:text-white transition-colors"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 2. Main Navigation Items */}
          <nav className="space-y-1">
            {/* Solo para Perfil Principal */}
            {isMainProfile && (
              <>
                {/* Agregar cuenta */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAddAccount();
                  }}
                  className="w-full flex items-start gap-3.5 px-2.5 py-2.5 rounded-xl text-left hover:bg-white/5 active:bg-white/10 transition-colors group"
                >
                  <div className="p-1.5 rounded-lg text-neutral-300 group-hover:text-white flex-shrink-0">
                    <Plus className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-white block">
                      Agregar cuenta
                    </span>
                    <span className="text-xs text-[#b3b3b3] block truncate mt-0.5">
                      Agrega a un menor o a alguien más.
                    </span>
                  </div>
                </button>

                {/* Panel de administración */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAdminPanel();
                  }}
                  className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-left hover:bg-white/5 active:bg-white/10 transition-colors group"
                >
                  <div className="p-1.5 rounded-lg text-neutral-300 group-hover:text-white flex-shrink-0">
                    <LayoutGrid className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-semibold text-white flex-1 truncate">
                    Panel de administración
                  </span>
                </button>

                {/* Estadísticas de reproducción */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenStats();
                  }}
                  className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-left hover:bg-white/5 active:bg-white/10 transition-colors group"
                >
                  <div className="p-1.5 rounded-lg text-neutral-300 group-hover:text-white flex-shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-semibold text-white flex-1 truncate">
                    Estadísticas de reproducción
                  </span>
                </button>

                {/* Recientes (Historial de música por semanas) */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenRecents();
                  }}
                  className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-left hover:bg-white/5 active:bg-white/10 transition-colors group"
                >
                  <div className="p-1.5 rounded-lg text-neutral-300 group-hover:text-white flex-shrink-0">
                    <History className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-semibold text-white flex-1 truncate">
                    Recientes
                  </span>
                </button>
              </>
            )}

            {/* Personalizar (Visible para todos) */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCustomize();
              }}
              className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-left hover:bg-white/5 active:bg-white/10 transition-colors group"
            >
              <div className="p-1.5 rounded-lg text-neutral-300 group-hover:text-white flex-shrink-0">
                <Sliders className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold text-white flex-1 truncate">
                Personalizar
              </span>
            </button>

            {/* Configuración y privacidad (Solo perfil principal) */}
            {isMainProfile && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettingsPrivacy();
                }}
                className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-left hover:bg-white/5 active:bg-white/10 transition-colors group"
              >
                <div className="p-1.5 rounded-lg text-neutral-300 group-hover:text-white flex-shrink-0">
                  <Settings className="w-5 h-5" />
                </div>
                <span className="text-sm font-semibold text-white flex-1 truncate">
                  Configuración y privacidad
                </span>
              </button>
            )}

            {/* Cerrar sesión para perfiles no principales */}
            {!isMainProfile && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  logout();
                }}
                className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-left text-red-400 hover:bg-red-500/10 transition-colors group mt-2"
              >
                <div className="p-1.5 rounded-lg text-red-400 flex-shrink-0">
                  <LogOut className="w-5 h-5" />
                </div>
                <span className="text-sm font-semibold flex-1 truncate">
                  Cerrar sesión
                </span>
              </button>
            )}
          </nav>

          {/* 3. Friend Activity Carousel (Solo perfil principal) */}
          {isMainProfile && (
            <>
              <div className="pt-2">
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-none pb-2 -mx-1 px-1">
              {/* Current User Activity Pill */}
              <div
                onClick={() => {
                  onClose();
                  onOpenProfile();
                }}
                className="flex flex-col items-center gap-1.5 text-center flex-shrink-0 w-16 cursor-pointer group"
              >
                <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-emerald-500 shadow-md">
                  <img
                    src={currentUser?.avatarUrl}
                    alt={currentUser?.displayName}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#121212]" />
                </div>
                <span className="text-[11px] font-bold text-white truncate max-w-[64px]">
                  Actividad
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold truncate max-w-[64px]">
                  Activado
                </span>
              </div>

              {/* Other friends */}
              {otherUsers.slice(0, 3).map((friend) => {
                const activity = friend.currentListeningSong;
                const isListening = Boolean(activity?.isPlaying);

                return (
                  <div
                    key={friend.id}
                    onClick={() => {
                      onClose();
                      onSelectFriendProfile?.(friend);
                    }}
                    className="flex flex-col items-center gap-1.5 text-center flex-shrink-0 w-16 cursor-pointer group"
                  >
                    <div className="relative w-12 h-12 rounded-full overflow-hidden border border-white/10 shadow group-hover:border-emerald-400 transition-colors">
                      <img
                        src={friend.avatarUrl}
                        alt={friend.displayName}
                        className="w-full h-full object-cover"
                      />
                      {/* Mini album cover badge if listening */}
                      {activity?.coverUrl && (
                        <img
                          src={activity.coverUrl}
                          alt="Cover"
                          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md object-cover border border-[#121212] shadow"
                        />
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-white truncate max-w-[64px]">
                      {friend.displayName}
                    </span>
                    <span
                      className={`text-[10px] truncate max-w-[64px] ${
                        isListening
                          ? 'text-emerald-400 font-bold flex items-center justify-center gap-0.5'
                          : 'text-[#b3b3b3]'
                      }`}
                    >
                      {isListening ? (
                        <>
                          <span className="inline-block w-1.5 h-2.5 bg-emerald-400 animate-pulse rounded-xs" />
                          <span>{activity?.title || 'Sonando'}</span>
                        </>
                      ) : (
                        activity?.relativeTimeText || 'Reciente'
                      )}
                    </span>
                  </div>
                );
              })}

              {/* Invitar a amigos Button */}
              <div
                onClick={() => {
                  onClose();
                  onOpenMessages();
                }}
                className="flex flex-col items-center gap-1.5 text-center flex-shrink-0 w-16 cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-full bg-[#242424] hover:bg-[#2c2c2c] border border-white/10 flex items-center justify-center text-neutral-300 group-hover:text-white transition-colors shadow">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-white truncate max-w-[64px]">
                  Invitar a
                </span>
                <span className="text-[10px] text-[#b3b3b3] truncate max-w-[64px]">
                  amigos
                </span>
              </div>
            </div>
          </div>

          {/* 4. Mensajes Section */}
          <div className="pt-3 border-t border-[#242424] space-y-2">
            <div className="flex items-center justify-between py-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMessages();
                }}
                className="flex items-center gap-1 text-base font-bold text-white hover:text-emerald-400 transition-colors"
              >
                <span>Mensajes</span>
                <ChevronRight className="w-4 h-4 text-neutral-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMessages();
                }}
                className="p-1 text-neutral-400 hover:text-white transition-colors"
                title="Nuevo mensaje"
              >
                <SquarePen className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Threads list */}
            <div className="space-y-1">
              {chatThreads.map((thread) => (
                <div
                  key={thread.id}
                  onClick={() => {
                    onClose();
                    onOpenMessages(thread.id);
                  }}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 active:bg-white/10 cursor-pointer transition-colors"
                >
                  {/* Chat Avatar */}
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-[#242424] flex items-center justify-center flex-shrink-0 text-white font-bold text-xs shadow">
                    {thread.avatarUrl ? (
                      <img src={thread.avatarUrl} alt={thread.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white">
                        {thread.displayName.charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Thread info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white truncate max-w-[170px]">
                        {thread.displayName}
                      </h4>
                      {thread.unread && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#b3b3b3] truncate mt-0.5">
                      {thread.subtitle}
                    </p>
                  </div>
                </div>
              ))}

              {/* Nuevo mensaje row */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMessages();
                }}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 active:bg-white/10 cursor-pointer transition-colors text-left text-neutral-300 hover:text-white"
              >
                <div className="w-10 h-10 rounded-full bg-[#242424] flex items-center justify-center flex-shrink-0">
                  <SquarePen className="w-4 h-4 text-neutral-400" />
                </div>
                <span className="text-xs font-semibold">Nuevo mensaje</span>
              </button>
            </div>
          </div>
          </>
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-[#242424] text-[11px] text-[#727272] flex items-center justify-between">
          <span>Spotifree Mobile</span>
          <span className="text-emerald-400 font-semibold">100% Offline</span>
        </div>
      </div>
    </div>
  );
};

export default SpotifySideDrawer;
