export type UserRole = 'admin' | 'member';

export interface UserListeningActivity {
  title: string;
  artist: string;
  coverUrl?: string;
  album?: string;
  startedAt?: string;
  relativeTimeText?: string;
  isPlaying?: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  role: UserRole;
  pin?: string;
  createdAt: string;
  // Social & Privacy Settings
  isFavoritesPublic?: boolean;
  shareListeningActivity?: boolean;
  isProfilePublic?: boolean;
  currentListeningSong?: UserListeningActivity;
  followingUserIds?: string[];
}

export interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
  songAttachment?: {
    id: string;
    title: string;
    artist: string;
    coverUrl: string;
  };
}

export interface ChatThread {
  id: string;
  participantIds: string[];
  displayName: string;
  avatarUrl?: string;
  subtitle: string;
  lastMessageTime: string;
  unread?: boolean;
}

export type SongVersionType =
  | 'original'
  | 'cover'
  | 'instrumental'
  | 'remix'
  | 'live'
  | 'other';

/**
 * Alternative versions (cover, instrumental, live...) live inside the same
 * song document. They never appear as separate tracks in the library.
 */
export interface SongVersion {
  id: string;
  label: string;
  type: SongVersionType;
  audioUrl: string;
  duration?: number;
  lyricsLrc?: string;
  plainLyrics?: string;
  videoUrl?: string;
  instrumentalUrl?: string;
  instrumentalLyricsLrc?: string;
  instrumentalOffset?: number;
  language?: string;
  createdAt?: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  coverUrl: string;
  audioUrl: string;
  duration: number; // in seconds
  lyricsLrc?: string; // LRC formatted timestamped lyrics: [00:15.20] Hello...
  plainLyrics?: string;
  genre?: string;
  year?: string;
  trackNumber?: number;
  discNumber?: number;
  isExplicit?: boolean;
  addedBy?: string;
  createdAt: string;

  // Video clip (direct MP4/WebM; never a YouTube/Spotify embed)
  videoUrl?: string;

  // Karaoke for the main/original version
  instrumentalUrl?: string;
  instrumentalLyricsLrc?: string;
  instrumentalOffset?: number;

  // Alternative versions associated with this same song
  versions?: SongVersion[];

  // Standard identifiers used for imports / enrichment
  isrc?: string;

  // Metadata enrichment state
  needsReview?: boolean;
  enrichmentNote?: string;
}

export interface Album {
  name: string;
  artist: string;
  coverUrl: string;
  year?: string;
  genre?: string;
  songs: Song[];
  totalDiscs?: number;
}

export interface ArtistProfile {
  id: string; // normalized artist name, e.g. "aitana"
  name: string;
  avatarUrl?: string;
  headerUrl?: string;
  bio?: string;
  updatedAt?: string;
  aliases?: string[]; // e.g. ["J. Balvin", "J Balvin", "José Álvaro Osorio"]
  mergedInto?: string; // Canonical artist name if this artist is merged into another
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  isPublic?: boolean;
  userId: string;
  songIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PlayEvent {
  songId: string;
  playedAt: string;
}

export interface UserLibraryData {
  favoriteSongIds: string[];
  historySongIds: string[];
  playlists: Playlist[];
  /** Normalized artist names the user follows. */
  followedArtists?: string[];
  /** Custom playlists pinned at the top of the library. */
  pinnedPlaylistIds?: string[];
  /** Saved albums in user's library. */
  savedAlbumNames?: string[];
  playCounts?: Record<string, number>; // songId -> user play count
  playHistory?: PlayEvent[]; // user play history for Top tracks / Wrapped
  totalListenSeconds?: number; // accumulated listening time
  songListenSeconds?: Record<string, number>; // songId -> seconds listened
  artistListenSeconds?: Record<string, number>; // primary artist -> seconds listened
  updatedAt?: string; // last local write, used for cross-device conflict resolution
}

export interface GlobalStatsCacheEntry {
  key: string;
  type: 'artist' | 'track';
  name: string;
  artist?: string;
  source: 'last.fm' | 'deezer';
  listeners?: number;
  playcount?: number;
  fans?: number;
  rank?: number;
  url?: string;
  fetchedAt: string;
  period?: string;
  note?: string;
}

export interface LyricsTranslation {
  id: string;
  songId: string;
  versionId: string; // 'original' or a SongVersion id
  lang: string;
  sourceLang: string;
  sourceHash: string;
  lines: LyricLine[];
  provider: string;
  updatedAt: string;
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
