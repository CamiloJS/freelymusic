import React, { useEffect } from 'react';
import Pin from 'lucide-react/dist/esm/icons/pin.mjs';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Trash2 from 'lucide-react/dist/esm/icons/trash.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import { Playlist } from '../types';

export interface PlaylistMenuState {
  playlist: Playlist;
  x: number;
  y: number;
}

interface PlaylistContextMenuProps {
  state: PlaylistMenuState | null;
  pinned: boolean;
  onClose: () => void;
  onTogglePin: (playlistId: string) => void;
  onPlay?: (playlist: Playlist) => void;
  onDelete?: (playlist: Playlist) => void;
}

/**
 * Spotify-style context menu for a playlist. It opens on right click
 * (desktop) or on a long press (touch devices).
 */
export const PlaylistContextMenu: React.FC<PlaylistContextMenuProps> = ({
  state,
  pinned,
  onClose,
  onTogglePin,
  onPlay,
  onDelete,
}) => {
  useEffect(() => {
    if (!state) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [state, onClose]);

  if (!state) return null;

  const width = 232;
  const height = onDelete ? 196 : 146;
  const left = Math.max(8, Math.min(state.x, window.innerWidth - width - 8));
  const top = Math.max(8, Math.min(state.y, window.innerHeight - height - 8));

  return (
    <div
      className="fixed inset-0 z-[60]"
      onClick={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        className="absolute rounded-xl border border-white/10 bg-[#282828] p-1.5 shadow-2xl shadow-black/60 animate-in fade-in zoom-in-95 duration-100"
        style={{ left, top, width }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-white/10 mb-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Playlist
          </p>
          <p className="truncate text-xs font-bold text-white">{state.playlist.name}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            onTogglePin(state.playlist.id);
            onClose();
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-neutral-200 hover:bg-white/10 transition-colors"
        >
          <Pin
            className={`h-4 w-4 transition-transform ${
              pinned
                ? 'text-emerald-400 fill-emerald-400 rotate-45'
                : 'text-neutral-400'
            }`}
          />
          <span className="flex-1">{pinned ? 'Desfijar playlist' : 'Fijar playlist'}</span>
          {pinned && <Check className="h-4 w-4 text-emerald-400" />}
        </button>

        {onPlay && (
          <button
            type="button"
            onClick={() => {
              onPlay(state.playlist);
              onClose();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-neutral-200 hover:bg-white/10 transition-colors"
          >
            <Play className="h-4 w-4 text-neutral-400" />
            <span>Reproducir</span>
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            onClick={() => {
              onDelete(state.playlist);
              onClose();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-red-300 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            <span>Eliminar playlist</span>
          </button>
        )}
      </div>
    </div>
  );
};
