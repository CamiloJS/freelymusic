import React from 'react';
import Layers from 'lucide-react/dist/esm/icons/layers.mjs';
import Mic2 from 'lucide-react/dist/esm/icons/mic-vocal.mjs';
import { useAudio } from '../context/AudioContext';

interface SongVersionSelectorProps {
  compact?: boolean;
  className?: string;
}

export const SongVersionSelector: React.FC<SongVersionSelectorProps> = ({
  compact = false,
  className = '',
}) => {
  const {
    currentSong,
    activeVersionId,
    availableVersions,
    setActiveVersion,
    isKaraoke,
    hasInstrumental,
    toggleKaraoke,
  } = useAudio();

  if (!currentSong) return null;
  if (availableVersions.length === 0 && !hasInstrumental) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {availableVersions.length > 0 && (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900/90 border border-neutral-800 px-2.5 py-1">
          <Layers className="w-3 h-3 text-emerald-400 flex-shrink-0" />
          <label className="sr-only" htmlFor="song-version-selector">
            Versión de la canción
          </label>
          <select
            id="song-version-selector"
            value={activeVersionId || 'original'}
            onChange={(event) =>
              setActiveVersion(event.target.value === 'original' ? null : event.target.value)
            }
            className={`bg-transparent text-[10px] font-bold text-neutral-200 outline-none ${
              compact ? 'max-w-[130px]' : 'max-w-[210px]'
            }`}
            title="Cambiar entre la versión original y sus covers/instrumentales"
          >
            <option value="original" className="bg-neutral-900">
              Original
            </option>
            {availableVersions.map((version) => (
              <option key={version.id} value={version.id} className="bg-neutral-900">
                {version.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {hasInstrumental && (
        <button
          type="button"
          onClick={toggleKaraoke}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black transition-colors ${
            isKaraoke
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : 'bg-neutral-900/90 border-neutral-800 text-neutral-400 hover:text-white'
          }`}
          title={
            isKaraoke
              ? 'Volver a la versión original'
              : 'Activar karaoke con la pista instrumental'
          }
        >
          <Mic2 className="w-3 h-3" />
          <span>{isKaraoke ? 'Karaoke activo' : 'Karaoke'}</span>
        </button>
      )}
    </div>
  );
};
