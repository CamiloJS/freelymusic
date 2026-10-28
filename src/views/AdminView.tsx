import React, { useState, useRef, useMemo } from 'react';
import Search from 'lucide-react/dist/esm/icons/search.mjs';
import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert.mjs';
import Link2 from 'lucide-react/dist/esm/icons/link-2.mjs';
import Users from 'lucide-react/dist/esm/icons/users.mjs';
import Database from 'lucide-react/dist/esm/icons/database.mjs';
import ListMusic from 'lucide-react/dist/esm/icons/list-music.mjs';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import AlertCircle from 'lucide-react/dist/esm/icons/circle-alert.mjs';
import Trash2 from 'lucide-react/dist/esm/icons/trash.mjs';
import Upload from 'lucide-react/dist/esm/icons/upload.mjs';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.mjs';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.mjs';
import KeyRound from 'lucide-react/dist/esm/icons/key-round.mjs';
import Download from 'lucide-react/dist/esm/icons/download.mjs';
import FileCode from 'lucide-react/dist/esm/icons/file-code.mjs';
import Pencil from 'lucide-react/dist/esm/icons/pencil.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Disc from 'lucide-react/dist/esm/icons/disc.mjs';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { Song, UserRole, FirebaseConfigOptions } from '../types';
import { saveStoredFirebaseConfig, getStoredFirebaseConfig } from '../services/storage';
import { isFirebaseConnected } from '../services/firebase';
import { compressImage } from '../utils/imageCompressor';
import { detectAudioDuration } from '../utils/audioDuration';
import { parseAudioUrlMetadata, cleanArtistSeparators, splitArtistNames } from '../utils/urlMetadataParser';
import { SongMediaEditor, SongMediaValue, EMPTY_SONG_MEDIA } from '../components/SongMediaEditor';
import { MetadataEnrichmentModal } from '../components/MetadataEnrichmentModal';

