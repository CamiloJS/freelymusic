import React, { useEffect, useState } from 'react';
import Chart from 'lucide-react/dist/esm/icons/chart-no-axes-column.mjs';
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
      <span className={`inline-flex items-center gap-1.5 text-[11px] text-neutral-500 ${className}`}>
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>...</span>
      </span>
    );
  }

  if (!data) return null;

  // Only the count is shown. If the service has a total play count we use it;
  // otherwise we keep the public popularity number and never expose its source.
  const playCount = data.playcount;
  const fallback = type === 'artist' ? data.fans : data.rank;
  const value = playCount ?? fallback;
  const label = 'reproducciones';

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] text-neutral-400 ${className}`}>
        <Chart className="w-3 h-3 text-emerald-400" />
        <strong className="text-neutral-200 font-bold">{formatNumber(value)}</strong>
        <span>{label}</span>
      </span>
    );
  }

  return (
    <div className={`rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 ${className}`}>
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-emerald-400">
        <Chart className="w-4 h-4" />
        {label}
      </div>
      <p className="mt-1 text-3xl font-black text-white">{formatNumber(value)}</p>
    </div>
  );
};
