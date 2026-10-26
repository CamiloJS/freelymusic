import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCustomization } from '../context/CustomizationContext';
import KeyRound from 'lucide-react/dist/esm/icons/key-round.mjs';
import LogIn from 'lucide-react/dist/esm/icons/log-in.mjs';
import Lock from 'lucide-react/dist/esm/icons/lock.mjs';
import Music2 from 'lucide-react/dist/esm/icons/eighth-note.mjs';
import User from 'lucide-react/dist/esm/icons/user.mjs';
import Eye from 'lucide-react/dist/esm/icons/eye.mjs';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off.mjs';

export const LoginLockScreen: React.FC = () => {
  const { loginWithCredentials } = useAuth();
  const { appName, appIcon } = useCustomization();

  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!usernameInput.trim()) {
      setErrorMsg('Por favor ingresa tu nombre de usuario.');
      return;
    }

    if (!passwordInput.trim()) {
      setErrorMsg('Por favor ingresa tu contraseña o PIN.');
      return;
    }

    setIsLoading(true);
    const result = loginWithCredentials(usernameInput, passwordInput);
    if (!result.success) {
      setErrorMsg(result.error || 'Usuario o contraseña incorrectos.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950 flex flex-col items-center justify-center p-6 select-none overflow-y-auto">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="relative z-10 flex flex-col items-center text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-2xl shadow-emerald-500/30 mb-3 overflow-hidden">
          {appIcon ? (
            <img src={appIcon} alt={appName} className="w-full h-full object-cover" />
          ) : (
            <Music2 className="w-8 h-8 text-black" />
          )}
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">{appName}</h1>
        <p className="text-xs uppercase tracking-widest text-emerald-400 font-bold mt-1">
          Tu Repositorio Personal de Música
        </p>
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Secure Credentials Login Box */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95">
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-white">Iniciar Sesión</h2>
            <p className="text-xs text-neutral-400 mt-1">
              Ingresa tu usuario y contraseña para acceder
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* Username Input */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-bold text-neutral-300">
                Usuario
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  autoFocus
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={usernameInput}
                  onChange={(e) => {
                    setUsernameInput(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Tu nombre de usuario (ej: camilo)"
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 text-sm text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Password / PIN Input */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-bold text-neutral-300">
                Contraseña / PIN
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Tu contraseña o PIN"
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 text-sm text-white rounded-xl py-3 pl-10 pr-10 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors p-1"
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-950/60 border border-red-500/30 rounded-xl text-xs text-red-300 text-center font-medium">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !usernameInput.trim() || !passwordInput.trim()}
              className="w-full py-3.5 mt-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all transform active:scale-[0.99]"
            >
              <LogIn className="w-4 h-4 stroke-[2.5]" />
              <span>{isLoading ? 'Comprobando...' : 'Iniciar Sesión'}</span>
            </button>
          </form>
        </div>
      </div>

      <div className="relative z-10 text-center mt-10 text-[11px] text-neutral-600">
        Sesión protegida &bull; Libre de rastreo &bull; Base de datos en la nube
      </div>
    </div>
  );
};
