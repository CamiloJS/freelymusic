import React, { useMemo, useState } from 'react';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Download from 'lucide-react/dist/esm/icons/download.mjs';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.mjs';
import AlertCircle from 'lucide-react/dist/esm/icons/circle-alert.mjs';
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.mjs';
import Music from 'lucide-react/dist/esm/icons/music.mjs';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.mjs';
import { useMusic } from '../context/MusicContext';
import { Playlist } from '../types';
import {
  ImportedPlaylist,
  PlaylistMatchReport,
  PlaylistProvider,
  importPlaylistFromUrl,
  matchPlaylistTracks,
  parseTextPlaylist,
  playlistProviderLabel,
} from '../services/playlistImport';

interface ImportPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (playlist: Playlist) => void;
}

const PROVIDERS: Array<{ id: PlaylistProvider; label: string; hint: string }> = [
  {
    id: 'spotify',
    label: 'Spotify',
    hint: 'Playlist pública. Requiere SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET en Vercel.',
  },
  {
    id: 'deezer',
    label: 'Deezer',
    hint: 'Playlist pública. No necesita cuenta ni clave.',
  },
  {
    id: 'apple-music',
    label: 'Apple Music',
    hint: 'Requiere un token de desarrollador de MusicKit (cuenta de desarrollador de Apple).',
  },
  {
    id: 'text',
    label: 'Texto / CSV',
    hint: 'Pega una canción por línea con el formato "Artista - Título".',
  },
];

function duplicateName(playlists: Playlist[], name: string): boolean {
  const clean = name.trim().toLowerCase();
  return Boolean(clean) && playlists.some((playlist) => playlist.name.trim().toLowerCase() === clean);
}

