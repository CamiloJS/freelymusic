import React, { useState, useRef } from 'react';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Upload from 'lucide-react/dist/esm/icons/upload.mjs';
import Image from 'lucide-react/dist/esm/icons/image.mjs';
import Lock from 'lucide-react/dist/esm/icons/lock.mjs';
import Globe from 'lucide-react/dist/esm/icons/globe.mjs';
import FolderPlus from 'lucide-react/dist/esm/icons/folder-plus.mjs';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.mjs';
import { useMusic } from '../context/MusicContext';
import { compressImage } from '../utils/imageCompressor';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({ isOpen, onClose }) => {
  const { createPlaylist } = useMusic();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const compressedDataUrl = await compressImage(file, 600, 0.85);
      setCoverUrl(compressedDataUrl);
    } catch (err) {
      console.warn('Error al procesar la imagen:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createPlaylist(name.trim(), description.trim(), coverUrl.trim(), isPublic);
    setName('');
    setDescription('');
    setCoverUrl('');
    setIsPublic(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-neutral-400 hover:text-white p-1 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400">
            <FolderPlus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-white text-lg">Nueva Playlist</h3>
            <p className="text-xs text-neutral-400">Crea una lista con tu propia imagen y privacidad</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Custom Cover Upload */}
          <div>
            <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
              Carátula de la Playlist
            </label>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {coverUrl ? (
              <div className="flex items-center gap-4 p-3 bg-neutral-950 rounded-2xl border border-neutral-800">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-neutral-900 flex-shrink-0 shadow relative group">
                  <img src={coverUrl} alt="Vista previa" className="w-full h-full object-cover" />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-white text-[10px] font-bold"
                  >
                    Cambiar
                  </div>
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <span className="text-xs font-bold text-white block truncate">
                    Imagen personalizada cargada
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-emerald-400 hover:underline font-semibold"
                    >
                      Subir otra
                    </button>
                    <span className="text-neutral-600">•</span>
                    <button
                      type="button"
                      onClick={() => setCoverUrl('')}
                      className="text-xs text-red-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Quitar</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-6 px-4 border-2 border-dashed border-neutral-800 hover:border-emerald-500/50 rounded-2xl bg-neutral-950/60 hover:bg-neutral-950 cursor-pointer flex flex-col items-center justify-center gap-2 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-neutral-800 group-hover:bg-emerald-500/20 text-neutral-400 group-hover:text-emerald-400 flex items-center justify-center transition-colors">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <span className="text-xs font-bold text-neutral-200 group-hover:text-white block">
                    {isUploading ? 'Procesando imagen...' : 'Sube una imagen desde tu dispositivo'}
                  </span>
                  <span className="text-[11px] text-neutral-500 block mt-0.5">
                    PNG, JPG o WebM (se optimizará automáticamente)
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
              Nombre de la Playlist *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Favoritas 2026, Gym, Relax..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
              Descripción (Opcional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Una breve descripción..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Privacy Selector: Pública vs Privada */}
          <div>
            <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
              Privacidad
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                  !isPublic
                    ? 'bg-neutral-800 border-emerald-500/50 text-white shadow-md'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <div className={`p-2 rounded-lg ${!isPublic ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-900 text-neutral-500'}`}>
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold block">Privada</span>
                  <span className="text-[10px] text-neutral-500 block leading-tight">Solo visible para ti</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                  isPublic
                    ? 'bg-neutral-800 border-emerald-500/50 text-white shadow-md'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <div className={`p-2 rounded-lg ${isPublic ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-900 text-neutral-500'}`}>
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold block">Pública</span>
                  <span className="text-[10px] text-neutral-500 block leading-tight">Visible para otros perfiles</span>
                </div>
              </button>
            </div>
          </div>

          <div className="pt-3 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold text-sm transition-colors shadow-lg shadow-emerald-500/20"
            >
              Crear Playlist
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
