import React, { useState, useRef } from 'react';
import {
  X,
  UserCheck,
  Shield,
  Plus,
  KeyRound,
  User,
  Palette,
  Upload,
  Check,
  RotateCcw,
  Sparkles,
  UploadCloud,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import { compressImage } from '../utils/imageCompressor';
import {
  getCustomAppIcon,
  setCustomAppIcon,
  removeCustomAppIcon,
} from '../utils/appIcon';

interface ProfileSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateProfile?: () => void;
  onNavigateAddMusic?: () => void;
}

export const ProfileSwitcherModal: React.FC<ProfileSwitcherModalProps> = ({
  isOpen,
  onClose,
  onOpenCreateProfile,
  onNavigateAddMusic,
}) => {
  const { currentUser, allUsers, switchUser, updateProfile, isAdmin, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<'perfiles' | 'mi_perfil' | 'personalizacion'>('perfiles');

  // PIN switch state
  const [pinPromptUser, setPinPromptUser] = useState<UserProfile | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Tab: Mi Perfil state
  const [editDisplayName, setEditDisplayName] = useState(currentUser?.displayName || '');
  const [editPin, setEditPin] = useState(currentUser?.pin || '');
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (currentUser) {
      setEditDisplayName(currentUser.displayName || '');
      setEditPin(currentUser.pin || '');
    }
  }, [currentUser]);

  // Tab: Personalizacion (App Icon) state
  const [currentIcon, setCurrentIcon] = useState<string | null>(() => getCustomAppIcon());
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [iconSuccessMsg, setIconSuccessMsg] = useState('');
  const iconFileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Switch user handler
  const handleSelectUser = (user: UserProfile) => {
    if (user.id === currentUser?.id) {
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

  // Avatar file upload from PC with automatic compression for Firestore
  const handleAvatarFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedDataUrl = await compressImage(file, 300, 0.8);
      if (compressedDataUrl && currentUser) {
        updateProfile({
          ...currentUser,
          avatarUrl: compressedDataUrl,
        });
        setProfileSuccessMsg('¡Foto de perfil actualizada y sincronizada en la nube!');
        setTimeout(() => setProfileSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error('Error procesando imagen de perfil:', err);
    }
  };

  // Save profile info (Name + PIN)
  const handleSaveProfileInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    updateProfile({
      ...currentUser,
      displayName: editDisplayName.trim() || currentUser.displayName,
      pin: editPin.trim() || undefined,
    });
    setProfileSuccessMsg('¡Información guardada exitosamente!');
    setTimeout(() => setProfileSuccessMsg(''), 3000);
  };

  // Icon upload from PC
  const handleIconFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setIconPreview(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomIcon = () => {
    if (!iconPreview) return;
    setCustomAppIcon(iconPreview);
    setCurrentIcon(iconPreview);
    setIconSuccessMsg('¡Icono de la aplicación actualizado! Se mostrará en pestañas e instalación PWA.');
    setTimeout(() => setIconSuccessMsg(''), 4000);
  };

  const handleResetIcon = () => {
    removeCustomAppIcon();
    setCurrentIcon(null);
    setIconPreview(null);
    setIconSuccessMsg('Icono restaurado al valor por defecto.');
    setTimeout(() => setIconSuccessMsg(''), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-neutral-400 hover:text-white p-1 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-neutral-950 rounded-2xl border border-neutral-800 mb-6 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('perfiles')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'perfiles'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span>Perfiles</span>
          </button>

          <button
            onClick={() => setActiveTab('mi_perfil')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'mi_perfil'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Mi Cuenta</span>
          </button>

          <button
            onClick={() => setActiveTab('personalizacion')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'personalizacion'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-emerald-400" />
            <span>Personalizar Icono</span>
          </button>

          {onNavigateAddMusic && (
            <button
              onClick={() => {
                onClose();
                onNavigateAddMusic();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-400 hover:text-white hover:bg-neutral-850 transition-all ml-auto whitespace-nowrap"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Añadir Música</span>
            </button>
          )}
        </div>

        {/* Tab Content Container (Scrollable) */}
        <div className="flex-1 overflow-y-auto pr-1">
          {/* TAB 1: PERFILES */}
          {activeTab === 'perfiles' && (
            <div>
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
                  <div className="mb-5">
                    <h3 className="font-extrabold text-white text-xl">¿Quién está escuchando?</h3>
                    <p className="text-xs text-neutral-400 mt-1">
                      Selecciona tu perfil personal con tus playlists y favoritos aislados.
                    </p>
                  </div>

                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {allUsers.map((user) => {
                      const isActive = user.id === currentUser?.id;
                      return (
                        <div
                          key={user.id}
                          onClick={() => handleSelectUser(user)}
                          className={`flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border ${
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

                  <div className="mt-5 pt-4 border-t border-neutral-800 space-y-2">
                    {onOpenCreateProfile && isAdmin && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenCreateProfile();
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-emerald-400 font-bold text-xs tracking-wide transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        Crear Nuevo Perfil (Solo Admin)
                      </button>
                    )}

                    <button
                      onClick={() => {
                        onClose();
                        logout();
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-500/20 text-red-400 font-bold text-xs tracking-wide transition-all"
                    >
                      <LogOut className="w-4 h-4" />
                      Cerrar sesión en este dispositivo
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MI PERFIL (PHOTO UPLOAD FROM PC & DATA) */}
          {activeTab === 'mi_perfil' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-extrabold text-white text-xl">Tu Perfil Personal</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Cambia tu foto directamente desde tu computador y configura tu seguridad.
                </p>
              </div>

              {profileSuccessMsg && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              {/* Avatar Uploader */}
              <div className="flex items-center gap-5 p-4 bg-neutral-950 rounded-2xl border border-neutral-800">
                <img
                  src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80'}
                  alt={currentUser?.displayName || 'Usuario'}
                  className="w-20 h-20 rounded-2xl object-cover ring-2 ring-emerald-500/50 shadow-lg"
                />

                <div className="space-y-2">
                  <input
                    type="file"
                    ref={avatarFileInputRef}
                    accept="image/*"
                    onChange={handleAvatarFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs tracking-wide shadow-md transition-all"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Subir foto desde tu PC
                  </button>
                  <p className="text-[11px] text-neutral-500">
                    Soporta imágenes JPG, PNG o WebP. Se guarda en tu perfil local.
                  </p>
                </div>
              </div>

              {/* Profile Details Form */}
              <form onSubmit={handleSaveProfileInfo} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                    Nombre para mostrar
                  </label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Tu nombre"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                    PIN numérico de seguridad (opcional)
                  </label>
                  <input
                    type="password"
                    maxLength={8}
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value)}
                    placeholder="Dejar vacío para no pedir PIN"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Si asignas un PIN, se solicitará cada vez que alguien intente cambiar a tu perfil.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs tracking-wider transition-colors"
                  >
                    Guardar Cambios de Cuenta
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: PERSONALIZACION (APP ICON FROM PC) */}
          {activeTab === 'personalizacion' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-extrabold text-white text-xl">Personalizar Icono de la App</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Sube tu propio logo o imagen desde tu computador. Se aplicará a la pestaña del navegador y a la aplicación web instalada (PWA).
                </p>
              </div>

              {iconSuccessMsg && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>{iconSuccessMsg}</span>
                </div>
              )}

              {/* Icon Preview */}
              <div className="p-5 bg-neutral-950 rounded-2xl border border-neutral-800 flex flex-col md:flex-row items-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-20 h-20 rounded-2xl bg-neutral-900 border border-neutral-700 flex items-center justify-center overflow-hidden shadow-xl">
                    <img
                      src={iconPreview || currentIcon || '/icon.svg'}
                      alt="Icon Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-[10px] text-neutral-400 font-semibold">
                    {iconPreview ? 'Vista Previa' : currentIcon ? 'Icono Personalizado' : 'Icono Por Defecto'}
                  </span>
                </div>

                <div className="space-y-3 text-center md:text-left flex-1">
                  <input
                    type="file"
                    ref={iconFileInputRef}
                    accept="image/png,image/jpeg,image/svg+xml,image/x-icon,image/webp"
                    onChange={handleIconFileUpload}
                    className="hidden"
                  />

                  <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    <button
                      type="button"
                      onClick={() => iconFileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-emerald-400 font-bold text-xs transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Elegir imagen de tu PC
                    </button>

                    {iconPreview && (
                      <button
                        type="button"
                        onClick={handleApplyCustomIcon}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-md transition-all"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Guardar como Icono
                      </button>
                    )}

                    {(currentIcon || iconPreview) && (
                      <button
                        type="button"
                        onClick={handleResetIcon}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white text-xs font-semibold"
                        title="Restaurar icono original"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restaurar original
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-neutral-500">
                    Recomendado: imagen cuadrada (PNG, SVG, ICO o JPG) de al menos 192x192 píxeles.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
