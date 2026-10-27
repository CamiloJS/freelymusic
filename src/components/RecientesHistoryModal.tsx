import React, { useState, useMemo } from 'react';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Pause from 'lucide-react/dist/esm/icons/pause.mjs';
import Clock from 'lucide-react/dist/esm/icons/clock.mjs';
import MoreVertical from 'lucide-react/dist/esm/icons/ellipsis-vertical.mjs';
import Heart from 'lucide-react/dist/esm/icons/heart.mjs';
import PlusCircle from 'lucide-react/dist/esm/icons/circle-plus.mjs';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { Song } from '../types';
import { SavedCheckIcon } from './SavedCheckIcon';

interface RecientesHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAddToPlaylist?: (song: Song) => void;
}

interface HistoryGroup {
  label: string;
  items: Array<{
    song: Song;
    playedAt: string;
    formattedTime: string;
  }>;
}

const PAGE_SIZE = 20;

export const RecientesHistoryModal: React.FC<RecientesHistoryModalProps> = ({
  isOpen,
  onClose,
  onOpenAddToPlaylist,
}) => {
  const { catalog, userPlayHistory, toggleFavorite, isFavorite } = useMusic();
  const { playSong, currentSong, isPlaying, togglePlayPause } = useAudio();
  const [displayCount, setDisplayCount] = useState<number>(PAGE_SIZE);

  // Group userPlayHistory by calendar weeks
  const groupedHistory = useMemo(() => {
    if (!userPlayHistory || userPlayHistory.length === 0) return [];

    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const ONE_WEEK = 7 * ONE_DAY;

    // Filter valid catalog songs and attach playedAt
    const validHistory = userPlayHistory
      .slice(0, displayCount)
      .map((entry) => {
        const song = catalog.find((s) => s.id === entry.songId);
        if (!song) return null;
        return {
          song,
          playedAt: entry.playedAt,
        };
      })
      .filter((item): item is { song: Song; playedAt: string } => Boolean(item));

    const groups: Record<string, HistoryGroup['items']> = {};
    const groupOrder: string[] = [];

    validHistory.forEach((item) => {
      const date = new Date(item.playedAt);
      const timeMs = date.getTime();
      const diffMs = now - timeMs;

      let groupLabel = 'Esta semana';
      if (diffMs > 3 * ONE_WEEK) {
        // Month or older: display formatted week
        const startOfWeek = new Date(timeMs);
        const day = startOfWeek.getDay();
        const diffToMonday = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diffToMonday);
        const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        groupLabel = `Semana del ${startOfWeek.getDate()} de ${monthNames[startOfWeek.getMonth()]}`;
      } else if (diffMs > 2 * ONE_WEEK) {
        groupLabel = 'Hace 3 semanas';
      } else if (diffMs > ONE_WEEK) {
        groupLabel = 'Hace 2 semanas';
      } else if (diffMs > 7 * ONE_DAY) {
        groupLabel = 'Semana pasada';
      } else {
        groupLabel = 'Esta semana';
      }

      if (!groups[groupLabel]) {
        groups[groupLabel] = [];
        groupOrder.push(groupLabel);
      }

      // Format relative or readable time
      let formattedTime = '';
      if (diffMs < ONE_DAY) {
        const hours = Math.floor(diffMs / (60 * 60 * 1000));
        formattedTime = hours <= 1 ? 'Hace poco' : `Hace ${hours} horas`;
      } else {
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        formattedTime = `${dayNames[date.getDay()]} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
      }

      groups[groupLabel].push({
        song: item.song,
        playedAt: item.playedAt,
        formattedTime,
      });
    });

    return groupOrder.map((label) => ({
      label,
      items: groups[label],
    }));
  }, [userPlayHistory, catalog, displayCount]);

  if (!isOpen) return null;

  const totalAvailable = userPlayHistory.length;
  const hasMore = displayCount < totalAvailable;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-xl h-full sm:h-[88vh] bg-[#121212] border border-[#282828] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#242424] flex items-center justify-between flex-shrink-0 bg-[#121212]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/5 text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">
                Recientes
              </h2>
              <p className="text-xs text-[#b3b3b3] mt-0.5">
                Historial completo de reproducción organizado por semanas
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 scrollbar-none">
          {groupedHistory.length === 0 ? (
            <div className="py-20 text-center space-y-2">
              <Clock className="w-10 h-10 text-neutral-500 mx-auto" />
              <h3 className="text-base font-bold text-white">Sin reproducciones recientes</h3>
              <p className="text-xs text-[#b3b3b3] max-w-xs mx-auto">
                La música que escuches en Sonora se guardará automáticamente aquí para que nunca la pierdas.
              </p>
            </div>
          ) : (
            groupedHistory.map((group) => (
              <div key={group.label} className="space-y-2">
                <div className="sticky top-0 bg-[#121212]/95 backdrop-blur-sm py-1 z-10 border-b border-white/5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                    {group.label}
                  </h3>
                </div>

                <div className="space-y-1">
                  {group.items.map((item, idx) => {
                    const isThisPlaying = isPlaying && currentSong?.id === item.song.id;
                    const liked = isFavorite(item.song.id);

                    return (
                      <div
                        key={`${item.song.id}-${item.playedAt}-${idx}`}
                        onClick={() => {
                          if (currentSong?.id === item.song.id) {
                            togglePlayPause();
                          } else {
                            playSong(item.song, [item.song]);
                          }
                        }}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 active:bg-white/10 cursor-pointer transition-colors group"
                      >
                        {/* Cover */}
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0 shadow">
                          <img
                            src={item.song.coverUrl}
                            alt={item.song.title}
                            className="w-full h-full object-cover"
                          />
                          <div
                            className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                              isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            {isThisPlaying ? (
                              <Pause className="w-5 h-5 fill-white text-white" />
                            ) : (
                              <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                            )}
                          </div>
                        </div>

                        {/* Title & Artist */}
                        <div className="min-w-0 flex-1">
                          <h4
                            className={`text-sm font-semibold truncate ${
                              isThisPlaying ? 'text-emerald-400 font-bold' : 'text-white'
                            }`}
                          >
                            {item.song.title}
                          </h4>
                          <p className="text-xs text-[#b3b3b3] truncate mt-0.5">
                            {item.song.artist}
                          </p>
                        </div>

                        {/* Time & actions */}
                        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[11px] text-[#727272]">
                            {item.formattedTime}
                          </span>

                          <button
                            type="button"
                            onClick={() => toggleFavorite(item.song.id)}
                            className="p-1.5 text-neutral-400 hover:text-white transition-transform active:scale-90"
                            title={liked ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                          >
                            {liked ? (
                              <SavedCheckIcon size={16} />
                            ) : (
                              <Heart className="w-4 h-4" />
                            )}
                          </button>

                          {onOpenAddToPlaylist && (
                            <button
                              type="button"
                              onClick={() => onOpenAddToPlaylist(item.song)}
                              className="p-1.5 text-neutral-400 hover:text-white transition-colors"
                              title="Añadir a playlist"
                            >
                              <PlusCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {/* Pagination Ver más button */}
          {hasMore && (
            <div className="pt-4 pb-2 text-center">
              <button
                type="button"
                onClick={() => setDisplayCount((prev) => prev + PAGE_SIZE)}
                className="px-6 py-2.5 rounded-full bg-[#242424] hover:bg-[#2c2c2c] text-white text-xs font-bold transition-all active:scale-95 shadow"
              >
                Ver más ({totalAvailable - displayCount} restantes)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecientesHistoryModal;
