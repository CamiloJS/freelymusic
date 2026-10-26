import React from 'react';
import HardDriveDownload from 'lucide-react/dist/esm/icons/hard-drive-download.mjs';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Trash2 from 'lucide-react/dist/esm/icons/trash.mjs';
import Disc from 'lucide-react/dist/esm/icons/disc.mjs';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.mjs';
import WifiOff from 'lucide-react/dist/esm/icons/wifi-off.mjs';
import Music from 'lucide-react/dist/esm/icons/eighth-notes.mjs';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { formatTime } from '../utils/lyrics';

export const OfflineView: React.FC = () => {
  const { catalog, downloadedSongIds, toggleDownloadSong, downloadSingleSongFile } = useMusic();
  const { playSong, currentSong } = useAudio();

  const downloadedSongs = catalog.filter((s) => downloadedSongIds.includes(s.id));

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950/40 via-neutral-900 to-black p-6 rounded-3xl border border-emerald-500/20 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-2">
            <HardDriveDownload className="w-4 h-4" />
            <span>Almacenamiento Local PWA</span>
          </div>
          <h1 className="text-3xl font-black text-white">Música Sin Conexión</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Canciones almacenadas en el caché local de la aplicación. Puedes escucharlas incluso en modo avión o sin cobertura.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-neutral-900/90 border border-neutral-800 px-5 py-3 rounded-2xl flex-shrink-0">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
            <WifiOff className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-xl font-black text-white">
              {downloadedSongs.length}
            </span>
            <span className="block text-[11px] text-neutral-400">
              canciones disponibles offline
            </span>
          </div>
        </div>
      </div>

      {downloadedSongs.length === 0 ? (
        <div className="p-16 text-center text-neutral-500 bg-neutral-900/30 border border-neutral-800/60 rounded-3xl space-y-3">
          <HardDriveDownload className="w-12 h-12 mx-auto text-neutral-600" />
          <h3 className="font-bold text-lg text-neutral-300">No hay canciones descargadas</h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            Toca el botón de descarga en cualquier canción para guardarla y escucharla sin gastar tus datos móviles.
          </p>
        </div>
      ) : (
        <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-3xl overflow-hidden divide-y divide-neutral-800/40">
          <div className="p-4 bg-neutral-900/80 flex items-center justify-between text-xs text-neutral-400 font-bold uppercase">
            <span>Canción Guardada</span>
            <span>Duración y Acciones</span>
          </div>

          {downloadedSongs.map((song, idx) => {
            const isCurrent = currentSong?.id === song.id;
            return (
              <div
                key={song.id}
                onClick={() => playSong(song, downloadedSongs)}
                className="flex items-center justify-between p-3.5 hover:bg-neutral-800/50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 truncate">
                  <span className="text-xs font-mono text-neutral-500 w-5 text-right flex-shrink-0 group-hover:hidden">
                    {idx + 1}
                  </span>
                  <button className="w-5 text-emerald-400 flex-shrink-0 hidden group-hover:block">
                    <Play className="w-4 h-4 fill-current" />
                  </button>

                  <img
                    src={song.coverUrl}
                    alt={song.title} loading="lazy" decoding="async"
                    className="w-11 h-11 rounded-xl object-cover flex-shrink-0 shadow"
                  />

                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-bold truncate ${
                          isCurrent ? 'text-emerald-400' : 'text-white'
                        }`}
                      >
                        {song.title}
                      </span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    </div>
                    <span className="block text-xs text-neutral-400 truncate mt-0.5">
                      {song.artist} • {song.album || 'Sonora Audio'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="text-xs font-mono text-neutral-400">
                    {formatTime(song.duration)}
                  </span>

                  {/* Download to PC/Phone */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadSingleSongFile(song);
                    }}
                    className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                    title="Exportar archivo de audio al dispositivo"
                  >
                    <Disc className="w-4 h-4" />
                  </button>

                  {/* Remove from offline cache */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDownloadSong(song);
                    }}
                    className="p-2 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                    title="Eliminar de almacenamiento local"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
