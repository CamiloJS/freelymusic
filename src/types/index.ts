export type UserRole = 'admin' | 'member';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  role: UserRole;
  pin?: string;
  createdAt: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  audioUrl: string;
  duration: number; // in seconds
  lyricsLrc?: string; // LRC formatted timestamped lyrics: [00:15.20] Hello...
  plainLyrics?: string;
  genre?: string;
  year?: string;
  trackNumber?: number;
  isExplicit?: boolean;
  addedBy?: string;
  createdAt: string;
}

export interface Album {
  name: string;
  artist: string;
  coverUrl: string;
  year?: string;
  genre?: string;
  songs: Song[];
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  userId: string;
  songIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserLibraryData {
  favoriteSongIds: string[];
  historySongIds: string[];
  playlists: Playlist[];
}

export interface LyricLine {
  time: number; // timestamp in seconds
  text: string;
}

export interface FirebaseConfigOptions {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}
