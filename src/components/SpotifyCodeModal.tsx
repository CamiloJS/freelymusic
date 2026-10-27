import React, { useState } from 'react';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Share2 from 'lucide-react/dist/esm/icons/share-2.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import { Song } from '../types';
import { SpotifyCode } from './SpotifyCode';

interface SpotifyCodeModalProps {
  song: Song;
  isOpen: boolean;
  onClose: () => void;
}

export const SpotifyCodeModal: React.FC<SpotifyCodeModalProps> = ({
  song,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleShare = async () => {
    const text = `Escucha "${song.title}" de ${song.artist} en Spotify`;
    const url = `${window.location.origin}/#/track/${song.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: song.title, text, url });
        return;
      } catch {}
    }
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-5 select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-[#181818] border border-[#282828] p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col items-center text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white rounded-full bg-neutral-900/60"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Artwork */}
        <div className="w-52 h-52 rounded-xl overflow-hidden shadow-2xl shadow-black/80 my-2">
          <img
            src={song.coverUrl}
            alt={song.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Title and artist */}
        <h3 className="font-extrabold text-white text-lg mt-3 truncate max-w-[260px]">
          {song.title}
        </h3>
        <p className="text-xs text-neutral-400 truncate max-w-[240px] mt-0.5">
          {song.artist}
        </p>

        {/* Spotify Soundwave Code Bar */}
        <div className="w-full bg-[#121212] border border-[#282828] rounded-2xl py-3 px-5 my-4 flex items-center justify-center shadow-inner">
          <SpotifyCode song={song} barColor="#1DB954" className="w-full justify-center" />
        </div>

        {/* Share Button */}
        <button
          onClick={handleShare}
          className="w-full py-3 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 mt-1"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 stroke-[3]" />
              <span>¡Enlace copiado!</span>
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4 stroke-[2.5]" />
              <span>Compartir código</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