export const ImportPlaylistModal: React.FC<ImportPlaylistModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { catalog, playlists, importPlaylist } = useMusic();
  const [provider, setProvider] = useState<PlaylistProvider>('deezer');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [appleToken, setAppleToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imported, setImported] = useState<ImportedPlaylist | null>(null);
  const [report, setReport] = useState<PlaylistMatchReport | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const providerInfo = PROVIDERS.find((item) => item.id === provider) || PROVIDERS[1];

  const matchedSongs = useMemo(() => {
    if (!report) return [];
    return report.matches
      .filter((match) => Boolean(match.songId))
      .map((match) => ({
        match,
        song: catalog.find((song) => song.id === match.songId),
      }));
  }, [report, catalog]);

  if (!isOpen) return null;

  const resetResult = () => {
    setImported(null);
    setReport(null);
    setName('');
    setDescription('');
    setError('');
  };

  const handleProviderChange = (nextProvider: PlaylistProvider) => {
    setProvider(nextProvider);
    resetResult();
  };

  const handleAnalyze = async () => {
    setError('');
    setLoading(true);
    setImported(null);
    setReport(null);

    try {
      let sourcePlaylist: ImportedPlaylist;

      if (provider === 'text') {
        const tracks = parseTextPlaylist(text);
        if (tracks.length === 0) {
          throw new Error('Pega al menos una canción, una por línea.');
        }
        sourcePlaylist = {
          name: 'Playlist importada',
          description: 'Importada desde texto',
          provider: 'text',
          tracks,
        };
      } else {
        if (!url.trim()) {
          throw new Error('Pega el enlace público de la playlist.');
        }
        sourcePlaylist = await importPlaylistFromUrl(url, appleToken);
      }

      if (sourcePlaylist.tracks.length === 0) {
        throw new Error('La playlist no contiene canciones legibles.');
      }

      const matchReport = matchPlaylistTracks(sourcePlaylist.tracks, catalog);
      setImported(sourcePlaylist);
      setReport(matchReport);
      setName(sourcePlaylist.name);
      setDescription(sourcePlaylist.description || '');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo analizar la playlist.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    if (!report) return;

    const songIds = report.matches
      .filter((match) => match.songId)
      .map((match) => match.songId as string);

    if (songIds.length === 0) {
      setError('No se encontró ninguna canción de esta playlist en tu catálogo.');
      return;
    }

    if (
      duplicateName(playlists, name) &&
      !window.confirm(
        `Ya tienes una playlist llamada "${name}". ¿Quieres crear otra con el mismo nombre?`
      )
    ) {
      return;
    }

    const firstSong = catalog.find((song) => song.id === songIds[0]);
    const created = importPlaylist(
      name,
      description || `Importada desde ${playlistProviderLabel(provider)}`,
      songIds,
      firstSong?.coverUrl
    );

    onCreated(created);
    resetResult();
    setUrl('');
    setText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900 shadow-2xl flex flex-col">
        <header className="flex items-center justify-between gap-3 px-5 md:px-7 py-4 border-b border-neutral-800 flex-shrink-0">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-white">
              <Download className="w-5 h-5 text-emerald-400" />
              Importar playlist
            </h2>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Reconstruye una playlist con las canciones que ya existen en tu catálogo.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 md:p-7 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PROVIDERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleProviderChange(item.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  provider === item.id
                    ? 'bg-emerald-500 text-black border-emerald-400'
                    : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-neutral-500">{providerInfo.hint}</p>

          {provider === 'text' ? (
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                Canciones (una por línea)
              </label>
              <textarea
                rows={7}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={'Aitana - CUARTO AZUL\nMARINA - BUTTERFLY\nArtista - Título'}
                className="w-full rounded-xl bg-neutral-950 border border-neutral-800 p-3 text-xs font-mono text-white focus:outline-none focus:border-emerald-500 resize-y"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                  Enlace público de la playlist
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder={
                    provider === 'spotify'
                      ? 'https://open.spotify.com/playlist/...'
                      : provider === 'deezer'
                      ? 'https://www.deezer.com/playlist/...'
                      : 'https://music.apple.com/us/playlist/...'
                  }
                  className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              {provider === 'apple-music' && (
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                    Token de desarrollador de MusicKit (opcional si está configurado en Vercel)
                  </label>
                  <input
                    type="password"
                    value={appleToken}
                    onChange={(event) => setAppleToken(event.target.value)}
                    placeholder="eyJhbGciOi..."
                    className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-extrabold transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{loading ? 'Analizando...' : 'Analizar playlist'}</span>
          </button>

          {imported && report && (
            <div className="space-y-4 border-t border-neutral-800 pt-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">Canciones</p>
                  <p className="text-xl font-black text-white">{imported.tracks.length}</p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-400">Encontradas</p>
                  <p className="text-xl font-black text-emerald-300">{report.matched}</p>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-amber-400">Sin coincidencia</p>
                  <p className="text-xl font-black text-amber-300">{report.unmatched}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                    Nombre de la playlist
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                    Descripción
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
                  <h3 className="flex items-center gap-1.5 text-xs font-black text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Coincidencias ({report.matched})
                  </h3>
                  <div className="mt-2 max-h-64 overflow-y-auto space-y-1">
                    {matchedSongs.map(({ match, song }, index) => (
                      <div key={`${match.songId}-${index}`} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-neutral-900">
                        {song?.coverUrl ? (
                          <img
                            src={song.coverUrl}
                            alt={song.title}
                            loading="lazy"
                            className="w-8 h-8 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-neutral-800 flex items-center justify-center">
                            <Music className="w-3.5 h-3.5 text-neutral-500" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-bold text-white">
                            {song?.title || match.track.title}
                          </p>
                          <p className="truncate text-[10px] text-neutral-500">
                            {match.track.artist || match.track.title} · {Math.round(match.confidence * 100)}%
                          </p>
                        </div>
                      </div>
                    ))}
                    {matchedSongs.length === 0 && (
                      <p className="py-4 text-center text-[11px] text-neutral-500">
                        Ninguna canción coincide todavía.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
                  <h3 className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                    <AlertCircle className="w-3.5 h-3.5" />
                    No encontradas ({report.unmatched})
                  </h3>
                  <div className="mt-2 max-h-64 overflow-y-auto space-y-1">
                    {report.matches
                      .filter((match) => !match.songId)
                      .map((match, index) => (
                        <div key={`${match.track.title}-${index}`} className="rounded-lg p-1.5 hover:bg-neutral-900">
                          <p className="truncate text-[11px] font-bold text-neutral-300">
                            {match.track.title}
                          </p>
                          <p className="truncate text-[10px] text-neutral-500">
                            {match.track.artist || 'Artista desconocido'} · no se sustituye por otra
                          </p>
                        </div>
                      ))}
                    {report.unmatched === 0 && (
                      <p className="py-4 text-center text-[11px] text-emerald-500">
                        Todas las canciones coinciden.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-[10px] text-neutral-500">
                  Se crearán {report.matched} canciones en la nueva playlist. Las no encontradas
                  se listan arriba y no se reemplazan.
                </p>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={report.matched === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black text-xs font-extrabold transition-colors"
                >
                  Crear playlist
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
