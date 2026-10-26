import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import { Shield, KeyRound, ArrowLeft, LogIn, Lock, Music2 } from 'lucide-react';

export const LoginLockScreen: React.FC = () => {
  const { allUsers, login } = useAuth();
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleProfileClick = (user: UserProfile) => {
    setErrorMsg('');
    setPinInput('');
    if (user.pin && user.pin.trim() !== '') {
      setSelectedUser(user);
    } else {
      // No pin set, login directly
      const result = login(user.id);
      if (!result.success && result.error) {
        setErrorMsg(result.error);
      }
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const result = login(selectedUser.id, pinInput);
    if (!result.success) {
      setErrorMsg(result.error || 'PIN incorrecto.');
      setPinInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950 flex flex-col items-center justify-center p-6 select-none overflow-y-auto">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="relative z-10 flex flex-col items-center text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-2xl shadow-emerald-500/30 mb-3">
          <Music2 className="w-8 h-8 text-black" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Música</h1>
        <p className="text-xs uppercase tracking-widest text-emerald-400 font-bold mt-1">
          Tu Repositorio Personal en la Nube
        </p>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {!selectedUser ? (
          /* Profile Picker Screen */
          <div className="text-center space-y-6">
            <h2 className="text-xl md:text-2xl font-bold text-neutral-200">
              ¿Quién está escuchando?
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
              {allUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleProfileClick(user)}
                  className="group flex flex-col items-center p-3 rounded-2xl hover:bg-neutral-900/80 transition-all transform hover:-translate-y-1 focus:outline-none"
                >
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden mb-3 ring-2 ring-neutral-800 group-hover:ring-emerald-500 shadow-lg group-hover:shadow-emerald-500/20 transition-all">
                    <img
                      src={user.avatarUrl}
                      alt={user.displayName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {user.role === 'admin' && (
                      <div className="absolute bottom-0 right-0 p-1 bg-emerald-500 rounded-full text-black" title="Administrador">
                        <Shield className="w-3.5 h-3.5 fill-black" />
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-neutral-300 group-hover:text-white truncate max-w-[110px]">
                    {user.displayName}
                  </span>
                  <span className="text-[11px] text-neutral-500 capitalize">
                    {user.role === 'admin' ? 'Administrador' : 'Miembro'}
                  </span>
                </button>
              ))}
            </div>

            {errorMsg && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-500/20 py-2 px-3 rounded-lg">
                {errorMsg}
              </p>
            )}
          </div>
        ) : (
          /* PIN Entry Form */
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95">
            <button
              onClick={() => {
                setSelectedUser(null);
                setPinInput('');
                setErrorMsg('');
              }}
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Cambiar de perfil</span>
            </button>

            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-emerald-500/50 mb-3 shadow-lg">
                <img
                  src={selectedUser.avatarUrl}
                  alt={selectedUser.displayName}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-lg font-bold text-white">{selectedUser.displayName}</h3>
              <p className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>Introduce tu PIN para acceder</span>
              </p>
              {selectedUser.id === 'camilo-admin' && (
                <p className="text-[11px] text-neutral-500 mt-1">
                  (PIN predeterminado: <span className="text-emerald-400 font-mono font-bold">1234</span>)
                </p>
              )}
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div className="relative">
                <KeyRound className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  maxLength={8}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Introduce tu PIN"
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 text-center tracking-[0.5em] text-lg font-mono text-white rounded-xl py-3 px-10 focus:outline-none transition-colors"
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-red-400 text-center bg-red-950/40 border border-red-500/20 py-2 rounded-lg">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={!pinInput.trim()}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-black font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>Ingresar a Música</span>
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="relative z-10 text-center mt-12 text-[11px] text-neutral-600">
        Sesión privada y cifrada &bull; Acceso sincronizado en tiempo real con Google Firebase
      </div>
    </div>
  );
};
