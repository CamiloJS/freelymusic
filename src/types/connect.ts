export type ConnectDeviceType = 'computer' | 'smartphone' | 'tablet' | 'tv' | 'speaker';

export interface ConnectDevice {
  id: string;
  name: string;
  type: ConnectDeviceType;
  lastSeenMs: number;
  isActive: boolean;
}

export interface ConnectPlaybackState {
  songId: string;
  versionId?: string | null;
  isKaraoke?: boolean;
  isVideoMode?: boolean;
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
  timestampMs: number;
  volume: number;
  repeatMode: 'off' | 'all' | 'one';
  isShuffle: boolean;
}

export type ConnectActionType =
  | 'play'
  | 'pause'
  | 'seek'
  | 'next'
  | 'prev'
  | 'volume'
  | 'playSong'
  | 'transfer';

export interface ConnectCommand {
  id: string;
  issuedByDeviceId: string;
  targetDeviceId: string;
  action: ConnectActionType;
  param?: any;
  timestampMs: number;
}

export interface ConnectSession {
  userId: string;
  activeDeviceId: string;
  devices: ConnectDevice[];
  playback?: ConnectPlaybackState;
  command?: ConnectCommand | null;
  updatedAtMs: number;
}
