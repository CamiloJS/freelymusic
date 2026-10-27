import React, { useMemo, useState } from 'react';
import Search from 'lucide-react/dist/esm/icons/search.mjs';
import Clock from 'lucide-react/dist/esm/icons/clock.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Heart from 'lucide-react/dist/esm/icons/heart.mjs';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.mjs';
import Download from 'lucide-react/dist/esm/icons/download.mjs';
import { DownloadedIcon } from '../components/DownloadedIcon';
import { SavedCheckIcon } from '../components/SavedCheckIcon';
import Music from 'lucide-react/dist/esm/icons/music.mjs';
import Disc from 'lucide-react/dist/esm/icons/disc.mjs';
import Mic2 from 'lucide-react/dist/esm/icons/mic-vocal.mjs';
import UserCheck from 'lucide-react/dist/esm/icons/user-check.mjs';
import UserPlus from 'lucide-react/dist/esm/icons/user-plus.mjs';
import Users from 'lucide-react/dist/esm/icons/users.mjs';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { Song, Album, UserProfile } from '../types';
import { formatTime } from '../utils/lyrics';
import { getAlbumsFromCatalog } from '../utils/albums';
import { ArtistLinks } from '../components/ArtistLinks';
import {
  getRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from '../services/storage';

interface CloudSearchViewProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onOpenAddToPlaylist: (song: Song) => void;
  onSelectArtist?: (artistName: string) => void;
  onSelectAlbum?: (album: Album) => void;
  onSelectUserProfile?: (user: UserProfile) => void;
}

function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function findMatchingLyricSnippet(song: Song, query: string): string | null {
  if (!query || query.trim().length < 2) return null;
  const normQ = normalizeSearchText(query);
  const text = song.lyricsLrc || song.plainLyrics || '';
  if (!text) return null;

  const lines = text.split('\n');
  for (const rawLine of lines) {
    const clean = rawLine.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();
    if (!clean) continue;
    const normLine = normalizeSearchText(clean);
    if (normLine.includes(normQ)) {
      return clean;
    }
  }

  // Also check if all tokens of query match within a single line
  const tokens = normQ.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    for (const rawLine of lines) {
      const clean = rawLine.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();
      if (!clean) continue;
      const normLine = normalizeSearchText(clean);
      if (tokens.every((token) => normLine.includes(token))) {
        return clean;
      }
    }
  }

  return null;
}

function scoreSongSearch(song: Song, query: string): { score: number; snippet: string | null } {
  if (!query) return { score: 0, snippet: null };
  const normQ = normalizeSearchText(query);
  if (!normQ) return { score: 0, snippet: null };

  const normTitle = normalizeSearchText(song.title);
  const normArtist = normalizeSearchText(song.artist);
  const normAlbum = song.album ? normalizeSearchText(song.album) : '';
  const normGenre = song.genre ? normalizeSearchText(song.genre) : '';

  // Cross-field combinations (allows "Aitana En el coche" or "En el coche Aitana")
  const combined = `${normTitle} ${normArtist} ${normAlbum} ${normGenre} ${normArtist} ${normTitle}`;

  // 1. Exact match on title or artist
  if (normTitle === normQ) return { score: 100, snippet: null };
  if (normArtist === normQ) return { score: 95, snippet: null };

  // 2. Starts with query
  if (normTitle.startsWith(normQ)) return { score: 90, snippet: null };
  if (normArtist.startsWith(normQ)) return { score: 85, snippet: null };

  // 3. Substring match
  if (normTitle.includes(normQ)) return { score: 80, snippet: null };
  if (normArtist.includes(normQ)) return { score: 75, snippet: null };
  if (combined.includes(normQ)) return { score: 70, snippet: null };

  // 4. Token-level matching (all words in query must exist in combined song info)
  const tokens = normQ.split(/\s+/).filter(Boolean);
  if (tokens.length > 0) {
    const allTokensPresent = tokens.every((tok) => combined.includes(tok));
    if (allTokensPresent) {
      const titleMatches = tokens.filter((t) => normTitle.includes(t)).length;
      const artistMatches = tokens.filter((t) => normArtist.includes(t)).length;
      return { score: 50 + titleMatches * 10 + artistMatches * 8, snippet: null };
    }
  }

  // 5. Lyrics snippet search
  const snippet = findMatchingLyricSnippet(song, query);
  if (snippet) {
    return { score: 40, snippet };
  }

  return { score: 0, snippet: null };
}

