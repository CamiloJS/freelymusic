import React, { useState, useRef } from 'react';
import {
  X,
  UserCheck,
  Shield,
  Plus,
  KeyRound,
  User,
  Palette,
  Cloud,
  Upload,
  Check,
  RotateCcw,
  Sparkles,
  Music,
  Disc3,
  FileCode,
  Image,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { UserProfile } from '../types';
import {
  getCustomAppIcon,
  setCustomAppIcon,
  removeCustomAppIcon,
} from '../utils/appIcon';

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
  const { currentUser, allUsers, switchUser, updateProfile, isAdmin } = useAuth();
  const { addTrackToCatalog } = useMusic();

  const [activeTab, setActiveTab] = useState<'perfiles' | 'mi_perfil' | 'personalizacion' | 'repositorio'>('perfiles');

  // PIN switch state
  const [pinPromptUser, setPinPromptUser] = useState<UserProfile | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Tab: Mi Perfil state
  const [editDisplayName, setEditDisplayName] = useState(currentUser.displayName);
  const [editPin, setEditPin] = useState(currentUser.pin || '');
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  // Tab: Personalizacion (App Icon) state
  const [currentIcon, setCurrentIcon] = useState<string | null>(() => getCustomAppIcon());
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [iconSuccessMsg, setIconSuccessMsg] = useState('');
  const iconFileInputRef = useRef<HTMLInputElement | null>(null);

  // Tab: Repositorio (Añadir Música por enlace)
  const [audioUrl, setAudioUrl] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [songAlbum, setSongAlbum] = useState('');
  const [songGenre, setSongGenre] = useState('');
  const [songYear, setSongYear] = useState('2026');
  const [songCoverUrl, setSongCoverUrl] = useState('https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=600&q=80');
  const [lyricsLrc, setLyricsLrc] = useState('');
  const [detectedDuration, setDetectedDuration] = useState<number>(180);
  const [isDetecting, setIsDetecting] = useState(false);
  const [repoSuccessMsg, setRepoSuccessMsg] = useState('');
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const lrcFileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Switch user handler
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

  // Avatar file upload from PC
  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        updateProfile({
          ...currentUser,
          avatarUrl: dataUrl,
        });
        setProfileSuccessMsg('¡Foto de perfil actualizada exitosamente!');
        setTimeout(() => setProfileSuccessMsg(''), 3000);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save profile info (Name + PIN)
  const handleSaveProfileInfo = (e: React.FormEvent) => {
    e.preventDefault();
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

  // Song Cover upload from PC
  const handleCoverFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setSongCoverUrl(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // LRC file upload from PC
  const handleLrcFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setLyricsLrc(content);
      }
    };
    reader.readAsText(file);
  };

  // Auto-fill title from URL on blur
  const handleAudioUrlBlur = () => {
    if (audioUrl && !songTitle) {
      try {
        const urlObj = new URL(audioUrl);
        const filename = urlObj.pathname.split('/').pop() || '';
        const cleanName = decodeURIComponent(filename)
          .replace(/\.(mp3|wav|flac|m4a|aac|ogg)(\?.*)?$/i, '')
          .replace(/[_-]/g, ' ')
          .trim();

        if (cleanName) {
          setSongTitle(cleanName);
        }
      } catch {
        // invalid URL
      }
    }
  };

  // Detect audio duration
  const handleDetectDuration = () => {
    if (!audioUrl) return;
    setIsDetecting(true);
    const audio = new Audio();
    audio.src = audioUrl;
    audio.onloadedmetadata = () => {
      if (!isNaN(audio.duration) && audio.duration > 0) {
        setDetectedDuration(Math.round(audio.duration));
      }
      setIsDetecting(false);
    };
    audio.onerror = () => setIsDetecting(false);
  };

  // Save song to repository
  const handleSaveSongToRepo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioUrl.trim() || !songTitle.trim() || !songArtist.trim()) return;

    addTrackToCatalog({
      title: songTitle.trim(),
      artist: songArtist.trim(),
      album: songAlbum.trim() || 'Sencillo',
      genre: songGenre.trim() || 'General',
      year: songYear.trim() || '2026',
      coverUrl: songCoverUrl.trim(),
      audioUrl: audioUrl.trim(),
      duration: detectedDuration || 180,
      lyricsLrc: lyricsLrc.trim() || undefined,
    });

    setRepoSuccessMsg('¡Canción añadida al repositorio en la nube con éxito!');
    setAudioUrl('');
    setSongTitle('');
    setSongArtist('');
    setSongAlbum('');
    setLyricsLrc('');
    setTimeout(() => setRepoSuccessMsg(''), 4000);
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

          <button
            onClick={() => setActiveTab('repositorio')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'repositorio'
                ? 'bg-emerald-500 text-black font-extrabold shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>+ Añadir Música</span>
          </button>
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
                      const isActive = user.id === currentUser.id;
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

                  {onOpenCreateProfile && isAdmin && (
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
                  src={currentUser.avatarUrl}
                  alt={currentUser.displayName}
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

          {/* TAB 4: REPOSITORIO (AÑADIR MÚSICA POR ENLACE COMO FILE GARDEN) */}
          {activeTab === 'repositorio' && (
            <div className="space-y-5">
              <div>
                <h3 className="font-extrabold text-white text-xl">Subir al Repositorio de Música</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Añade música mediante enlaces directos (File Garden, Dropbox, Notion, etc.). Las canciones se guardan en el catálogo en la nube para que las explores y agregues a tus listas.
                </p>
              </div>

              {repoSuccessMsg && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>{repoSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveSongToRepo} className="space-y-3.5">
                {/* Audio URL */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-neutral-300">
                      Enlace del Archivo de Audio (File Garden, Dropbox, etc.)
                    </label>
                    <span className="text-[10px] text-emerald-400 font-semibold">
                      MP3, WAV, FLAC, M4A, OGG
                    </span>
                  </div>
                  <input
                    type="url"
                    required
                    value={audioUrl}
                    onChange={(e) => setAudioUrl(e.target.value)}
                    onBlur={handleAudioUrlBlur}
                    placeholder="https://filegarden.com/tu-archivo.mp3"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-[10px] text-neutral-500">
                      File Garden genera enlaces directos rápidos ideales como repositorio.
                    </p>
                    {audioUrl && (
                      <button
                        type="button"
                        onClick={handleDetectDuration}
                        disabled={isDetecting}
                        className="text-[10px] font-bold text-emerald-400 hover:underline"
                      >
                        {isDetecting ? 'Detectando...' : 'Detectar duración'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Title & Artist */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1">
                      Título de la Canción
                    </label>
                    <input
                      type="text"
                      required
                      value={songTitle}
                      onChange={(e) => setSongTitle(e.target.value)}
                      placeholder="Ej. Blinding Lights"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1">
                      Artista / Grupo
                    </label>
                    <input
                      type="text"
                      required
                      value={songArtist}
                      onChange={(e) => setSongArtist(e.target.value)}
                      placeholder="Ej. The Weeknd"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Album & Genre */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1">
                      Álbum
                    </label>
                    <input
                      type="text"
                      value={songAlbum}
                      onChange={(e) => setSongAlbum(e.target.value)}
                      placeholder="Sencillo o Álbum"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1">
                      Género (Para IA)
                    </label>
                    <input
                      type="text"
                      value={songGenre}
                      onChange={(e) => setSongGenre(e.target.value)}
                      placeholder="Pop, Rock, Lo-Fi..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1">
                      Año
                    </label>
                    <input
                      type="text"
                      value={songYear}
                      onChange={(e) => setSongYear(e.target.value)}
                      placeholder="2026"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Cover Art (URL or PC file upload) */}
                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                    Carátula / Portada
                  </label>
                  <div className="flex items-center gap-3">
                    <img
                      src={songCoverUrl}
                      alt="Cover"
                      className="w-12 h-12 rounded-lg object-cover ring-1 ring-neutral-700 flex-shrink-0"
                    />
                    <div className="flex-1 space-y-1.5">
                      <input
                        type="url"
                        value={songCoverUrl}
                        onChange={(e) => setSongCoverUrl(e.target.value)}
                        placeholder="URL de imagen https://..."
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                      />
                      <input
                        type="file"
                        ref={coverFileInputRef}
                        accept="image/*"
                        onChange={handleCoverFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => coverFileInputRef.current?.click()}
                        className="text-[10px] font-bold text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <Image className="w-3 h-3" />
                        O subir carátula desde tu computador
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lyrics File (.LRC) */}
                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                      Letras Sincronizadas (.LRC) (opcional)
                    </label>
                    <input
                      type="file"
                      ref={lrcFileInputRef}
                      accept=".lrc,.txt"
                      onChange={handleLrcFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => lrcFileInputRef.current?.click()}
                      className="text-[10px] font-bold text-emerald-400 hover:underline"
                    >
                      Subir archivo .lrc de tu PC
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={lyricsLrc}
                    onChange={(e) => setLyricsLrc(e.target.value)}
                    placeholder="[00:12.50] Primera línea de la canción..."
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-[11px] font-mono text-neutral-300 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs tracking-wider transition-all shadow-lg shadow-emerald-500/20"
                >
                  Guardar Canción en el Repositorio
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
