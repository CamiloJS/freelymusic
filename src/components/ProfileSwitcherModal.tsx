import React, { useState, useRef } from 'react';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import UserCheck from 'lucide-react/dist/esm/icons/user-check.mjs';
import Shield from 'lucide-react/dist/esm/icons/shield.mjs';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import KeyRound from 'lucide-react/dist/esm/icons/key-round.mjs';
import User from 'lucide-react/dist/esm/icons/user.mjs';
import Palette from 'lucide-react/dist/esm/icons/palette.mjs';
import Upload from 'lucide-react/dist/esm/icons/upload.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw.mjs';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.mjs';
import UploadCloud from 'lucide-react/dist/esm/icons/cloud-upload.mjs';
import LogOut from 'lucide-react/dist/esm/icons/log-out.mjs';
import Sun from 'lucide-react/dist/esm/icons/sun.mjs';
import Moon from 'lucide-react/dist/esm/icons/moon.mjs';
import Layers from 'lucide-react/dist/esm/icons/layers.mjs';
import ImageIcon from 'lucide-react/dist/esm/icons/image.mjs';
import { useAuth } from '../context/AuthContext';
import { useCustomization, ACCENT_PRESETS } from '../context/CustomizationContext';
import { UserProfile } from '../types';
import { compressImage } from '../utils/imageCompressor';
import { DEFAULT_AVATAR } from '../services/storage';

interface ProfileSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateProfile?: () => void;
  onNavigateAddMusic?: () => void;
  onOpenProfileView?: () => void;
  onOpenAdminPanel?: () => void;
}

