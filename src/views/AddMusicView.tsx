import React, { useState, useRef, useEffect, useMemo } from 'react';
import UploadCloud from 'lucide-react/dist/esm/icons/cloud-upload.mjs';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Pause from 'lucide-react/dist/esm/icons/pause.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import AlertCircle from 'lucide-react/dist/esm/icons/circle-alert.mjs';
import Music from 'lucide-react/dist/esm/icons/eighth-notes.mjs';
import Disc from 'lucide-react/dist/esm/icons/disc.mjs';
import FileCode from 'lucide-react/dist/esm/icons/file-code.mjs';
import ImageIcon from 'lucide-react/dist/esm/icons/image.mjs';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.mjs';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.mjs';
import Trash2 from 'lucide-react/dist/esm/icons/trash.mjs';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link.mjs';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import Layers from 'lucide-react/dist/esm/icons/layers.mjs';
import Radio from 'lucide-react/dist/esm/icons/radio.mjs';
import FileAudio from 'lucide-react/dist/esm/icons/file-headphone.mjs';
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up.mjs';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.mjs';
import Sliders from 'lucide-react/dist/esm/icons/sliders-vertical.mjs';
import ListOrdered from 'lucide-react/dist/esm/icons/list-ordered.mjs';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { parseLrc, formatTime } from '../utils/lyrics';
import { compressImage } from '../utils/imageCompressor';
import { SongMediaEditor, SongMediaValue, EMPTY_SONG_MEDIA } from '../components/SongMediaEditor';
import { enrichSongMetadata, searchLyrics, searchCover } from '../services/metadataEnrichment';
import { detectAudioDuration } from '../utils/audioDuration';
import { parseAudioUrlMetadata, cleanArtistSeparators, splitArtistNames } from '../utils/urlMetadataParser';
import {
  extractMetadataFromAudioSource,
  autoDetectCover,
  autoDetectAlbumCover,
  autoDetectOnlineMetadata,
} from '../utils/audioCoverExtractor';
import { Song, LyricLine } from '../types';

interface AddMusicViewProps {
  onNavigate?: (tab: string) => void;
}

interface AlbumTrackDraft {
  id: string;
  title: string;
  audioUrl: string;
  artist?: string;
  duration: number;
  isExplicit: boolean;
  lyricsLrc: string;
  isConfigOpen?: boolean;
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
  const {
    catalog,
    addTrackToCatalog,
    addMultipleTracksToCatalog,
    deleteCatalogTrack,
    updateCatalogTrack,
  } = useMusic();
  const { playSong, currentSong, isPlaying } = useAudio();

  // Mode: Single vs Album
  const [uploadMode, setUploadMode] = useState<'single' | 'album'>('single');

