import React, { useState } from 'react';
import { X, UserCheck, Shield, Plus, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';

interface ProfileSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateProfile?: () => void;
}

export const ProfileSwitcherModal: React.FC<ProfileSwitcherModalProps> = ({
  isOpen,
  onClose,
  onOpenCreateProfile,
}) => {
  const { currentUser, allUsers, switchUser } = useAuth();
  const [pinPromptUser, setPinPromptUser] = useState<UserProfile | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  if (!isOpen) return null;

  const handleSelectUser = (user: UserProfile) => {
    if (user.id === currentUser.id) {
      onClose();
      return;
    }

    if (user.pin) {
      setPinPromptUser(user);
      setPinInput('');
      setPinError('');
    } else {
      switchUser(user.id);
      onClose();
    }
  };

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinPromptUser) return;

    if (pinPromptUser.pin === pinInput.trim()) {
      switchUser(pinPromptUser.id);
      setPinPromptUser(null);
      onClose();
    } else {
      setPinError('PIN incorrecto. Intenta de nuevo.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-neutral-400 hover:text-white p-1 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {pinPromptUser ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Introduce tu PIN</h3>
                <p className="text-xs text-neutral-400">
                  El perfil de {pinPromptUser.displayName} está protegido
                </p>
              </div>
            </div>

            <form onSubmit={handleVerifyPin} className="space-y-4">
              <input
                type="password"
                maxLength={8}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Ingresa el PIN numérico"
                autoFocus
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-center text-xl tracking-widest text-white focus:outline-none focus:border-emerald-500"
              />
              {pinError && <p className="text-xs text-red-400 font-semibold">{pinError}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPinPromptUser(null)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-sm transition-colors"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors shadow-lg shadow-emerald-500/20"
                >
                  Ingresar
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <h3 className="font-extrabold text-white text-xl">¿Quién está escuchando?</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Selecciona tu perfil personal con tus playlists y favoritos aislados.
              </p>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {allUsers.map((user) => {
                const isActive = user.id === currentUser.id;
                return (
                  <div
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border ${
                      isActive
                        ? 'bg-emerald-950/40 border-emerald-500/40 shadow-sm'
                        : 'bg-neutral-950/60 border-neutral-800/80 hover:bg-neutral-800/60 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName}
                        className="w-11 h-11 rounded-xl object-cover ring-2 ring-neutral-700/60"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{user.displayName}</span>
                          {user.role === 'admin' ? (
                            <span className="text-[9px] uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-black border border-emerald-500/30 flex items-center gap-1">
                              <Shield className="w-2.5 h-2.5" />
                              ADMIN
                            </span>
                          ) : (
                            <span className="text-[9px] uppercase tracking-wider bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-semibold">
                              MIEMBRO
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-neutral-500">@{user.username}</span>
                      </div>
                    </div>

                    {isActive && (
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" />
                        Activo
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {onOpenCreateProfile && currentUser.role === 'admin' && (
              <div className="mt-5 pt-4 border-t border-neutral-800">
                <button
                  onClick={() => {
                    onClose();
                    onOpenCreateProfile();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-emerald-400 font-bold text-xs tracking-wide transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Crear Nuevo Perfil (Solo Admin)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
