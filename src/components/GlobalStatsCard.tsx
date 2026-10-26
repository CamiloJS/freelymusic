import React, { useEffect, useState } from 'react';
import Chart from 'lucide-react/dist/esm/icons/chart-no-axes-column.mjs';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link.mjs';
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.mjs';
import { useCustomization } from '../context/CustomizationContext';
import {
  getArtistGlobalStats,
  getTrackGlobalStats,
  GlobalStatsResult,
} from '../services/globalStats';

interface GlobalStatsCardProps {
  type: 'artist' | 'track';
  name: string;
  artist?: string;
  compact?: boolean;
  className?: string;
}

function formatNumber(value?: number): string {
  if (value === undefined || value === null) return '—';
  return new Intl.NumberFormat('es-CO').format(value);
}

export const GlobalStatsCard: React.FC<GlobalStatsCardProps> = ({
  type,
  name,
  artist,
  compact = false,
  className = '',
}) => {
  const { lastfmApiKey } = useCustomization();
  const [data, setData] = useState<GlobalStatsResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);

    const request =
      type === 'artist'
        ? getArtistGlobalStats(name, lastfmApiKey)
        : getTrackGlobalStats(name, artist || '', lastfmApiKey);

    request
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((error) => {
        console.warn('No se pudieron cargar las estadísticas globales:', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [type, name, artist, lastfmApiKey]);

  if (loading) {
    return (
      <div
        className={`flex items-center gap-2 text-[11px] text-neutral-500 ${className}`}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
        <span>Consultando popularidad...</span>
      </div>
    );
  }

  if (!data) {
    if (compact) return null;
    return (
      <div className={`rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 ${className}`}>
        <p className="flex items-center gap-2 text-xs font-bold text-neutral-300">
          <Chart className="w-4 h-4 text-neutral-500" />
          Estadísticas globales no disponibles
        </p>
        <p className="mt-1 text-[11px] text-neutral-500">
          No se encontró una coincidencia fiable en la fuente pública. No se muestran cifras
          inventadas.
        </p>
      </div>
    );
  }

  const isLastfm = data.source === 'last.fm';
  const sourceLabel = isLastfm ? 'LAST.FM' : 'DEEZER';
  const sourceColor = isLastfm
    ? 'bg-red-500/15 text-red-300 border-red-500/25'
    : 'bg-violet-500/15 text-violet-300 border-violet-500/25';

  const metrics: Array<{ label: string; value: string }> = [];
  if (type === 'artist') {
    if (isLastfm) {
      metrics.push(
        { label: 'Oyentes totales', value: formatNumber(data.listeners) },
        { label: 'Reproducciones', value: formatNumber(data.playcount) }
      );
    } else {
      metrics.push({ label: 'Fans en Deezer', value: formatNumber(data.fans) });
    }
  } else if (isLastfm) {
    metrics.push(
      { label: 'Oyentes totales', value: formatNumber(data.listeners) },
      { label: 'Reproducciones', value: formatNumber(data.playcount) }
    );
  } else {
    metrics.push({ label: 'Popularidad Deezer', value: formatNumber(data.rank) });
  }

  if (compact) {
    return (
      <div className={`flex flex-wrap items-center gap-2 text-[10px] ${className}`}>
        <span className={`px-2 py-0.5 rounded-full border font-black tracking-wider ${sourceColor}`}>
          {sourceLabel}
        </span>
        {metrics.map((metric) => (
          <span key={metric.label} className="text-neutral-400">
            <strong className="text-neutral-200">{metric.value}</strong> {metric.label.toLowerCase()}
          </span>
        ))}
        {data.stale && <span className="text-amber-400">caché</span>}
        {data.url && (
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-emerald-400 hover:underline font-bold"
          >
            ver fuente <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-black text-white">
          <Chart className="w-4 h-4 text-emerald-400" />
          Popularidad global
        </p>
        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black tracking-wider ${sourceColor}`}>
          {sourceLabel}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl bg-neutral-950/70 border border-neutral-800/70 p-2.5">
            <p className="text-[9px] uppercase tracking-wider font-bold text-neutral-500">
              {metric.label}
            </p>
            <p className="text-lg font-black text-white">{metric.value}</p>
          </div>
        ))}
      </div>

      <p className="mt-2 text-[10px] text-neutral-500">{data.note}</p>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-neutral-500">
        <span>
          {data.period} · actualizado {new Date(data.fetchedAt).toLocaleDateString()}
          {data.stale ? ' · caché anterior' : ''}
        </span>
        {data.url && (
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-emerald-400 hover:underline font-bold"
          >
            Ver en {isLastfm ? 'Last.fm' : 'Deezer'}
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
    </div>
  );
};
