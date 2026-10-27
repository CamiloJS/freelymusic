import React, { useState, useRef, useEffect } from 'react';
import Languages from 'lucide-react/dist/esm/icons/languages.mjs';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.mjs';
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import { useAudio } from '../context/AudioContext';

const TARGET_LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'de', label: 'Deutsch' },
];

interface LyricsTranslationButtonProps {
  className?: string;
  dropDirection?: 'up' | 'down';
}

export const LyricsTranslationButton: React.FC<LyricsTranslationButtonProps> = ({
  className = '',
  dropDirection = 'up',
}) => {
  const {
    parsedLyrics,
    translatedLyrics,
    lyricsDisplayMode,
    setLyricsDisplayMode,
    translationLang,
    setTranslationLang,
    translationStatus,
    translateCurrentLyrics,
    clearTranslation,
  } = useAudio();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (parsedLyrics.length === 0) return null;

  const isTranslating = translationStatus === 'loading';
  const hasTranslation = translatedLyrics.length > 0;
  const isTranslationActive = lyricsDisplayMode !== 'original' && hasTranslation;

  const handleToggleOrTranslate = async () => {
    if (!hasTranslation) {
      // First click: trigger translation to chosen target language (defaults to 'es')
      await translateCurrentLyrics();
      setLyricsDisplayMode('both');
    } else {
      // Toggle between original, both, and translation
      if (lyricsDisplayMode === 'original') {
        setLyricsDisplayMode('both');
      } else if (lyricsDisplayMode === 'both') {
        setLyricsDisplayMode('translation');
      } else {
        setLyricsDisplayMode('original');
      }
    }
  };

  const handleSelectLanguage = async (code: string) => {
    setTranslationLang(code);
    await translateCurrentLyrics(code);
    setLyricsDisplayMode('both');
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Subtle Google Translate style button (A - 文 icon) */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleToggleOrTranslate}
          disabled={isTranslating}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all backdrop-blur-md border ${
            isTranslationActive
              ? 'bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/20 font-black'
              : 'bg-white/10 hover:bg-white/20 text-white/90 border-white/10'
          }`}
          title={
            isTranslating
              ? 'Traduciendo letra...'
              : hasTranslation
              ? `Letra traducida al ${TARGET_LANGUAGES.find((l) => l.code === translationLang)?.label || 'Español'} (clic para alternar modo)`
              : 'Traducir letra de canción'
          }
        >
          {isTranslating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          ) : (
            <Languages className={`w-3.5 h-3.5 ${isTranslationActive ? 'text-black' : 'text-emerald-400'}`} />
          )}
          <span className="text-[11px] uppercase tracking-wide">
            {isTranslating ? 'Traduciendo...' : translationLang.toUpperCase()}
          </span>
        </button>

        {/* Small settings arrow / options button to change language or display mode */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`p-1.5 rounded-full transition-colors border backdrop-blur-md ${
            isOpen
              ? 'bg-white/30 text-white border-white/30'
              : 'bg-white/10 hover:bg-white/20 text-white/80 border-white/10'
          }`}
          title="Opciones de idioma y traducción"
        >
          <span className="text-[9px] font-mono leading-none select-none">▾</span>
        </button>
      </div>

      {/* Floating Settings Popover */}
      {isOpen && (
        <div
          className={`absolute ${
            dropDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
          } right-0 w-64 p-3 rounded-2xl bg-neutral-900/95 border border-white/15 shadow-2xl backdrop-blur-xl z-50 text-left select-none animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-emerald-400" />
              <span>Traductor de letras</span>
            </span>
            {hasTranslation && (
              <button
                type="button"
                onClick={() => {
                  clearTranslation();
                  setIsOpen(false);
                }}
                className="text-[10px] text-neutral-400 hover:text-red-400 transition-colors"
              >
                Restablecer
              </button>
            )}
          </div>

          {/* Mode Selector */}
          <div className="mb-3">
            <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold block mb-1.5">
              Modo de vista
            </span>
            <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
              {(['original', 'both', 'translation'] as const).map((mode) => {
                const label =
                  mode === 'original' ? 'Original' : mode === 'both' ? 'Ambas' : 'Traducida';
                const disabled = mode !== 'original' && !hasTranslation;
                const isSelected = lyricsDisplayMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setLyricsDisplayMode(mode);
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all disabled:opacity-30 ${
                      isSelected
                        ? 'bg-white text-black shadow-sm'
                        : 'text-neutral-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Language Grid */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold block mb-1.5">
              Traducir a
            </span>
            <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto pr-1">
              {TARGET_LANGUAGES.map((lang) => {
                const isCurrent = translationLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleSelectLanguage(lang.code)}
                    disabled={isTranslating}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors text-left ${
                      isCurrent
                        ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                        : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span>{lang.label}</span>
                    {isCurrent && <Check className="w-3 h-3 text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