  // Single Song Form State
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
  const [detectedDuration, setDetectedDuration] = useState<number>(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectStatus, setDetectStatus] = useState<string | null>(null);
  const [songMedia, setSongMedia] = useState<SongMediaValue>({ ...EMPTY_SONG_MEDIA });
  const [autoEnrich, setAutoEnrich] = useState(true);
  const [isSearchingCover, setIsSearchingCover] = useState(false);
  const [isSearchingAlbumCover, setIsSearchingAlbumCover] = useState(false);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);

  // Album Form State
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumArtistList, setAlbumArtistList] = useState<string[]>(['']);
  const [albumGenre, setAlbumGenre] = useState('');
  const [albumYear, setAlbumYear] = useState('2026');
  const [albumCoverUrl, setAlbumCoverUrl] = useState(
    'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=600&q=80'
  );
  const [albumTracks, setAlbumTracks] = useState<AlbumTrackDraft[]>([
    { id: '1', title: '', audioUrl: '', duration: 0, isExplicit: false, lyricsLrc: '', isConfigOpen: false },
    { id: '2', title: '', audioUrl: '', duration: 0, isExplicit: false, lyricsLrc: '', isConfigOpen: false },
  ]);
  const [bulkTrackCountInput, setBulkTrackCountInput] = useState('5');
  const [isSavingAlbum, setIsSavingAlbum] = useState(false);

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
    if (val.includes('/') || val.includes('\\')) {
      const parts = val.split(/\s*[\/\\]+\s*/).map((p) => p.trim()).filter(Boolean);
      if (parts.length > 1) {
        setArtistList((prev) => {
          const next = [...prev];
          next[index] = parts[0];
          next.splice(index + 1, 0, ...parts.slice(1));
          return next;
        });
        return;
      }
    }
    const updated = [...artistList];
    updated[index] = val;
    setArtistList(updated);
  };

  // Album artist handlers
  const handleAddAlbumArtist = () => {
    setAlbumArtistList([...albumArtistList, '']);
  };

  const handleRemoveAlbumArtist = (index: number) => {
    if (albumArtistList.length <= 1) {
      setAlbumArtistList(['']);
    } else {
      setAlbumArtistList(albumArtistList.filter((_, i) => i !== index));
    }
  };

  const handleAlbumArtistChange = (index: number, val: string) => {
    if (val.includes('/') || val.includes('\\')) {
      const parts = val.split(/\s*[\/\\]+\s*/).map((p) => p.trim()).filter(Boolean);
      if (parts.length > 1) {
        setAlbumArtistList((prev) => {
          const next = [...prev];
          next[index] = parts[0];
          next.splice(index + 1, 0, ...parts.slice(1));
          return next;
        });
        return;
      }
    }
    const updated = [...albumArtistList];
    updated[index] = val;
    setAlbumArtistList(updated);
  };

  // Album track handlers
  const handleAddAlbumTrack = () => {
    setAlbumTracks((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        title: '',
        audioUrl: '',
        duration: 0,
        isExplicit: false,
        lyricsLrc: '',
        isConfigOpen: false,
      },
    ]);
  };

  const handleRemoveAlbumTrack = (index: number) => {
    if (albumTracks.length <= 1) return;
    setAlbumTracks(albumTracks.filter((_, idx) => idx !== index));
  };

  const handleMoveTrack = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === albumTracks.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newTracks = [...albumTracks];
    const [moved] = newTracks.splice(index, 1);
    newTracks.splice(targetIndex, 0, moved);
    setAlbumTracks(newTracks);
  };

  const handleUpdateAlbumTrack = (index: number, updates: Partial<AlbumTrackDraft>) => {
    let finalUpdates = { ...updates };
    if (typeof updates.title === 'string') {
      const rawTitle = updates.title;
      if (/[\(\[]\s*(?:explicit|dirty|uncensored|explicito|explícito|e)\s*[\)\]]/i.test(rawTitle)) {
        finalUpdates.isExplicit = true;
        finalUpdates.title = rawTitle.replace(/[\(\[]\s*(?:explicit|dirty|uncensored|explicito|explícito|e)\s*[\)\]]/gi, '').trim();
      }
    }

    setAlbumTracks((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...finalUpdates };
      return updated;
    });

    // Auto-detect metadata, duration and LRCLIB lyrics whenever audioUrl changes
    if (updates.audioUrl && updates.audioUrl.trim()) {
      const targetUrl = updates.audioUrl.trim();

      // 1. Duration detection
      void detectAudioDuration(targetUrl).then((dur) => {
        if (dur > 0) {
          setAlbumTracks((prev) => {
            const next = [...prev];
            if (next[index] && next[index].audioUrl.trim() === targetUrl) {
              next[index] = { ...next[index], duration: dur };
            }
            return next;
          });
        }
      });

      // 2. Title & Artist parsing from URL filename
      const parsed = parseAudioUrlMetadata(targetUrl);
      const current = albumTracks[index];

      const needTitle = !current?.title?.trim() && Boolean(parsed.title);
      const detectedAlbumArt = albumArtistList.filter(Boolean).map(cleanArtistSeparators).join(', ');
      const needArtist = !current?.artist?.trim() && parsed.artists.length > 0;
      const finalTrackArtist = needArtist ? parsed.artists.join(', ') : (cleanArtistSeparators(current?.artist || '') || detectedAlbumArt);
      const finalTrackTitle = needTitle ? parsed.title : (current?.title || '');
      const needExplicit = current?.isExplicit === false && Boolean(parsed.isExplicit);

      if (needTitle || needArtist || needExplicit) {
        setAlbumTracks((prev) => {
          const next = [...prev];
          if (next[index] && next[index].audioUrl.trim() === targetUrl) {
            next[index] = {
              ...next[index],
              ...(needTitle ? { title: parsed.title } : {}),
              ...(needArtist ? { artist: parsed.artists.join(', ') } : {}),
              ...(needExplicit ? { isExplicit: true } : {}),
            };
          }
          return next;
        });
      }

      // 3. Search LRCLIB for synced lyrics automatically
      if (finalTrackTitle && finalTrackArtist && (!current?.lyricsLrc || !current.lyricsLrc.trim())) {
        void searchLyrics(finalTrackTitle, finalTrackArtist, albumTitle.trim() || undefined).then((lrc) => {
          if (lrc) {
            setAlbumTracks((prev) => {
              const next = [...prev];
              if (next[index] && next[index].audioUrl.trim() === targetUrl && !next[index].lyricsLrc) {
                next[index] = { ...next[index], lyricsLrc: lrc };
              }
              return next;
            });
          }
        });
      }

      // 4. Extract embedded cover art, Year, Genre, Explicit & ID3 tags from audio file
      void (async () => {
        try {
          const extracted = await extractMetadataFromAudioSource(targetUrl);
          if (extracted) {
            if (index === 0 && extracted.coverUrl && albumCoverUrl.includes('images.unsplash.com')) {
              setAlbumCoverUrl(extracted.coverUrl);
            }
            if (!albumTitle.trim() && extracted.album) {
              setAlbumTitle(extracted.album);
            }
            if (extracted.year && (!albumYear.trim() || albumYear === '2026')) {
              setAlbumYear(extracted.year);
            }
            if (extracted.genre && !albumGenre.trim()) {
              setAlbumGenre(extracted.genre);
            }
            if (albumArtistList.filter(Boolean).length === 0 && extracted.artist) {
              const splitArts = splitArtistNames(extracted.artist);
              if (splitArts.length > 0) setAlbumArtistList(splitArts);
            }
            setAlbumTracks((prev) => {
              const next = [...prev];
              if (next[index] && next[index].audioUrl.trim() === targetUrl) {
                const trackArts = extracted.artist ? splitArtistNames(extracted.artist).join(', ') : '';
                next[index] = {
                  ...next[index],
                  title: next[index].title || extracted.title || '',
                  artist: next[index].artist || trackArts || '',
                  lyricsLrc: next[index].lyricsLrc || extracted.lyrics || '',
                  isExplicit: next[index].isExplicit || Boolean(extracted.isExplicit),
                };
              }
              return next;
            });
          }

          // Check online explicit status for album track
          if (finalTrackTitle && finalTrackArtist) {
            void autoDetectOnlineMetadata(finalTrackTitle, finalTrackArtist, albumTitle.trim() || undefined).then((trkMeta) => {
              if (trkMeta?.isExplicit) {
                setAlbumTracks((prev) => {
                  const next = [...prev];
                  if (next[index] && next[index].audioUrl.trim() === targetUrl) {
                    next[index] = { ...next[index], isExplicit: true };
                  }
                  return next;
                });
              }
            });
          }

          // In addition, if album cover/year/genre are still empty, query online metadata
          const effAlbum = albumTitle.trim() || extracted?.album || '';
          const effArtist = albumArtistList.filter(Boolean)[0] || (extracted?.artist ? splitArtistNames(extracted.artist)[0] : '');
          if (effAlbum || effArtist) {
            const onlineMeta = await autoDetectOnlineMetadata('', effArtist, effAlbum, true);
            if (onlineMeta) {
              if (onlineMeta.coverUrl && albumCoverUrl.includes('images.unsplash.com')) {
                setAlbumCoverUrl(onlineMeta.coverUrl);
              }
              if (onlineMeta.year && (!albumYear.trim() || albumYear === '2026')) {
                setAlbumYear(onlineMeta.year);
              }
              if (onlineMeta.genre && !albumGenre.trim()) {
                setAlbumGenre(onlineMeta.genre);
              }
            }
          }
        } catch {
          // non-blocking
        }
      })();
    }
  };

  const handleSetBulkTrackCount = (count: number) => {
    if (isNaN(count) || count < 1 || count > 50) return;
    setAlbumTracks((prev) => {
      if (count <= prev.length) {
        return prev.slice(0, count);
      }
      const added: AlbumTrackDraft[] = [];
      for (let i = prev.length; i < count; i++) {
        added.push({
          id: Math.random().toString(36).substring(2, 9),
          title: '',
          audioUrl: '',
          duration: 0,
          isExplicit: false,
          lyricsLrc: '',
          isConfigOpen: false,
        });
      }
      return [...prev, ...added];
    });
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

  // Auto-detect metadata (Title, Artists, LRCLIB lyrics, cover, Year, Genre, Explicit) from URL or File
  const handleAudioUrlChange = async (newUrl: string) => {
    setAudioUrl(newUrl);
    if (!newUrl.trim()) return;

    const trimmedUrl = newUrl.trim();
    const parsed = parseAudioUrlMetadata(trimmedUrl);

    let currentTitle = title.trim();
    let currentArtists = artistList.filter(Boolean);

    if (!currentTitle && parsed.title) {
      setTitle(parsed.title);
      currentTitle = parsed.title;
    }

    if (currentArtists.length === 0 && parsed.artists.length > 0) {
      setArtistList(parsed.artists);
      currentArtists = parsed.artists;
    }

    if (parsed.year && (!year.trim() || year === '2026')) {
      setYear(parsed.year);
    }
    if (parsed.isExplicit) {
      setIsExplicit(true);
    }

    // Automatically trigger duration detection
    detectAudioMetadata(trimmedUrl);

    // 1. First, attempt to extract embedded cover art & ID3 / FLAC tags from audio stream
    setDetectStatus('Analizando archivo y extrayendo metadatos...');
    try {
      const extracted = await extractMetadataFromAudioSource(trimmedUrl);
      if (extracted) {
        if (extracted.coverUrl && (coverUrl.includes('images.unsplash.com') || !coverUrl)) {
          setCoverUrl(extracted.coverUrl);
        }
        if (!currentTitle && extracted.title) {
          setTitle(extracted.title);
          currentTitle = extracted.title;
        }
        if (extracted.artist) {
          const splitArts = splitArtistNames(extracted.artist);
          if (currentArtists.length === 0 && splitArts.length > 0) {
            setArtistList(splitArts);
            currentArtists = splitArts;
          }
        }
        if (!album.trim() && extracted.album) {
          setAlbum(extracted.album);
        }
        if (!genre.trim() && extracted.genre) {
          setGenre(extracted.genre);
        }
        if (extracted.year && (!year.trim() || year === '2026')) {
          setYear(extracted.year);
        }
        if (extracted.isExplicit) {
          setIsExplicit(true);
        }
        if (!lyricsLrc.trim() && extracted.lyrics) {
          setLyricsLrc(extracted.lyrics);
        }
        setDetectStatus('✓ Metadatos y etiquetas extraídos del archivo de audio');
      }
    } catch {
      // non-blocking
    }

    // 2. Online search for lyrics, cover, release year, genre, and explicit rating
    const primaryArt = currentArtists[0] || (parsed.artists[0] ?? '');
    if (currentTitle && primaryArt) {
      void (async () => {
        try {
          if (!lyricsLrc.trim()) {
            setDetectStatus('Buscando letra sincronizada en LRCLIB...');
            const lrc = await searchLyrics(currentTitle, primaryArt, album.trim() || undefined);
            if (lrc) {
              setLyricsLrc(lrc);
            }
          }

          setDetectStatus('Detectando metadatos en línea (Año, Género, Carátula, Explícito)...');
          const onlineMeta = await autoDetectOnlineMetadata(currentTitle, primaryArt, album.trim() || undefined);
          if (onlineMeta) {
            if (onlineMeta.coverUrl && (coverUrl.includes('images.unsplash.com') || !coverUrl)) {
              setCoverUrl(onlineMeta.coverUrl);
            }
            if (onlineMeta.year && (!year.trim() || year === '2026')) {
              setYear(onlineMeta.year);
            }
            if (onlineMeta.genre && !genre.trim()) {
              setGenre(onlineMeta.genre);
            }
            if (onlineMeta.isExplicit) {
              setIsExplicit(true);
            }
            setDetectStatus('✓ Metadatos y carátula obtenidos automáticamente');
            setTimeout(() => setDetectStatus(null), 3500);
          }
        } catch {
          // non-blocking
        }
      })();
    }
  };

  const handleUrlBlur = () => {
    handleAudioUrlChange(audioUrl);
  };

  // Blur handler on title/artist to auto-search metadata & cover if still default
  const handleSingleMetadataBlur = async () => {
    const art = artistList.filter(Boolean)[0] || '';
    if (title.trim() && art) {
      try {
        const meta = await autoDetectOnlineMetadata(title.trim(), art, album.trim() || undefined);
        if (meta.coverUrl && (coverUrl.includes('images.unsplash.com') || !coverUrl)) {
          setCoverUrl(meta.coverUrl);
        }
        if (meta.year && (!year.trim() || year === '2026')) {
          setYear(meta.year);
        }
        if (meta.genre && !genre.trim()) {
          setGenre(meta.genre);
        }
        if (meta.isExplicit) {
          setIsExplicit(true);
        }
        setDetectStatus('✓ Metadatos actualizados automáticamente');
        setTimeout(() => setDetectStatus(null), 3500);
      } catch {
        // non-blocking
      }
    }
  };

  // Blur handler on album fields to auto-search album cover and album metadata
  const handleAlbumMetadataBlur = async () => {
    const art = albumArtistList.filter(Boolean)[0] || '';
    if (albumTitle.trim() || art) {
      try {
        const meta = await autoDetectOnlineMetadata('', art, albumTitle.trim(), true);
        if (meta.coverUrl && (albumCoverUrl.includes('images.unsplash.com') || !albumCoverUrl)) {
          setAlbumCoverUrl(meta.coverUrl);
        }
        if (meta.year && (!albumYear.trim() || albumYear === '2026')) {
          setAlbumYear(meta.year);
        }
        if (meta.genre && !albumGenre.trim()) {
          setAlbumGenre(meta.genre);
        }
      } catch {
        // non-blocking
      }
    }
  };

  // Manual button: auto-detect single song cover
  const handleAutoDetectCover = async () => {
    const primaryArt = artistList.filter(Boolean)[0] || '';
    if (!title.trim() && !primaryArt) {
      setErrorMessage('Ingresa al menos el título o artista para detectar la carátula.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    setIsSearchingCover(true);
    setDetectStatus('Buscando carátula en alta definición (iTunes/Deezer)...');
    try {
      const detected = await autoDetectCover(title.trim(), primaryArt, album.trim() || undefined);
      if (detected) {
        setCoverUrl(detected);
        setDetectStatus('✓ Carátula encontrada y aplicada con éxito');
      } else {
        setDetectStatus('No se encontró carátula en línea para este título.');
      }
    } catch {
      setDetectStatus('Error al buscar carátula.');
    } finally {
      setIsSearchingCover(false);
      setTimeout(() => setDetectStatus(null), 4000);
    }
  };

  // Manual button: extract cover from audio file/URL
  const handleExtractFromFileOrUrl = async (source?: string | File) => {
    const target = source || audioUrl;
    if (!target) {
      setErrorMessage('Ingresa un enlace de audio o selecciona un archivo para extraer su carátula.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    setIsSearchingCover(true);
    setDetectStatus('Extrayendo carátula y metadatos del archivo de audio...');
    try {
      const extracted = await extractMetadataFromAudioSource(target);
      let detectedExplicit = extracted?.isExplicit;
      let detectedYear = extracted?.year;
      let detectedGenre = extracted?.genre;

      if (extracted?.coverUrl) {
        setCoverUrl(extracted.coverUrl);
      }
      if (!title.trim() && extracted?.title) setTitle(extracted.title);
      if (extracted?.artist && artistList.filter(Boolean).length === 0) {
        const parts = splitArtistNames(cleanArtistSeparators(extracted.artist));
        if (parts.length > 0) setArtistList(parts);
      }
      if (!album.trim() && extracted?.album) setAlbum(extracted.album);
      if (!genre.trim() && detectedGenre) setGenre(detectedGenre);
      if (!year.trim() && detectedYear) setYear(detectedYear);
      if (detectedExplicit !== undefined) setIsExplicit(Boolean(detectedExplicit));
      if (!lyricsLrc.trim() && extracted?.lyrics) setLyricsLrc(extracted.lyrics);

      // If online cover or tags can complement missing data
      const effectiveTitle = title.trim() || extracted?.title || '';
      const effectiveArtist = artistList.filter(Boolean)[0] || extracted?.artist || '';
      if (effectiveTitle && effectiveArtist && (!extracted?.coverUrl || !detectedGenre || !detectedYear)) {
        try {
          const onlineMeta = await autoDetectOnlineMetadata(effectiveTitle, effectiveArtist, album.trim() || undefined);
          if (!extracted?.coverUrl && onlineMeta.coverUrl) {
            setCoverUrl(onlineMeta.coverUrl);
          }
          if (!detectedYear && onlineMeta.year && (!year.trim() || year === '2026')) {
            setYear(onlineMeta.year);
          }
          if (!detectedGenre && onlineMeta.genre && !genre.trim()) {
            setGenre(onlineMeta.genre);
          }
          if (detectedExplicit === undefined && onlineMeta.isExplicit !== undefined) {
            setIsExplicit(onlineMeta.isExplicit);
          }
        } catch {
          // non-blocking
        }
      }

      if (extracted?.coverUrl) {
        setDetectStatus('✓ Carátula y metadatos extraídos con éxito');
      } else {
        setDetectStatus('✓ Metadatos procesados');
      }
    } catch {
      setDetectStatus('No se pudo extraer carátula del archivo.');
    } finally {
      setIsSearchingCover(false);
      setTimeout(() => setDetectStatus(null), 4000);
    }
  };

  // Manual button: auto-detect album cover
  const handleAutoDetectAlbumCover = async () => {
    const primaryAlbumArt = albumArtistList.filter(Boolean)[0] || '';
    if (!albumTitle.trim() && !primaryAlbumArt) {
      setErrorMessage('Ingresa al menos el título del álbum o artista.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    setIsSearchingAlbumCover(true);
    try {
      const meta = await autoDetectOnlineMetadata('', primaryAlbumArt, albumTitle.trim(), true);
      if (meta.coverUrl) {
        setAlbumCoverUrl(meta.coverUrl);
        if (meta.year && (!albumYear.trim() || albumYear === '2026')) {
          setAlbumYear(meta.year);
        }
        if (meta.genre && !albumGenre.trim()) {
          setAlbumGenre(meta.genre);
        }
        setSuccessMessage('✓ Carátula y metadatos del álbum detectados automáticamente');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        const detected = await autoDetectAlbumCover(albumTitle.trim(), primaryAlbumArt);
        if (detected) {
          setAlbumCoverUrl(detected);
          setSuccessMessage('✓ Carátula del álbum detectada automáticamente');
          setTimeout(() => setSuccessMessage(''), 3000);
        } else {
          setErrorMessage('No se encontró carátula para este álbum.');
          setTimeout(() => setErrorMessage(''), 3000);
        }
      }
    } catch {
      setErrorMessage('Error al buscar carátula del álbum.');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setIsSearchingAlbumCover(false);
    }
  };

  // Manual button: extract album cover from track 1
  const handleExtractAlbumCoverFromTrack1 = async () => {
    const track1 = albumTracks[0];
    if (!track1?.audioUrl?.trim()) {
      setErrorMessage('Ingresa el enlace de la Pista #1 para extraer su carátula.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    setIsSearchingAlbumCover(true);
    try {
      const extracted = await extractMetadataFromAudioSource(track1.audioUrl.trim());
      if (extracted?.coverUrl) {
        setAlbumCoverUrl(extracted.coverUrl);
        if (!albumTitle.trim() && extracted.album) setAlbumTitle(extracted.album);
        if (albumArtistList.filter(Boolean).length === 0 && extracted.artist) {
          const parts = splitArtistNames(cleanArtistSeparators(extracted.artist));
          if (parts.length > 0) setAlbumArtistList(parts);
        }
        if (extracted.year && (!albumYear.trim() || albumYear === '2026')) {
          setAlbumYear(extracted.year);
        }
        if (extracted.genre && !albumGenre.trim()) {
          setAlbumGenre(extracted.genre);
        }
        setSuccessMessage('✓ Carátula y metadatos extraídos de la Pista #1 del álbum');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        await handleAutoDetectAlbumCover();
      }
    } catch {
      await handleAutoDetectAlbumCover();
    } finally {
      setIsSearchingAlbumCover(false);
    }
  };

  // Detect audio duration and verify audio stream automatically
  const detectAudioMetadata = async (urlToTest: string) => {
    if (!urlToTest) return;
    setIsDetecting(true);
    setDetectStatus('Detectando duración...');

    try {
      const dur = await detectAudioDuration(urlToTest);
      if (dur > 0) {
        setDetectedDuration(dur);
        setDetectStatus(`Duración detectada: ${formatTime(dur)}`);
      } else {
        setDetectStatus('Enlace listo');
      }
    } catch {
      setDetectStatus('Enlace listo');
    } finally {
      setIsDetecting(false);
    }
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
    const finalArtist = artistList
      .map(cleanArtistSeparators)
      .flatMap(splitArtistNames)
      .map((a) => a.trim())
      .filter(Boolean)
      .join(', ');
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
        duration: detectedDuration || 0,
        lyricsLrc: lyricsLrc.trim() || undefined,
        isExplicit: isExplicit,
        videoUrl: songMedia.videoUrl.trim() || undefined,
        instrumentalUrl: songMedia.instrumentalUrl.trim() || undefined,
        instrumentalOffset: songMedia.instrumentalOffset || undefined,
        instrumentalLyricsLrc: songMedia.instrumentalLyricsLrc.trim() || undefined,
        versions: songMedia.versions
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
      });

      setSuccessMessage(`¡"${newSong.title}" guardada exitosamente en el repositorio en la nube!`);

      if (autoEnrich) {
        void enrichSongMetadata(newSong)
          .then((result) => {
            if (Object.keys(result.updated).length === 0) return;

            updateCatalogTrack({
              ...newSong,
              ...result.updated,
              needsReview: undefined,
              enrichmentNote: undefined,
            });

            setSuccessMessage(
              `¡"${newSong.title}" guardada! Metadatos completados con ${result.sources.join(
                ', '
              ) || 'fuentes públicas'}.`
            );
            setTimeout(() => setSuccessMessage(''), 6000);
          })
          .catch((err) => console.warn('No se pudieron completar los metadatos:', err));
      }

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
      setSongMedia({ ...EMPTY_SONG_MEDIA });

      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al guardar la canción.');
      setTimeout(() => setErrorMessage(''), 4000);
    }
  };

  const albumCoverFileInputRef = useRef<HTMLInputElement | null>(null);

  // Album cover upload from computer
  const handleAlbumCoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, 500, 0.8);
      if (compressed) {
        setAlbumCoverUrl(compressed);
      }
    } catch (err) {
      console.warn('Error comprimiendo carátula de álbum:', err);
    }
  };

  // Save full album
  const handleSaveAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalAlbumArtist = albumArtistList
      .map(cleanArtistSeparators)
      .flatMap(splitArtistNames)
      .map((a) => a.trim())
      .filter(Boolean)
      .join(', ');
    if (!albumTitle.trim() || !finalAlbumArtist) {
      setErrorMessage('Por favor ingresa el título del álbum y al menos un artista.');
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }
    if (albumTracks.length === 0) {
      setErrorMessage('El álbum debe tener al menos una pista.');
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }

    // Validate tracks
    for (let i = 0; i < albumTracks.length; i++) {
      const t = albumTracks[i];
      if (!t.title.trim() || !t.audioUrl.trim()) {
        setErrorMessage(`La pista #${i + 1} debe tener título y enlace directo de audio.`);
        setTimeout(() => setErrorMessage(''), 4000);
        return;
      }
    }

    setIsSavingAlbum(true);
    try {
      const tracksToSave = albumTracks.map((t, idx) => ({
        title: t.title.trim(),
        artist: t.artist?.trim()
          ? splitArtistNames(cleanArtistSeparators(t.artist.trim())).join(', ')
          : finalAlbumArtist,
        album: albumTitle.trim(),
        albumArtist: finalAlbumArtist,
        genre: albumGenre.trim() || 'General',
        year: albumYear.trim() || '2026',
        coverUrl: albumCoverUrl.trim(),
        audioUrl: t.audioUrl.trim(),
        duration: t.duration || 0,
        lyricsLrc: t.lyricsLrc?.trim() || undefined,
        isExplicit: t.isExplicit,
        trackNumber: idx + 1,
      }));

      const savedTracks = await addMultipleTracksToCatalog(tracksToSave);
      setSuccessMessage(`¡Álbum "${albumTitle}" con ${tracksToSave.length} pistas guardado exitosamente en el catálogo global!`);

      if (autoEnrich && savedTracks.length > 0) {
        // Run in the background so a long album does not block the form.
        void (async () => {
          for (const track of savedTracks) {
            try {
              const result = await enrichSongMetadata(track);
              if (Object.keys(result.updated).length > 0) {
                updateCatalogTrack({
                  ...track,
                  ...result.updated,
                  needsReview: undefined,
                  enrichmentNote: undefined,
                });
              }
            } catch (err) {
              console.warn(`No se pudieron completar los metadatos de ${track.title}:`, err);
            }
          }
        })();
      }

      // Reset
      setAlbumTitle('');
      setAlbumArtistList(['']);
      setAlbumGenre('');
      setAlbumTracks([
        { id: '1', title: '', audioUrl: '', duration: 0, isExplicit: false, lyricsLrc: '', isConfigOpen: false },
        { id: '2', title: '', audioUrl: '', duration: 0, isExplicit: false, lyricsLrc: '', isConfigOpen: false },
      ]);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al guardar el álbum.');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setIsSavingAlbum(false);
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
            Sube canciones individuales o álbumes completos mediante enlaces directos. Es 100% compatible con <strong className="text-emerald-400">File Garden</strong>, Dropbox, Notion, o cualquier URL de audio directa (.mp3, .flac, .wav, .m4a).
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

      {/* Mode Switcher: Canción Individual vs Álbum Completo */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-neutral-900/90 border border-neutral-800 rounded-2xl w-fit shadow-lg">
        <button
          type="button"
          onClick={() => setUploadMode('single')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all ${
            uploadMode === 'single'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/25'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Music className="w-4 h-4" />
          <span>Canción Individual (Sencillo)</span>
        </button>

        <button
          type="button"
          onClick={() => setUploadMode('album')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all ${
            uploadMode === 'album'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/25'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Disc className="w-4 h-4" />
          <span>Álbum Completo (Múltiples Pistas)</span>
        </button>
      </div>

      {/* Main Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form Details (2 columns wide) */}
        <div className="lg:col-span-2 space-y-6">
          {uploadMode === 'single' ? (
            /* Single Track Form */
            <form onSubmit={handleSaveTrack} className="bg-neutral-900/50 border border-neutral-800/80 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl">
              {/* Step 1: Link Ingestion */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <FileAudio className="w-4 h-4" />
                    1. Enlace de Audio Directo (URL) *
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => audioFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs font-bold border border-white/10 transition-all"
                      title="Seleccionar archivo de tu dispositivo para auto-rellenar tags y carátula"
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Cargar archivo local</span>
                    </button>
                    {audioUrl && (
                      <button
                        type="button"
                        onClick={handleTogglePreview}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 transition-all"
                      >
                        {isPlayingPreview ? (
                          <>
                            <Pause className="w-3.5 h-3.5 fill-emerald-400" />
                            <span>Pausar</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-emerald-400" />
                            <span>Probar</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <input
                  type="file"
                  ref={audioFileInputRef}
                  accept="audio/*,.mp3,.flac,.m4a,.wav"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setDetectStatus('Extrayendo carátula y etiquetas del archivo local...');
                    setIsDetecting(true);
                    try {
                      const extracted = await extractMetadataFromAudioSource(file);
                      if (extracted) {
                        if (extracted.coverUrl) setCoverUrl(extracted.coverUrl);
                        if (extracted.title) setTitle(extracted.title);
                        if (extracted.artist) {
                          const parts = splitArtistNames(cleanArtistSeparators(extracted.artist));
                          setArtistList(parts.length > 0 ? parts : [cleanArtistSeparators(extracted.artist)]);
                        }
                        if (extracted.album) setAlbum(extracted.album);
                        if (extracted.genre) setGenre(extracted.genre);
                        if (extracted.year) setYear(extracted.year);
                        if (extracted.isExplicit !== undefined) setIsExplicit(Boolean(extracted.isExplicit));
                        if (extracted.lyrics) setLyricsLrc(extracted.lyrics);
                        setDetectStatus('✓ Carátula y metadatos extraídos del archivo local');
                      } else {
                        setDetectStatus('Archivo analizado (sin carátula incrustada)');
                      }
                    } catch {
                      setDetectStatus('Error al leer archivo local.');
                    } finally {
                      setIsDetecting(false);
                      setTimeout(() => setDetectStatus(null), 4000);
                    }
                  }}
                  className="hidden"
                />

                <input
                  type="url"
                  required
                  value={audioUrl}
                  onChange={(e) => handleAudioUrlChange(e.target.value)}
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
                      onChange={(e) => {
                        const val = e.target.value;
                        if (
                          /[\(\[]\s*(?:explicit|dirty|uncensored|explicito|explícito|e)\s*[\)\]]/i.test(val)
                        ) {
                          setIsExplicit(true);
                          setTitle(
                            val
                              .replace(
                                /[\(\[]\s*(?:explicit|dirty|uncensored|explicito|explícito|e)\s*[\)\]]/gi,
                                ''
                              )
                              .trim()
                          );
                        } else {
                          setTitle(val);
                        }
                      }}
                      onBlur={handleSingleMetadataBlur}
                      placeholder="Ej. Blinding Lights"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Multiple Artists List */}
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
                            onBlur={handleSingleMetadataBlur}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                      Álbum
                    </label>
                    <input
                      type="text"
                      value={album}
                      onChange={(e) => setAlbum(e.target.value)}
                      onBlur={handleSingleMetadataBlur}
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
                </div>

                {/* Genre Selection & Chips */}
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                    Género musical
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

              <SongMediaEditor value={songMedia} onChange={setSongMedia} />

              <label className="flex items-start gap-2.5 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoEnrich}
                  onChange={(event) => setAutoEnrich(event.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-emerald-500 flex-shrink-0"
                />
                <span>
                  <span className="block text-xs font-bold text-white">
                    Completar metadatos y letra automáticamente
                  </span>
                  <span className="block text-[10px] text-neutral-500 mt-0.5">
                    Busca carátula, álbum, año y letra LRC en MusicBrainz, iTunes y LRCLIB.
                    Solo rellena campos vacíos y no inventa coincidencias.
                  </span>
                </span>
              </label>

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
          ) : (
            /* Album Builder Form */
            <form onSubmit={handleSaveAlbum} className="bg-neutral-900/50 border border-neutral-800/80 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl">
              {/* Step 1: Album Information */}
              <div className="space-y-4">
                <label className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Disc className="w-4 h-4" />
                  1. Información General del Álbum
                </label>

                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                    Título del Álbum *
                  </label>
                  <input
                    type="text"
                    required
                    value={albumTitle}
                    onChange={(e) => setAlbumTitle(e.target.value)}
                    onBlur={handleAlbumMetadataBlur}
                    placeholder="Ej. Un Verano Sin Ti / After Hours"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-bold"
                  />
                </div>

                {/* Album Multi-Artists */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-neutral-300">
                      Artista Principal del Álbum *
                    </label>
                    <button
                      type="button"
                      onClick={handleAddAlbumArtist}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-emerald-400 text-xs font-bold transition-colors border border-neutral-800"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Añadir artista</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {albumArtistList.map((art, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          required={idx === 0}
                          value={art}
                          onChange={(e) => handleAlbumArtistChange(idx, e.target.value)}
                          onBlur={handleAlbumMetadataBlur}
                          placeholder={idx === 0 ? "Artista principal del álbum (Ej. Bad Bunny)" : "Artista colaborador"}
                          className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                        />
                        {albumArtistList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAlbumArtist(idx)}
                            className="p-2.5 rounded-xl bg-neutral-900 hover:bg-red-950/40 text-neutral-400 hover:text-red-400 border border-neutral-800 transition-colors"
                            title="Quitar artista"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {albumArtistList.filter(Boolean).length > 1 && (
                    <p className="text-[11px] text-neutral-500">
                      Se guardará como: <span className="text-emerald-400 font-semibold">{albumArtistList.filter(Boolean).join(', ')}</span>
                    </p>
                  )}
                </div>

                {/* Genre and Year */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                      Género Musical
                    </label>
                    <input
                      type="text"
                      value={albumGenre}
                      onChange={(e) => setAlbumGenre(e.target.value)}
                      placeholder="Ej. Urbano / Reggaeton, Pop..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />

                    <div className="mt-2 flex flex-wrap gap-1">
                      {['Pop', 'Urbano / Reggaeton', 'Rock', 'Synthwave', 'Indie'].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setAlbumGenre(g)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                            albumGenre.toLowerCase() === g.toLowerCase()
                              ? 'bg-emerald-500 text-black font-bold'
                              : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                      Año de Lanzamiento
                    </label>
                    <input
                      type="text"
                      value={albumYear}
                      onChange={(e) => setAlbumYear(e.target.value)}
                      placeholder="2026"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Tracks of the album */}
              <div className="border-t border-neutral-800/80 pt-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <ListOrdered className="w-4 h-4" />
                      2. Pistas del Álbum en Orden ({albumTracks.length} canciones)
                    </label>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Organiza las pistas, sube sus enlaces y mueve el orden con las flechas.
                    </p>
                  </div>

                  {/* Quick batch count & Add track button */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1">
                      <span className="text-[10px] text-neutral-400 font-bold uppercase">Cant:</span>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={bulkTrackCountInput}
                        onChange={(e) => setBulkTrackCountInput(e.target.value)}
                        className="w-10 bg-transparent text-xs text-center font-bold text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSetBulkTrackCount(parseInt(bulkTrackCountInput, 10))}
                        className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-emerald-400 font-bold px-2 py-0.5 rounded-lg transition-colors"
                        title="Ajustar cantidad total de pistas"
                      >
                        Ajustar
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddAlbumTrack}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-bold border border-emerald-500/30 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Añadir pista</span>
                    </button>
                  </div>
                </div>

                {/* Compact List of Tracks */}
                <div className="space-y-3">
                  {albumTracks.map((t, index) => {
                    return (
                      <div
                        key={t.id}
                        className="bg-neutral-950/80 border border-neutral-800/80 rounded-2xl p-3.5 space-y-3 transition-colors hover:border-neutral-700"
                      >
                        {/* Compact main row */}
                        <div className="flex items-center gap-2.5">
                          {/* Track Number Badge */}
                          <div className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xs font-black text-emerald-400 font-mono flex-shrink-0">
                            #{index + 1}
                          </div>

                          {/* Order Reorder Arrows */}
                          <div className="flex flex-col gap-0.5 flex-shrink-0">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMoveTrack(index, 'up')}
                              className="p-0.5 text-neutral-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                              title="Mover canción arriba"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={index === albumTracks.length - 1}
                              onClick={() => handleMoveTrack(index, 'down')}
                              className="p-0.5 text-neutral-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                              title="Mover canción abajo"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Title input */}
                          <div className="flex-1 min-w-[120px]">
                            <input
                              type="text"
                              required
                              value={t.title}
                              onChange={(e) => handleUpdateAlbumTrack(index, { title: e.target.value })}
                              placeholder={`Pista ${index + 1}: Título *`}
                              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          {/* Audio URL input */}
                          <div className="flex-1 min-w-[140px]">
                            <input
                              type="url"
                              required
                              value={t.audioUrl}
                              onChange={(e) => handleUpdateAlbumTrack(index, { audioUrl: e.target.value })}
                              placeholder="Enlace audio (.mp3, File Garden, etc.) *"
                              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-mono text-neutral-300 focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          {/* Auto-detected Duration Badge */}
                          {t.duration > 0 && (
                            <span
                              className="inline-flex items-center text-[11px] font-mono text-emerald-400 font-semibold px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex-shrink-0"
                              title="Duración detectada automáticamente"
                            >
                              {formatTime(t.duration)}
                            </span>
                          )}

                          {/* Explicit Badge if active */}
                          {t.isExplicit && (
                            <span
                              className="inline-flex items-center justify-center w-5 h-5 rounded bg-neutral-700 text-black text-[10px] font-black flex-shrink-0"
                              title="Explícita"
                            >
                              E
                            </span>
                          )}

                          {/* Configure accordion toggle */}
                          <button
                            type="button"
                            onClick={() => handleUpdateAlbumTrack(index, { isConfigOpen: !t.isConfigOpen })}
                            className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 border transition-colors ${
                              t.isConfigOpen
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-neutral-900 text-neutral-400 hover:text-white border-neutral-800'
                            }`}
                            title="Configurar colaboradores y letra sincronizada"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Configurar</span>
                          </button>

                          {/* Remove Track Button */}
                          {albumTracks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveAlbumTrack(index)}
                              className="p-2 rounded-xl text-neutral-500 hover:text-red-400 hover:bg-neutral-900 transition-colors"
                              title="Quitar pista"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Expandable Track Configuration Accordion */}
                        {t.isConfigOpen && (
                          <div className="p-3.5 bg-neutral-900/90 rounded-xl border border-neutral-800 space-y-3 animate-in fade-in duration-150">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Collaborator / Custom Artist */}
                              <div>
                                <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                                  Artista específico / Feat
                                </label>
                                <input
                                  type="text"
                                  value={t.artist || ''}
                                  onChange={(e) => handleUpdateAlbumTrack(index, { artist: e.target.value })}
                                  placeholder="Por defecto el del álbum"
                                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                                />
                              </div>

                              {/* Explicit Toggle */}
                              <div className="flex items-end">
                                <label
                                  onClick={() => handleUpdateAlbumTrack(index, { isExplicit: !t.isExplicit })}
                                  className="flex items-center gap-2 p-2 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-neutral-700 cursor-pointer w-full"
                                >
                                  <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-neutral-600 text-black text-[9px] font-black">
                                    E
                                  </span>
                                  <span className="text-xs text-neutral-300 font-bold select-none">
                                    Contenido explícito (E)
                                  </span>
                                  <input
                                    type="checkbox"
                                    checked={t.isExplicit}
                                    onChange={(e) => handleUpdateAlbumTrack(index, { isExplicit: e.target.checked })}
                                    className="w-3.5 h-3.5 ml-auto accent-emerald-500"
                                  />
                                </label>
                              </div>
                            </div>

                            {/* Synced lyrics for this track */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1">
                                  <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Letras Sincronizadas (.LRC) para Pista #{index + 1}</span>
                                </label>
                              </div>
                              <textarea
                                rows={2}
                                value={t.lyricsLrc}
                                onChange={(e) => handleUpdateAlbumTrack(index, { lyricsLrc: e.target.value })}
                                placeholder="[00:05.00] Letra sincronizada..."
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs font-mono text-neutral-300 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-start gap-2.5 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoEnrich}
                  onChange={(event) => setAutoEnrich(event.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-emerald-500 flex-shrink-0"
                />
                <span>
                  <span className="block text-xs font-bold text-white">
                    Completar metadatos y letras de las pistas automáticamente
                  </span>
                  <span className="block text-[10px] text-neutral-500 mt-0.5">
                    Se ejecuta en segundo plano después de guardar el álbum. Solo rellena
                    campos vacíos con MusicBrainz, iTunes y LRCLIB.
                  </span>
                </span>
              </label>

              {/* Save Album Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingAlbum}
                  className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black text-sm tracking-wide shadow-xl shadow-emerald-500/25 transition-all transform active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <Disc className="w-5 h-5 stroke-[2.5]" />
                  <span>
                    {isSavingAlbum ? 'Guardando Álbum...' : `Guardar Álbum Completo (${albumTracks.length} Pistas) en la Nube`}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right Column: Cover Preview & Summary */}
        <div className="space-y-6">
          {uploadMode === 'single' ? (
            /* Single Song Cover Preview Card */
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

                {/* Auto Detection & Extraction Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleAutoDetectCover}
                    disabled={isSearchingCover}
                    className="py-2.5 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    title="Buscar carátula automáticamente en línea (iTunes y Deezer)"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isSearchingCover ? 'animate-spin' : ''}`} />
                    <span>Detectar en línea</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExtractFromFileOrUrl()}
                    disabled={isSearchingCover || !audioUrl}
                    className="py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-bold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    title="Extraer carátula incrustada en el archivo de audio o enlace"
                  >
                    <Music className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Extraer de archivo</span>
                  </button>
                </div>

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
          ) : (
            /* Album Cover Preview & Summary */
            <>
              <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-3xl p-6 space-y-4 shadow-xl">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  <span>Carátula del Álbum</span>
                </h3>

                <div className="aspect-square w-full rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 relative group shadow-2xl">
                  <img
                    src={albumCoverUrl}
                    alt="Carátula Álbum"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => albumCoverFileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-emerald-500 text-black text-xs font-bold shadow-lg"
                    >
                      Cambiar Imagen
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    type="file"
                    ref={albumCoverFileInputRef}
                    accept="image/*"
                    onChange={handleAlbumCoverFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => albumCoverFileInputRef.current?.click()}
                    className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-emerald-400 font-bold text-xs tracking-wide transition-colors flex items-center justify-center gap-2"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Subir carátula de álbum desde tu PC</span>
                  </button>

                  {/* Auto Detection & Extraction for Album */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleAutoDetectAlbumCover}
                      disabled={isSearchingAlbumCover}
                      className="py-2.5 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      title="Buscar carátula del álbum automáticamente en línea"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isSearchingAlbumCover ? 'animate-spin' : ''}`} />
                      <span>Detectar álbum</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExtractAlbumCoverFromTrack1}
                      disabled={isSearchingAlbumCover || !albumTracks[0]?.audioUrl}
                      className="py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-bold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      title="Extraer carátula incrustada en la pista #1 del álbum"
                    >
                      <Disc className="w-3.5 h-3.5 text-emerald-400" />
                      <span>De pista #1</span>
                    </button>
                  </div>

                  <div className="pt-1">
                    <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                      O pegar URL de imagen:
                    </label>
                    <input
                      type="url"
                      value={albumCoverUrl}
                      onChange={(e) => setAlbumCoverUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Album Summary Card */}
              <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-3xl p-6 space-y-3 shadow-xl">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Disc className="w-4 h-4 text-emerald-400" />
                  <span>Resumen del Álbum</span>
                </h3>
                <div className="space-y-1.5 text-xs">
                  <p className="font-extrabold text-white text-sm">
                    {albumTitle.trim() || 'Título del Álbum'}
                  </p>
                  <p className="text-neutral-400">
                    {albumArtistList.filter(Boolean).join(', ') || 'Artista del Álbum'}
                  </p>
                  <p className="text-neutral-500 text-[11px]">
                    {albumYear} • {albumGenre || 'General'} • {albumTracks.length} canciones
                  </p>
                </div>

                <div className="border-t border-neutral-800/80 pt-3 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                    Orden de Pistas:
                  </span>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                    {albumTracks.map((t, i) => (
                      <div key={t.id} className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-neutral-500 text-[11px] w-5">#{i + 1}</span>
                        <span className="truncate text-neutral-300 font-medium">
                          {t.title.trim() || `(Pista ${i + 1} sin título)`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

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
                                className="inline-flex items-center justify-center w-3 h-3 rounded bg-neutral-600/80 text-white text-[8px] font-black flex-shrink-0 select-none leading-none"
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
