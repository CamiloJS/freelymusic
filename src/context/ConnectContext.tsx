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

const HEARTBEAT_INTERVAL_MS = 75000; // 75 seconds
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
    return deviceList.filter((d) => d.lastSeenMs > cutoff);
  }, []);

  // Heartbeat & Registration
  const syncHeartbeat = useCallback(async () => {
    if (!isAuthenticated || !currentUser?.id) return;
    try {
      const fb = await loadFirebaseService();
      const current = latestSessionRef.current;
      const now = Date.now();

      const existingDevices = current?.devices ? cleanDevices(current.devices) : [];
      const updatedDevices = existingDevices.filter((d) => d.id !== currentDeviceId);
      updatedDevices.unshift({
        id: currentDeviceId,
        name: currentDeviceNameRef.current,
        type: currentDeviceType,
        lastSeenMs: now,
        isActive: current?.activeDeviceId === currentDeviceId,
      });

      // If activeDeviceId is missing or dead, assign to current device
      let activeId = current?.activeDeviceId;
      if (!activeId || !updatedDevices.some((d) => d.id === activeId)) {
        activeId = currentDeviceId;
      }

      await fb.saveConnectSessionToFirestore(currentUser.id, {
        activeDeviceId: activeId,
        devices: updatedDevices,
      });
    } catch (err) {
      console.warn('Connect heartbeat error:', err);
    }
  }, [currentUser?.id, currentDeviceId, currentDeviceType, cleanDevices, isAuthenticated]);

  // Subscribe to realtime updates for this user's connect session
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) {
      setSession(null);
      return;
    }

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    loadFirebaseService()
      .then((fb) => {
        if (cancelled) return;
        return fb.subscribeToConnectSessionUpdates(currentUser.id, (remoteSession) => {
          if (cancelled) return;
          if (!remoteSession) {
            // First time this user uses Connect, initiate heartbeat
            void syncHeartbeat();
            return;
          }

          setSession(remoteSession);

          // Check if there is a command directed to this device
          if (
            remoteSession.command &&
            remoteSession.command.targetDeviceId === currentDeviceId &&
            remoteSession.command.id !== lastProcessedCommandIdRef.current
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

    // Run initial heartbeat
    void syncHeartbeat();

    // Set recurring heartbeat interval (only while tab is alive)
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void syncHeartbeat();
      }
    }, HEARTBEAT_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncHeartbeat();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser?.id, isAuthenticated, syncHeartbeat, currentDeviceId]);

  // Consume an incoming command once handled by audio player
  const consumeIncomingCommand = useCallback((commandId: string) => {
    setIncomingCommand((prev) => (prev?.id === commandId ? null : prev));
  }, []);

  // Compute active device & devices list
  const activeDeviceId = session?.activeDeviceId || null;
  const activeDevices = session?.devices ? cleanDevices(session.devices) : [];
  
  // Ensure this device appears in list
  const allDevices: ConnectDevice[] = (() => {
    const list = [...activeDevices];
    if (!list.some((d) => d.id === currentDeviceId)) {
      list.unshift({
        id: currentDeviceId,
        name: currentDeviceName,
        type: currentDeviceType,
        lastSeenMs: Date.now(),
        isActive: activeDeviceId === currentDeviceId || !activeDeviceId,
      });
    }
    return list.map((d) => ({
      ...d,
      isActive: d.id === activeDeviceId || (!activeDeviceId && d.id === currentDeviceId),
    }));
  })();

  const isCurrentDeviceActive =
    activeDeviceId === currentDeviceId || (!activeDeviceId && allDevices.length <= 1);
  const activeDevice = allDevices.find((d) => d.isActive) || null;
  const isRemoteControl = !isCurrentDeviceActive && Boolean(activeDevice);

  // Send command from remote controller to active device
  const sendCommand = useCallback(
    async (action: ConnectActionType, param?: any) => {
      if (!currentUser?.id) return;
      try {
        const targetId = latestSessionRef.current?.activeDeviceId || currentDeviceId;
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

  // Active device publishes playback state (songId, isPlaying, positionSec, etc.)
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
