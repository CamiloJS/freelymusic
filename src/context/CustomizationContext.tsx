import React, { createContext, useContext, useState, useEffect } from 'react';
import type { GlobalAppSettings } from '../services/firebase';
import { loadFirebaseService } from '../services/firebaseLoader';
import {
  getCustomAppIcon,
  setCustomAppIcon,
  removeCustomAppIcon,
  applyAppIcon,
  cachePwaIcons,
} from '../utils/appIcon';

export type ThemeMode = 'dark' | 'light' | 'system';

export interface AccentColorPreset {
  id: string;
  name: string;
  color: string;
  hover: string;
}

export const ACCENT_PRESETS: AccentColorPreset[] = [
  { id: 'emerald', name: 'Verde Esmeralda', color: '#10b981', hover: '#059669' },
  { id: 'purple', name: 'Morado Eléctrico', color: '#8b5cf6', hover: '#7c3aed' },
  { id: 'blue', name: 'Azul Océano', color: '#3b82f6', hover: '#2563eb' },
  { id: 'pink', name: 'Rosa Neón', color: '#ec4899', hover: '#db2777' },
  { id: 'red', name: 'Rojo Pasión', color: '#ef4444', hover: '#dc2626' },
  { id: 'amber', name: 'Ámbar Dorado', color: '#f59e0b', hover: '#d97706' },
  { id: 'cyan', name: 'Cian Futurista', color: '#06b6d4', hover: '#0891b2' },
];

const THEME_STORAGE_KEY = 'musica_theme_mode';
const ACCENT_STORAGE_KEY = 'musica_accent_color';
const APP_NAME_STORAGE_KEY = 'musica_app_name';
const GLOBAL_APP_NAME_KEY = 'musica_global_app_name';
const LASTFM_KEY_STORAGE_KEY = 'musica_lastfm_api_key';

interface CustomizationContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  accentColor: string;
  accentHover: string;
  setAccentColorById: (presetId: string) => void;
  setCustomAccentColor: (color: string) => void;
  appName: string;
  setCustomAppName: (name: string) => void;
  setGlobalAppName: (name: string) => Promise<void>;
  lastfmApiKey: string;
  setGlobalLastfmKey: (key: string) => Promise<void>;
  globalIcons: string[];
  uploadGlobalIcon: (iconDataUrl: string) => Promise<void>;
  appIcon: string | null;
  selectIcon: (iconUrl: string) => void;
  resetIcon: () => void;
}

const CustomizationContext = createContext<CustomizationContextType | undefined>(undefined);

