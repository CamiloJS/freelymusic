import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  UploadCloud,
  Play,
  Pause,
  Check,
  AlertCircle,
  Music,
  Disc,
  FileCode,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  Trash2,
  ExternalLink,
  Plus,
  Layers,
  Radio,
  FileAudio
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { parseLrc, formatTime } from '../utils/lyrics';
import { compressImage } from '../utils/imageCompressor';
import { Song, LyricLine } from '../types';

interface AddMusicViewProps {
  onNavigate?: (tab: string) => void;
}

const COMMON_GENRES = [
  'Pop',
  'Rock',
  'Lo-Fi',
  'Synthwave',
  'Electrónica',
  'Urbano / Reggaeton',
  'Chillhop',
  'Indie',
  'Hip-Hop',
  'R&B',
  'Jazz',
  'Clásica',
];

export const AddMusicView: React.FC<AddMusicViewProps> = ({ onNavigate }) => {
  const { currentUser, isAdmin } = useAuth();
  const { catalog, addTrackToCatalog, deleteCatalogTrack } = useMusic();
  const { playSong, currentSong, isPlaying } = useAudio();

  // Form State
  const [audioUrl, setAudioUrl] = useState('');
  const [title, setTitle] = useState('');
  const [artistList, setArtistList] = useState<string[]>(['']);
  const [album, setAlbum] = useState('');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('2026');
  const [isExplicit, setIsExplicit] = useState<boolean>(false);
  const [coverUrl, setCoverUrl] = useState(
    'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=600&q=80'
  );
  const [lyricsLrc, setLyricsLrc] = useState('');
  const [detectedDuration, setDetectedDuration] = useState<number>(180);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectStatus, setDetectStatus] = useState<string | null>(null);

  const handleAddArtist = () => {
    setArtistList([...artistList, '']);
  };

  const handleRemoveArtist = (index: number) => {
    if (artistList.length <= 1) {
      setArtistList(['']);
    } else {
      setArtistList(artistList.filter((_, i) => i !== index));
    }
  };

  const handleArtistChange = (index: number, val: string) => {
    const updated = [...artistList];
    updated[index] = val;
    setArtistList(updated);
  };

  // In-page Audio Preview
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);

  // Success / Feedback
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Refs for file pickers
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const lrcFileInputRef = useRef<HTMLInputElement | null>(null);

  // Cleanup preview audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio.src = '';
      }
    };
  }, [previewAudio]);

  // Auto-detect metadata from URL
  const handleUrlBlur = () => {
    if (!audioUrl.trim()) return;

    try {
      const urlObj = new URL(audioUrl.trim());
      const filename = urlObj.pathname.split('/').pop() || '';
      const cleanName = decodeURIComponent(filename)
        .replace(/\.(mp3|wav|flac|m4a|aac|ogg)(\?.*)?$/i, '')
        .replace(/[_-]/g, ' ')
        .trim();

      if (cleanName && !title) {
        // If name has "Artist - Song", separate them
        if (cleanName.includes(' - ')) {
          const parts = cleanName.split(' - ');
          if (parts[0]) {
            const splitArtists = parts[0].split(/[,&]/).map((a) => a.trim()).filter(Boolean);
            if (splitArtists.length > 0) setArtistList(splitArtists);
          }
          if (parts[1]) setTitle(parts[1].trim());
        } else {
          setTitle(cleanName);
        }
      }
    } catch {
      // not a standard valid URL yet
    }

    // Automatically trigger duration detection if not yet detected
    detectAudioMetadata(audioUrl.trim());
  };

  // Detect audio duration and verify audio stream
  const detectAudioMetadata = (urlToTest: string) => {
    if (!urlToTest) return;
    setIsDetecting(true);
    setDetectStatus('Verificando enlace...');

    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = urlToTest;

    const timeout = setTimeout(() => {
      setIsDetecting(false);
      setDetectStatus('Enlace listo (duración estimada)');
    }, 6000);

    audio.onloadedmetadata = () => {
      clearTimeout(timeout);
      if (!isNaN(audio.duration) && audio.duration > 0) {
        setDetectedDuration(Math.round(audio.duration));
        setDetectStatus(`Duración detectada: ${formatTime(audio.duration)}`);
      } else {
        setDetectStatus('Enlace verificado');
      }
      setIsDetecting(false);
    };

    audio.onerror = () => {
      clearTimeout(timeout);
      setIsDetecting(false);
      setDetectStatus('Audio no detectable automáticamente, puedes asignarlo manual.');
    };
  };

  // Toggle in-page preview playback
  const handleTogglePreview = () => {
    if (!audioUrl) return;

    if (previewAudio) {
      if (isPlayingPreview) {
        previewAudio.pause();
        setIsPlayingPreview(false);
      } else {
        previewAudio.play().then(() => setIsPlayingPreview(true)).catch((e) => {
          console.warn('Preview error:', e);
          setIsPlayingPreview(false);
        });
      }
    } else {
      const newAudio = new Audio(audioUrl);
      newAudio.onended = () => {
        setIsPlayingPreview(false);
        setPreviewCurrentTime(0);
      };
      newAudio.ontimeupdate = () => {
        setPreviewCurrentTime(newAudio.currentTime);
      };
      newAudio.play().then(() => {
        setPreviewAudio(newAudio);
        setIsPlayingPreview(true);
      }).catch((err) => {
        console.warn('Could not play preview:', err);
        setErrorMessage('No se pudo reproducir la vista previa. Verifica el enlace directo.');
        setTimeout(() => setErrorMessage(''), 4000);
      });
    }
  };

  // Cover upload from computer with automatic compression
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

  // LRC file upload from computer
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

  // Save track to repository
  const handleSaveTrack = (e: React.FormEvent) => {
    e.preventDefault();
    const finalArtist = artistList.map((a) => a.trim()).filter(Boolean).join(', ');
    if (!audioUrl.trim() || !title.trim() || !finalArtist) {
      setErrorMessage('Por favor completa el enlace de audio, título y al menos un artista.');
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }

    try {
      const newSong = addTrackToCatalog({
        title: title.trim(),
        artist: finalArtist,
        album: album.trim() || 'Sencillo',
        genre: genre.trim() || 'General',
        year: year.trim() || '2026',
        coverUrl: coverUrl.trim(),
        audioUrl: audioUrl.trim(),
        duration: detectedDuration || 180,
        lyricsLrc: lyricsLrc.trim() || undefined,
        isExplicit: isExplicit,
      });

      setSuccessMessage(`¡"${newSong.title}" guardada exitosamente en el repositorio en la nube!`);
      
      // Stop preview audio if playing
      if (previewAudio) {
        previewAudio.pause();
        setIsPlayingPreview(false);
      }

      // Reset form
      setAudioUrl('');
      setTitle('');
      setArtistList(['']);
      setAlbum('');
      setGenre('');
      setIsExplicit(false);
      setLyricsLrc('');
      setDetectStatus(null);

      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al guardar la canción.');
      setTimeout(() => setErrorMessage(''), 4000);
    }
  };

  // Parse lyrics preview in real time
  const parsedLyricsPreview = useMemo(() => {
    if (!lyricsLrc.trim()) return [];
    return parseLrc(lyricsLrc).slice(0, 5);
  }, [lyricsLrc]);

  // Recent songs added to repository
  const recentCatalog = catalog.slice(0, 5);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto pb-36 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950/70 via-neutral-900 to-black p-6 md:p-8 rounded-3xl border border-emerald-500/20 shadow-2xl">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
            <UploadCloud className="w-4 h-4 text-emerald-400" />
            <span>Repositorio Global de Música</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            Añadir Música a la Nube
          </h1>
          <p className="text-neutral-400 text-xs md:text-sm max-w-2xl">
            Sube canciones mediante enlaces directos. Es 100% compatible con <strong className="text-emerald-400">File Garden</strong>, Dropbox, Notion, o cualquier URL de audio directa (.mp3, .flac, .wav, .m4a).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-neutral-950/80 px-4 py-2.5 rounded-2xl border border-neutral-800 text-xs text-neutral-300 flex items-center gap-2.5 shadow-inner">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <span className="font-extrabold text-white text-sm block">{catalog.length}</span>
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Pistas en la nube</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl flex items-center gap-3 text-emerald-300 text-sm font-bold shadow-lg animate-in fade-in">
          <Check className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-950/80 border border-red-500/50 rounded-2xl flex items-center gap-3 text-red-300 text-sm font-bold shadow-lg animate-in fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form Details (2 columns wide) */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveTrack} className="bg-neutral-900/50 border border-neutral-800/80 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl">
            {/* Step 1: Link Ingestion */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <FileAudio className="w-4 h-4" />
                  1. Enlace de Audio Directo (URL) *
                </label>
                {audioUrl && (
                  <button
                    type="button"
                    onClick={handleTogglePreview}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 transition-all"
                  >
                    {isPlayingPreview ? (
                      <>
                        <Pause className="w-3.5 h-3.5 fill-emerald-400" />
                        <span>Pausar Vista Previa</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-emerald-400" />
                        <span>Probar Enlace</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <input
                type="url"
                required
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                onBlur={handleUrlBlur}
                placeholder="https://filegarden.com/tu-usuario/cancion.mp3"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono shadow-inner transition-colors"
              />

              {/* Supported Platforms Hints */}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-neutral-500 font-medium">Recomendados:</span>
                <span className="text-[10px] bg-neutral-950 px-2 py-0.5 rounded-md border border-neutral-800 text-neutral-400 font-semibold">
                  File Garden (filegarden.com)
                </span>
                <span className="text-[10px] bg-neutral-950 px-2 py-0.5 rounded-md border border-neutral-800 text-neutral-400 font-semibold">
                  Dropbox (raw link)
                </span>
                <span className="text-[10px] bg-neutral-950 px-2 py-0.5 rounded-md border border-neutral-800 text-neutral-400 font-semibold">
                  Notion CDN
                </span>
                <span className="text-[10px] bg-neutral-950 px-2 py-0.5 rounded-md border border-neutral-800 text-neutral-400 font-semibold">
                  Direct MP3 / WAV / FLAC / M4A
                </span>
              </div>

              {detectStatus && (
                <div className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
                  <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isDetecting ? 'animate-spin' : ''}`} />
                  <span>{detectStatus}</span>
                </div>
              )}
            </div>

            {/* Step 2: Track Information */}
            <div className="border-t border-neutral-800/80 pt-5 space-y-4">
              <label className="text-xs font-black uppercase tracking-wider text-emerald-400 block">
                2. Metadata e Información del Tema
              </label>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                    Título de la Canción *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej. Blinding Lights"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Multiple Artists List (User requirement: botón añadir artista separado por comas) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-neutral-300">
                      Artistas y Colaboradores *
                    </label>
                    <button
                      type="button"
                      onClick={handleAddArtist}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-emerald-400 text-xs font-bold transition-colors border border-neutral-800"
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
                          onChange={(e) => handleArtistChange(idx, e.target.value)}
                          placeholder={idx === 0 ? "Artista principal (Ej. Aitana)" : "Artista colaborador (Ej. Kenia OS)"}
                          className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                        />
                        {artistList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveArtist(idx)}
                            className="p-2.5 rounded-xl bg-neutral-900 hover:bg-red-950/40 text-neutral-400 hover:text-red-400 border border-neutral-800 transition-colors"
                            title="Quitar artista"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {artistList.filter(Boolean).length > 1 && (
                    <p className="text-[11px] text-neutral-500">
                      Se guardará como: <span className="text-emerald-400 font-semibold">{artistList.filter(Boolean).join(', ')}</span>
                    </p>
                  )}
                </div>

                {/* Explicit Content Toggle (E) */}
                <div
                  onClick={() => setIsExplicit(!isExplicit)}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    isExplicit
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
                      <span className="text-[11px] text-neutral-400 block">Indica con una insignia "E" si la canción contiene letras explícitas</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isExplicit}
                    onChange={(e) => setIsExplicit(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                    Álbum
                  </label>
                  <input
                    type="text"
                    value={album}
                    onChange={(e) => setAlbum(e.target.value)}
                    placeholder="Sencillo / After Hours"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5">
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
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5">
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

              {/* Genre Selection & Chips */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                  Género Musical (para Recomendación IA)
                </label>
                <input
                  type="text"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="Ej. Synthwave, Pop, Lo-Fi..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {COMMON_GENRES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGenre(g)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                        genre.toLowerCase() === g.toLowerCase()
                          ? 'bg-emerald-500 text-black font-bold shadow'
                          : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 3: Synced Lyrics (.LRC) */}
            <div className="border-t border-neutral-800/80 pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <FileCode className="w-4 h-4" />
                    3. Letras Sincronizadas (.LRC) (opcional)
                  </label>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Formato estándar [mm:ss.xx] Texto. Se sincronizan en vivo durante la reproducción.
                  </p>
                </div>

                <div>
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-emerald-400 text-xs font-bold transition-colors"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    Subir archivo .LRC de tu PC
                  </button>
                </div>
              </div>

              <textarea
                rows={4}
                value={lyricsLrc}
                onChange={(e) => setLyricsLrc(e.target.value)}
                placeholder="[00:05.00] Primera estrofa de la canción...&#10;[00:15.50] Segunda línea sincronizada..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs font-mono text-neutral-300 focus:outline-none focus:border-emerald-500"
              />

              {parsedLyricsPreview.length > 0 && (
                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800/80 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                    Vista previa de sincronización ({parsedLyricsPreview.length} líneas detectadas)
                  </span>
                  {parsedLyricsPreview.map((line: LyricLine, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-neutral-500 text-[10px]">{formatTime(line.time)}</span>
                      <span className="text-neutral-200">{line.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm tracking-wide shadow-xl shadow-emerald-500/25 transition-all transform active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5 stroke-[3]" />
                <span>Guardar Canción en el Catálogo Global</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Cover Preview & Recent Uploads */}
        <div className="space-y-6">
          {/* Cover Art Card */}
          <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-3xl p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-emerald-400" />
              <span>Carátula / Portada</span>
            </h3>

            {/* Cover Image Preview */}
            <div className="aspect-square w-full rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 relative group shadow-2xl">
              <img
                src={coverUrl}
                alt="Preview"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => coverFileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-black text-xs font-bold shadow-lg"
                >
                  Cambiar Imagen
                </button>
              </div>
            </div>

            {/* Cover Controls */}
            <div className="space-y-2">
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
                className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-emerald-400 font-bold text-xs tracking-wide transition-colors flex items-center justify-center gap-2"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Subir carátula desde tu PC</span>
              </button>

              <div className="pt-1">
                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                  O pegar URL de imagen:
                </label>
                <input
                  type="url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Quick Recent Ingestions */}
          <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Music className="w-4 h-4 text-emerald-400" />
                <span>Pistas Recientes en la Nube</span>
              </h3>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('cloud')}
                  className="text-xs text-neutral-400 hover:text-emerald-400 font-bold transition-colors"
                >
                  Ver todas
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {recentCatalog.length === 0 ? (
                <p className="text-xs text-neutral-500 italic">No hay pistas registradas aún.</p>
              ) : (
                recentCatalog.map((song) => {
                  const isCurrent = currentSong?.id === song.id;
                  return (
                    <div
                      key={song.id}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-neutral-950/70 border border-neutral-800/60 hover:border-neutral-700 group transition-all"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <img
                          src={song.coverUrl}
                          alt={song.title}
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            {song.isExplicit && (
                              <span
                                className="inline-flex items-center justify-center w-3 h-3 rounded bg-neutral-600/80 text-black text-[8px] font-black flex-shrink-0 select-none leading-none"
                                title="Contenido explícito"
                              >
                                E
                              </span>
                            )}
                            <span
                              className={`block font-bold text-xs truncate ${
                                isCurrent ? 'text-emerald-400' : 'text-white'
                              }`}
                            >
                              {song.title}
                            </span>
                          </div>
                          <span className="block text-[10px] text-neutral-400 truncate">
                            {song.artist}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => playSong(song, recentCatalog)}
                          className="p-2 rounded-xl bg-neutral-800 hover:bg-emerald-500 hover:text-black text-white transition-colors"
                          title="Reproducir"
                        >
                          {isCurrent && isPlaying ? (
                            <span className="w-2.5 h-2.5 bg-black rounded-sm block" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current" />
                          )}
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => {
                              if (confirm(`¿Eliminar "${song.title}" del catálogo?`)) {
                                deleteCatalogTrack(song.id);
                              }
                            }}
                            className="p-2 rounded-xl text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                            title="Eliminar de la nube"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
