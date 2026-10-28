import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  ConnectDevice,
  ConnectSession,
  ConnectPlaybackState,
  ConnectCommand,
  ConnectActionType,
  ConnectDeviceType,
} from '../types';
import { useAuth } from './AuthContext';
import {
  getOrCreateDeviceId,
  detectDeviceType,
  getStoredDeviceName,
  setStoredDeviceName,
} from '../utils/deviceInfo';
import { loadFirebaseService } from '../services/firebaseLoader';

const HEARTBEAT_INTERVAL_MS = 60000; // 60 seconds
const DEVICE_TIMEOUT_MS = 180000; // 3 minutes timeout for inactive devices

interface ConnectContextType {
  currentDeviceId: string;
  currentDeviceName: string;
  currentDeviceType: ConnectDeviceType;
  devices: ConnectDevice[];
  activeDeviceId: string | null;
  activeDevice: ConnectDevice | null;
  isCurrentDeviceActive: boolean;
  isRemoteControl: boolean;
  isSessionLoaded: boolean;
  remotePlayback: ConnectPlaybackState | null;
  isConnectModalOpen: boolean;
  setIsConnectModalOpen: (open: boolean) => void;
  transferPlaybackTo: (targetDeviceId: string) => Promise<void>;
  transferPlaybackToHere: () => Promise<void>;
  sendCommand: (action: ConnectActionType, param?: any) => Promise<void>;
  publishPlaybackState: (state: Partial<ConnectPlaybackState>) => Promise<void>;
  renameCurrentDevice: (name: string) => Promise<void>;
  incomingCommand: ConnectCommand | null;
  consumeIncomingCommand: (commandId: string) => void;
}

const ConnectContext = createContext<ConnectContextType | undefined>(undefined);