export const AdminView: React.FC = () => {
  const { currentUser, allUsers, createProfile, deleteProfile, isAdmin } = useAuth();
  const { catalog, addTrackToCatalog, deleteCatalogTrack, updateCatalogTrack, updateMultipleCatalogTracks } = useMusic();

  const [activeTab, setActiveTab] = useState<'upload' | 'users' | 'catalog' | 'firebase'>('upload');

  // Tab 1: Upload song state
  const [audioUrl, setAudioUrl] = useState('');
  const [title, setTitle] = useState('');
  const [artistList, setArtistList] = useState<string[]>(['']);
  const [album, setAlbum] = useState('');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('2026');
  const [adminIsExplicit, setAdminIsExplicit] = useState(false);
  const [coverUrl, setCoverUrl] = useState(
    'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=600&q=80'
  );
  const [lyricsLrc, setLyricsLrc] = useState('');
  const [detectedDuration, setDetectedDuration] = useState<number>(0);
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

  // Tab 3: Song Configuration & Editing in Global Catalog
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [editingSong, setEditingSong] = useState<Song | null>(null);

  const filteredCatalog = useMemo(() => {
    const q = catalogSearchQuery.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        (s.album && s.album.toLowerCase().includes(q))
    );
  }, [catalog, catalogSearchQuery]);
  const [editTitle, setEditTitle] = useState('');
  const [editArtistList, setEditArtistList] = useState<string[]>(['']);
  const [editAlbum, setEditAlbum] = useState('');
  const [editAlbumArtist, setEditAlbumArtist] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editYear, setEditYear] = useState('2026');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [editAudioUrl, setEditAudioUrl] = useState('');
  const [editLyricsLrc, setEditLyricsLrc] = useState('');
  const [editIsExplicit, setEditIsExplicit] = useState(false);
  const [editTrackNumber, setEditTrackNumber] = useState<number | undefined>(undefined);
  const [editDiscNumber, setEditDiscNumber] = useState<number | undefined>(undefined);
  const [editDuration, setEditDuration] = useState(180);
  const [editMedia, setEditMedia] = useState<SongMediaValue>({ ...EMPTY_SONG_MEDIA });
  const [applyCoverToAlbum, setApplyCoverToAlbum] = useState(false);
  const [isEnrichmentOpen, setIsEnrichmentOpen] = useState(false);
  const editCoverFileInputRef = useRef<HTMLInputElement | null>(null);
  const editLrcFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleOpenEditSong = (song: Song) => {
    setEditingSong(song);
    setApplyCoverToAlbum(false);
    setEditTitle(song.title);
    const split = song.artist ? splitArtistNames(cleanArtistSeparators(song.artist)) : [''];
    setEditArtistList(split.length > 0 ? split : ['']);
    setEditAlbum(song.album || '');
    setEditAlbumArtist(song.albumArtist || '');
    setEditTrackNumber(song.trackNumber);
    setEditDiscNumber(song.discNumber);
    setEditGenre(song.genre || '');
    setEditYear(song.year || '2026');
    setEditCoverUrl(song.coverUrl);
    setEditAudioUrl(song.audioUrl);
    setEditLyricsLrc(song.lyricsLrc || song.plainLyrics || '');
    setEditIsExplicit(Boolean(song.isExplicit));
    const currentDur = song.duration && song.duration !== 180 ? song.duration : 0;
    setEditDuration(currentDur);
    if (!currentDur && song.audioUrl) {
      void detectAudioDuration(song.audioUrl).then((d) => {
        if (d > 0) setEditDuration(d);
      });
    }
    setEditMedia({
      videoUrl: song.videoUrl || '',
      instrumentalUrl: song.instrumentalUrl || '',
      instrumentalOffset: song.instrumentalOffset || 0,
      instrumentalLyricsLrc: song.instrumentalLyricsLrc || '',
      versions: song.versions || [],
    });
  };

  const handleSaveEditSong = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSong) return;

    const finalArtist = editArtistList
      .map(cleanArtistSeparators)
      .flatMap(splitArtistNames)
      .map((a) => a.trim())
      .filter(Boolean)
      .join(', ');
    if (!editTitle.trim() || !finalArtist || !editAudioUrl.trim()) {
      alert('El título, al menos un artista y el enlace de audio son requeridos.');
      return;
    }

    const updated: Song = {
      ...editingSong,
      title: editTitle.trim(),
      artist: finalArtist,
      album: editAlbum.trim() || 'Sencillo',
      albumArtist: editAlbumArtist.trim() ? cleanArtistSeparators(editAlbumArtist.trim()) : undefined,
      trackNumber: editTrackNumber ? Number(editTrackNumber) : undefined,
      discNumber: editDiscNumber ? Number(editDiscNumber) : undefined,
      genre: editGenre.trim() || 'General',
      year: editYear.trim() || '2026',
      coverUrl: editCoverUrl.trim(),
      audioUrl: editAudioUrl.trim(),
      lyricsLrc: editLyricsLrc.trim() || undefined,
      isExplicit: editIsExplicit,
      duration: editDuration,
      videoUrl: editMedia.videoUrl.trim() || undefined,
      instrumentalUrl: editMedia.instrumentalUrl.trim() || undefined,
      instrumentalOffset: editMedia.instrumentalOffset || undefined,
      instrumentalLyricsLrc: editMedia.instrumentalLyricsLrc.trim() || undefined,
      versions: editMedia.versions
        .filter((version) => version.audioUrl.trim())
        .map((version) => ({
          ...version,
          audioUrl: version.audioUrl.trim(),
          label: version.label.trim() || 'Versión',
          lyricsLrc: version.lyricsLrc?.trim() || undefined,
          videoUrl: version.videoUrl?.trim() || undefined,
          instrumentalUrl: version.instrumentalUrl?.trim() || undefined,
          instrumentalLyricsLrc: version.instrumentalLyricsLrc?.trim() || undefined,
        })),
    };

    if (applyCoverToAlbum && updated.coverUrl && updated.album && updated.album.toLowerCase() !== 'sencillo') {
      const albumTarget = updated.album.trim().toLowerCase();
      const updatedCover = updated.coverUrl;
      const otherAlbumTracks = catalog
        .filter((s) => s.id !== updated.id && (s.album || '').trim().toLowerCase() === albumTarget)
        .map((s) => ({ ...s, coverUrl: updatedCover }));

      if (otherAlbumTracks.length > 0) {
        void updateMultipleCatalogTracks([updated, ...otherAlbumTracks]);
      } else {
        updateCatalogTrack(updated);
      }
    } else {
      updateCatalogTrack(updated);
    }
    setEditingSong(null);
  };

  const lrcFileInputRef = useRef<HTMLInputElement | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, 500, 0.8);
      if (compressed) {
        setCoverUrl(compressed);
      }
    } catch (err) {
      console.warn('Error comprimiendo carátula:', err);
    }
  };

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

  // Handle URL change to auto-fill title & artists
  const handleUrlBlur = () => {
    if (!audioUrl.trim()) return;

    const parsed = parseAudioUrlMetadata(audioUrl);
    if (!title && parsed.title) {
      setTitle(parsed.title);
    }
    if ((!artistList[0] || artistList.length <= 1) && parsed.artists.length > 0) {
      setArtistList(parsed.artists);
    }
    handleDetectDuration();
  };

  // Detect audio duration automatically
  const handleDetectDuration = async () => {
    if (!audioUrl) return;
    setIsDetecting(true);
    try {
      const dur = await detectAudioDuration(audioUrl.trim());
      if (dur > 0) {
        setDetectedDuration(dur);
      }
    } finally {
      setIsDetecting(false);
    }
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
    const finalArtist = artistList
      .map(cleanArtistSeparators)
      .flatMap(splitArtistNames)
      .map((a) => a.trim())
      .filter(Boolean)
      .join(', ');
    if (!audioUrl || !title || !finalArtist) return;

    addTrackToCatalog({
      title: title.trim(),
      artist: finalArtist,
      album: album.trim() || 'Sencillo',
      genre: genre.trim() || 'General',
      year: year.trim() || '2026',
      coverUrl: coverUrl.trim(),
      audioUrl: audioUrl.trim(),
      duration: detectedDuration || 0,
      lyricsLrc: lyricsLrc.trim() || undefined,
      isExplicit: adminIsExplicit,
    });

    setUploadSuccess(true);
    setTitle('');
    setArtistList(['']);
    setAlbum('');
    setAudioUrl('');
    setLyricsLrc('');
    setAdminIsExplicit(false);

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
    // Firebase cannot be re-initialized in place with a different project.
    // Reload so the SDK starts with the saved configuration.
    setFbStatusMessage('Configuración guardada. Recargando para conectar...');
    setTimeout(() => window.location.reload(), 700);
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
                  placeholder="https://filegarden.com/... o enlace directo a MP3/WAV/FLAC"
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
            <div className="space-y-4">
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

              {/* Multiple Artists List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider">
                    Artistas y Colaboradores *
                  </label>
                  <button
                    type="button"
                    onClick={() => setArtistList([...artistList, ''])}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-emerald-400 text-xs font-bold border border-neutral-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir artista</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {artistList.map((art, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        required={idx === 0}
                        value={art}
                        onChange={(e) => {
                          const updated = [...artistList];
                          updated[idx] = e.target.value;
                          setArtistList(updated);
                        }}
                        placeholder={idx === 0 ? "Artista principal (Ej. Aitana)" : "Artista colaborador (Ej. Kenia OS)"}
                        className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                      {artistList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setArtistList(artistList.filter((_, i) => i !== idx))}
                          className="p-2.5 rounded-xl bg-neutral-900 hover:bg-red-950/40 text-neutral-400 hover:text-red-400 border border-neutral-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Explicit Content Toggle (E) */}
              <div
                onClick={() => setAdminIsExplicit(!adminIsExplicit)}
                className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  adminIsExplicit
                    ? 'bg-neutral-900 border-neutral-700 shadow-md'
                    : 'bg-neutral-950/60 border-neutral-800/80 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-neutral-600 text-black text-xs font-black select-none">
                    E
                  </span>
                  <div>
                    <span className="text-xs font-bold text-white block">Contenido Explícito (E)</span>
                    <span className="text-[11px] text-neutral-400 block">Indica si la canción contiene letras explícitas con la insignia "E"</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={adminIsExplicit}
                  onChange={(e) => setAdminIsExplicit(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Album, Genre & Year */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            </div>

            {/* Cover Image URL & Preview */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider">
                  Carátula (Cover Art)
                </label>
                <div>
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
                    className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Subir carátula desde tu PC
                  </button>
                </div>
              </div>
              <div className="flex gap-4 items-center">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800 flex-shrink-0">
                  <img src={coverUrl} alt="Cover preview" className="w-full h-full object-cover" />
                </div>
                <input
                  type="url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... o sube una imagen de tu PC"
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
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="font-extrabold text-white text-lg">Catálogo Global de Música</h3>
              <p className="text-xs text-neutral-400">
                Configura cada canción, modifica sus artistas colaboradores, ajusta sus letras sincronizadas o marca si es explícita (E).
              </p>
            </div>
            <button
              onClick={() => setIsEnrichmentOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold"
            >
              <Sparkles className="w-4 h-4" />
              Enriquecer metadatos
            </button>
          </div>

          {/* Search box for catalog */}
          <div className="relative mb-4">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={catalogSearchQuery}
              onChange={(e) => setCatalogSearchQuery(e.target.value)}
              placeholder="Buscar canción en el catálogo por título, artista o álbum..."
              className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {catalogSearchQuery && (
              <button
                onClick={() => setCatalogSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="divide-y divide-neutral-800/40 max-h-[600px] overflow-y-auto">
            {filteredCatalog.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-500 italic">
                No se encontraron canciones que coincidan con "{catalogSearchQuery}".
              </div>
            ) : (
              filteredCatalog.map((song) => (
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
                    <div className="flex items-center gap-1.5">
                      {song.isExplicit && (
                        <span
                          className="inline-flex items-center justify-center w-3 h-3 rounded bg-neutral-600/80 text-white text-[8px] font-black flex-shrink-0 select-none leading-none"
                          title="Contenido explícito"
                        >
                          E
                        </span>
                      )}
                      <span className="block font-bold text-sm text-white truncate">{song.title}</span>
                    </div>
                    <span className="block text-xs text-neutral-400 truncate">
                      {song.trackNumber ? `Pista #${song.trackNumber} • ` : ''}{song.artist} • {song.album}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditSong(song)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-emerald-500 hover:text-black text-neutral-300 font-bold text-xs transition-colors"
                    title="Editar y configurar canción"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Configurar</span>
                  </button>

                  <a
                    href={song.audioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-400 hover:underline font-mono truncate max-w-[120px] hidden sm:block px-2"
                  >
                    URL
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
            )))}
          </div>

          {/* EDIT SONG MODAL */}
          {editingSong && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                  <div>
                    <h3 className="text-lg font-extrabold text-white">Configurar Canción</h3>
                    <p className="text-xs text-neutral-400">Modifica la metadata, artistas, letra o estado explícito</p>
                  </div>
                  <button
                    onClick={() => setEditingSong(null)}
                    className="p-1.5 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveEditSong} className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1.5">Título</label>
                    <input
                      type="text"
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Multiple Artists */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-neutral-300">
                        Artistas y Colaboradores
                      </label>
                      <button
                        type="button"
                        onClick={() => setEditArtistList([...editArtistList, ''])}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-emerald-400 text-xs font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Añadir artista</span>
                      </button>
                    </div>

                    {editArtistList.map((art, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          required={idx === 0}
                          value={art}
                          onChange={(e) => {
                            const updated = [...editArtistList];
                            updated[idx] = e.target.value;
                            setEditArtistList(updated);
                          }}
                          placeholder={idx === 0 ? "Artista principal" : "Artista colaborador"}
                          className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                        />
                        {editArtistList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setEditArtistList(editArtistList.filter((_, i) => i !== idx))}
                            className="p-2 text-neutral-400 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Album, Track #, Disc # & Year */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-neutral-300 mb-1.5">Álbum</label>
                      <input
                        type="text"
                        value={editAlbum}
                        onChange={(e) => setEditAlbum(e.target.value)}
                        placeholder="Ej. Cuarto Azul"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-300 mb-1.5">Artista del Álbum</label>
                      <input
                        type="text"
                        value={editAlbumArtist}
                        onChange={(e) => setEditAlbumArtist(e.target.value)}
                        placeholder="Ej. Aitana"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-300 mb-1.5">Nº de Pista (#)</label>
                      <input
                        type="number"
                        min="1"
                        value={editTrackNumber || ''}
                        onChange={(e) => setEditTrackNumber(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                        placeholder="Ej. 1"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-300 mb-1.5">Nº de Disco (CD #)</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={editDiscNumber || ''}
                        onChange={(e) => setEditDiscNumber(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                        placeholder="Ej. 1 o 2"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-300 mb-1.5">Año</label>
                      <input
                        type="text"
                        value={editYear}
                        onChange={(e) => setEditYear(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Explicit Toggle (E) */}
                  <div
                    onClick={() => setEditIsExplicit(!editIsExplicit)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${
                      editIsExplicit ? 'bg-neutral-950 border-neutral-700' : 'bg-neutral-950/60 border-neutral-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-neutral-600 text-black text-[9px] font-black">
                        E
                      </span>
                      <span className="text-xs font-bold text-white">Contenido Explícito (E)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={editIsExplicit}
                      onChange={(e) => setEditIsExplicit(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500"
                    />
                  </div>

                  {/* Cover Art Preview & Upload */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-neutral-300">Carátula</label>
                    <div className="flex items-center gap-3">
                      <img
                        src={editCoverUrl || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=600&q=80'}
                        alt="Preview"
                        className="w-14 h-14 rounded-xl object-cover ring-1 ring-neutral-700"
                      />
                      <div className="flex-1 space-y-1.5">
                        <input
                          type="file"
                          ref={editCoverFileInputRef}
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const compressed = await compressImage(file, 500, 0.8);
                              if (compressed) setEditCoverUrl(compressed);
                            } catch (err) {
                              console.warn(err);
                            }
                          }}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => editCoverFileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-emerald-400 font-bold text-xs"
                        >
                          Subir carátula desde PC
                        </button>
                        <input
                          type="url"
                          value={editCoverUrl}
                          onChange={(e) => setEditCoverUrl(e.target.value)}
                          placeholder="O pegar URL de imagen"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>

                    {/* Batch cover apply to album */}
                    {(() => {
                      const albumName = editAlbum.trim();
                      const isRealAlbum = albumName && albumName.toLowerCase() !== 'sencillo';
                      if (!isRealAlbum) return null;
                      const albumTracksCount = catalog.filter(
                        (s) => (s.album || '').trim().toLowerCase() === albumName.toLowerCase()
                      ).length;

                      return (
                        <div className="mt-2 p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between gap-3">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={applyCoverToAlbum}
                              onChange={(e) => setApplyCoverToAlbum(e.target.checked)}
                              className="w-4 h-4 rounded text-emerald-500 bg-neutral-950 border-neutral-700 focus:ring-emerald-500 focus:ring-offset-neutral-950"
                            />
                            <div className="text-xs">
                              <span className="font-semibold text-white flex items-center gap-1.5">
                                <Disc className="w-3.5 h-3.5 text-emerald-400" />
                                Aplicar carátula a todo el álbum ({albumTracksCount} canciones)
                              </span>
                              <span className="block text-[11px] text-neutral-400">
                                Al guardar, las canciones del álbum &quot;{albumName}&quot; tendrán esta carátula.
                              </span>
                            </div>
                          </label>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!editCoverUrl.trim()) {
                                alert('Por favor ingresa o sube una carátula primero.');
                                return;
                              }
                              const albumTarget = albumName.toLowerCase();
                              const newCover = editCoverUrl.trim();
                              const tracksToSync = catalog
                                .filter((s) => (s.album || '').trim().toLowerCase() === albumTarget)
                                .map((s) => ({ ...s, coverUrl: newCover }));

                              if (tracksToSync.length === 0) {
                                alert('No hay canciones encontradas para este álbum.');
                                return;
                              }

                              await updateMultipleCatalogTracks(tracksToSync);
                              alert(`¡Carátula aplicada exitosamente a ${tracksToSync.length} canciones del álbum "${albumName}"!`);
                            }}
                            className="shrink-0 px-2.5 py-1 text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-lg transition-colors"
                          >
                            Aplicar ahora
                          </button>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Audio URL */}
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1.5">Enlace de Audio (URL directa)</label>
                    <input
                      type="url"
                      required
                      value={editAudioUrl}
                      onChange={(e) => setEditAudioUrl(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Lyrics LRC */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-neutral-300">
                        Letras sincronizadas (.lrc) o texto
                      </label>
                      <input
                        type="file"
                        ref={editLrcFileInputRef}
                        accept=".lrc,.txt"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const txt = ev.target?.result as string;
                            if (txt) setEditLyricsLrc(txt);
                          };
                          reader.readAsText(file);
                        }}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => editLrcFileInputRef.current?.click()}
                        className="text-xs text-emerald-400 hover:underline"
                      >
                        Cargar archivo .lrc
                      </button>
                    </div>
                    <textarea
                      rows={5}
                      value={editLyricsLrc}
                      onChange={(e) => setEditLyricsLrc(e.target.value)}
                      placeholder="[00:05.00] Letra aquí..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <SongMediaEditor value={editMedia} onChange={setEditMedia} />

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
                    <button
                      type="button"
                      onClick={() => setEditingSong(null)}
                      className="px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs shadow-lg shadow-emerald-500/20"
                    >
                      Guardar Cambios
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
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

      <MetadataEnrichmentModal
        isOpen={isEnrichmentOpen}
        onClose={() => setIsEnrichmentOpen(false)}
      />
    </div>
  );
};
