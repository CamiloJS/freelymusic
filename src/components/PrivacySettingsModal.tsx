import React, { useState } from 'react';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Shield from 'lucide-react/dist/esm/icons/shield.mjs';
import Heart from 'lucide-react/dist/esm/icons/heart.mjs';
import Radio from 'lucide-react/dist/esm/icons/radio.mjs';
import UserCheck from 'lucide-react/dist/esm/icons/user-check.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import { useAuth } from '../context/AuthContext';

interface PrivacySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacySettingsModal: React.FC<PrivacySettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser, updateProfile } = useAuth();
  const [isFavoritesPublic, setIsFavoritesPublic] = useState<boolean>(
    currentUser.isFavoritesPublic ?? true
  );
  const [shareListeningActivity, setShareListeningActivity] = useState<boolean>(
    currentUser.shareListeningActivity ?? true
  );
  const [isProfilePublic, setIsProfilePublic] = useState<boolean>(
    currentUser.isProfilePublic ?? true
  );
  const [savedFeedback, setSavedFeedback] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleToggleFavorites = () => {
    const next = !isFavoritesPublic;
    setIsFavoritesPublic(next);
    updateProfile({ ...currentUser, isFavoritesPublic: next });
    showFeedback();
  };

  const handleToggleActivity = () => {
    const next = !shareListeningActivity;
    setShareListeningActivity(next);
    updateProfile({ ...currentUser, shareListeningActivity: next });
    showFeedback();
  };

  const handleToggleProfile = () => {
    const next = !isProfilePublic;
    setIsProfilePublic(next);
    updateProfile({ ...currentUser, isProfilePublic: next });
    showFeedback();
  };

  const showFeedback = () => {
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-md bg-[#121212] border border-[#282828] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#242424] flex items-center justify-between bg-[#121212]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/5 text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Configuración y privacidad
              </h2>
              <p className="text-xs text-[#b3b3b3] mt-0.5">
                Controla la visibilidad de tu cuenta y actividad
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options Body */}
        <div className="p-4 sm:p-5 space-y-4">
          
          {/* 1. Tus me gusta pública */}
          <div className="flex items-start justify-between gap-4 p-3.5 rounded-2xl bg-[#181818] border border-[#282828]">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 flex-shrink-0 mt-0.5">
                <Heart className="w-4 h-4 fill-current" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-white">
                  Playlist de Tus me gusta pública
                </h4>
                <p className="text-xs text-[#b3b3b3] mt-1 leading-relaxed">
                  Permite que tus seguidores y amigos puedan ver las canciones favoritas de tu perfil.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleFavorites}
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 flex-shrink-0 ${
                isFavoritesPublic ? 'bg-emerald-500' : 'bg-neutral-700'
              }`}
              role="switch"
              aria-checked={isFavoritesPublic}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  isFavoritesPublic ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 2. Actividad de escucha en tiempo real */}
          <div className="flex items-start justify-between gap-4 p-3.5 rounded-2xl bg-[#181818] border border-[#282828]">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 flex-shrink-0 mt-0.5">
                <Radio className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-white">
                  Compartir actividad de escucha
                </h4>
                <p className="text-xs text-[#b3b3b3] mt-1 leading-relaxed">
                  Muestra a tus amigos en tiempo real la canción que estás reproduciendo en la barra lateral.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleActivity}
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 flex-shrink-0 ${
                shareListeningActivity ? 'bg-emerald-500' : 'bg-neutral-700'
              }`}
              role="switch"
              aria-checked={shareListeningActivity}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  shareListeningActivity ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 3. Perfil público en búsquedas */}
          <div className="flex items-start justify-between gap-4 p-3.5 rounded-2xl bg-[#181818] border border-[#282828]">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 flex-shrink-0 mt-0.5">
                <UserCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-white">
                  Perfil público en búsquedas (@)
                </h4>
                <p className="text-xs text-[#b3b3b3] mt-1 leading-relaxed">
                  Permite que otros usuarios puedan buscarte por tu nombre de usuario (@{currentUser.username}) y seguirte.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleProfile}
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 flex-shrink-0 ${
                isProfilePublic ? 'bg-emerald-500' : 'bg-neutral-700'
              }`}
              role="switch"
              aria-checked={isProfilePublic}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  isProfilePublic ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer feedback */}
        <div className="p-4 border-t border-[#242424] flex items-center justify-between text-xs text-[#b3b3b3] bg-[#121212]">
          {savedFeedback ? (
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5 animate-in fade-in">
              <Check className="w-3.5 h-3.5" />
              <span>Configuración guardada</span>
            </span>
          ) : (
            <span>Los cambios se aplican automáticamente</span>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-[#242424] hover:bg-[#2c2c2c] text-white font-bold text-xs transition-colors"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacySettingsModal;
