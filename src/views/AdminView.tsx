import React, { useState, useRef } from 'react';
import {
  ShieldAlert,
  Link2,
  Users,
  Database,
  ListMusic,
  Plus,
  Play,
  Check,
  AlertCircle,
  Trash2,
  Upload,
  RefreshCw,
  Sparkles,
  KeyRound,
  Download,
  FileCode
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { Song, UserRole, FirebaseConfigOptions } from '../types';
import { saveStoredFirebaseConfig, getStoredFirebaseConfig } from '../services/storage';
import { initFirebase, isFirebaseConnected } from '../services/firebase';

export const AdminView: React.FC = () => {
  const { currentUser, allUsers, createProfile, deleteProfile, isAdmin } = useAuth();
  const { catalog, addTrackToCatalog, deleteCatalogTrack, updateCatalogTrack } = useMusic();

  const [activeTab, setActiveTab] = useState<'upload' | 'users' | 'catalog' | 'firebase'>('upload');

  // Tab 1: Upload song state
  const [audioUrl, setAudioUrl] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('2026');
  const [coverUrl, setCoverUrl] = useState(
    'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=600&q=80'
  );
  const [lyricsLrc, setLyricsLrc] = useState('');
  const [detectedDuration, setDetectedDuration] = useState<number>(180);
  const [isDetecting, setIsDetecting] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  // Tab 2: Users state
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('member');
  const [newPin, setNewPin] = useState('');
  const [userCreatedMessage, setUserCreatedMessage] = useState('');

  // Tab 3: Firebase state
  const [fbApiKey, setFbApiKey] = useState(() => getStoredFirebaseConfig()?.apiKey || '');
  const [fbAuthDomain, setFbAuthDomain] = useState(() => getStoredFirebaseConfig()?.authDomain || '');
  const [fbProjectId, setFbProjectId] = useState(() => getStoredFirebaseConfig()?.projectId || '');
  const [fbStorageBucket, setFbStorageBucket] = useState(() => getStoredFirebaseConfig()?.storageBucket || '');
  const [fbAppId, setFbAppId] = useState(() => getStoredFirebaseConfig()?.appId || '');
  const [fbStatusMessage, setFbStatusMessage] = useState('');

  const lrcFileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isAdmin) {
    return (
      <div className="p-12 text-center text-neutral-400 max-w-md mx-auto space-y-4">
        <ShieldAlert className="w-16 h-16 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Acceso Restringido</h2>
        <p className="text-sm">
          Esta sección está reservada exclusivamente para administradores de FreelyMusic.
        </p>
      </div>
    );
  }

  // Handle URL change to auto-fill title
  const handleUrlBlur = () => {
    if (audioUrl && !title) {
      try {
        const urlObj = new URL(audioUrl);
        const filename = urlObj.pathname.split('/').pop() || '';
        const cleanName = decodeURIComponent(filename)
          .replace(/\.(mp3|wav|flac|m4a|aac|ogg)(\?.*)?$/i, '')
          .replace(/[_-]/g, ' ')
          .trim();

        if (cleanName) {
          setTitle(cleanName);
        }
      } catch {
        // invalid URL format, ignore
      }
    }
  };

  // Detect audio duration automatically
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
    audio.onerror = () => {
      setIsDetecting(false);
    };
  };

  // Toggle preview playback of link
  const handleTogglePreview = () => {
    if (!audioUrl) return;

    if (previewAudio) {
      if (isPlayingPreview) {
        previewAudio.pause();
        setIsPlayingPreview(false);
      } else {
        previewAudio.play();
        setIsPlayingPreview(true);
      }
    } else {
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlayingPreview(false);
      audio.play().then(() => {
        setPreviewAudio(audio);
        setIsPlayingPreview(true);
      });
    }
  };

  // Handle LRC file upload
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

  // Save Track to Catalog
  const handleSaveTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioUrl || !title || !artist) return;

    addTrackToCatalog({
      title: title.trim(),
      artist: artist.trim(),
      album: album.trim() || 'Sencillo',
      genre: genre.trim() || 'General',
      year: year.trim() || '2026',
      coverUrl: coverUrl.trim(),
      audioUrl: audioUrl.trim(),
      duration: detectedDuration || 180,
      lyricsLrc: lyricsLrc.trim() || undefined,
    });

    setUploadSuccess(true);
    setTitle('');
    setArtist('');
    setAlbum('');
    setAudioUrl('');
    setLyricsLrc('');

    if (previewAudio) {
      previewAudio.pause();
      setIsPlayingPreview(false);
    }

    setTimeout(() => setUploadSuccess(false), 4000);
  };

  // Create Profile handler
  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newDisplayName.trim()) return;

    try {
      createProfile({
        username: newUsername.trim(),
        displayName: newDisplayName.trim(),
        role: newRole,
        pin: newPin.trim() || undefined,
      });

      setUserCreatedMessage(`¡Perfil de ${newDisplayName} creado exitosamente!`);
      setNewUsername('');
      setNewDisplayName('');
      setNewPin('');
      setNewRole('member');
      setTimeout(() => setUserCreatedMessage(''), 4000);
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  // Save Firebase configuration
  const handleSaveFirebase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbProjectId || !fbApiKey) {
      setFbStatusMessage('Por favor completa al menos el Project ID y el API Key.');
      return;
    }

    const config: FirebaseConfigOptions = {
      apiKey: fbApiKey.trim(),
      authDomain: fbAuthDomain.trim(),
      projectId: fbProjectId.trim(),
      storageBucket: fbStorageBucket.trim(),
      messagingSenderId: '',
      appId: fbAppId.trim(),
    };

    saveStoredFirebaseConfig(config);
    const connected = initFirebase(config);
    if (connected) {
      setFbStatusMessage('¡Firebase Firestore conectado exitosamente! Sincronizando datos...');
    } else {
      setFbStatusMessage('Configuración guardada. Verificando conexión...');
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950/60 via-neutral-900 to-black p-6 rounded-3xl border border-emerald-500/20 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-black text-white">Panel de Administración</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-500 text-black px-2 py-0.5 rounded-full">
                ADMIN EXCLUSIVO
              </span>
            </div>
            <p className="text-neutral-400 text-xs md:text-sm mt-0.5">
              Gestión centralizada del catálogo en la nube, perfiles restringidos y base de datos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-neutral-950/80 px-3 py-1.5 rounded-xl border border-neutral-800 text-xs text-neutral-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{catalog.length} pistas en el catálogo global</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'upload'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-black'
              : 'text-neutral-400 hover:text-white bg-neutral-900/60'
          }`}
        >
          <Link2 className="w-4 h-4" />
          <span>Añadir Música por Link</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-black'
              : 'text-neutral-400 hover:text-white bg-neutral-900/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Gestión de Perfiles ({allUsers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'catalog'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-black'
              : 'text-neutral-400 hover:text-white bg-neutral-900/60'
          }`}
        >
          <ListMusic className="w-4 h-4" />
          <span>Catálogo Global ({catalog.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('firebase')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'firebase'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-black'
              : 'text-neutral-400 hover:text-white bg-neutral-900/60'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Google Firebase</span>
        </button>
      </div>

      {/* TAB 1: ADD TRACK BY LINK */}
      {activeTab === 'upload' && (
        <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-3xl p-6 md:p-8 space-y-6">
          <div>
            <h2 className="text-xl font-extrabold text-white">Ingesta de Audio por Enlace</h2>
            <p className="text-xs text-neutral-400 mt-1">
              Pega un enlace directo de audio (MP3, WAV, FLAC, M4A, etc.). La canción quedará almacenada en tu repositorio privado en la nube.
            </p>
          </div>

          {uploadSuccess && (
            <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl flex items-center gap-3 text-emerald-300 text-xs font-bold animate-in fade-in">
              <Check className="w-5 h-5 flex-shrink-0" />
              <span>¡Canción añadida exitosamente al catálogo en la nube! Ya puedes buscarla en "Explorar la Nube".</span>
            </div>
          )}

          <form onSubmit={handleSaveTrack} className="space-y-5">
            {/* Audio Link Input */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                Enlace Directo de Audio (URL) *
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  required
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  onBlur={handleUrlBlur}
                  placeholder="https://ejemplo.com/musica/mi_cancion.mp3"
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />

                <button
                  type="button"
                  onClick={handleDetectDuration}
                  disabled={!audioUrl || isDetecting}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
                  title="Detectar duración del enlace"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
                  <span>{isDetecting ? 'Detectando...' : 'Calcular'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTogglePreview}
                  disabled={!audioUrl}
                  className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                  title="Probar sonido antes de guardar"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isPlayingPreview ? 'Detener' : 'Probar'}</span>
                </button>
              </div>
            </div>

            {/* Title & Artist */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Título de la Canción *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Starboy"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Artista *
                </label>
                <input
                  type="text"
                  required
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="Ej: The Weeknd, Daft Punk..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Album, Genre, Year & Duration */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Álbum
                </label>
                <input
                  type="text"
                  value={album}
                  onChange={(e) => setAlbum(e.target.value)}
                  placeholder="Ej: After Hours"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Género
                </label>
                <input
                  type="text"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="Ej: Synthwave, Pop, Rock..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Año
                </label>
                <input
                  type="text"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="2026"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Duración (segundos)
                </label>
                <input
                  type="number"
                  min="1"
                  value={detectedDuration}
                  onChange={(e) => setDetectedDuration(parseInt(e.target.value, 10) || 180)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Cover Image URL & Preview */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                URL de la Carátula (Cover Art)
              </label>
              <div className="flex gap-4 items-center">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800 flex-shrink-0">
                  <img src={coverUrl} alt="Cover preview" className="w-full h-full object-cover" />
                </div>
                <input
                  type="url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Synced Lyrics (.LRC file or paste) */}
            <div className="border-t border-neutral-800 pt-5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider">
                    Letras Sincronizadas (.LRC)
                  </label>
                  <p className="text-[11px] text-neutral-400">
                    Formato estándar [mm:ss.xx] Texto de la estrofa para modo Apple Music
                  </p>
                </div>

                <div className="flex gap-2">
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
                    className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-emerald-400 font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Subir archivo .LRC
                  </button>
                </div>
              </div>

              <textarea
                rows={6}
                value={lyricsLrc}
                onChange={(e) => setLyricsLrc(e.target.value)}
                placeholder="[00:15.20] Primera estrofa sincronizada...&#10;[00:22.50] Segunda estrofa..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm tracking-wide shadow-xl shadow-emerald-500/25 active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5 stroke-[3]" />
                Guardar Canción en el Repositorio de la Nube
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: USER PROFILE MANAGEMENT (ADMIN ONLY) */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create User Form */}
          <div className="lg:col-span-1 bg-neutral-900/40 border border-neutral-800/80 rounded-3xl p-6 space-y-4">
            <div>
              <h3 className="font-extrabold text-white text-lg">Crear Nuevo Perfil</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Solo los administradores pueden añadir nuevos perfiles. No existe registro público abierto.
              </p>
            </div>

            {userCreatedMessage && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold">
                {userCreatedMessage}
              </div>
            )}

            <form onSubmit={handleCreateProfile} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="Ej: Laura Jaimes"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1">
                  Nombre de Usuario *
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="ej: laura"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1">
                  Rol del Usuario
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="member">Miembro (Escucha, crea playlists privadas)</option>
                  <option value="admin">Administrador (Puede crear usuarios y subir links)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1">
                  PIN de Acceso (Opcional)
                </label>
                <input
                  type="password"
                  maxLength={8}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Opcional: 4 dígitos"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs tracking-wider transition-all shadow-md shadow-emerald-500/20"
                >
                  Crear Perfil Restringido
                </button>
              </div>
            </form>
          </div>

          {/* Existing Profiles List */}
          <div className="lg:col-span-2 bg-neutral-900/40 border border-neutral-800/80 rounded-3xl p-6">
            <h3 className="font-extrabold text-white text-lg mb-1">Perfiles Autorizados</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Cada perfil cuenta con su propia biblioteca, listas y canciones favoritas aisladas.
            </p>

            <div className="space-y-3">
              {allUsers.map((user) => {
                const isCurrent = user.id === currentUser.id;
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3.5 bg-neutral-950/70 border border-neutral-800/80 rounded-2xl"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName}
                        className="w-12 h-12 rounded-xl object-cover ring-2 ring-neutral-700/60"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{user.displayName}</span>
                          <span
                            className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-black tracking-wider ${
                              user.role === 'admin'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-neutral-800 text-neutral-400'
                            }`}
                          >
                            {user.role}
                          </span>
                          {user.pin && (
                            <span title="Protegido con PIN">
                              <KeyRound className="w-3 h-3 text-amber-400" />
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-neutral-500">
                          @{user.username} • Creado el {new Date(user.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isCurrent && (
                        <button
                          onClick={() => {
                            if (confirm(`¿Eliminar el perfil de ${user.displayName}?`)) {
                              deleteProfile(user.id);
                            }
                          }}
                          className="p-2 text-neutral-500 hover:text-red-400 rounded-lg hover:bg-neutral-800 transition-colors"
                          title="Eliminar perfil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GLOBAL CATALOG LIST */}
      {activeTab === 'catalog' && (
        <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-extrabold text-white text-lg">Catálogo Global de FreelyMusic</h3>
              <p className="text-xs text-neutral-400">
                Pistas agregadas por enlaces que están disponibles para la búsqueda en la nube.
              </p>
            </div>
          </div>

          <div className="divide-y divide-neutral-800/40 max-h-[600px] overflow-y-auto">
            {catalog.map((song) => (
              <div
                key={song.id}
                className="flex items-center justify-between py-3 px-2 hover:bg-neutral-800/30 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3 truncate max-w-md">
                  <img
                    src={song.coverUrl}
                    alt={song.title}
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="truncate">
                    <span className="block font-bold text-sm text-white truncate">{song.title}</span>
                    <span className="block text-xs text-neutral-400 truncate">
                      {song.artist} • {song.album}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <a
                    href={song.audioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-400 hover:underline font-mono truncate max-w-[200px] hidden sm:block"
                  >
                    Ver URL
                  </a>

                  <button
                    onClick={() => {
                      if (confirm(`¿Eliminar "${song.title}" del catálogo global?`)) {
                        deleteCatalogTrack(song.id);
                      }
                    }}
                    className="p-1.5 text-neutral-500 hover:text-red-400 rounded-lg hover:bg-neutral-800 transition-colors"
                    title="Eliminar de catálogo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: FIREBASE CONFIGURATION */}
      {activeTab === 'firebase' && (
        <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-3xl p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-white">Configuración Google Firebase</h2>
              <p className="text-xs text-neutral-400 mt-1">
                Conecta tu proyecto de Firebase Firestore para respaldar tu catálogo y playlists en los servidores de Google.
              </p>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-neutral-950 border border-neutral-800">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isFirebaseConnected() ? 'bg-emerald-400' : 'bg-neutral-500'
                }`}
              />
              <span className={isFirebaseConnected() ? 'text-emerald-400' : 'text-neutral-400'}>
                {isFirebaseConnected() ? 'Conectado a Firestore' : 'Modo Local Activo'}
              </span>
            </div>
          </div>

          {fbStatusMessage && (
            <div className="p-3 bg-neutral-950 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold">
              {fbStatusMessage}
            </div>
          )}

          <form onSubmit={handleSaveFirebase} className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1">
                Project ID (Obligatorio)
              </label>
              <input
                type="text"
                required
                value={fbProjectId}
                onChange={(e) => setFbProjectId(e.target.value)}
                placeholder="ej: sonora-music-12345"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1">
                API Key (Obligatorio)
              </label>
              <input
                type="text"
                required
                value={fbApiKey}
                onChange={(e) => setFbApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1">
                  Auth Domain
                </label>
                <input
                  type="text"
                  value={fbAuthDomain}
                  onChange={(e) => setFbAuthDomain(e.target.value)}
                  placeholder="sonora-music.firebaseapp.com"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1">
                  App ID
                </label>
                <input
                  type="text"
                  value={fbAppId}
                  onChange={(e) => setFbAppId(e.target.value)}
                  placeholder="1:123456789:web:abcdef..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs tracking-wider transition-all shadow-md shadow-emerald-500/20"
            >
              Guardar Credenciales de Firebase
            </button>
          </form>

          {/* Quick backup / export tool */}
          <div className="pt-6 border-t border-neutral-800 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-white text-sm">Respaldo Manual en JSON</h4>
              <p className="text-xs text-neutral-400">
                Descarga una copia completa de tu catálogo y perfiles en un archivo .json
              </p>
            </div>

            <button
              onClick={() => {
                const data = {
                  catalog,
                  profiles: allUsers,
                  exportedAt: new Date().toISOString(),
                };
                const blob = new Blob([JSON.stringify(data, null, 2)], {
                  type: 'application/json',
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `sonora-backup-${Date.now()}.json`;
                a.click();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              Exportar Copia JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