export const CloudSearchView: React.FC<CloudSearchViewProps> = ({
  searchQuery,
  onSearchQueryChange,
  onOpenAddToPlaylist,
  onSelectArtist,
  onSelectAlbum,
  onSelectUserProfile,
}) => {
  const { currentUser, allUsers, updateProfile } = useAuth();
  const {
    catalog,
    isFavorite,
    toggleFavorite,
    isDownloaded,
    toggleDownloadSong,
    downloadSingleSongFile,
    getArtistProfile,
  } = useMusic();
  const { playSong, currentSong } = useAudio();

  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches());

  const matchedUsers = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];
    const hasAt = q.includes('@');
    const cleanQ = q.replace(/^@+/, '').toLowerCase().trim();

    return allUsers.filter((u) => {
      if (u.isProfilePublic === false && u.id !== currentUser.id) return false;
      if (hasAt && !cleanQ) return true;
      if (!cleanQ) return false;
      return (
        u.username.toLowerCase().includes(cleanQ) ||
        u.displayName.toLowerCase().includes(cleanQ)
      );
    });
  }, [allUsers, searchQuery, currentUser.id]);

  const handleToggleFollowUser = (targetUserId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const currentFollowing = currentUser.followingUserIds || [];
    const isFollowing = currentFollowing.includes(targetUserId);
    const nextFollowing = isFollowing
      ? currentFollowing.filter((id) => id !== targetUserId)
      : [...currentFollowing, targetUserId];

    updateProfile({
      ...currentUser,
      followingUserIds: nextFollowing,
    });
  };

  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];
    // If the query is strictly an '@' user query (e.g. '@laura'), do not match random songs unless there are no user matches
    if (q.startsWith('@')) return [];

    const scored = catalog
      .map((song) => {
        const result = scoreSongSearch(song, q);
        return { song, score: result.score };
      })
      .filter((item) => item.score > 0);

    scored.sort((a, b) => b.score - a.score);
    return scored.map((item) => item.song);
  }, [catalog, searchQuery]);

  const matchedArtists = useMemo(() => {
    const q = searchQuery.trim();
    if (!q || q.startsWith('@')) return [];
    const normQ = normalizeSearchText(q);

    // Group songs by artist name (handling multi-artists)
    const map = new Map<string, { name: string; songs: Song[] }>();

    for (const song of catalog) {
      if (!song.artist) continue;
      const parts = song.artist
        .split(/[,&/]|feat\.|ft\./i)
        .map((p) => p.trim())
        .filter(Boolean);

      const uniqueNames = Array.from(new Set([song.artist.trim(), ...parts]));
      for (const name of uniqueNames) {
        const key = name.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { name, songs: [] });
        }
        const entry = map.get(key)!;
        if (!entry.songs.some((s) => s.id === song.id)) {
          entry.songs.push(song);
        }
      }
    }

    const matches: Array<{
      name: string;
      photoUrl?: string;
      songCount: number;
      score: number;
      songs: Song[];
    }> = [];

    for (const entry of map.values()) {
      const normName = normalizeSearchText(entry.name);
      let score = 0;

      if (normName === normQ) {
        score = 100;
      } else if (normName.startsWith(normQ)) {
        score = 85;
      } else if (normName.includes(normQ)) {
        score = 65;
      } else {
        const words = normName.split(/\s+/);
        if (words.some((w) => w.startsWith(normQ))) {
          score = 75;
        }
      }

      if (score > 0) {
        const profile = getArtistProfile(entry.name);
        const photoUrl =
          profile?.avatarUrl || entry.songs.find((s) => Boolean(s.coverUrl))?.coverUrl;

        matches.push({
          name: entry.name,
          photoUrl,
          songCount: entry.songs.length,
          score,
          songs: entry.songs,
        });
      }
    }

    matches.sort((a, b) => b.score - a.score || b.songCount - a.songCount);
    return matches;
  }, [catalog, searchQuery, getArtistProfile]);

  const selectRecent = (term: string) => {
    onSearchQueryChange(term);
  };

  const handleRemoveRecent = (event: React.MouseEvent, term: string) => {
    event.stopPropagation();
    setRecentSearches(removeRecentSearch(term));
  };

  const handleClearRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto pb-32">
      {!searchQuery.trim() ? (
        <div className="max-w-2xl">
          <h1 className="text-3xl font-black text-white">Buscar</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Busca por título, artista, álbum o una frase de la letra.
          </p>

          {recentSearches.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2 text-base font-bold text-white">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  Búsquedas recientes
                </h2>
                <button
                  onClick={handleClearRecent}
                  className="text-[11px] text-neutral-500 hover:text-red-400 transition-colors"
                >
                  Borrar historial
                </button>
              </div>

              <div className="space-y-1">
                {recentSearches.map((term) => {
                  const matchedSong = catalog.find(
                    (song) => song.title.toLowerCase() === term.toLowerCase()
                  );
                  return (
                    <div
                      key={term}
                      onClick={() => selectRecent(term)}
                      className="flex items-center gap-3 rounded-xl p-2 hover:bg-neutral-900 cursor-pointer transition-colors group"
                    >
                      <div className="w-11 h-11 rounded-lg overflow-hidden bg-neutral-900 flex items-center justify-center flex-shrink-0">
                        {matchedSong?.coverUrl ? (
                          <img
                            src={matchedSong.coverUrl}
                            alt={term}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Search className="w-4 h-4 text-neutral-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate">{term}</p>
                        <p className="text-[11px] text-neutral-500 truncate">
                          {matchedSong
                            ? `${matchedSong.album} • ${matchedSong.artist}`
                            : 'Búsqueda reciente'}
                        </p>
                      </div>
                      <button
                        onClick={(event) => handleRemoveRecent(event, term)}
                        className="p-1.5 rounded-full text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Quitar de búsquedas recientes"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {recentSearches.length === 0 && (
            <div className="mt-10 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-8 text-center">
              <Search className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-neutral-300">
                Escribe en la barra superior para buscar
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                El catálogo completo está disponible aquí, pero no se muestra hasta que busques.
              </p>
              <button
                type="button"
                onClick={() => onSearchQueryChange('@')}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors shadow-sm"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Buscar perfiles y amigos con @</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-black text-white">Resultados</h1>
            <p className="text-sm text-neutral-400 mt-1">
              {searchQuery.trim().startsWith('@')
                ? `${matchedUsers.length} ${matchedUsers.length === 1 ? 'perfil encontrado' : 'perfiles encontrados'} para “${searchQuery.trim()}”`
                : `${filteredSongs.length + matchedUsers.length + matchedArtists.length} coincidencias para “${searchQuery.trim()}”`}
            </p>
          </div>

          {/* 1. Sección de Artistas (Aparece de PRIMERO) */}
          {matchedArtists.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Mic2 className="w-4 h-4 text-emerald-400" />
                <span>{matchedArtists[0].score >= 80 ? 'Mejor resultado' : 'Artistas'}</span>
                <span className="text-xs text-[#b3b3b3] font-normal">({matchedArtists.length})</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Top Artist Highlight Card */}
                <div
                  onClick={() => {
                    const updated = saveRecentSearch(matchedArtists[0].name);
                    setRecentSearches(updated);
                    onSelectArtist?.(matchedArtists[0].name);
                  }}
                  className="md:col-span-1 p-5 rounded-3xl bg-[#181818] hover:bg-[#222222] border border-[#282828] cursor-pointer transition-all duration-200 group relative flex flex-col justify-between shadow-lg"
                >
                  <div className="space-y-4">
                    <div className="relative w-24 h-24 rounded-full overflow-hidden bg-neutral-800 border-2 border-white/10 shadow-xl">
                      {matchedArtists[0].photoUrl ? (
                        <img
                          src={matchedArtists[0].photoUrl}
                          alt={matchedArtists[0].name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900 text-white font-bold text-2xl">
                          {matchedArtists[0].name.charAt(0)}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-2xl font-black text-white truncate group-hover:text-emerald-400 transition-colors">
                        {matchedArtists[0].name}
                      </h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-3 py-1 rounded-full bg-white/10 text-white text-[11px] font-bold uppercase tracking-wider">
                          Artista
                        </span>
                        <span className="text-xs text-[#b3b3b3]">
                          {matchedArtists[0].songCount} {matchedArtists[0].songCount === 1 ? 'canción' : 'canciones'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Floating play button */}
                  {matchedArtists[0].songs.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playSong(matchedArtists[0].songs[0], matchedArtists[0].songs, {
                          type: 'artist',
                          name: matchedArtists[0].name,
                          id: matchedArtists[0].name,
                        });
                      }}
                      className="absolute right-5 bottom-5 w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center shadow-xl opacity-90 group-hover:opacity-100 group-hover:scale-105 active:scale-95 transition-all"
                      title={`Reproducir canciones de ${matchedArtists[0].name}`}
                    >
                      <Play className="w-5 h-5 fill-black ml-0.5" />
                    </button>
                  )}
                </div>

                {/* Additional matched artists if any */}
                {matchedArtists.length > 1 && (
                  <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {matchedArtists.slice(1, 5).map((artist) => (
                      <div
                        key={artist.name}
                        onClick={() => {
                          const updated = saveRecentSearch(artist.name);
                          setRecentSearches(updated);
                          onSelectArtist?.(artist.name);
                        }}
                        className="p-4 rounded-2xl bg-[#181818] hover:bg-[#222222] border border-[#282828] cursor-pointer transition-all group flex flex-col items-center text-center shadow"
                      >
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-neutral-800 border border-white/10 mb-2.5 shadow">
                          {artist.photoUrl ? (
                            <img
                              src={artist.photoUrl}
                              alt={artist.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                              {artist.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-white truncate max-w-full group-hover:text-emerald-400">
                          {artist.name}
                        </h4>
                        <span className="text-[10px] text-[#b3b3b3] mt-0.5">Artista</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Perfiles y Amigos (@) Section */}
          {matchedUsers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Perfiles y amigos (@)</span>
                <span className="text-xs text-[#b3b3b3] font-normal">({matchedUsers.length})</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {matchedUsers.map((user) => {
                  const isFollowing = (currentUser.followingUserIds || []).includes(user.id);
                  const isMe = user.id === currentUser.id;
                  const activity = user.currentListeningSong;

                  return (
                    <div
                      key={user.id}
                      onClick={() => onSelectUserProfile?.(user)}
                      className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#181818] hover:bg-[#242424] border border-[#282828] cursor-pointer transition-all group shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative w-12 h-12 rounded-full overflow-hidden bg-[#242424] border border-white/10 flex-shrink-0 shadow">
                          <img
                            src={user.avatarUrl}
                            alt={user.displayName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          {user.shareListeningActivity && activity?.isPlaying && (
                            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#181818]" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                            {user.displayName} {isMe && <span className="text-xs text-[#b3b3b3] font-normal">(Tú)</span>}
                          </h4>
                          <p className="text-xs text-emerald-400 truncate">
                            @{user.username}
                          </p>
                          {user.shareListeningActivity && activity ? (
                            <p className="text-[11px] text-[#b3b3b3] truncate mt-0.5">
                              {activity.isPlaying ? `🎵 ${activity.title}` : activity.relativeTimeText || 'Reciente'}
                            </p>
                          ) : (
                            <p className="text-[11px] text-[#b3b3b3] truncate mt-0.5">
                              Perfil público
                            </p>
                          )}
                        </div>
                      </div>

                      {!isMe && (
                        <button
                          type="button"
                          onClick={(e) => handleToggleFollowUser(user.id, e)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 flex-shrink-0 shadow ${
                            isFollowing
                              ? 'bg-[#282828] text-white border border-white/10 hover:bg-[#333333]'
                              : 'bg-emerald-500 text-black hover:bg-emerald-400'
                          }`}
                        >
                          {isFollowing ? (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Siguiendo</span>
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Seguir</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Songs Section */}
          {searchQuery.trim().startsWith('@') && matchedUsers.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-12 text-center">
              <Users className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-neutral-300">
                No se encontraron perfiles para “{searchQuery.trim()}”
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Prueba buscando con el nombre de usuario o nombre completo.
              </p>
            </div>
          ) : !searchQuery.trim().startsWith('@') && filteredSongs.length === 0 && matchedUsers.length === 0 && matchedArtists.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-12 text-center">
              <Music className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-neutral-300">
                No se encontraron resultados para “{searchQuery.trim()}”
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Prueba con otra palabra del título, del artista o de la letra.
              </p>
            </div>
          ) : filteredSongs.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Music className="w-4 h-4 text-emerald-400" />
                <span>Canciones</span>
                <span className="text-xs text-[#b3b3b3] font-normal">({filteredSongs.length})</span>
              </div>
              <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-3xl overflow-hidden">
              <div className="p-4 border-b border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500 font-bold uppercase tracking-wider">
                <span>Canción</span>
                <div className="flex items-center gap-6 sm:gap-12 sm:pr-4">
                  <span className="hidden md:inline">Álbum</span>
                  <span className="hidden sm:inline">Duración</span>
                  <span>Acciones</span>
                </div>
              </div>

              <div className="divide-y divide-neutral-800/40">
                {filteredSongs.map((song, index) => {
                  const liked = isFavorite(song.id);
                  const downloaded = isDownloaded(song.id);
                  const isCurrent = currentSong?.id === song.id;
                  const lyricMatchSnippet = findMatchingLyricSnippet(song, searchQuery);

                  return (
                    <div
                      key={song.id}
                      onClick={() => {
                        const updated = saveRecentSearch(song.title);
                        setRecentSearches(updated);
                        playSong(song, filteredSongs);
                      }}
                      className={`flex items-center justify-between p-3.5 hover:bg-neutral-800/50 transition-colors cursor-pointer group ${
                        isCurrent ? 'bg-neutral-800/40' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3.5 min-w-0 flex-1 pr-2 md:max-w-md">
                        <span className="text-xs font-mono text-neutral-500 w-5 text-right flex-shrink-0 group-hover:hidden">
                          {index + 1}
                        </span>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            const updated = saveRecentSearch(song.title);
                            setRecentSearches(updated);
                            playSong(song, filteredSongs);
                          }}
                          className="w-5 text-emerald-400 flex-shrink-0 hidden group-hover:block"
                          title="Reproducir"
                        >
                          <Play className="w-4 h-4 fill-current" />
                        </button>

                        <div className="w-11 h-11 rounded-xl bg-neutral-800 overflow-hidden flex-shrink-0 shadow relative">
                          {song.coverUrl ? (
                            <img
                              src={song.coverUrl}
                              alt={song.title}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Music className="w-4 h-4 text-neutral-600 m-auto mt-3.5" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {song.isExplicit && (
                              <span
                                className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-neutral-600/80 text-white text-[9px] font-black flex-shrink-0 select-none leading-none"
                                title="Contenido explícito"
                              >
                                E
                              </span>
                            )}
                            <span
                              className={`block text-sm font-bold truncate ${
                                isCurrent ? 'text-emerald-400' : 'text-white'
                              }`}
                            >
                              {song.title}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-400 truncate mt-0.5">
                            {downloaded && (
                              <span className="flex-shrink-0" title="Descargado">
                                <DownloadedIcon size={12} />
                              </span>
                            )}
                            <ArtistLinks
                              artists={song.artist}
                              onSelectArtist={onSelectArtist || selectRecent}
                            />
                            {song.year ? <span>• {song.year}</span> : ''}
                          </div>

                          {lyricMatchSnippet && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400/90 font-medium truncate mt-1 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                              <Mic2 className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">Coincide letra: “{lyricMatchSnippet}”</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 sm:gap-6 md:gap-12 flex-shrink-0 pr-0 sm:pr-2">
                        {song.album && song.album.trim().toLowerCase() !== 'sencillo' ? (
                          <span
                            onClick={(event) => {
                              if (onSelectAlbum) {
                                event.stopPropagation();
                                const targetAlbum = getAlbumsFromCatalog(catalog).find(
                                  (album) =>
                                    album.name.trim().toLowerCase() ===
                                    song.album.trim().toLowerCase()
                                );
                                if (targetAlbum) onSelectAlbum(targetAlbum);
                              }
                            }}
                            className="hidden md:inline text-xs text-neutral-400 max-w-[140px] truncate hover:underline hover:text-white cursor-pointer"
                            title={`Abrir álbum ${song.album}`}
                          >
                            {song.album}
                          </span>
                        ) : (
                          <span className="hidden md:inline text-xs text-neutral-400 max-w-[140px] truncate">
                            {song.album || '—'}
                          </span>
                        )}

                        <span className="hidden sm:inline text-xs font-mono text-neutral-400">
                          {formatTime(song.duration)}
                        </span>

                        <div className="flex items-center gap-0.5 sm:gap-1">
                          {/* Chulito verde if liked, plus if not */}
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleFavorite(song.id);
                            }}
                            className={`p-1.5 sm:p-2 rounded-full transition-transform active:scale-90 ${
                              liked ? 'hover:scale-110' : 'text-neutral-400 hover:text-white hover:scale-110'
                            }`}
                            title={liked ? 'Guardada en tus favoritos (clic para quitar)' : 'Añadir a tus favoritos'}
                          >
                            {liked ? (
                              <SavedCheckIcon size={16} />
                            ) : (
                              <Plus className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenAddToPlaylist(song);
                            }}
                            className="p-1.5 sm:p-2 rounded-full text-neutral-500 hover:text-white transition-colors"
                            title="Añadir a una playlist"
                          >
                            <Plus className="w-4 h-4" />
                          </button>

                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              void toggleDownloadSong(song);
                            }}
                            className={`p-1.5 sm:p-2 rounded-full transition-colors ${
                              downloaded
                                ? 'text-emerald-400 hover:text-emerald-300'
                                : 'text-neutral-500 hover:text-white'
                            }`}
                            title={downloaded ? 'Descargado sin conexión' : 'Guardar en caché local'}
                          >
                            {downloaded ? (
                              <DownloadedIcon size={16} />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              void downloadSingleSongFile(song);
                            }}
                            className="p-2 rounded-full text-neutral-500 hover:text-white transition-colors hidden sm:block"
                            title="Descargar archivo al computador"
                          >
                            <Disc className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