export const ConnectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();
  const currentDeviceId = useRef<string>(getOrCreateDeviceId()).current;
  const currentDeviceType = useRef<ConnectDeviceType>(detectDeviceType()).current;
  const [currentDeviceName, setCurrentDeviceNameState] = useState<string>(getStoredDeviceName);

  const [session, setSession] = useState<ConnectSession | null>(null);
  const [isSessionLoaded, setIsSessionLoaded] = useState<boolean>(false);
  const [incomingCommand, setIncomingCommand] = useState<ConnectCommand | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);

  const lastProcessedCommandIdRef = useRef<string | null>(null);
  const latestSessionRef = useRef<ConnectSession | null>(null);
  latestSessionRef.current = session;

  const currentDeviceNameRef = useRef<string>(currentDeviceName);
  currentDeviceNameRef.current = currentDeviceName;

  // Filter out devices not seen in the last DEVICE_TIMEOUT_MS
  const cleanDevices = useCallback((deviceList: ConnectDevice[]): ConnectDevice[] => {
    const cutoff = Date.now() - DEVICE_TIMEOUT_MS;
    return (deviceList || []).filter((d) => d && typeof d.lastSeenMs === 'number' && d.lastSeenMs > cutoff);
  }, []);

  // Update or register this device without hijacking activeDeviceId
  const registerHeartbeat = useCallback(
    async (existingSession?: ConnectSession | null) => {
      if (!isAuthenticated || !currentUser?.id) return;
      try {
        const fb = await loadFirebaseService();
        const base = existingSession ?? latestSessionRef.current;
        const now = Date.now();

        const rawDevices = base?.devices ? cleanDevices(base.devices) : [];
        const existingActiveId = base?.activeDeviceId;
        const hasValidActiveDevice =
          Boolean(existingActiveId) && rawDevices.some((d) => d.id === existingActiveId);

        // Preserve activeDeviceId if one is alive; only if completely empty, default to this device
        let targetActiveId: string;
        if (hasValidActiveDevice && existingActiveId) {
          targetActiveId = existingActiveId;
        } else if (rawDevices.length > 0) {
          targetActiveId = existingActiveId || rawDevices[0].id;
        } else {
          targetActiveId = currentDeviceId;
        }

        const myDevice: ConnectDevice = {
          id: currentDeviceId,
          name: currentDeviceNameRef.current,
          type: currentDeviceType,
          lastSeenMs: now,
          isActive: targetActiveId === currentDeviceId,
        };

        const updatedDevices = rawDevices.filter((d) => d.id !== currentDeviceId);
        updatedDevices.unshift(myDevice);

        await fb.saveConnectSessionToFirestore(currentUser.id, {
          activeDeviceId: targetActiveId,
          devices: updatedDevices,
        });
      } catch (err) {
        console.warn('Connect heartbeat registration error:', err);
      }
    },
    [currentUser?.id, currentDeviceId, currentDeviceType, cleanDevices, isAuthenticated]
  );

  // Realtime subscription to the user's Connect Session
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) {
      setSession(null);
      setIsSessionLoaded(false);
      return;
    }

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    let initialRegistered = false;

    loadFirebaseService()
      .then((fb) => {
        if (cancelled) return;
        return fb.subscribeToConnectSessionUpdates(currentUser.id, (remoteSession) => {
          if (cancelled) return;
          setIsSessionLoaded(true);
          setSession(remoteSession);

          // On first snapshot, register this device into devices list
          if (!initialRegistered) {
            initialRegistered = true;
            void registerHeartbeat(remoteSession);
          }

          // Check if there is an incoming command for this device (only if issued in the last 15 seconds)
          if (
            remoteSession?.command &&
            remoteSession.command.targetDeviceId === currentDeviceId &&
            remoteSession.command.id !== lastProcessedCommandIdRef.current &&
            typeof remoteSession.command.timestampMs === 'number' &&
            Date.now() - remoteSession.command.timestampMs < 15000
          ) {
            lastProcessedCommandIdRef.current = remoteSession.command.id;
            setIncomingCommand(remoteSession.command);
          }
        });
      })
      .then((unsub) => {
        if (unsub) unsubscribe = unsub;
      })
      .catch((err) => {
        console.warn('Error subscribing to connect session:', err);
      });

    // Heartbeat every 60s while tab is visible
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void registerHeartbeat();
      }
    }, HEARTBEAT_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void registerHeartbeat();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser?.id, isAuthenticated, registerHeartbeat, currentDeviceId]);

  // Consume an incoming command once handled by audio player
  const consumeIncomingCommand = useCallback((commandId: string) => {
    setIncomingCommand((prev) => (prev?.id === commandId ? null : prev));
  }, []);

  // Compute active device & devices list
  const activeDeviceId = session?.activeDeviceId || null;
  const activeDevices = session?.devices ? cleanDevices(session.devices) : [];

  const allDevices: ConnectDevice[] = (() => {
    const list = [...activeDevices];
    if (!list.some((d) => d.id === currentDeviceId)) {
      list.unshift({
        id: currentDeviceId,
        name: currentDeviceName,
        type: currentDeviceType,
        lastSeenMs: Date.now(),
        isActive: activeDeviceId === currentDeviceId,
      });
    }
    return list.map((d) => ({
      ...d,
      isActive: d.id === activeDeviceId,
    }));
  })();

  // While session is loading, do NOT assume active to avoid clobbering remote host
  const isCurrentDeviceActive = isSessionLoaded
    ? (activeDeviceId ? activeDeviceId === currentDeviceId : true)
    : false;

  const activeDevice = allDevices.find((d) => d.id === activeDeviceId) || null;
  const isRemoteControl = isSessionLoaded && !isCurrentDeviceActive && Boolean(activeDeviceId && activeDeviceId !== currentDeviceId);

  // Send command from remote controller to active playback device
  const sendCommand = useCallback(
    async (action: ConnectActionType, param?: any) => {
      if (!currentUser?.id) return;
      const targetId = latestSessionRef.current?.activeDeviceId;
      if (!targetId || targetId === currentDeviceId) {
        console.warn('Cannot send remote command: no other active device to target');
        return;
      }

      try {
        const command: ConnectCommand = {
          id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          issuedByDeviceId: currentDeviceId,
          targetDeviceId: targetId,
          action,
          param,
          timestampMs: Date.now(),
        };

        const fb = await loadFirebaseService();
        await fb.saveConnectSessionToFirestore(currentUser.id, {
          command,
        });
      } catch (err) {
        console.warn('Failed to send connect command:', err);
      }
    },
    [currentUser?.id, currentDeviceId]
  );

  // Transfer playback to another device
  const transferPlaybackTo = useCallback(
    async (targetDeviceId: string) => {
      if (!currentUser?.id) return;
      try {
        const fb = await loadFirebaseService();
        const current = latestSessionRef.current;
        const devices = current?.devices ? cleanDevices(current.devices) : [];

        const updatedDevices = devices.map((d) => ({
          ...d,
          isActive: d.id === targetDeviceId,
        }));

        const command: ConnectCommand = {
          id: `cmd_transfer_${Date.now()}`,
          issuedByDeviceId: currentDeviceId,
          targetDeviceId,
          action: 'transfer',
          param: { targetDeviceId },
          timestampMs: Date.now(),
        };

        await fb.saveConnectSessionToFirestore(currentUser.id, {
          activeDeviceId: targetDeviceId,
          devices: updatedDevices,
          command,
        });
      } catch (err) {
        console.warn('Failed to transfer playback:', err);
      }
    },
    [currentUser?.id, currentDeviceId, cleanDevices]
  );

  const transferPlaybackToHere = useCallback(async () => {
    await transferPlaybackTo(currentDeviceId);
  }, [transferPlaybackTo, currentDeviceId]);

  // Active device publishes playback state
  const publishPlaybackState = useCallback(
    async (playbackUpdate: Partial<ConnectPlaybackState>) => {
      if (!currentUser?.id || !isCurrentDeviceActive) return;
      try {
        const fb = await loadFirebaseService();
        const currentState = latestSessionRef.current?.playback;
        const mergedPlayback: ConnectPlaybackState = {
          songId: playbackUpdate.songId ?? currentState?.songId ?? '',
          versionId: playbackUpdate.versionId !== undefined ? playbackUpdate.versionId : currentState?.versionId,
          isKaraoke: playbackUpdate.isKaraoke ?? currentState?.isKaraoke ?? false,
          isVideoMode: playbackUpdate.isVideoMode ?? currentState?.isVideoMode ?? false,
          isPlaying: playbackUpdate.isPlaying ?? currentState?.isPlaying ?? false,
          positionSec: playbackUpdate.positionSec ?? currentState?.positionSec ?? 0,
          durationSec: playbackUpdate.durationSec ?? currentState?.durationSec ?? 0,
          timestampMs: Date.now(),
          volume: playbackUpdate.volume ?? currentState?.volume ?? 0.85,
          repeatMode: playbackUpdate.repeatMode ?? currentState?.repeatMode ?? 'off',
          isShuffle: playbackUpdate.isShuffle ?? currentState?.isShuffle ?? false,
        };

        await fb.saveConnectSessionToFirestore(currentUser.id, {
          playback: mergedPlayback,
        });
      } catch (err) {
        console.warn('Failed to publish playback state:', err);
      }
    },
    [currentUser?.id, isCurrentDeviceActive]
  );

  // Rename current device
  const renameCurrentDevice = useCallback(
    async (newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed || !currentUser?.id) return;
      setStoredDeviceName(trimmed);
      setCurrentDeviceNameState(trimmed);

      try {
        const fb = await loadFirebaseService();
        const current = latestSessionRef.current;
        if (!current?.devices) return;

        const updatedDevices = current.devices.map((d) =>
          d.id === currentDeviceId ? { ...d, name: trimmed } : d
        );

        await fb.saveConnectSessionToFirestore(currentUser.id, {
          devices: updatedDevices,
        });
      } catch (err) {
        console.warn('Failed to rename device in Firestore:', err);
      }
    },
    [currentUser?.id, currentDeviceId]
  );

  return (
    <ConnectContext.Provider
      value={{
        currentDeviceId,
        currentDeviceName,
        currentDeviceType,
        devices: allDevices,
        activeDeviceId,
        activeDevice,
        isCurrentDeviceActive,
        isRemoteControl,
        isSessionLoaded,
        remotePlayback: session?.playback || null,
        isConnectModalOpen,
        setIsConnectModalOpen,
        transferPlaybackTo,
        transferPlaybackToHere,
        sendCommand,
        publishPlaybackState,
        renameCurrentDevice,
        incomingCommand,
        consumeIncomingCommand,
      }}
    >
      {children}
    </ConnectContext.Provider>
  );
};

export const useConnect = (): ConnectContextType => {
  const context = useContext(ConnectContext);
  if (!context) {
    throw new Error('useConnect must be used within a ConnectProvider');
  }
  return context;
};