export const ProfileSwitcherModal: React.FC<ProfileSwitcherModalProps> = ({
  isOpen,
  onClose,
  onOpenCreateProfile,
  onNavigateAddMusic,
  onOpenProfileView,
  onOpenAdminPanel,
}) => {
  const { currentUser, allUsers, switchUser, updateProfile, isAdmin, logout } = useAuth();
  const {
    themeMode,
    setThemeMode,
    accentColor,
    setAccentColorById,
    appName,
    setCustomAppName,
    setGlobalAppName,
    lastfmApiKey,
    setGlobalLastfmKey,
    globalIcons,
    uploadGlobalIcon,
    appIcon,
    selectIcon,
    resetIcon,
  } = useCustomization();

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

  // Tab: Personalizacion state
  const [nameInput, setNameInput] = useState(appName);
  const [nameSuccessMsg, setNameSuccessMsg] = useState('');
  const [iconSuccessMsg, setIconSuccessMsg] = useState('');
  const [lastfmKeyInput, setLastfmKeyInput] = useState(lastfmApiKey);
  const [lastfmSuccessMsg, setLastfmSuccessMsg] = useState('');
  const iconFileInputRef = useRef<HTMLInputElement | null>(null);
  const adminGlobalIconInputRef = useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (currentUser) {
      setEditDisplayName(currentUser.displayName || '');
      setEditPin(currentUser.pin || '');
    }
  }, [currentUser]);

  React.useEffect(() => {
    setNameInput(appName);
  }, [appName]);

  React.useEffect(() => {
    setLastfmKeyInput(lastfmApiKey);
  }, [lastfmApiKey]);

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

  // Avatar file upload from PC
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

  // Icon upload from PC for personal use
  const handlePersonalIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, 256, 0.85);
      if (compressed) {
        selectIcon(compressed);
        setIconSuccessMsg('¡Icono de la aplicación actualizado para tu navegador!');
        setTimeout(() => setIconSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error('Error subiendo icono personal:', err);
    }
  };

  // Icon upload for Admin into Global Gallery (shared with all profiles)
  const handleAdminGlobalIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, 256, 0.85);
      if (compressed) {
        await uploadGlobalIcon(compressed);
        setIconSuccessMsg('¡Icono añadido a la Galería Global! Ahora todos los perfiles lo pueden elegir.');
        setTimeout(() => setIconSuccessMsg(''), 4500);
      }
    } catch (err) {
      console.error('Error subiendo icono a galería global:', err);
    }
  };

  const handleSaveLocalName = () => {
    setCustomAppName(nameInput);
    setNameSuccessMsg('¡Nombre de aplicación actualizado para tu perfil!');
    setTimeout(() => setNameSuccessMsg(''), 3000);
  };

  const handleSaveGlobalName = async () => {
    await setGlobalAppName(nameInput);
    setNameSuccessMsg('¡Nombre de aplicación guardado globalmente para todos los perfiles!');
    setTimeout(() => setNameSuccessMsg(''), 3500);
  };

  const handleSaveLastfmKey = async () => {
    await setGlobalLastfmKey(lastfmKeyInput);
    setLastfmSuccessMsg(
      lastfmKeyInput.trim()
        ? '¡Clave de Last.fm guardada! Las fichas usarán Last.fm.'
        : 'Clave eliminada. Se usarán las estadísticas de Deezer.'
    );
    setTimeout(() => setLastfmSuccessMsg(''), 4500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl relative max-h-[92vh] flex flex-col">
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
            <span>Personalización & Tema</span>
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

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-6">
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
                              src={user.avatarUrl || DEFAULT_AVATAR}
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
                    {onOpenProfileView && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenProfileView();
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs tracking-wide transition-all"
                      >
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        Mi perfil y estadísticas
                      </button>
                    )}

                    {onOpenAdminPanel && isAdmin && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenAdminPanel();
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/25 text-emerald-300 font-bold text-xs tracking-wide transition-all"
                      >
                        <Shield className="w-4 h-4" />
                        Panel de Administración
                      </button>
                    )}

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

          {/* TAB 2: MI PERFIL */}
          {activeTab === 'mi_perfil' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-extrabold text-white text-xl">Configurar Mi Perfil</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Personaliza tu foto de perfil, nombre de usuario y PIN de seguridad.
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
                  src={currentUser?.avatarUrl || DEFAULT_AVATAR}
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
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-emerald-400 font-bold text-xs transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Subir foto desde tu PC
                  </button>
                  <p className="text-[11px] text-neutral-500">
                    Soporta imágenes JPG, PNG o WebP. Se guarda en la nube y en tu perfil.
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
                    Si asignas un PIN, se solicitará cada vez que alguien intente ingresar o cambiar a tu perfil.
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

          {/* TAB 3: PERSONALIZACION & TEMA */}
          {activeTab === 'personalizacion' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-extrabold text-white text-xl">Personalización & Apariencia</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Modo claro/oscuro, color de acento, nombre de la página y galería de iconos.
                </p>
              </div>

              {iconSuccessMsg && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>{iconSuccessMsg}</span>
                </div>
              )}

              {nameSuccessMsg && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>{nameSuccessMsg}</span>
                </div>
              )}

              {/* 1. Theme Mode Switcher (Dark vs Light) */}
              <div className="space-y-2 p-4 bg-neutral-950 rounded-2xl border border-neutral-800">
                <label className="block text-xs font-black uppercase tracking-wider text-emerald-400">
                  Modo de Visualización
                </label>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setThemeMode('dark')}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                      themeMode === 'dark'
                        ? 'bg-neutral-800 text-white border-emerald-500 shadow-md ring-1 ring-emerald-500/40'
                        : 'bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-white'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    <span>Modo Oscuro</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setThemeMode('light')}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                      themeMode === 'light'
                        ? 'bg-neutral-800 text-white border-emerald-500 shadow-md ring-1 ring-emerald-500/40'
                        : 'bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-white'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    <span>Modo Claro</span>
                  </button>
                </div>
              </div>

              {/* 2. Accent Color Palette */}
              <div className="space-y-3 p-4 bg-neutral-950 rounded-2xl border border-neutral-800">
                <label className="block text-xs font-black uppercase tracking-wider text-emerald-400">
                  Color de Acento de la Aplicación
                </label>
                <p className="text-[11px] text-neutral-400">
                  Cambia el color de los botones de reproducción, insignias, controles y letras activas:
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {ACCENT_PRESETS.map((p) => {
                    const isSelected = accentColor.toLowerCase() === p.color.toLowerCase();
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setAccentColorById(p.id)}
                        className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-neutral-850 border-white text-white shadow-md'
                            : 'bg-neutral-900/60 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full flex-shrink-0 shadow"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="truncate">{p.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. App Name Customization */}
              <div className="space-y-3 p-4 bg-neutral-950 rounded-2xl border border-neutral-800">
                <label className="block text-xs font-black uppercase tracking-wider text-emerald-400">
                  Nombre de la Aplicación (Cabecera Superior)
                </label>
                <p className="text-[11px] text-neutral-400">
                  Personaliza el nombre que aparece en la esquina superior izquierda:
                </p>

                <div className="space-y-2.5">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Ej. Música / Sonora / Freely"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-bold"
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSaveLocalName}
                      className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs transition-colors"
                    >
                      Guardar para mi perfil
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={handleSaveGlobalName}
                        className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span>Guardar como Nombre Global (Para todos)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="space-y-3 p-4 bg-neutral-950 rounded-2xl border border-neutral-800">
                  <label className="block text-xs font-black uppercase tracking-wider text-emerald-400">
                    Estadísticas globales · Last.fm (opcional)
                  </label>
                  <p className="text-[11px] text-neutral-400">
                    Sin clave se usan los datos públicos de Deezer (fans y popularidad).
                    Con una clave gratuita de Last.fm se muestran oyentes y reproducciones
                    totales. Ninguna de las dos fuentes son los oyentes mensuales de Spotify.
                  </p>

                  {lastfmSuccessMsg && (
                    <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/25 rounded-xl text-emerald-300 text-[11px] font-bold">
                      {lastfmSuccessMsg}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="password"
                      value={lastfmKeyInput}
                      onChange={(event) => setLastfmKeyInput(event.target.value)}
                      placeholder="API key de Last.fm"
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleSaveLastfmKey}
                      className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold transition-colors"
                    >
                      Guardar clave
                    </button>
                  </div>
                  <a
                    href="https://www.last.fm/api/account/create"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-[10px] text-emerald-400 hover:underline"
                  >
                    Crear una API key gratuita en Last.fm →
                  </a>
                </div>
              )}

              {/* 4. App Icon Customization & Global Gallery */}
              <div className="space-y-4 p-4 bg-neutral-950 rounded-2xl border border-neutral-800">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-emerald-400">
                      Icono de la Aplicación & Galería
                    </label>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Se aplica al favicon del navegador y al icono al instalar la app (PWA).
                    </p>
                  </div>

                  {appIcon && (
                    <button
                      type="button"
                      onClick={resetIcon}
                      className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Original</span>
                    </button>
                  )}
                </div>

                {/* Current Active Icon Preview */}
                <div className="flex items-center gap-4 p-3 bg-neutral-900/60 rounded-xl border border-neutral-800/80">
                  <div className="w-14 h-14 rounded-xl bg-neutral-950 border border-neutral-700 overflow-hidden flex-shrink-0 shadow">
                    <img
                      src={appIcon || '/icon.svg'}
                      alt="Active Icon"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">
                      {appIcon ? 'Icono Personalizado Activo' : 'Icono Por Defecto'}
                    </span>
                    <span className="text-[11px] text-neutral-400 block mt-0.5">
                      Visible en la pestaña del navegador y la cabecera.
                    </span>
                  </div>
                </div>

                {/* Global Icon Gallery (Admin can upload for everyone) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Galería Global de Iconos ({globalIcons.length})</span>
                    </label>

                    {isAdmin && (
                      <div>
                        <input
                          type="file"
                          ref={adminGlobalIconInputRef}
                          accept="image/*"
                          onChange={handleAdminGlobalIconUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => adminGlobalIconInputRef.current?.click()}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-bold border border-emerald-500/30 transition-all"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Subir a Galería Global</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {globalIcons.length === 0 ? (
                    <p className="text-xs text-neutral-500 italic p-3 bg-neutral-900/40 rounded-xl">
                      Aún no hay iconos en la galería global. Como administrador puedes subir iconos arriba para que todos los perfiles los usen.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2.5 max-h-40 overflow-y-auto p-2.5 bg-neutral-900/60 rounded-xl border border-neutral-800">
                      {globalIcons.map((ic, idx) => {
                        const isCurrent = appIcon === ic;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              selectIcon(ic);
                              setIconSuccessMsg('¡Icono seleccionado de la galería global!');
                              setTimeout(() => setIconSuccessMsg(''), 3000);
                            }}
                            className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all hover:scale-105 p-0.5 relative group ${
                              isCurrent ? 'border-white shadow-lg' : 'border-neutral-700/80 hover:border-neutral-400'
                            }`}
                            title="Haz clic para elegir este icono"
                          >
                            <img src={ic} alt={`Icon ${idx + 1}`} className="w-full h-full object-cover rounded-lg" />
                            {isCurrent && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Personal Icon Upload from PC */}
                <div className="pt-1">
                  <input
                    type="file"
                    ref={iconFileInputRef}
                    accept="image/*"
                    onChange={handlePersonalIconUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => iconFileInputRef.current?.click()}
                    className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Subir icono propio desde tu PC (para ti)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
