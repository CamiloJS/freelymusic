import React, { useState } from 'react';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Laptop from 'lucide-react/dist/esm/icons/laptop.mjs';
import Smartphone from 'lucide-react/dist/esm/icons/smartphone.mjs';
import Tablet from 'lucide-react/dist/esm/icons/tablet.mjs';
import Tv from 'lucide-react/dist/esm/icons/tv.mjs';
import Speaker from 'lucide-react/dist/esm/icons/speaker.mjs';
import Volume2 from 'lucide-react/dist/esm/icons/volume-2.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import Edit2 from 'lucide-react/dist/esm/icons/edit-2.mjs';
import Radio from 'lucide-react/dist/esm/icons/radio.mjs';
import { useConnect } from '../context/ConnectContext';
import { useAudio } from '../context/AudioContext';
import { ConnectDeviceType } from '../types';

interface ConnectDevicesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConnectDevicesModal: React.FC<ConnectDevicesModalProps> = ({ isOpen, onClose }) => {
  const {
    devices,
    currentDeviceId,
    currentDeviceName,
    activeDeviceId,
    activeDevice,
    isCurrentDeviceActive,
    transferPlaybackTo,
    transferPlaybackToHere,
    renameCurrentDevice,
  } = useConnect();
  const { transferToThisDevice } = useAudio();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(currentDeviceName);

  if (!isOpen) return null;

  const getDeviceIcon = (type: ConnectDeviceType, className = 'w-6 h-6') => {
    switch (type) {
      case 'smartphone':
        return <Smartphone className={className} />;
      case 'tablet':
        return <Tablet className={className} />;
      case 'tv':
        return <Tv className={className} />;
      case 'speaker':
        return <Speaker className={className} />;
      case 'computer':
      default:
        return <Laptop className={className} />;
    }
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editedName.trim()) {
      await renameCurrentDevice(editedName.trim());
      setIsEditingName(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-[#242424] sm:rounded-2xl rounded-t-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-white animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
            <h2 className="text-base font-bold text-white tracking-wide">
              Conectar a un dispositivo
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hero Current Playing Device Card */}
        <div className="px-5 pt-5 pb-4 bg-gradient-to-b from-emerald-950/40 via-transparent to-transparent flex-shrink-0">
          <div className="flex items-center gap-3.5 bg-black/30 p-3.5 rounded-xl border border-emerald-500/20">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 shadow-inner">
              {activeDevice ? getDeviceIcon(activeDevice.type, 'w-6 h-6') : <Speaker className="w-6 h-6" />}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                Estás escuchando en
              </span>
              <p className="text-sm font-bold text-white truncate mt-0.5">
                {activeDevice ? activeDevice.name : currentDeviceName}
                {activeDeviceId === currentDeviceId && (
                  <span className="ml-1.5 text-xs text-neutral-400 font-normal">
                    (Este dispositivo)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Device List */}
        <div className="px-5 py-2 flex-1 overflow-y-auto space-y-2">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
            Selecciona un dispositivo
          </p>

          {devices.map((device) => {
            const isThis = device.id === currentDeviceId;
            const isActive = device.id === activeDeviceId || (devices.length === 1 && isThis);

            return (
              <div
                key={device.id}
                onClick={async () => {
                  if (isThis) {
                    await transferToThisDevice();
                    onClose();
                  } else {
                    await transferPlaybackTo(device.id);
                  }
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                    : 'bg-neutral-800/60 hover:bg-neutral-800 border-white/5 text-neutral-200'
                }`}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-700/50 text-neutral-400'
                    }`}
                  >
                    {getDeviceIcon(device.type, 'w-5 h-5')}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className={`text-sm font-semibold truncate ${isActive ? 'text-emerald-400' : 'text-white'}`}>
                      {device.name}
                      {isThis && (
                        <span className="text-xs font-normal text-neutral-400 ml-1.5">
                          (Este dispositivo)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-neutral-400 truncate">
                      {isActive ? '● Escuchando ahora' : 'FreelyMusic Connect'}
                    </p>
                  </div>
                </div>

                {isActive ? (
                  <div className="flex items-center gap-1 text-emerald-400 flex-shrink-0 pl-2">
                    <Volume2 className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="text-xs font-medium text-neutral-400 hover:text-white flex-shrink-0 pl-2">
                    Cambiar
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Device Settings (Rename This Device) & Transfer Here CTA */}
        <div className="px-5 py-4 border-t border-white/10 bg-neutral-900/60 flex-shrink-0 space-y-3">
          {/* Quick transfer button if not active on this device */}
          {!isCurrentDeviceActive && (
            <button
              onClick={async () => {
                await transferToThisDevice();
                onClose();
              }}
              className="w-full py-2.5 px-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-98"
            >
              <Volume2 className="w-4 h-4" />
              Escuchar en este dispositivo
            </button>
          )}

          {/* Inline Rename current device */}
          {isEditingName ? (
            <form onSubmit={handleSaveName} className="flex items-center gap-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                maxLength={40}
                placeholder="Nombre del dispositivo"
                className="flex-1 bg-neutral-800 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                autoFocus
              />
              <button
                type="submit"
                className="p-1.5 bg-emerald-500 text-black rounded-lg text-xs font-bold hover:bg-emerald-400"
                title="Guardar"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditedName(currentDeviceName);
                  setIsEditingName(false);
                }}
                className="p-1.5 bg-neutral-700 text-neutral-300 rounded-lg text-xs hover:bg-neutral-600"
                title="Cancelar"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span className="truncate">
                Nombre local: <strong className="text-neutral-200">{currentDeviceName}</strong>
              </span>
              <button
                onClick={() => {
                  setEditedName(currentDeviceName);
                  setIsEditingName(true);
                }}
                className="inline-flex items-center gap-1 text-emerald-400 hover:underline ml-2 flex-shrink-0"
              >
                <Edit2 className="w-3 h-3" />
                Editar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
