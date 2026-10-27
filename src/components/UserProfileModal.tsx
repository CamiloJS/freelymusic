import React, { useState } from 'react';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import UserCheck from 'lucide-react/dist/esm/icons/user-check.mjs';
import UserPlus from 'lucide-react/dist/esm/icons/user-plus.mjs';
import MessageCircle from 'lucide-react/dist/esm/icons/message-circle.mjs';
import Music from 'lucide-react/dist/esm/icons/music.mjs';
import Heart from 'lucide-react/dist/esm/icons/heart.mjs';
import Lock from 'lucide-react/dist/esm/icons/lock.mjs';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { UserProfile, Song, Playlist } from '../types';
import { getStoredUserData } from '../services/storage';

interface UserProfileModalProps {
  user: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenMessagesWithUser?: (user: UserProfile) => void;
  onSelectPlaylist?: (playlist: Playlist) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onOpenMessagesWithUser,
  onSelectPlaylist,
}) => {
  const { currentUser, updateProfile } = useAuth();
  const { catalog, playlists } = useMusic();
  const { playSong } = useAudio();
  const [activeTab, setActiveTab] = useState<'playlists' | 'favoritos'>('playlists');

  if (!isOpen || !user) return null;

  const isFollowing = (currentUser.followingUserIds || []).includes(user.id);
  const isMe = currentUser.id === user.id;

  const handleToggleFollow = () => {
    const currentFollowing = currentUser.followingUserIds || [];
    const nextFollowing = isFollowing
      ? currentFollowing.filter((id) => id !== user.id)
      : [...currentFollowing, user.id];

    updateProfile({
      ...currentUser,
      followingUserIds: nextFollowing,
    });
  };

  // Get user's public playlists
  const userPlaylists = playlists.filter(
    (pl) => pl.userId === user.id && (pl.isPublic !== false || isMe)
  );

  // Get user's favorites from their stored user data
  const targetUserData = getStoredUserData(user.id);
  const targetFavorites = targetUserData.favoriteSongIds
    .map((id) => catalog.find((s) => s.id === id))
    .filter((s): s is Song => Boolean(s));

  const showFavorites = user.isFavoritesPublic !== false || isMe;
  const activity = user.currentListeningSong;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-lg h-full sm:h-[85vh] bg-[#121212] border border-[#282828] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-[#242424] flex items-center justify-between bg-[#121212] flex-shrink-0">
          <span className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
            Perfil de usuario
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Profile Card */}
        <div className="p-5 border-b border-[#242424] bg-gradient-to-b from-white/5 to-transparent space-y-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-[#242424] border-2 border-white/10 flex-shrink-0 shadow-xl">
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-white truncate">
                {user.displayName}
              </h2>
              <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                @{user.username}
              </p>

              {/* Listening activity badge */}
              {user.shareListeningActivity && activity && (
                <div className="flex items-center gap-1.5 text-xs text-[#b3b3b3] mt-2 truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                  <span className="truncate">
                    Escuchando <strong className="text-white">{activity.title}</strong> de {activity.artist}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Social Action Buttons */}
          {!isMe && (
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleToggleFollow}
                className={`flex-1 py-2 rounded-full font-bold text-xs flex items-center justify-center gap-2 transition-transform active:scale-95 shadow ${
                  isFollowing
                    ? 'bg-[#242424] hover:bg-[#2c2c2c] text-white border border-white/10'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-black'
                }`}
              >
                {isFollowing ? (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>Siguiendo</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Seguir</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMessagesWithUser?.(user);
                }}
                className="flex-1 py-2 rounded-full bg-[#242424] hover:bg-[#2c2c2c] text-white font-bold text-xs border border-white/10 flex items-center justify-center gap-2 transition-colors active:scale-95 shadow"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Mensaje</span>
              </button>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex items-center gap-4 pt-2 border-t border-[#242424]">
            <button
              type="button"
              onClick={() => setActiveTab('playlists')}
              className={`text-xs font-bold pb-1 transition-colors relative ${
                activeTab === 'playlists' ? 'text-white' : 'text-[#727272] hover:text-[#b3b3b3]'
              }`}
            >
              <span>Playlists públicas ({userPlaylists.length})</span>
              {activeTab === 'playlists' && (
                <div className="absolute -bottom-1.5 left-0 right-0 h-[2px] bg-emerald-500 rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('favoritos')}
              className={`text-xs font-bold pb-1 transition-colors relative ${
                activeTab === 'favoritos' ? 'text-white' : 'text-[#727272] hover:text-[#b3b3b3]'
              }`}
            >
              <span>Tus me gusta {showFavorites ? `(${targetFavorites.length})` : '(Privado)'}</span>
              {activeTab === 'favoritos' && (
                <div className="absolute -bottom-1.5 left-0 right-0 h-[2px] bg-emerald-500 rounded-full" />
              )}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-none">
          {activeTab === 'playlists' ? (
            userPlaylists.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#b3b3b3]">
                Este usuario aún no tiene playlists públicas.
              </div>
            ) : (
              userPlaylists.map((pl) => (
                <div
                  key={pl.id}
                  onClick={() => {
                    onClose();
                    onSelectPlaylist?.(pl);
                  }}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 active:bg-white/10 cursor-pointer transition-colors"
                >
                  <div className="w-12 h-12 rounded-lg bg-[#242424] overflow-hidden flex items-center justify-center flex-shrink-0 shadow">
                    {pl.coverUrl ? (
                      <img src={pl.coverUrl} alt={pl.name} className="w-full h-full object-cover" />
                    ) : (
                      <Music className="w-5 h-5 text-neutral-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-white truncate">
                      {pl.name}
                    </h4>
                    <p className="text-xs text-[#b3b3b3] truncate mt-0.5">
                      Playlist • {pl.songIds.length} canciones
                    </p>
                  </div>
                </div>
              ))
            )
          ) : (
            !showFavorites ? (
              <div className="py-12 text-center space-y-2">
                <Lock className="w-8 h-8 text-neutral-500 mx-auto" />
                <h4 className="text-sm font-bold text-white">Favoritos privados</h4>
                <p className="text-xs text-[#b3b3b3] max-w-xs mx-auto">
                  Este usuario ha configurado su lista de favoritos como privada en sus ajustes de privacidad.
                </p>
              </div>
            ) : targetFavorites.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#b3b3b3]">
                No hay canciones en favoritos aún.
              </div>
            ) : (
              targetFavorites.map((song) => (
                <div
                  key={song.id}
                  onClick={() => playSong(song, [song])}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 active:bg-white/10 cursor-pointer transition-colors group"
                >
                  <img
                    src={song.coverUrl}
                    alt={song.title}
                    className="w-11 h-11 rounded-lg object-cover flex-shrink-0 shadow"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold text-white truncate group-hover:text-emerald-400 transition-colors">
                      {song.title}
                    </h4>
                    <p className="text-[11px] text-[#b3b3b3] truncate mt-0.5">
                      {song.artist}
                    </p>
                  </div>
                  <Play className="w-4 h-4 fill-white text-white opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
