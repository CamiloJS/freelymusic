import React, { useState } from 'react';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Sliders from 'lucide-react/dist/esm/icons/sliders.mjs';
import Sun from 'lucide-react/dist/esm/icons/sun.mjs';
import Moon from 'lucide-react/dist/esm/icons/moon.mjs';
import Laptop from 'lucide-react/dist/esm/icons/laptop.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import { useCustomization, ACCENT_PRESETS, ThemeMode } from '../context/CustomizationContext';
import { DownloadedIcon } from './DownloadedIcon';
import { SavedCheckIcon } from './SavedCheckIcon';

interface CustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomizeModal: React.FC<CustomizeModalProps> = ({ isOpen, onClose }) => {
  const {
    themeMode,
    setThemeMode,
    accentColor,
    setAccentColorById,
    setCustomAccentColor,
  } = useCustomization();

  const [customHex, setCustomHex] = useState(accentColor);

  if (!isOpen) return null;

  const handleCustomColorChange = (color: string) => {
    setCustomHex(color);
    setCustomAccentColor(color);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-md bg-[#121212] border border-[#282828] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#242424] flex items-center justify-between bg-[#121212]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/5 text-emerald-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Personalizar aplicación
              </h2>
              <p className="text-xs text-[#b3b3b3] mt-0.5">
                Tema visual y color de acento para todos los controles
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-5 overflow-y-auto max-h-[75vh] scrollbar-none">
          
          {/* 1. Theme Mode Switcher */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-neutral-400 block">
              Tema visual
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'dark', label: 'Oscuro', icon: Moon },
                { id: 'light', label: 'Claro', icon: Sun },
                { id: 'system', label: 'Sistema', icon: Laptop },
              ].map(({ id, label, icon: Icon }) => {
                const isActive = themeMode === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setThemeMode(id as ThemeMode)}
                    className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 ${
                      isActive
                        ? 'bg-white/10 border-emerald-400 text-white font-bold shadow-md'
                        : 'bg-[#181818] border-[#282828] text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400' : ''}`} />
                    <span className="text-xs">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Accent Color Palette */}
          <div className="space-y-2.5">
            <label className="text-xs font-black uppercase tracking-wider text-neutral-400 block">
              Color de acento
            </label>
            <p className="text-xs text-[#b3b3b3]">
              Personaliza el color de los botones de reproducción, descargas, me gusta y elementos activos.
            </p>

            <div className="grid grid-cols-4 gap-2.5 pt-1">
              {ACCENT_PRESETS.map((preset) => {
                const isSelected = accentColor.toLowerCase() === preset.color.toLowerCase();
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setAccentColorById(preset.id);
                      setCustomHex(preset.color);
                    }}
                    className={`h-12 rounded-xl flex items-center justify-center transition-transform active:scale-90 relative shadow-sm border ${
                      isSelected ? 'ring-2 ring-white scale-105 border-white' : 'border-black/20'
                    }`}
                    style={{ backgroundColor: preset.color }}
                    title={preset.name}
                  >
                    {isSelected && <Check className="w-5 h-5 text-black stroke-[3]" />}
                  </button>
                );
              })}
            </div>

            {/* Custom Color input */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#181818] border border-[#282828] mt-2">
              <div className="relative w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 border border-white/20 shadow">
                <input
                  type="color"
                  value={customHex}
                  onChange={(e) => handleCustomColorChange(e.target.value)}
                  className="absolute -top-3 -left-3 w-16 h-16 cursor-pointer"
                />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-white block">Color personalizado</span>
                <span className="text-[11px] text-[#b3b3b3] block uppercase font-mono mt-0.5">
                  {accentColor}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Live Interactive Preview */}
          <div className="p-4 rounded-2xl bg-[#181818] border border-[#282828] space-y-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
              Vista previa interactiva
            </span>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-colors"
                  style={{ backgroundColor: accentColor }}
                >
                  <Play className="w-4 h-4 fill-black text-black ml-0.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold truncate" style={{ color: accentColor }}>
                    Canción en reproducción
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#b3b3b3]">
                    <DownloadedIcon size={13} />
                    <span>Descargado</span>
                    <span>•</span>
                    <SavedCheckIcon size={14} />
                    <span>Me gusta</span>
                  </div>
                </div>
              </div>

              <div
                className="px-3 py-1 rounded-full text-xs font-bold text-black"
                style={{ backgroundColor: accentColor }}
              >
                Activo
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#242424] flex items-center justify-end bg-[#121212]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full font-bold text-xs text-black shadow-md transition-transform active:scale-95"
            style={{ backgroundColor: accentColor }}
          >
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomizeModal;
