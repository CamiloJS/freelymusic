import React from 'react';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.mjs';
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.mjs';
import Languages from 'lucide-react/dist/esm/icons/languages.mjs';
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

const SOURCE_LANGUAGES = [
  { code: 'auto', label: 'Auto' },
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'ja', label: 'JA' },
  { code: 'ko', label: 'KO' },
  { code: 'fr', label: 'FR' },
  { code: 'pt', label: 'PT' },
  { code: 'it', label: 'IT' },
  { code: 'de', label: 'DE' },
];

interface LyricsTranslationControlsProps {
  compact?: boolean;
  className?: string;
}

export const LyricsTranslationControls: React.FC<LyricsTranslationControlsProps> = ({
  compact = false,
  className = '',
}) => {
  const {
    parsedLyrics,
    translatedLyrics,
    lyricsDisplayMode,
    setLyricsDisplayMode,
    translationLang,
    setTranslationLang,
    translationSourceLang,
    setTranslationSourceLang,
    translationStatus,
    translationError,
    translationProvider,
    translationUpdatedAt,
    translateCurrentLyrics,
    clearTranslation,
  } = useAudio();

  if (parsedLyrics.length === 0) return null;

  const isTranslating = translationStatus === 'loading';
  const hasTranslation = translatedLyrics.length > 0;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="inline-flex items-center gap-1 rounded-full bg-neutral-900/90 border border-neutral-800 p-1">
        {(['original', 'translation', 'both'] as const).map((mode) => {
          const label =
            mode === 'original' ? 'Original' : mode === 'translation' ? 'Traducción' : 'Ambas';
          const disabled = mode !== 'original' && !hasTranslation;
          return (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              onClick={() => setLyricsDisplayMode(mode)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors disabled:opacity-35 ${
                lyricsDisplayMode === mode
                  ? 'bg-white text-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="inline-flex items-center gap-1 rounded-full bg-neutral-900/90 border border-neutral-800 px-2 py-1">
        <Languages className="w-3 h-3 text-emerald-400" />
        <label className="sr-only" htmlFor="translation-source">
          Idioma original
        </label>
        <select
          id="translation-source"
          value={translationSourceLang}
          onChange={(event) => setTranslationSourceLang(event.target.value)}
          className="bg-transparent text-[10px] font-bold text-neutral-300 outline-none"
          title="Idioma original"
        >
          {SOURCE_LANGUAGES.map((language) => (
            <option key={language.code} value={language.code} className="bg-neutral-900">
              {language.label}
            </option>
          ))}
        </select>
        <span className="text-neutral-600 text-[10px]">→</span>
        <label className="sr-only" htmlFor="translation-target">
          Idioma de la traducción
        </label>
        <select
          id="translation-target"
          value={translationLang}
          onChange={(event) => setTranslationLang(event.target.value)}
          className="bg-transparent text-[10px] font-bold text-emerald-300 outline-none"
          title="Idioma de la traducción"
        >
          {TARGET_LANGUAGES.map((language) => (
            <option key={language.code} value={language.code} className="bg-neutral-900">
              {language.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => void translateCurrentLyrics()}
        disabled={isTranslating}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-black transition-colors disabled:opacity-50"
        title="Traducir la letra manteniendo los tiempos originales"
      >
        {isTranslating ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Sparkles className="w-3 h-3" />
        )}
        <span>{isTranslating ? 'Traduciendo...' : 'Traducir letra'}</span>
      </button>

      {hasTranslation && (
        <button
          type="button"
          onClick={clearTranslation}
          className="text-[10px] font-bold text-neutral-500 hover:text-red-400 transition-colors"
          title="Quitar la traducción de esta vista"
        >
          Quitar
        </button>
      )}

      {!compact && translationProvider && translationUpdatedAt && (
        <span className="text-[10px] text-neutral-500">
          {translationProvider} · {new Date(translationUpdatedAt).toLocaleDateString()}
        </span>
      )}

      {translationError && (
        <span className="text-[10px] text-red-400 font-semibold max-w-xs truncate" title={translationError}>
          {translationError}
        </span>
      )}
    </div>
  );
};
