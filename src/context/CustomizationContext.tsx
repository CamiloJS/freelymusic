import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  syncGlobalSettingsFromFirestore,
  saveGlobalSettingsToFirestore,
  subscribeToGlobalSettingsUpdates,
  GlobalAppSettings,
} from '../services/firebase';
import {
  getCustomAppIcon,
  setCustomAppIcon,
  removeCustomAppIcon,
  applyAppIcon,
} from '../utils/appIcon';

export type ThemeMode = 'dark' | 'light';

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
  globalIcons: string[];
  uploadGlobalIcon: (iconDataUrl: string) => Promise<void>;
  appIcon: string | null;
  selectIcon: (iconUrl: string) => void;
  resetIcon: () => void;
}

const CustomizationContext = createContext<CustomizationContextType | undefined>(undefined);

export const CustomizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Theme Mode (Dark vs Light)
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      return (saved === 'light' || saved === 'dark') ? saved : 'dark';
    } catch {
      return 'dark';
    }
  });

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

  // 3. App Name
  const [appName, setAppName] = useState<string>(() => {
    try {
      return localStorage.getItem(APP_NAME_STORAGE_KEY) || 'Música';
    } catch {
      return 'Música';
    }
  });

  // 4. Global Settings from Firestore (Global App Name & Admin Icon Gallery)
  const [globalIcons, setGlobalIcons] = useState<string[]>([]);
  const [appIcon, setAppIconState] = useState<string | null>(() => getCustomAppIcon());

  // Apply theme & accent to DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.style.setProperty('--brand-color', accentColor);
    document.documentElement.style.setProperty('--brand-hover', accentHover);
    localStorage.setItem(ACCENT_STORAGE_KEY, accentColor);
  }, [accentColor, accentHover]);

  useEffect(() => {
    document.title = appName || 'Música';
    localStorage.setItem(APP_NAME_STORAGE_KEY, appName);
  }, [appName]);

  // Sync Global Settings from Firestore (Cloud Gallery & Global App Name)
  useEffect(() => {
    syncGlobalSettingsFromFirestore().then((settings) => {
      if (settings) {
        if (settings.globalIcons && settings.globalIcons.length > 0) {
          setGlobalIcons(settings.globalIcons);
        }
        if (settings.globalAppName && !localStorage.getItem(APP_NAME_STORAGE_KEY)) {
          setAppName(settings.globalAppName);
        }
      }
    });

    const unsubscribe = subscribeToGlobalSettingsUpdates((settings: GlobalAppSettings) => {
      if (settings.globalIcons) {
        setGlobalIcons(settings.globalIcons);
      }
      if (settings.globalAppName) {
        // If user hasn't explicitly overridden local name, adopt global name
        const local = localStorage.getItem(APP_NAME_STORAGE_KEY);
        if (!local || local === 'Música') {
          setAppName(settings.globalAppName);
        }
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
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
  };

  const setGlobalAppName = async (name: string) => {
    const clean = name.trim() || 'Música';
    setAppName(clean);
    await saveGlobalSettingsToFirestore({ globalAppName: clean });
  };

  const uploadGlobalIcon = async (iconDataUrl: string) => {
    const updated = [iconDataUrl, ...globalIcons.filter((i) => i !== iconDataUrl)];
    setGlobalIcons(updated);
    await saveGlobalSettingsToFirestore({ globalIcons: updated });
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