export const CustomizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Theme Mode (Dark vs Light vs System, default 'dark')
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      return (saved === 'light' || saved === 'dark' || saved === 'system') ? (saved as ThemeMode) : 'dark';
    } catch {
      return 'dark';
    }
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const effectiveTheme = themeMode === 'system' ? (systemIsDark ? 'dark' : 'light') : themeMode;

  // Apply theme to DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // ignore
    }
  }, [themeMode, effectiveTheme]);

  // 2. Accent Color
  const [accentColor, setAccentColor] = useState<string>(() => {
    try {
      return localStorage.getItem(ACCENT_STORAGE_KEY) || '#10b981';
    } catch {
      return '#10b981';
    }
  });

  const [accentHover, setAccentHover] = useState<string>(() => {
    const match = ACCENT_PRESETS.find((p) => p.color === accentColor);
    return match ? match.hover : '#059669';
  });

  // 3. App Name (local override -> cached global name -> default)
  const [appName, setAppName] = useState<string>(() => {
    try {
      return (
        localStorage.getItem(APP_NAME_STORAGE_KEY) ||
        localStorage.getItem(GLOBAL_APP_NAME_KEY) ||
        'Música'
      );
    } catch {
      return 'Música';
    }
  });

  // 4. Global Settings from Firestore (Global App Name & Admin Icon Gallery)
  const [globalIcons, setGlobalIcons] = useState<string[]>([]);
  const [appIcon, setAppIconState] = useState<string | null>(() => getCustomAppIcon());
  const [lastfmApiKey, setLastfmApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem(LASTFM_KEY_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    document.documentElement.style.setProperty('--brand-color', accentColor);
    document.documentElement.style.setProperty('--brand-hover', accentHover);
    localStorage.setItem(ACCENT_STORAGE_KEY, accentColor);
  }, [accentColor, accentHover]);

  // Do not write the default name to localStorage here: doing so made a new
  // device think the user had a local override and it never adopted the
  // global app name from Firestore.
  useEffect(() => {
    const safeName = appName || 'Música';
    document.title = safeName;
    document
      .querySelector('meta[name="apple-mobile-web-app-title"]')
      ?.setAttribute('content', safeName);
    document
      .querySelector('meta[name="application-name"]')
      ?.setAttribute('content', safeName);
  }, [appName]);

  // Sync Global Settings from Firestore (Cloud Gallery & Global App Name)
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const applyGlobalSettings = (settings: GlobalAppSettings) => {
      if (cancelled) return;

      if (settings.globalIcons && settings.globalIcons.length > 0) {
        setGlobalIcons(settings.globalIcons);
        const currentIcon = getCustomAppIcon();
        if (!currentIcon) {
          // Default to the first Spotify icon set by admin globally
          applyAppIcon(settings.globalIcons[0]);
          cachePwaIcons(settings.globalIcons[0]).catch(() => {});
        }
      }

      if (settings.globalAppName) {
        try {
          localStorage.setItem(GLOBAL_APP_NAME_KEY, settings.globalAppName);
        } catch {
          // ignore quota/private-mode errors
        }

        let local: string | null = null;
        try {
          local = localStorage.getItem(APP_NAME_STORAGE_KEY);
        } catch {
          // ignore
        }
        if (!local || local === 'Música') {
          setAppName(settings.globalAppName);
        }
      }

      if (typeof settings.lastfmApiKey === 'string') {
        setLastfmApiKey(settings.lastfmApiKey);
        try {
          if (settings.lastfmApiKey) {
            localStorage.setItem(LASTFM_KEY_STORAGE_KEY, settings.lastfmApiKey);
          } else {
            localStorage.removeItem(LASTFM_KEY_STORAGE_KEY);
          }
        } catch {
          // ignore
        }
      }
    };

    loadFirebaseService()
      .then(async (firebase) => {
        const settings = await firebase.syncGlobalSettingsFromFirestore();
        if (settings) applyGlobalSettings(settings);
      })
      .catch((err) => console.warn('No se pudieron cargar los ajustes globales:', err));

    loadFirebaseService()
      .then((firebase) =>
        firebase.subscribeToGlobalSettingsUpdates(
          applyGlobalSettings,
          (err) => console.warn('No se pudieron sincronizar los ajustes globales:', err)
        )
      )
      .then((unsub) => {
        if (cancelled) {
          unsub?.();
        } else {
          unsubscribe = unsub;
        }
      })
      .catch((err) => console.warn('No se pudo escuchar los ajustes globales:', err));

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  const toggleTheme = () => {
    setThemeModeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setAccentColorById = (presetId: string) => {
    const preset = ACCENT_PRESETS.find((p) => p.id === presetId) || ACCENT_PRESETS[0];
    setAccentColor(preset.color);
    setAccentHover(preset.hover);
  };

  const setCustomAccentColor = (color: string) => {
    setAccentColor(color);
    setAccentHover(color);
  };

  const setCustomAppName = (name: string) => {
    const clean = name.trim() || 'Música';
    setAppName(clean);
    try {
      localStorage.setItem(APP_NAME_STORAGE_KEY, clean);
    } catch {
      // ignore
    }
  };

  const setGlobalAppName = async (name: string) => {
    const clean = name.trim() || 'Música';
    setAppName(clean);
    try {
      localStorage.setItem(APP_NAME_STORAGE_KEY, clean);
      localStorage.setItem(GLOBAL_APP_NAME_KEY, clean);
    } catch {
      // ignore
    }
    const firebase = await loadFirebaseService();
    await firebase.saveGlobalSettingsToFirestore({ globalAppName: clean });
  };

  const setGlobalLastfmKey = async (key: string) => {
    const clean = key.trim();
    setLastfmApiKey(clean);
    try {
      if (clean) {
        localStorage.setItem(LASTFM_KEY_STORAGE_KEY, clean);
      } else {
        localStorage.removeItem(LASTFM_KEY_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
    const firebase = await loadFirebaseService();
    await firebase.saveGlobalSettingsToFirestore({ lastfmApiKey: clean });
  };

  const uploadGlobalIcon = async (iconDataUrl: string) => {
    const updated = [iconDataUrl, ...globalIcons.filter((i) => i !== iconDataUrl)];
    setGlobalIcons(updated);
    const firebase = await loadFirebaseService();
    await firebase.saveGlobalSettingsToFirestore({ globalIcons: updated });
    // Also apply it locally
    selectIcon(iconDataUrl);
  };

  const selectIcon = (iconUrl: string) => {
    setCustomAppIcon(iconUrl);
    setAppIconState(iconUrl);
    applyAppIcon(iconUrl);
  };

  const resetIcon = () => {
    removeCustomAppIcon();
    setAppIconState(null);
  };

  return (
    <CustomizationContext.Provider
      value={{
        themeMode,
        setThemeMode,
        toggleTheme,
        accentColor,
        accentHover,
        setAccentColorById,
        setCustomAccentColor,
        appName,
        setCustomAppName,
        setGlobalAppName,
        lastfmApiKey,
        setGlobalLastfmKey,
        globalIcons,
        uploadGlobalIcon,
        appIcon,
        selectIcon,
        resetIcon,
      }}
    >
      {children}
    </CustomizationContext.Provider>
  );
};

export const useCustomization = () => {
  const context = useContext(CustomizationContext);
  if (!context) {
    throw new Error('useCustomization must be used within a CustomizationProvider');
  }
  return context;
};
