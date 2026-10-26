import React, { useMemo, useRef, useState } from 'react';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.mjs';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.mjs';
import AlertCircle from 'lucide-react/dist/esm/icons/circle-alert.mjs';
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.mjs';
import Music from 'lucide-react/dist/esm/icons/music.mjs';
import Database from 'lucide-react/dist/esm/icons/database.mjs';
import { useMusic } from '../context/MusicContext';
import { Song } from '../types';
import {
  buildManualUpdate,
  enrichSongMetadata,
  EnrichmentResult,
  songNeedsEnrichment,
} from '../services/metadataEnrichment';

interface MetadataEnrichmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ScanEntry {
  song: Song;
  result?: EnrichmentResult;
  applied?: boolean;
}

export const MetadataEnrichmentModal: React.FC<MetadataEnrichmentModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { catalog, updateCatalogTrack } = useMusic();
  const [running, setRunning] = useState(false);
  const [currentTitle, setCurrentTitle] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [entries, setEntries] = useState<ScanEntry[]>([]);
  const cancelledRef = useRef(false);

  const pendingSongs = useMemo(
    () => catalog.filter((song) => songNeedsEnrichment(song)),
    [catalog]
  );

  if (!isOpen) return null;

  const runScan = async () => {
    if (running) return;

    cancelledRef.current = false;
    setRunning(true);
    setProgress({ done: 0, total: pendingSongs.length });
    setEntries(pendingSongs.map((song) => ({ song })));

    for (let index = 0; index < pendingSongs.length; index += 1) {
      if (cancelledRef.current) break;

      const song = pendingSongs[index];
      setCurrentTitle(song.title);

      try {
        const result = await enrichSongMetadata(song);
        if (cancelledRef.current) break;

        const shouldApply = Object.keys(result.updated).length > 0 && !result.needsReview;

        if (shouldApply) {
          updateCatalogTrack({
            ...song,
            ...result.updated,
            needsReview: undefined,
            enrichmentNote: undefined,
          });
        }

        setEntries((previous) =>
          previous.map((entry) =>
            entry.song.id === song.id
              ? { ...entry, result, applied: shouldApply }
              : entry
          )
        );
      } catch (error) {
        setEntries((previous) =>
          previous.map((entry) =>
            entry.song.id === song.id
              ? {
                  ...entry,
                  result: {
                    updated: {},
                    candidate: null,
                    needsReview: true,
                    note:
                      error instanceof Error
                        ? error.message
                        : 'No se pudo consultar la fuente.',
                    sources: [],
                  },
                }
              : entry
          )
        );
      }

      setProgress({ done: index + 1, total: pendingSongs.length });
    }

    setCurrentTitle('');
    setRunning(false);
  };

  const applyManual = (entry: ScanEntry) => {
    if (!entry.result?.candidate) return;

    const update = {
      ...entry.result.updated,
      ...buildManualUpdate(entry.song, entry.result.candidate),
    };
    if (Object.keys(update).length === 0) return;

    updateCatalogTrack({
      ...entry.song,
      ...update,
      needsReview: undefined,
      enrichmentNote: undefined,
    });

    setEntries((previous) =>
      previous.map((item) =>
        item.song.id === entry.song.id
          ? { ...item, applied: true }
          : item
      )
    );
  };

  const markPending = (entry: ScanEntry) => {
    updateCatalogTrack({
      ...entry.song,
      needsReview: true,
      enrichmentNote: entry.result?.note || 'Pendiente de revisión manual.',
    });
  };

  const markAllPending = () => {
    entries.forEach((entry) => {
      if (entry.result?.needsReview && !entry.applied) markPending(entry);
    });
  };

  const analyzed = entries.filter((entry) => Boolean(entry.result)).length;
  const appliedCount = entries.filter((entry) => entry.applied).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-4xl max-h-[92vh] rounded-3xl border border-neutral-800 bg-neutral-900 shadow-2xl flex flex-col overflow-hidden">
        <header className="flex items-start justify-between gap-3 px-5 md:px-7 py-4 border-b border-neutral-800 flex-shrink-0">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-white">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              Enriquecer metadatos con IA y fuentes públicas
            </h2>
            <p className="text-[11px] text-neutral-400 mt-1 max-w-2xl">
              MusicBrainz para álbum/año/género/ISRC, iTunes para carátula y LRCLIB para letras
              LRC. Solo se completan campos vacíos; no se sobrescriben datos existentes ni se
              inventan coincidencias.
            </p>
          </div>
          <button
            onClick={() => {
              cancelledRef.current = true;
              onClose();
            }}
            className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 md:p-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-white">
                {pendingSongs.length} canciones necesitan revisión
              </p>
              <p className="text-[11px] text-neutral-500">
                {analyzed} analizadas · {appliedCount} actualizadas en esta sesión
              </p>
            </div>
            <div className="flex items-center gap-2">
              {entries.some((entry) => entry.result?.needsReview && !entry.applied) && (
                <button
                  onClick={markAllPending}
                  className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold"
                >
                  Marcar pendientes
                </button>
              )}
              <button
                onClick={() => void runScan()}
                disabled={running || pendingSongs.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black text-xs font-extrabold"
              >
                {running ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {running ? 'Analizando...' : 'Analizar catálogo'}
              </button>
            </div>
          </div>

          {running && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-3">
              <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300 mb-1.5">
                <span>{currentTitle ? `Buscando: ${currentTitle}` : 'Preparando...'}</span>
                <span>
                  {progress.done}/{progress.total}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-emerald-950 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all"
                  style={{
                    width: `${
                      progress.total > 0 ? (progress.done / progress.total) * 100 : 0
                    }%`,
                  }}
                />
              </div>
              <p className="mt-1 text-[10px] text-neutral-500">
                MusicBrainz limita a una consulta por segundo; el proceso puede tardar.
              </p>
            </div>
          )}

          {entries.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-8 text-center">
              <Database className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-neutral-300">
                Pulsa “Analizar catálogo” para revisar las canciones incompletas.
              </p>
              <p className="text-[11px] text-neutral-500 mt-1">
                Se revisarán {pendingSongs.length} canciones con metadatos o letras faltantes.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => {
                const result = entry.result;
                const isScanning = running && currentTitle === entry.song.title;

                return (
                  <div
                    key={entry.song.id}
                    className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={entry.song.coverUrl}
                        alt={entry.song.title}
                        loading="lazy"
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-neutral-800"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-white">
                          {entry.song.title}
                        </p>
                        <p className="truncate text-[10px] text-neutral-500">
                          {entry.song.artist} · {entry.song.album || 'Sin álbum'}
                          {entry.song.genre && entry.song.genre !== 'General'
                            ? ` · ${entry.song.genre}`
                            : ''}
                        </p>
                      </div>

                      {isScanning && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                          <Loader2 className="w-3 h-3 animate-spin" /> buscando
                        </span>
                      )}

                      {entry.applied && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> aplicado
                        </span>
                      )}

                      {!isScanning && !entry.applied && result?.updated && Object.keys(result.updated).length > 0 && (
                        <button
                          onClick={() => applyManual(entry)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold"
                        >
                          Aplicar
                        </button>
                      )}

                      {!isScanning && result?.needsReview && !entry.applied && (
                        <button
                          onClick={() => markPending(entry)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-300 text-[10px] font-bold"
                        >
                          Marcar pendiente
                        </button>
                      )}
                    </div>

                    {result && (
                      <div className="mt-2 pl-13">
                        <p className="text-[10px] text-neutral-400">{result.note}</p>
                        {result.sources.length > 0 && (
                          <p className="text-[10px] text-neutral-600 mt-0.5">
                            Fuentes: {result.sources.join(' · ')}
                          </p>
                        )}
                        {result.candidate && (
                          <p className="text-[10px] text-neutral-500 mt-0.5">
                            Candidato: {result.candidate.title} — {result.candidate.artist} ·{' '}
                            {Math.round(result.candidate.confidence * 100)}% de confianza
                          </p>
                        )}
                      </div>
                    )}

                    {!result && !isScanning && (
                      <p className="mt-1 pl-13 text-[10px] text-neutral-600">
                        Pendiente de analizar
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!running && entries.length > 0 && (
            <p className="flex items-start gap-2 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 text-[11px] text-neutral-500">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
              Las canciones sin coincidencia fiable no se modifican. Puedes marcarlas como
              pendientes y revisarlas manualmente desde el catálogo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
