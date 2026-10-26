import React from 'react';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.mjs';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.mjs';
import Video from 'lucide-react/dist/esm/icons/video.mjs';
import Mic2 from 'lucide-react/dist/esm/icons/mic-vocal.mjs';
import Layers from 'lucide-react/dist/esm/icons/layers.mjs';
import { SongVersion, SongVersionType } from '../types';

export interface SongMediaValue {
  videoUrl: string;
  instrumentalUrl: string;
  instrumentalOffset: number;
  instrumentalLyricsLrc: string;
  versions: SongVersion[];
}

export const EMPTY_SONG_MEDIA: SongMediaValue = {
  videoUrl: '',
  instrumentalUrl: '',
  instrumentalOffset: 0,
  instrumentalLyricsLrc: '',
  versions: [],
};

interface SongMediaEditorProps {
  value: SongMediaValue;
  onChange: (value: SongMediaValue) => void;
}

const VERSION_TYPES: Array<{ value: SongVersionType; label: string }> = [
  { value: 'cover', label: 'Cover' },
  { value: 'instrumental', label: 'Instrumental' },
  { value: 'remix', label: 'Remix' },
  { value: 'live', label: 'En vivo' },
  { value: 'other', label: 'Otra' },
];

function createVersion(): SongVersion {
  const id = `version-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    label: 'Nueva versión',
    type: 'cover',
    audioUrl: '',
    lyricsLrc: '',
    videoUrl: '',
    instrumentalUrl: '',
    instrumentalLyricsLrc: '',
    instrumentalOffset: 0,
  };
}

export const SongMediaEditor: React.FC<SongMediaEditorProps> = ({ value, onChange }) => {
  const update = (patch: Partial<SongMediaValue>) => {
    onChange({ ...value, ...patch });
  };

  const updateVersion = (id: string, patch: Partial<SongVersion>) => {
    update({
      versions: value.versions.map((version) =>
        version.id === id ? { ...version, ...patch } : version
      ),
    });
  };

  const removeVersion = (id: string) => {
    update({ versions: value.versions.filter((version) => version.id !== id) });
  };

  const addVersion = () => {
    update({ versions: [...value.versions, createVersion()] });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-black text-white">
          <Layers className="w-4 h-4 text-emerald-400" />
          Videoclip, karaoke y versiones alternativas
        </h3>
        <p className="text-[11px] text-neutral-500 mt-1">
          Todos los enlaces deben ser archivos directos (MP4/WebM para video, MP3/M4A para audio).
          Las versiones quedan dentro de esta misma canción y no duplican la biblioteca.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="block text-[11px] font-bold text-neutral-300 mb-1">
            Videoclip (URL directa)
          </label>
          <div className="relative">
            <Video className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="url"
              value={value.videoUrl}
              onChange={(event) => update({ videoUrl: event.target.value })}
              placeholder="https://.../videoclip.mp4"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-neutral-300 mb-1">
            Pista instrumental (karaoke)
          </label>
          <div className="relative">
            <Mic2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="url"
              value={value.instrumentalUrl}
              onChange={(event) => update({ instrumentalUrl: event.target.value })}
              placeholder="https://.../instrumental.mp3"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-neutral-300 mb-1">
            Desfase del instrumental (segundos)
          </label>
          <input
            type="number"
            step="0.1"
            value={value.instrumentalOffset}
            onChange={(event) =>
              update({ instrumentalOffset: Number(event.target.value) || 0 })
            }
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            placeholder="0"
          />
          <p className="text-[10px] text-neutral-500 mt-1">
            Úsalo si el instrumental tiene una intro distinta. Positivo = empieza antes.
          </p>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-neutral-300 mb-1">
            Letra LRC del instrumental (opcional)
          </label>
          <textarea
            rows={3}
            value={value.instrumentalLyricsLrc}
            onChange={(event) => update({ instrumentalLyricsLrc: event.target.value })}
            placeholder="Si sus tiempos cambian, pega aquí el LRC de la versión instrumental."
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-y font-mono"
          />
        </div>
      </div>

      <div className="pt-2 border-t border-neutral-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-black text-neutral-200">
              Versiones alternativas ({value.versions.length})
            </h4>
            <p className="text-[10px] text-neutral-500">
              Cover, versión en otro idioma, remix o instrumental completo.
            </p>
          </div>
          <button
            type="button"
            onClick={addVersion}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir versión
          </button>
        </div>

        {value.versions.length === 0 ? (
          <p className="mt-3 text-[11px] text-neutral-500 italic">
            Aún no hay versiones. La versión principal es la que estás editando arriba.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {value.versions.map((version, index) => (
              <details
                key={version.id}
                className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-3"
                open={index === value.versions.length - 1}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-xs font-bold text-white">
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
                    {version.label || `Versión ${index + 1}`}
                    <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[9px] uppercase tracking-wider text-neutral-400">
                      {version.type}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      removeVersion(version.id);
                    }}
                    className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800"
                    title="Eliminar versión"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </summary>

                <div className="mt-3 grid gap-2.5 md:grid-cols-2">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 mb-1">
                      Nombre visible
                    </label>
                    <input
                      type="text"
                      value={version.label}
                      onChange={(event) =>
                        updateVersion(version.id, { label: event.target.value })
                      }
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 mb-1">
                      Tipo
                    </label>
                    <select
                      value={version.type}
                      onChange={(event) =>
                        updateVersion(version.id, {
                          type: event.target.value as SongVersionType,
                        })
                      }
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      {VERSION_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-neutral-400 mb-1">
                      Audio de la versión (URL directa)
                    </label>
                    <input
                      type="url"
                      value={version.audioUrl}
                      onChange={(event) =>
                        updateVersion(version.id, { audioUrl: event.target.value })
                      }
                      placeholder="https://.../cover.mp3"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 mb-1">
                      Idioma
                    </label>
                    <input
                      type="text"
                      value={version.language || ''}
                      onChange={(event) =>
                        updateVersion(version.id, { language: event.target.value })
                      }
                      placeholder="es, ja, en..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 mb-1">
                      Duración (segundos)
                    </label>
                    <input
                      type="number"
                      value={version.duration || ''}
                      onChange={(event) =>
                        updateVersion(version.id, {
                          duration: Number(event.target.value) || undefined,
                        })
                      }
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-neutral-400 mb-1">
                      Letra LRC de esta versión (opcional)
                    </label>
                    <textarea
                      rows={3}
                      value={version.lyricsLrc || ''}
                      onChange={(event) =>
                        updateVersion(version.id, { lyricsLrc: event.target.value })
                      }
                      placeholder="[00:12.00] Letra sincronizada de esta versión..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-y font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 mb-1">
                      Videoclip de esta versión
                    </label>
                    <input
                      type="url"
                      value={version.videoUrl || ''}
                      onChange={(event) =>
                        updateVersion(version.id, { videoUrl: event.target.value })
                      }
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 mb-1">
                      Instrumental de esta versión
                    </label>
                    <input
                      type="url"
                      value={version.instrumentalUrl || ''}
                      onChange={(event) =>
                        updateVersion(version.id, { instrumentalUrl: event.target.value })
                      }
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-neutral-400 mb-1">
                      Letra LRC del instrumental de esta versión
                    </label>
                    <textarea
                      rows={2}
                      value={version.instrumentalLyricsLrc || ''}
                      onChange={(event) =>
                        updateVersion(version.id, {
                          instrumentalLyricsLrc: event.target.value,
                        })
                      }
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-y font-mono"
                    />
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
