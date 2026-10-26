import React, { useState, useEffect } from 'react';
import Download from 'lucide-react/dist/esm/icons/download.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Smartphone from 'lucide-react/dist/esm/icons/smartphone.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  const DISMISSED_KEY = 'musica_install_banner_seen';

  useEffect(() => {
    // If the user already saw/dismissed the prompt once, never show it again
    if (localStorage.getItem(DISMISSED_KEY) === 'true') {
      return;
    }

    // Check if running as standalone PWA
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as unknown as { standalone?: boolean }).standalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(iosDevice);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
      localStorage.setItem(DISMISSED_KEY, 'true');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // If on iOS and not standalone, show prompt after a short delay (once only)
    if (iosDevice && !isInstalled) {
      const timer = setTimeout(() => {
        setShowBanner(true);
        localStorage.setItem(DISMISSED_KEY, 'true');
      }, 2500);
      return () => clearTimeout(timer);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, [isInstalled]);

  const handleInstallClick = async () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setShowBanner(false);
  };

  if (!showBanner || isInstalled) return null;

  return (
    <div className="fixed bottom-24 right-4 md:right-8 z-50 max-w-sm bg-neutral-900/95 border border-neutral-700/80 p-4 rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
            <Smartphone className="w-6 h-6 text-black" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">Instalar Música</h4>
            <p className="text-xs text-neutral-400 mt-0.5">
              Instala la aplicación para escuchar y descargar tu música sin conexión.
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-neutral-500 hover:text-white p-1 rounded-lg transition-colors"
          title="Cerrar y no volver a mostrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 pt-3 border-t border-neutral-800">
        {isIOS ? (
          <p className="text-xs text-emerald-400 font-medium">
            En Safari: toca el botón <span className="font-bold">Compartir</span> y selecciona <span className="font-bold">"Añadir a la pantalla de inicio"</span>.
          </p>
        ) : (
          <button
            onClick={handleInstallClick}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs tracking-wide transition-all shadow-md active:scale-95"
          >
            <Download className="w-4 h-4" />
            Instalar App
          </button>
        )}
      </div>
    </div>
  );
};
