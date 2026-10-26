import React, { useState } from 'react';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import Music from 'lucide-react/dist/esm/icons/eighth-notes.mjs';
import { useMusic } from '../context/MusicContext';
import { Song } from '../types';

interface AddToPlaylistModalProps {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenCreatePlaylist: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  song,
  isOpen,
  onClose,
  onOpenCreatePlaylist,
}) => {
  const { playlists, addSongToPlaylist, removeSongFromPlaylist } = useMusic();

  if (!isOpen || !song) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-neutral-400 hover:text-white p-1 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4">
          <h3 className="font-extrabold text-white text-lg">Añadir a playlist</h3>
          <p className="text-xs text-neutral-400 truncate mt-0.5">
            {song.title} • {song.artist}
          </p>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {playlists.length === 0 ? (
            <p className="text-xs text-neutral-500 py-4 text-center">
              No tienes playlists creadas todavía.
            </p>
          ) : (
            playlists.map((pl) => {
              const isIn = pl.songIds.includes(song.id);
              return (
                <div
                  key={pl.id}
                  onClick={() => {
                    if (isIn) {
                      removeSongFromPlaylist(pl.id, song.id);
                    } else {
                      addSongToPlaylist(pl.id, song.id);
                    }
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                    isIn
                      ? 'bg-emerald-950/40 border-emerald-500/40'
                      : 'bg-neutral-950/60 border-neutral-800/80 hover:bg-neutral-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className="w-9 h-9 rounded-lg bg-neutral-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {pl.coverUrl ? (
                        <img src={pl.coverUrl} alt={pl.name} className="w-full h-full object-cover" />
                      ) : (
                        <Music className="w-4 h-4 text-neutral-500" />
                      )}
                    </div>
                    <div className="truncate">
                      <span className="block text-xs font-bold text-white truncate">{pl.name}</span>
                      <span className="block text-[10px] text-neutral-500">
                        {pl.songIds.length} canciones
                      </span>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                      isIn
                        ? 'bg-emerald-500 border-emerald-400 text-black'
                        : 'border-neutral-600'
                    }`}
                  >
                    {isIn && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-5 pt-3 border-t border-neutral-800">
          <button
            onClick={() => {
              onClose();
              onOpenCreatePlaylist();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-emerald-400 font-bold text-xs tracking-wide transition-all"
          >
            <Plus className="w-4 h-4" />
            Nueva Playlist
          </button>
        </div>
      </div>
    </div>
  );
};
